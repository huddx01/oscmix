"use strict";

/*
 * EQGraph — reusable canvas-based EQ curve renderer with mouse/touch
 * interaction. Uses a 48 kHz biquad model; identical math to roomEq.
 *
 * The graph is *stateless* w.r.t. band data: it asks the caller for bands
 * via `getBands()` on every draw, and reports edits via callbacks. The
 * caller owns the data and decides what to do (update knobs, send OSC,
 * mirror to a linked side, etc.) before calling `graph.draw()` again.
 *
 * Required option:
 *   getBands(): Array<{ type, gain, freq, q }>
 *
 * Optional options:
 *   getInactiveBands():    Array | null         — ghost curve (e.g. other stereo side)
 *   isBypassed():          boolean              — dimmed style when true
 *   getActiveColor():      { accent, accentBright }
 *   getInactiveColor():    { accent, accentBright }
 *   getNodeColor(idx):     { accent, accentBright }
 *   limits: { db:{min,max}, freq:{min,max}, q:{min,max} }
 *   displayLimits: { db, freq, q }            — render range (defaults to limits).
 *                                               Use this to give the curve some
 *                                               vertical/horizontal headroom while
 *                                               keeping interaction clamped to
 *                                               `limits`.
 *   sampleRate:            48000
 *   shelvingPolFreq:       1000  — Shelving filter polarity flip frequency
 *   qWheelStep:            0.2
 *   onBandDrag(idx, { freq, gain })   — fires while dragging a node
 *   onBandRelease(idx)                — fires on mouseup after drag
 *   onBandFocus(idx)                  — fires on mousedown on a node
 *   onBandBlur(idx)                   — fires on mouseup
 *   onBandQ(idx, q)                   — fires on wheel over a node
 *   onTooltipShow(text, color)        — show tooltip
 *   onTooltipHide()                   — hide tooltip
 *   formatBandFull(idx, band): string  — tooltip on hover/drag
 *   formatBandQ(idx, band):    string  — tooltip on wheel
 *
 * Methods:
 *   draw()       — re-render
 *   resize()     — sync canvas pixel size with CSS box, then redraw
 *   destroy()    — detach all listeners and observers
 */

const DEFAULTS = {
	getInactiveBands: () => null,
	isBypassed:       () => false,
	getActiveColor:   () => ({ accent: '#e87c2a', accentBright: '#ff9940' }),
	getInactiveColor: () => ({ accent: '#888',    accentBright: '#aaa'    }),
	getNodeColor:     null,  // defaults to getActiveColor when not provided

	limits: {
		db:   { min: -20, max: 20 },
		freq: { min: 20,  max: 20000 },
		q:    { min: 0.4, max: 9.9 },
	},
	sampleRate:      48000,
	shelvingPolFreq: 1000,
	qWheelStep:      0.2,

	onBandDrag:    () => {},
	onBandRelease: () => {},
	onBandFocus:   () => {},
	onBandBlur:    () => {},
	onBandQ:       () => {},
	onTooltipShow: () => {},
	onTooltipHide: () => {},

	formatBandFull(i, b) {
		const f = b.freq >= 1000 ? (b.freq/1000).toFixed(b.freq%1000===0 ? 0 : 1) + ' kHz'
		                         : Math.round(b.freq) + ' Hz';
		return `B${i+1}  ${f}  ${(b.gain>=0?'+':'')+b.gain.toFixed(1)} dB  Q:${b.q.toFixed(2)}`;
	},
	formatBandQ(i, b) {
		return `B${i+1} Q: ${b.q.toFixed(2)}`;
	},
};

function readGridTheme() {
	const s = getComputedStyle(document.documentElement);
	const v = (name, fb) => s.getPropertyValue(name).trim() || fb;
	return {
		gridZero:   v('--clr-canvas-grid-zero',   '#2e2e2e'),
		gridNormal: v('--clr-canvas-grid-normal', '#191919'),
		gridLabel:  v('--clr-canvas-grid-label',  '#333'),
	};
}

function hexToRgba(hex, a) {
	const r = parseInt(hex.slice(1,3),16);
	const g = parseInt(hex.slice(3,5),16);
	const b = parseInt(hex.slice(5,7),16);
	return `rgba(${r},${g},${b},${a})`;
}

export class EQGraph {
	#canvas;
	#ctx;
	#opts;
	#hovered  = -1;
	#dragging = null;     // { band, sx, sy, sf, sg }
	#touch    = null;     // { band, sx, sy, sf, sg }
	#resizeObserver;
	#listeners = [];      // [el, type, fn, opts]

	constructor(canvas, opts = {}) {
		if (!canvas) throw new Error('EQGraph: canvas required');
		this.#canvas = canvas;
		this.#ctx    = canvas.getContext('2d');
		this.#opts   = {
			...DEFAULTS,
			...opts,
			limits: { ...DEFAULTS.limits, ...(opts.limits || {}) },
		};
		// Display limits default to control limits; allows a visual margin
		// without changing how the controls clamp values.
		this.#opts.displayLimits = {
			...this.#opts.limits,
			...(opts.displayLimits || {}),
		};

		this.#wireEvents();
		this.#observeResize();
	}

	// ----- public --------------------------------------------------------

	resize() {
		const c = this.#canvas;
		c.width  = c.offsetWidth;
		c.height = c.offsetHeight;
		this.draw();
	}

	draw() {
		const ctx = this.#ctx;
		const W = this.#canvas.width, H = this.#canvas.height;
		if (!W || !H) return;
		ctx.clearRect(0, 0, W, H);

		this.#drawGrid(W, H);

		const inactive = this.#opts.getInactiveBands();
		if (inactive) {
			const combined = this.#computeCombined(inactive, W);
			const c = this.#opts.getInactiveColor();
			this.#drawCurve(combined, c.accent, false, this.#opts.isBypassed() ? 0.15 : 0.4);
		}

		const active = this.#opts.getBands();
		const combined = this.#computeCombined(active, W);
		const ac = this.#opts.getActiveColor();
		const bypassed = this.#opts.isBypassed();
		this.#drawCurve(combined, ac.accent, !bypassed, bypassed ? 0.35 : 1.0);

		this.#drawNodes(active);
	}

	destroy() {
		this.#resizeObserver?.disconnect();
		for (const [el, type, fn, opts] of this.#listeners) {
			el.removeEventListener(type, fn, opts);
		}
		this.#listeners = [];
	}

	// ----- math ----------------------------------------------------------

	// Compute the dB-domain response curve for a single band over `fArr` (Hz).
	// Returns an array of dB values aligned with fArr.
	// Supported band types:
	//   'Bell' (peak), 'Shelving' (auto low/high based on shelvingPolFreq),
	//   'Low Shelf', 'High Shelf', 'Low Pass', 'High Pass',
	//   'Low Cut'  (cascaded 1-pole HP, uses band.slope: 0=6 dB/oct .. 3=24 dB/oct)
	#calcResponse(band, fArr) {
		const Fs = this.#opts.sampleRate;
		const SHELF_POL = this.#opts.shelvingPolFreq;
		const type = band.type ?? 'Bell';
		const freq = band.freq;

		// LowCut uses analog-style cascaded 1-pole math (matches RME hardware shape)
		if (type === 'Low Cut') {
			const k = [1, 0.655, 0.528, 0.457];
			const order = Math.max(0, Math.min(3, Math.round(band.slope ?? 0)));
			const fc  = freq * k[order];
			const fc2 = fc * fc;
			return fArr.map(f => {
				const f2 = f * f;
				let y = 1;
				for (let i = 0; i <= order; ++i) y *= f2 / (f2 + fc2);
				return 10 * Math.log10(Math.max(1e-10, y));
			});
		}

		const gain = band.gain ?? 0;
		const q    = band.q    ?? 1;
		const f0 = Math.max(20, Math.min(23000, freq));
		const w0 = 2 * Math.PI * f0 / Fs;
		const cw = Math.cos(w0), sw = Math.sin(w0);
		const A  = Math.pow(10, gain/40);
		const aq = sw / (2*q);

		let b0,b1,b2,a0,a1,a2;

		// Convenience for shelf coefficients (low/high variants)
		const lowShelfCoeffs = () => {
			const sqA = Math.sqrt(A), aqS = 2*sqA*aq;
			b0=A*((A+1)-(A-1)*cw+aqS); b1=2*A*((A-1)-(A+1)*cw); b2=A*((A+1)-(A-1)*cw-aqS);
			a0=(A+1)+(A-1)*cw+aqS;     a1=-2*((A-1)+(A+1)*cw);   a2=(A+1)+(A-1)*cw-aqS;
		};
		const highShelfCoeffs = () => {
			const sqA = Math.sqrt(A), aqS = 2*sqA*aq;
			b0=A*((A+1)+(A-1)*cw+aqS); b1=-2*A*((A-1)+(A+1)*cw); b2=A*((A+1)+(A-1)*cw-aqS);
			a0=(A+1)-(A-1)*cw+aqS;     a1=2*((A-1)-(A+1)*cw);    a2=(A+1)-(A-1)*cw-aqS;
		};

		switch (type) {
			case 'Bell':
				b0=1+aq*A; b1=-2*cw; b2=1-aq*A; a0=1+aq/A; a1=-2*cw; a2=1-aq/A; break;
			case 'Shelving':
				if (freq <= SHELF_POL) lowShelfCoeffs(); else highShelfCoeffs();
				break;
			case 'Low Shelf':
				lowShelfCoeffs(); break;
			case 'High Shelf':
				highShelfCoeffs(); break;
			case 'Low Pass':
				b0=(1-cw)/2; b1=1-cw; b2=(1-cw)/2; a0=1+aq; a1=-2*cw; a2=1-aq; break;
			case 'High Pass':
				b0=(1+cw)/2; b1=-(1+cw); b2=(1+cw)/2; a0=1+aq; a1=-2*cw; a2=1-aq; break;
			default:
				b0=1; b1=0; b2=0; a0=1; a1=0; a2=0;
		}
		return fArr.map(f => {
			const w=2*Math.PI*f/Fs, cosW=Math.cos(w);
			const rN = b0*b0 + b1*b1 + b2*b2 + 2*(b0*b1+b1*b2)*cosW + 2*b0*b2*Math.cos(2*w);
			const rD = a0*a0 + a1*a1 + a2*a2 + 2*(a0*a1+a1*a2)*cosW + 2*a0*a2*Math.cos(2*w);
			return 20*Math.log10(Math.max(1e-10, Math.sqrt(Math.max(0, rN/rD))));
		});
	}

	#computeCombined(bands, W) {
		const fArr = Array.from({length:W}, (_,i) => this.#normToFreq(i/(W-1)));
		const combined = new Array(W).fill(0);
		bands.forEach(b => {
			if (b.enabled === false) return;
			this.#calcResponse(b, fArr).forEach((v,j) => combined[j] += v);
		});
		return combined;
	}

	// ----- draw helpers --------------------------------------------------

	#drawGrid(W, H) {
		const ctx     = this.#ctx;
		const t       = readGridTheme();
		const ctrlLim = this.#opts.limits;          // for grid line iteration
		const dispLim = this.#opts.displayLimits;   // for coord conversion + filtering
		// dB grid (every 5 dB), iterating across the control range — display
		// range may add headroom but the labelled lines stay at multiples of 5.
		for (let db = ctrlLim.db.min; db <= ctrlLim.db.max; db += 5) {
			const y = this.#dbToY(db, H);
			ctx.strokeStyle = db === 0 ? t.gridZero : t.gridNormal;
			ctx.lineWidth   = db === 0 ? 1.5       : 1;
			ctx.setLineDash(db === 0 ? [4,4] : []);
			ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
			ctx.setLineDash([]);
			ctx.fillStyle = t.gridLabel; ctx.font = '9px monospace';
			ctx.fillText((db>0?'+':'')+db, 3, y-2);
		}
		// freq grid — filtered against display range so out-of-view labels are skipped
		[20,50,100,200,500,1000,2000,5000,10000,20000].forEach(f => {
			if (f < dispLim.freq.min || f > dispLim.freq.max) return;
			const x = this.#freqToX(f, W);
			ctx.strokeStyle = t.gridNormal; ctx.lineWidth = 1;
			ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
			ctx.fillStyle = t.gridLabel; ctx.font = '9px monospace';
			ctx.fillText(f >= 1000 ? (f/1000)+'k' : f, x+2, H-4);
		});
	}

	#drawCurve(combined, clr, withFill, alpha) {
		const ctx = this.#ctx;
		const W = this.#canvas.width, H = this.#canvas.height;
		ctx.globalAlpha = alpha;

		ctx.beginPath();
		ctx.moveTo(0, this.#dbToY(combined[0], H));
		for (let i = 1; i < W; i++) ctx.lineTo(i, this.#dbToY(combined[i], H));

		if (withFill) {
			ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
			const grad = ctx.createLinearGradient(0, 0, 0, H);
			grad.addColorStop(0, hexToRgba(clr, 0.30));
			grad.addColorStop(1, hexToRgba(clr, 0.02));
			ctx.fillStyle = grad;
			ctx.fill();

			ctx.beginPath();
			ctx.moveTo(0, this.#dbToY(combined[0], H));
			for (let i = 1; i < W; i++) ctx.lineTo(i, this.#dbToY(combined[i], H));
		}

		ctx.strokeStyle = clr;
		ctx.lineWidth   = withFill ? 2 : 1.5;
		ctx.stroke();
		ctx.globalAlpha = 1;
	}

	#drawNodes(bands) {
		const ctx = this.#ctx;
		const W = this.#canvas.width, H = this.#canvas.height;
		const lim = this.#opts.limits;
		ctx.globalAlpha = this.#opts.isBypassed() ? 0.45 : 1;
		const nodeColorFn = this.#opts.getNodeColor ?? (() => this.#opts.getActiveColor());
		bands.forEach((b, i) => {
			const x   = this.#freqToX(b.freq, W);
			const y   = this.#dbToY(b.gain, H);
			const isHov = this.#hovered === i;
			const isDrg = this.#dragging && this.#dragging.band === i;
			const clr = nodeColorFn(i);
			const qRad = 12 + (b.q - lim.q.min) / (lim.q.max - lim.q.min) * 27;

			// Q ring
			ctx.beginPath(); ctx.arc(x, y, qRad, 0, Math.PI*2);
			ctx.strokeStyle = isHov || isDrg ? hexToRgba(clr.accent, 0.55) : hexToRgba(clr.accent, 0.15);
			ctx.lineWidth = 1.5; ctx.stroke();

			// Node circle
			ctx.beginPath(); ctx.arc(x, y, isDrg ? 12 : 9, 0, Math.PI*2);
			ctx.fillStyle = isDrg ? clr.accentBright : isHov ? clr.accent : hexToRgba(clr.accent, 0.55);
			ctx.fill();
			ctx.strokeStyle = clr.accentBright; ctx.lineWidth = 1.5; ctx.stroke();

			// Number label
			ctx.fillStyle = '#111'; ctx.font = 'bold 13px Arial';
			ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			ctx.fillText(i+1, x, y);
			ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
		});
		ctx.globalAlpha = 1;
	}

	// ----- coords --------------------------------------------------------

	#freqToNorm(f) {
		const lim = this.#opts.displayLimits.freq;
		return (Math.log10(f)-Math.log10(lim.min)) / (Math.log10(lim.max)-Math.log10(lim.min));
	}
	#normToFreq(n) {
		const lim = this.#opts.displayLimits.freq;
		return Math.pow(10, Math.log10(lim.min) + n*(Math.log10(lim.max)-Math.log10(lim.min)));
	}
	#dbToY(db, H) {
		const lim = this.#opts.displayLimits.db;
		return H * (1 - (db - lim.min) / (lim.max - lim.min));
	}
	#freqToX(f, W) { return W * this.#freqToNorm(f); }

	#getNodeAt(mx, my) {
		const W = this.#canvas.width, H = this.#canvas.height;
		const bands = this.#opts.getBands();
		for (let i = bands.length - 1; i >= 0; i--) {
			if (Math.hypot(mx - this.#freqToX(bands[i].freq, W),
			               my - this.#dbToY(bands[i].gain, H)) < 21) return i;
		}
		return -1;
	}

	// ----- events --------------------------------------------------------

	#on(el, type, fn, opts) {
		el.addEventListener(type, fn, opts);
		this.#listeners.push([el, type, fn, opts]);
	}

	#wireEvents() {
		const c = this.#canvas;

		this.#on(c, 'mousemove', (e) => {
			const r = c.getBoundingClientRect();
			const mx = e.clientX - r.left, my = e.clientY - r.top;
			if (this.#dragging) {
				const { band, sx, sy, sf, sg } = this.#dragging;
				const W = c.width, H = c.height;
				const ctrl = this.#opts.limits;
				const disp = this.#opts.displayLimits;
				let fn = this.#freqToNorm(sf) + (mx - sx) / (W * 0.7);
				fn = Math.max(0, Math.min(1, fn));
				const newFreq = Math.max(ctrl.freq.min, Math.min(ctrl.freq.max, this.#normToFreq(fn)));
				let gain = sg - (my - sy) * ((disp.db.max - disp.db.min) / H) * 1.5;
				gain = Math.round(Math.max(ctrl.db.min, Math.min(ctrl.db.max, gain)) * 10) / 10;
				this.#opts.onBandDrag(band, { freq: newFreq, gain });
				const b = this.#opts.getBands()[band];
				this.#opts.onTooltipShow(this.#opts.formatBandFull(band, b),
				                         this.#opts.getActiveColor().accent);
				c.style.cursor = 'grabbing';
				this.draw();
				return;
			}
			const hit = this.#getNodeAt(mx, my);
			if (hit !== this.#hovered) { this.#hovered = hit; this.draw(); }
			c.style.cursor = hit >= 0 ? 'grab' : 'crosshair';
			if (hit >= 0) {
				const b = this.#opts.getBands()[hit];
				const nodeColorFn = this.#opts.getNodeColor ?? (() => this.#opts.getActiveColor());
				this.#opts.onTooltipShow(this.#opts.formatBandFull(hit, b), nodeColorFn(hit).accent);
			} else {
				this.#opts.onTooltipHide();
			}
		});

		this.#on(c, 'mousedown', (e) => {
			const r = c.getBoundingClientRect();
			const mx = e.clientX - r.left, my = e.clientY - r.top;
			const hit = this.#getNodeAt(mx, my);
			if (hit < 0) return;
			const b = this.#opts.getBands()[hit];
			this.#dragging = { band: hit, sx: mx, sy: my, sf: b.freq, sg: b.gain };
			this.#opts.onBandFocus(hit);
			this.draw();
			e.preventDefault();
		});

		this.#on(window, 'mouseup', () => {
			if (!this.#dragging) return;
			const idx = this.#dragging.band;
			this.#opts.onBandRelease(idx);
			this.#opts.onBandBlur(idx);
			this.#dragging = null;
			this.#opts.onTooltipHide();
			c.style.cursor = 'crosshair';
			this.draw();
		});

		this.#on(c, 'wheel', (e) => {
			e.preventDefault();
			const r = c.getBoundingClientRect();
			const hit = this.#getNodeAt(e.clientX - r.left, e.clientY - r.top);
			if (hit < 0) return;
			const lim = this.#opts.limits.q;
			const cur = this.#opts.getBands()[hit].q;
			const step = this.#opts.qWheelStep * (e.deltaY < 0 ? 1 : -1);
			const next = Math.round(Math.max(lim.min, Math.min(lim.max, cur + step)) * 100) / 100;
			this.#opts.onBandQ(hit, next);
			const b = this.#opts.getBands()[hit];
			const nodeColorFn = this.#opts.getNodeColor ?? (() => this.#opts.getActiveColor());
			this.#opts.onTooltipShow(this.#opts.formatBandQ(hit, b), nodeColorFn(hit).accent);
			this.draw();
		}, { passive: false });

		// touch ----
		this.#on(c, 'touchstart', (e) => {
			const r = c.getBoundingClientRect(), t = e.touches[0];
			const mx = t.clientX - r.left, my = t.clientY - r.top;
			const hit = this.#getNodeAt(mx, my);
			if (hit < 0) { this.#touch = null; return; }
			const b = this.#opts.getBands()[hit];
			this.#touch = { band: hit, sx: mx, sy: my, sf: b.freq, sg: b.gain };
			this.#opts.onBandFocus(hit);
		}, { passive: true });

		this.#on(c, 'touchmove', (e) => {
			if (!this.#touch) return;
			const r = c.getBoundingClientRect(), t = e.touches[0];
			const mx = t.clientX - r.left, my = t.clientY - r.top;
			const W = c.width, H = c.height;
			const ctrl = this.#opts.limits;
			const disp = this.#opts.displayLimits;
			const { band, sx, sy, sf, sg } = this.#touch;
			let fn = this.#freqToNorm(sf) + (mx - sx) / (W * 0.7);
			fn = Math.max(0, Math.min(1, fn));
			const newFreq = Math.max(ctrl.freq.min, Math.min(ctrl.freq.max, this.#normToFreq(fn)));
			let gain = sg - (my - sy) * ((disp.db.max - disp.db.min) / H) * 1.5;
			gain = Math.round(Math.max(ctrl.db.min, Math.min(ctrl.db.max, gain)) * 10) / 10;
			this.#opts.onBandDrag(band, { freq: newFreq, gain });
			this.draw();
		}, { passive: true });

		this.#on(c, 'touchend', () => {
			if (!this.#touch) return;
			const idx = this.#touch.band;
			this.#opts.onBandRelease(idx);
			this.#opts.onBandBlur(idx);
			this.#touch = null;
			this.draw();
		});
	}

	#observeResize() {
		this.#resizeObserver = new ResizeObserver(() => this.resize());
		this.#resizeObserver.observe(this.#canvas);
	}
}
