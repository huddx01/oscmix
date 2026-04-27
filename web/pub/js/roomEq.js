"use strict";
import { Knob } from './knob.js';

// ------------------------------------------------
//  CONFIG
// ------------------------------------------------
const N        = 9;
const DB_MAX   = 20, DB_MIN = -20;
const Q_MIN    = 0.4, Q_MAX = 9.9;
const FREQ_MIN = 20,  FREQ_MAX = 20000;

const DEFAULT_GAIN      = 0;
const DEFAULT_FREQS     = [50,100,150,200,250,300,400,600,800];
const DEFAULT_Q         = 5.0;
const FULL_CHOICE_BANDS = new Set([0,7,8]);
const FILTER_TYPES      = ['Bell','Shelving','Low Pass','High Pass'];
const SHELVING_POL_FREQ = 1000;

// ------------------------------------------------
//  STEREO CONFIG
// ------------------------------------------------
const urlParams   = new URLSearchParams(window.location.search);
const isStereo    = urlParams.get('stereo') === '1';
const oscChannelL = urlParams.get('channel') || null;
const oscChannelR = isStereo && oscChannelL
	? oscChannelL.replace(/(\d+)$/, n => String(+n + 1))
	: null;

// Accent colors for L / R / linked-equal knobs
const CLR = {
	L:    { accent: '#e87c2a', accentBright: '#ff9940' },
	R:    { accent: '#00ccee', accentBright: '#44eeff' },
	link: { accent: '#44dd88', accentBright: '#88ffbb' },
};

// Active side and link state
let activeSide = 'L';
let linked     = false;

// ------------------------------------------------
//  THEME  (EQ canvas only — knobs use CLR above)
// ------------------------------------------------
function getTheme() {
	const s = getComputedStyle(document.documentElement);
	const v = name => s.getPropertyValue(name).trim();
	return {
		gridZero:           v('--clr-canvas-grid-zero'),
		gridNormal:         v('--clr-canvas-grid-normal'),
		gridLabel:          v('--clr-canvas-grid-label'),
		accent:             v('--clr-accent'),
		bandCurve:          v('--clr-canvas-band-curve'),
		fillTop:            v('--clr-canvas-fill-top'),
		fillBot:            v('--clr-canvas-fill-bot'),
		bypassedFill:       v('--clr-canvas-bypassed'),
		bypassedStroke:     v('--clr-canvas-bypassed-stroke'),
		nodeRingActive:     v('--clr-canvas-node-ring-active'),
		nodeRingInactive:   v('--clr-canvas-node-ring-inactive'),
		nodeDrag:           v('--clr-accent-bright'),
		nodeHover:          v('--clr-accent'),
		nodeDefault:        v('--clr-accent-dim'),
		nodeStroke:         v('--clr-accent-bright'),
		nodeLabel:          v('--clr-text-dark'),
	};
}

// ------------------------------------------------
//  TMREQ TYPE MAP
// ------------------------------------------------
const TMREQ_TYPE_TO_NAME = { '0.00':'Bell', '1.00':'Shelving', '2.00':'Low Pass', '3.00':'High Pass' };
const TMREQ_NAME_TO_TYPE = { 'Bell':'0.00', 'Shelving':'1.00', 'Low Pass':'2.00', 'High Pass':'3.00' };

// ------------------------------------------------
//  STATE
// ------------------------------------------------
function makeBands() {
	return Array.from({length:N}, (_,i) => ({
		gain: DEFAULT_GAIN, freq: DEFAULT_FREQS[i], q: DEFAULT_Q, type: 'Bell'
	}));
}

const state = {
	L: { bands: makeBands(), delay: 0.00, volCal: 0.00 },
	R: { bands: makeBands(), delay: 0.00, volCal: 0.00 },
};
let bypassed = false;
let presets  = JSON.parse(localStorage.getItem('roomEq_presets') || '{}');

// Convenience accessor for active side
function activeBands()  { return state[activeSide].bands; }

// ------------------------------------------------
//  HELPERS
// ------------------------------------------------
function freqToNorm(f) {
	return (Math.log10(f)-Math.log10(FREQ_MIN)) /
	       (Math.log10(FREQ_MAX)-Math.log10(FREQ_MIN));
}
function normToFreq(n) {
	return Math.pow(10, Math.log10(FREQ_MIN)+n*(Math.log10(FREQ_MAX)-Math.log10(FREQ_MIN)));
}
function formatFreq(f) {
	return f>=1000 ? (f/1000).toFixed(f%1000===0?0:1)+' kHz' : Math.round(f)+' Hz';
}
function clampParam(p,v) {
	if (p==='gain') return Math.max(DB_MIN,Math.min(DB_MAX,v));
	if (p==='freq') return Math.max(FREQ_MIN,Math.min(FREQ_MAX,v));
	if (p==='q')    return Math.max(Q_MIN,Math.min(Q_MAX,v));
}
function otherSide(side) { return side === 'L' ? 'R' : 'L'; }

// ------------------------------------------------
//  KNOB COLOR HELPERS
// ------------------------------------------------
function bandValuesEqual(bandIdx, param) {
	if (!isStereo) return false;
	const l = state.L.bands[bandIdx][param];
	const r = state.R.bands[bandIdx][param];
	return Math.abs(l - r) < 0.001;
}

function extraValuesEqual(key) {
	if (!isStereo) return false;
	return Math.abs(state.L[key] - state.R[key]) < 0.001;
}

function bandKnobColor(bandIdx, param) {
	if (linked && bandValuesEqual(bandIdx, param)) return CLR.link;
	return CLR[activeSide];
}

function extraKnobColor(side, key) {
	if (linked && extraValuesEqual(key)) return CLR.link;
	return CLR[side];
}

function nodeColor(bandIdx) {
	if (linked && bandValuesEqual(bandIdx, 'gain') && bandValuesEqual(bandIdx, 'freq') && bandValuesEqual(bandIdx, 'q')) {
		return CLR.link;
	}
	return CLR[activeSide];
}

function applyKnobColor(knob, clr) {
	knob.setAccentColor(clr.accent, clr.accentBright);
}

function updateAllKnobColors() {
	for (let i=0; i<N; i++) {
		for (const param of ['gain','freq','q']) {
			applyKnobColor(bandKnobs[i][param], bandKnobColor(i, param));
		}
	}
	if (isStereo) {
		for (const side of ['L','R']) {
			if (extraKnobs[side]?.delay)  applyKnobColor(extraKnobs[side].delay,  extraKnobColor(side, 'delay'));
			if (extraKnobs[side]?.volCal) applyKnobColor(extraKnobs[side].volCal, extraKnobColor(side, 'volCal'));
		}
	}
	updateDropdownColors();
}

function updateDropdownColors() {
	FULL_CHOICE_BANDS.forEach(i => {
		const sel = document.getElementById(`ftype-${i}`);
		if (!sel) return;
		const typeEqual = isStereo && state.L.bands[i].type === state.R.bands[i].type;
		sel.style.borderColor = (linked && typeEqual) ? CLR.link.accent : CLR[activeSide].accent;
	});
}

// ------------------------------------------------
//  BUILD DOM — Band Knobs
// ------------------------------------------------
const container  = document.getElementById('bandsContainer');
const bandKnobs  = []; // Array<{gain:Knob, freq:Knob, q:Knob}>
const extraKnobs = { L: {}, R: {} };

for (let i=0; i<N; i++) {
	const div = document.createElement('div');
	div.className = 'band'; div.id = `band-${i}`;

	const lbl = document.createElement('div');
	lbl.className = 'band-label'; lbl.textContent = `B${i+1}`;
	div.appendChild(lbl);

	const bk = {
		gain: new Knob({
			id: `b${i}-gain`, label: 'Gain',
			min: DB_MIN, max: DB_MAX, step: 0.1,
			value: DEFAULT_GAIN, resetValue: DEFAULT_GAIN,
			bipolar: true,
			format: v => (v >= 0 ? '+' : '') + v.toFixed(1) + ' dB',
			size: 38,
			sendDuringDrag: true, sendInterval: 30,
		}),
		freq: new Knob({
			id: `b${i}-freq`, label: 'Freq',
			min: FREQ_MIN, max: FREQ_MAX,
			value: DEFAULT_FREQS[i], resetValue: DEFAULT_FREQS[i],
			scale: 'log',
			format: formatFreq,
			size: 38,
			sendDuringDrag: true, sendInterval: 30,
		}),
		q: new Knob({
			id: `b${i}-q`, label: 'Q',
			min: Q_MIN, max: Q_MAX, step: 0.01,
			value: DEFAULT_Q, resetValue: DEFAULT_Q,
			size: 38,
			sendDuringDrag: true, sendInterval: 30,
		}),
	};
	bandKnobs.push(bk);

	for (const [param, knob] of Object.entries(bk)) {
		knob.element.addEventListener('user-change', e => {
			const val = e.detail.value;
			activeBands()[i][param] = val;

			if (linked) {
				const other = otherSide(activeSide);
				state[other].bands[i][param] = val;
				notifyOSC_band(i, param, [other]);
				applyKnobColor(knob, CLR.link); // now equal -> green
			} else {
				applyKnobColor(knob, CLR[activeSide]);
			}

			drawEQ();
			notifyOSC_band(i, param, [activeSide]);
			showTooltip(tooltipStr(i, param), (linked ? CLR.link : CLR[activeSide]).accent);
		});
		knob.element.addEventListener('mouseleave', hideTooltip);
		div.appendChild(knob.element);
	}

	if (FULL_CHOICE_BANDS.has(i)) {
		const sel = document.createElement('select');
		sel.className = 'filter-select'; sel.id = `ftype-${i}`;
		FILTER_TYPES.forEach(t => {
			const o = document.createElement('option'); o.value = t; o.textContent = t; sel.appendChild(o);
		});
		sel.value = activeBands()[i].type;
		sel.addEventListener('change', () => {
			activeBands()[i].type = sel.value;
			if (linked) state[otherSide(activeSide)].bands[i].type = sel.value;
			drawEQ();
			notifyOSC_band(i, 'type', linked ? ['L','R'] : [activeSide]);
			updateDropdownColors();
		});
		div.appendChild(sel);
	}
	container.appendChild(div);
}

// Apply initial colors (L = orange)
updateAllKnobColors();

// ------------------------------------------------
//  BUILD DOM — Extra Knobs (Delay & VolCal)
// ------------------------------------------------
// extraKnobs[side][key] for stereo; extraKnobs.L.delay etc.
const extraKnobContainer = document.getElementById('extraKnobContainer');

const EXTRA_OPTS = {
	delay: {
		min: 0, max: 42.50, step: 0.25, value: 0, resetValue: 0,
		format: v => v.toFixed(2) + ' ms',
		size: 38, sendDuringDrag: true, sendInterval: 50,
	},
	volCal: {
		min: -24.0, max: 3.0, step: 0.1, value: 0, resetValue: 0,
		bipolar: true,
		format: v => (v >= 0 ? '+' : '') + v.toFixed(1) + ' dB',
		size: 38, sendDuringDrag: true, sendInterval: 50,
	},
};

function buildExtraKnob(side, key, containerEl) {
	const label = isStereo ? undefined : (key === 'delay' ? 'Delay' : 'VolCal');
	const knob  = new Knob({ id: `extra-${side}-${key}`, label, ...EXTRA_OPTS[key] });

	knob.element.addEventListener('user-change', e => {
		const val = e.detail.value;
		state[side][key] = val;

		if (linked) {
			const other = otherSide(side);
			state[other][key] = val;
			// update the other side's knob display
			if (extraKnobs[other]?.[key]) extraKnobs[other][key].updateFromOSC(val);
			notifyOSC_extra(key, other);
			// both now equal -> green for both
			applyKnobColor(knob, CLR.link);
			if (extraKnobs[other]?.[key]) applyKnobColor(extraKnobs[other][key], CLR.link);
		} else {
			applyKnobColor(knob, CLR[side]);
		}

		notifyOSC_extra(key, side);
		showTooltip(extraTooltipStr(key, side), (linked ? CLR.link : CLR[side]).accent);
	});

	knob.element.addEventListener('mouseleave', hideTooltip);
	containerEl.appendChild(knob.element);
	extraKnobs[side][key] = knob;
	applyKnobColor(knob, CLR[side]);
}

if (isStereo) {
	for (const key of ['delay','volCal']) {
		const groupLabel = key === 'delay' ? 'delay\nms' : 'volume\ncal dB';
		const group = document.createElement('div');
		group.className = 'extra-group';

		const lbl = document.createElement('span');
		lbl.className = 'extra-group-label'; lbl.textContent = groupLabel;
		group.appendChild(lbl);

		const pair = document.createElement('div');
		pair.className = 'extra-knob-pair';
		buildExtraKnob('L', key, pair);
		buildExtraKnob('R', key, pair);
		group.appendChild(pair);

		extraKnobContainer.appendChild(group);
	}
} else {
	buildExtraKnob('L', 'delay',  extraKnobContainer);
	buildExtraKnob('L', 'volCal', extraKnobContainer);
}

// ------------------------------------------------
//  KNOB DRAW
// ------------------------------------------------
function drawAllKnobs() {
	for (const bk of bandKnobs) for (const knob of Object.values(bk)) knob.draw();
	for (const side of ['L','R'])
		for (const knob of Object.values(extraKnobs[side])) knob.draw();
}

// ------------------------------------------------
//  TOOLTIP
// ------------------------------------------------
const tooltipEl = document.getElementById('tooltip');
function tooltipStr(i, p) {
	const b = activeBands()[i];
	if (p==='gain') return `B${i+1} Gain: ${(b.gain>=0?'+':'')+b.gain.toFixed(1)} dB`;
	if (p==='freq') return `B${i+1} Freq: ${formatFreq(b.freq)}`;
	if (p==='q')    return `B${i+1} Q: ${b.q.toFixed(2)}`;
	return '';
}
function extraTooltipStr(key, side) {
	const s = isStereo ? ` (${side})` : '';
	if (key==='delay')  return `Delay${s}: ${state[side].delay.toFixed(2)} ms`;
	if (key==='volCal') return `Vol Cal${s}: ${(state[side].volCal>=0?'+':'')+state[side].volCal.toFixed(1)} dB`;
	return '';
}
function showTooltip(txt, clr) {
	tooltipEl.textContent = txt;
	tooltipEl.style.borderColor = clr || '';
	tooltipEl.style.color       = clr || '';
	tooltipEl.style.display     = 'block';
}
function hideTooltip()    { tooltipEl.style.display = 'none'; }
window.addEventListener('mousemove', e => {
	tooltipEl.style.left = (e.clientX+14) + 'px';
	tooltipEl.style.top  = (e.clientY-20) + 'px';
});

// ------------------------------------------------
//  CANVAS / EQ DRAW
// ------------------------------------------------
const canvas = document.getElementById('eqCanvas');
const ctx    = canvas.getContext('2d');
let nodeDrag = null, hoveredNode = -1;

function resizeCanvas() { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; drawEQ(); }

function calcResponse(type, freq, gain, q, fArr) {
	const Fs=48000, f0=Math.max(20,Math.min(23000,freq));
	const w0=2*Math.PI*f0/Fs, cw=Math.cos(w0), sw=Math.sin(w0);
	const A=Math.pow(10,gain/40), aq=sw/(2*q);
	let b0,b1,b2,a0,a1,a2;
	switch(type) {
		case 'Bell':
			b0=1+aq*A;b1=-2*cw;b2=1-aq*A;a0=1+aq/A;a1=-2*cw;a2=1-aq/A; break;
		case 'Shelving': {
			const sqA=Math.sqrt(A),aqS=2*sqA*aq;
			if (freq<=SHELVING_POL_FREQ) {
				b0=A*((A+1)-(A-1)*cw+aqS);b1=2*A*((A-1)-(A+1)*cw);b2=A*((A+1)-(A-1)*cw-aqS);
				a0=(A+1)+(A-1)*cw+aqS;a1=-2*((A-1)+(A+1)*cw);a2=(A+1)+(A-1)*cw-aqS;
			} else {
				b0=A*((A+1)+(A-1)*cw+aqS);b1=-2*A*((A-1)+(A+1)*cw);b2=A*((A+1)+(A-1)*cw-aqS);
				a0=(A+1)-(A-1)*cw+aqS;a1=2*((A-1)-(A+1)*cw);a2=(A+1)-(A-1)*cw-aqS;
			}
			break; }
		case 'Low Pass':
			b0=(1-cw)/2;b1=1-cw;b2=(1-cw)/2;a0=1+aq;a1=-2*cw;a2=1-aq; break;
		case 'High Pass':
			b0=(1+cw)/2;b1=-(1+cw);b2=(1+cw)/2;a0=1+aq;a1=-2*cw;a2=1-aq; break;
		default: b0=1;b1=0;b2=0;a0=1;a1=0;a2=0;
	}
	return fArr.map(f => {
		const w=2*Math.PI*f/Fs, cosW=Math.cos(w);
		const rN=b0*b0+b1*b1+b2*b2+2*(b0*b1+b1*b2)*cosW+2*b0*b2*Math.cos(2*w);
		const rD=a0*a0+a1*a1+a2*a2+2*(a0*a1+a1*a2)*cosW+2*a0*a2*Math.cos(2*w);
		return 20*Math.log10(Math.max(1e-10,Math.sqrt(Math.max(0,rN/rD))));
	});
}

function computeCombined(bands) {
	const W = canvas.width;
	const fArr = Array.from({length:W}, (_,i) => normToFreq(i/(W-1)));
	const combined = new Array(W).fill(0);
	bands.forEach((b,i) => {
		const type = FULL_CHOICE_BANDS.has(i) ? b.type : 'Bell';
		calcResponse(type, b.freq, b.gain, b.q, fArr).forEach((v,j) => combined[j] += v);
	});
	return combined;
}

function drawCurve(combined, clr, withFill, alpha) {
	const W = canvas.width, H = canvas.height;
	ctx.globalAlpha = alpha;

	ctx.beginPath();
	ctx.moveTo(0, dbToY(combined[0], H));
	for (let i=1; i<W; i++) ctx.lineTo(i, dbToY(combined[i], H));

	if (withFill) {
		ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
		const grad = ctx.createLinearGradient(0, 0, 0, H);
		grad.addColorStop(0, hexToRgba(clr, 0.30));
		grad.addColorStop(1, hexToRgba(clr, 0.02));
		ctx.fillStyle = grad;
		ctx.fill();

		ctx.beginPath();
		ctx.moveTo(0, dbToY(combined[0], H));
		for (let i=1; i<W; i++) ctx.lineTo(i, dbToY(combined[i], H));
	}

	ctx.strokeStyle = clr;
	ctx.lineWidth   = withFill ? 2 : 1.5;
	ctx.stroke();
	ctx.globalAlpha = 1;
}

function hexToRgba(hex, a) {
	const r = parseInt(hex.slice(1,3),16);
	const g = parseInt(hex.slice(3,5),16);
	const b = parseInt(hex.slice(5,7),16);
	return `rgba(${r},${g},${b},${a})`;
}

function drawNodes(bands) {
	const W = canvas.width, H = canvas.height;
	ctx.globalAlpha = bypassed ? 0.45 : 1;
	bands.forEach((b,i) => {
		const x = freqToX(b.freq,W), y = dbToY(b.gain,H);
		const isHov = hoveredNode===i, isDrg = nodeDrag&&nodeDrag.band===i;
		const clr   = nodeColor(i);
		const qRad  = 12 + (b.q-Q_MIN)/(Q_MAX-Q_MIN)*27;
		// Q ring
		ctx.beginPath(); ctx.arc(x,y,qRad,0,Math.PI*2);
		ctx.strokeStyle = isHov||isDrg ? hexToRgba(clr.accent,0.55) : hexToRgba(clr.accent,0.15);
		ctx.lineWidth = 1.5; ctx.stroke();
		// Node circle
		ctx.beginPath(); ctx.arc(x,y,isDrg?12:9,0,Math.PI*2);
		ctx.fillStyle  = isDrg ? clr.accentBright : isHov ? clr.accent : hexToRgba(clr.accent,0.55);
		ctx.fill();
		ctx.strokeStyle = clr.accentBright; ctx.lineWidth = 1.5; ctx.stroke();
		// Band number label
		ctx.fillStyle = '#111'; ctx.font = 'bold 13px Arial';
		ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		ctx.fillText(i+1,x,y);
		ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
	});
	ctx.globalAlpha = 1;
}

function drawEQ() {
	const W=canvas.width, H=canvas.height;
	const t=getTheme();
	ctx.clearRect(0,0,W,H);

	// Grid
	[-20,-15,-10,-5,0,5,10,15,20].forEach(db => {
		const y=dbToY(db,H);
		ctx.strokeStyle=db===0?t.gridZero:t.gridNormal;
		ctx.lineWidth=db===0?1.5:1;
		ctx.setLineDash(db===0?[4,4]:[]);
		ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();
		ctx.setLineDash([]);
		ctx.fillStyle=t.gridLabel;ctx.font='9px monospace';
		ctx.fillText((db>0?'+':'')+db,3,y-2);
	});
	[20,50,100,200,500,1000,2000,5000,10000,20000].forEach(f => {
		const x=freqToX(f,W);
		ctx.strokeStyle=t.gridNormal;ctx.lineWidth=1;
		ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();
		ctx.fillStyle=t.gridLabel;ctx.font='9px monospace';
		ctx.fillText(f>=1000?(f/1000)+'k':f,x+2,H-4);
	});

	if (isStereo) {
		// Draw inactive curve first (dimmer, no fill)
		const inactiveCombined = computeCombined(state[otherSide(activeSide)].bands);
		drawCurve(inactiveCombined, CLR[otherSide(activeSide)].accent, false, bypassed ? 0.15 : 0.4);
	}

	// Draw active curve — bypassed: actual shape but no fill, muted alpha
	const activeCombined = computeCombined(activeBands());
	drawCurve(activeCombined, CLR[activeSide].accent, !bypassed, bypassed ? 0.35 : 1.0);

	// Node handles at actual band positions
	drawNodes(activeBands());
}

function dbToY(db,H)  { return H*(1-(db-DB_MIN)/(DB_MAX-DB_MIN)); }
function freqToX(f,W) { return W*freqToNorm(f); }

function getNodeAt(mx,my) {
	const W=canvas.width,H=canvas.height;
	for(let i=N-1;i>=0;i--)
		if(Math.hypot(mx-freqToX(activeBands()[i].freq,W),my-dbToY(activeBands()[i].gain,H))<21) return i;
	return -1;
}

canvas.addEventListener('mousemove', e => {
	const r=canvas.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;
	if (nodeDrag) {
		const {band,sx,sy,sf,sg}=nodeDrag,W=canvas.width,H=canvas.height;
		let fn=freqToNorm(sf)+(mx-sx)/(W*0.7); fn=Math.max(0,Math.min(1,fn));
		activeBands()[band].freq=normToFreq(fn);
		let gain=sg-(my-sy)*((DB_MAX-DB_MIN)/H)*1.5;
		gain=Math.round(Math.max(DB_MIN,Math.min(DB_MAX,gain))*10)/10;
		activeBands()[band].gain=gain;
		if (linked) {
			state[otherSide(activeSide)].bands[band].freq = activeBands()[band].freq;
			state[otherSide(activeSide)].bands[band].gain = gain;
		}
		bandKnobs[band].gain.updateFromOSC(activeBands()[band].gain);
		bandKnobs[band].freq.updateFromOSC(activeBands()[band].freq);
		drawEQ();
		if (linked) updateAllKnobColors();
		showTooltip(`B${band+1}  ${formatFreq(activeBands()[band].freq)}  ${(gain>=0?'+':'')+gain.toFixed(1)} dB  Q:${activeBands()[band].q.toFixed(2)}`, (linked ? CLR.link : CLR[activeSide]).accent);
		canvas.style.cursor='grabbing'; return;
	}
	const hit=getNodeAt(mx,my);
	if(hit!==hoveredNode){hoveredNode=hit;drawEQ();}
	canvas.style.cursor=hit>=0?'grab':'crosshair';
	if(hit>=0) showTooltip(`B${hit+1}  ${formatFreq(activeBands()[hit].freq)}  ${(activeBands()[hit].gain>=0?'+':'')+activeBands()[hit].gain.toFixed(1)} dB  Q:${activeBands()[hit].q.toFixed(2)}`, nodeColor(hit).accent);
	else hideTooltip();
});

canvas.addEventListener('mousedown', e => {
	const r=canvas.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;
	const hit=getNodeAt(mx,my);
	if(hit>=0) {
		nodeDrag={band:hit,sx:mx,sy:my,sf:activeBands()[hit].freq,sg:activeBands()[hit].gain};
		const bandEl = document.getElementById(`band-${hit}`);
		bandEl.classList.add('active');
		bandEl.style.borderColor = (linked ? CLR.link : CLR[activeSide]).accent;
		e.preventDefault();
	}
});

window.addEventListener('mouseup', () => {
	if(nodeDrag) {
		notifyOSC_band(nodeDrag.band, 'gain', linked ? ['L','R'] : [activeSide]);
		notifyOSC_band(nodeDrag.band, 'freq', linked ? ['L','R'] : [activeSide]);
		const relBandEl = document.getElementById(`band-${nodeDrag.band}`);
		relBandEl.classList.remove('active');
		relBandEl.style.borderColor = '';
		nodeDrag=null; hideTooltip(); canvas.style.cursor='crosshair';
	}
});

canvas.addEventListener('wheel', e => {
	e.preventDefault();
	const r=canvas.getBoundingClientRect();
	const hit=getNodeAt(e.clientX-r.left,e.clientY-r.top);
	if(hit<0) return;
	activeBands()[hit].q=Math.round(Math.max(Q_MIN,Math.min(Q_MAX,activeBands()[hit].q+(e.deltaY<0?1:-1)*0.2))*100)/100;
	if (linked) state[otherSide(activeSide)].bands[hit].q = activeBands()[hit].q;
	bandKnobs[hit].q.updateFromOSC(activeBands()[hit].q);
	drawEQ();
	showTooltip(`B${hit+1} Q: ${activeBands()[hit].q.toFixed(2)}`, nodeColor(hit).accent);
},{passive:false});

let tN=-1,tSX=0,tSY=0,tSF=0,tSG=0;
canvas.addEventListener('touchstart', e => {
	const r=canvas.getBoundingClientRect(),t=e.touches[0];
	tN=getNodeAt(t.clientX-r.left,t.clientY-r.top);
	if(tN>=0){tSX=t.clientX-r.left;tSY=t.clientY-r.top;tSF=activeBands()[tN].freq;tSG=activeBands()[tN].gain;}
},{passive:true});
canvas.addEventListener('touchmove', e => {
	if(tN<0) return;
	const r=canvas.getBoundingClientRect(),t=e.touches[0];
	const mx=t.clientX-r.left,my=t.clientY-r.top,W=canvas.width,H=canvas.height;
	let fn=freqToNorm(tSF)+(mx-tSX)/(W*0.7);fn=Math.max(0,Math.min(1,fn));
	activeBands()[tN].freq=normToFreq(fn);
	let gain=tSG-(my-tSY)*((DB_MAX-DB_MIN)/H)*1.5;
	gain=Math.round(Math.max(DB_MIN,Math.min(DB_MAX,gain))*10)/10;
	activeBands()[tN].gain=gain;
	if (linked) {
		state[otherSide(activeSide)].bands[tN].freq = activeBands()[tN].freq;
		state[otherSide(activeSide)].bands[tN].gain = gain;
	}
	bandKnobs[tN].gain.updateFromOSC(activeBands()[tN].gain);
	bandKnobs[tN].freq.updateFromOSC(activeBands()[tN].freq);
	drawEQ();
},{passive:true});
canvas.addEventListener('touchend', () => { tN=-1; });

// ------------------------------------------------
//  PRESETS
// ------------------------------------------------
const presetSelect = document.getElementById('presetSelect');

function refreshPresets() {
	presetSelect.innerHTML = '<option value="">- Preset -</option>';
	Object.keys(presets).forEach(n => {
		const o=document.createElement('option'); o.value=n; o.textContent=n; presetSelect.appendChild(o);
	});
}
function savePreset() {
	const name=document.getElementById('presetName').value.trim();
	if(!name){alert('Preset Name cannot be empty!');return;}
	presets[name]=activeBands().map(b=>({...b}));
	localStorage.setItem('roomEq_presets',JSON.stringify(presets));
	refreshPresets(); presetSelect.value=name;
}
function deletePreset() {
	const n=presetSelect.value;
	if(!n){alert('No Preset selected');return;}
	if(!confirm(`Delete "${n}"?`))return;
	delete presets[n];
	localStorage.setItem('roomEq_presets',JSON.stringify(presets));
	refreshPresets();
}
presetSelect.addEventListener('change', () => {
	const n=presetSelect.value;
	if(!n||!presets[n]) return;
	presets[n].forEach((src,i) => Object.assign(activeBands()[i],src));
	FULL_CHOICE_BANDS.forEach(i => {
		const s=document.getElementById(`ftype-${i}`); if(s) s.value=activeBands()[i].type;
	});
	syncKnobsFromBands();
	drawEQ();
});

// ------------------------------------------------
//  RESET / BYPASS
// ------------------------------------------------
function resetEQ() {
	for (const side of (isStereo ? ['L','R'] : ['L'])) {
		state[side].bands.forEach((b,i) => {b.gain=DEFAULT_GAIN;b.freq=DEFAULT_FREQS[i];b.q=DEFAULT_Q;b.type='Bell';});
		state[side].delay=0.00; state[side].volCal=0.00;
	}
	FULL_CHOICE_BANDS.forEach(i => {
		const s=document.getElementById(`ftype-${i}`); if(s) s.value='Bell';
	});
	syncKnobsFromBands();
	syncExtraKnobs();
	drawEQ();
}

function updateBypassBtn() {
	const btn=document.getElementById('bypassBtn');
	if (!bypassed) {
		btn.className='bypass-btn state-on'; btn.textContent='On';
	} else {
		btn.className='bypass-btn state-off'; btn.textContent='Off';
	}
}

function toggleBypass() {
	bypassed=!bypassed;
	updateBypassBtn();
	drawEQ();
	notifyOSC_bypass();
}

// Sync band knobs from active side's state (no OSC fired)
function syncKnobsFromBands() {
	const bands = activeBands();
	for (let i=0; i<N; i++) {
		bandKnobs[i].gain.updateFromOSC(bands[i].gain);
		bandKnobs[i].freq.updateFromOSC(bands[i].freq);
		bandKnobs[i].q.updateFromOSC(bands[i].q);
	}
	updateAllKnobColors();
}

function syncExtraKnobs() {
	for (const side of ['L','R']) {
		if (extraKnobs[side]?.delay)  extraKnobs[side].delay.updateFromOSC(state[side].delay);
		if (extraKnobs[side]?.volCal) extraKnobs[side].volCal.updateFromOSC(state[side].volCal);
	}
	updateAllKnobColors();
}

// ------------------------------------------------
//  STEREO UI
// ------------------------------------------------
function setSide(side) {
	activeSide = side;
	syncKnobsFromBands();
	FULL_CHOICE_BANDS.forEach(i => {
		const s = document.getElementById(`ftype-${i}`);
		if (s) s.value = activeBands()[i].type;
	});
	updateSideButtons();
	updateBandLabelColors();
	drawEQ();
}

function toggleLink() {
	linked = !linked;
	updateAllKnobColors();
	updateLinkButton();
	updateBandLabelColors();
	drawEQ();
}

function updateSideButtons() {
	const lBtn = document.getElementById('sideLBtn');
	const rBtn = document.getElementById('sideRBtn');
	if (!lBtn || !rBtn) return;
	lBtn.classList.toggle('active', activeSide === 'L');
	rBtn.classList.toggle('active', activeSide === 'R');
}

function updateLinkButton() {
	const btn = document.getElementById('linkBtn');
	if (!btn) return;
	btn.classList.toggle('linked', linked);
}

function updateBandLabelColors() {
	for (let i = 0; i < N; i++) {
		const bandEl = document.getElementById(`band-${i}`);
		if (!bandEl) continue;
		bandEl.classList.remove('side-r', 'side-link');
		if (linked) bandEl.classList.add('side-link');
		else if (activeSide === 'R') bandEl.classList.add('side-r');
	}
}

// ------------------------------------------------
//  JSON EXPORT / IMPORT
// ------------------------------------------------
function exportJSON() {
	const bands = activeBands();
	const data={
		preset: document.getElementById('presetName').value.trim()||'untitled',
		bypassed, delay: state[activeSide].delay, volCal: state[activeSide].volCal,
		bands: bands.map((b,i)=>({
			band:i+1,
			type:FULL_CHOICE_BANDS.has(i)?b.type:'Bell',
			freq_hz:Math.round(b.freq),
			gain_db:b.gain, q:b.q
		}))
	};
	const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
	const url=URL.createObjectURL(blob);
	const a=document.createElement('a'); a.href=url;
	a.download=(data.preset||'eq-settings')+'.json'; a.click();
	URL.revokeObjectURL(url);
}

function importJSON(event) {
	const file=event.target.files[0]; if(!file) return;
	const reader=new FileReader();
	reader.onload=e=>{
		try {
			const data=JSON.parse(e.target.result);
			if(!data.bands||data.bands.length!==N){alert('Invalid RoomEQ-File Format in json.');return;}
			const bands = activeBands();
			data.bands.forEach((src,i)=>{
				bands[i].gain=clampParam('gain',src.gain_db??DEFAULT_GAIN);
				bands[i].freq=clampParam('freq',src.freq_hz??DEFAULT_FREQS[i]);
				bands[i].q=clampParam('q',src.q??DEFAULT_Q);
				bands[i].type=FILTER_TYPES.includes(src.type)?src.type:'Bell';
			});
			if(data.preset) document.getElementById('presetName').value=data.preset;
			bypassed=data.bypassed??false;
			state[activeSide].delay  = typeof data.delay  ==='number' ? Math.max(0,Math.min(42.50,data.delay)) : 0;
			state[activeSide].volCal = typeof data.volCal ==='number' ? Math.max(-24,Math.min(3,data.volCal)) : 0;
			updateBypassBtn();
			FULL_CHOICE_BANDS.forEach(i=>{const s=document.getElementById(`ftype-${i}`);if(s)s.value=bands[i].type;});
			syncKnobsFromBands();
			syncExtraKnobs();
			drawEQ();
		} catch(err){alert('File Read Error: '+err.message);}
	};
	reader.readAsText(file);
	event.target.value='';
}

// ------------------------------------------------
//  TMREQ EXPORT / IMPORT
// ------------------------------------------------
function buildTmreqChannel(channelName, side) {
	const bands = state[side].bands;
	const delay  = state[side].delay;
	const volCal = state[side].volCal;
	const lines=[];
	lines.push(`\t<${channelName}>`);
	lines.push(`\t\t<Params>`);
	lines.push(`\t\t\t<val e="REQ Delay" v="${delay.toFixed(2)},"/>`);
	for (let i=0;i<N;i++) {
		const b=bands[i],n=i+1;
		lines.push(`\t\t\t<val e="REQ Band${n} Freq" v="${b.freq.toFixed(2)},"/>`);
		lines.push(`\t\t\t<val e="REQ Band${n} Q" v="${b.q.toFixed(2)},"/>`);
		lines.push(`\t\t\t<val e="REQ Band${n} Gain" v="${b.gain.toFixed(2)},"/>`);
	}
	FULL_CHOICE_BANDS.forEach(i=>{
		const n=i+1, typeVal=TMREQ_NAME_TO_TYPE[bands[i].type]??'0.00';
		const eName=n===1?`REQ Band1Type`:`REQ Band${n} Type`;
		lines.push(`\t\t\t<val e="${eName}" v="${typeVal},"/>`);
	});
	lines.push(`\t\t\t<val e="Chan Gain" v="${volCal.toFixed(2)},"/>`);
	lines.push(`\t\t</Params>`);
	lines.push(`\t</${channelName}>`);
	return lines.join('\n');
}

function exportTmreq() {
	const presetName=document.getElementById('presetName').value.trim()||'untitled';
	const xml=['<Preset>',buildTmreqChannel('Room EQ L','L'),buildTmreqChannel('Room EQ R','R'),'</Preset>'].join('\n');
	const blob=new Blob([xml],{type:'application/xml'});
	const url=URL.createObjectURL(blob);
	const a=document.createElement('a');
	a.href=url; a.download=presetName+'.tmreq'; a.click();
	URL.revokeObjectURL(url);
}

function parseTmreqChannel(channelText) {
	const result={bands:Array.from({length:N},(_,i)=>({
		freq:DEFAULT_FREQS[i],q:DEFAULT_Q,gain:DEFAULT_GAIN,type:'Bell'
	})),delay:0.00,volCal:0.00};
	const valRe=/<val\s+e="([^"]+)"\s+v="([^"]+)"/g;
	let m;
	while ((m=valRe.exec(channelText))!==null) {
		const e=m[1], v=parseFloat(m[2]);
		if (e==='REQ Delay')  {result.delay=v;continue;}
		if (e==='Chan Gain')  {result.volCal=v;continue;}
		const mType1=e.match(/^REQ Band(\d+)Type$/);
		if (mType1) {
			const idx=parseInt(mType1[1])-1;
			if (idx>=0&&idx<N&&FULL_CHOICE_BANDS.has(idx)) {
				const typeName=TMREQ_TYPE_TO_NAME[v.toFixed(2)];
				if (typeName) result.bands[idx].type=typeName;
			}
			continue;
		}
		const mBand=e.match(/^REQ Band(\d+) (Freq|Q|Gain|Type)$/);
		if (!mBand) continue;
		const idx=parseInt(mBand[1])-1, prop=mBand[2];
		if (idx<0||idx>=N) continue;
		if (prop==='Freq') result.bands[idx].freq=v;
		if (prop==='Q')    result.bands[idx].q=v;
		if (prop==='Gain') result.bands[idx].gain=v;
		if (prop==='Type'&&FULL_CHOICE_BANDS.has(idx)) {
			const typeName=TMREQ_TYPE_TO_NAME[v.toFixed(2)];
			if (typeName) result.bands[idx].type=typeName;
		}
	}
	return result;
}

function applyTmreqData(data, side) {
	const bands = state[side].bands;
	data.bands.forEach((src,i)=>{
		bands[i].freq=clampParam('freq',src.freq);
		bands[i].q=clampParam('q',src.q);
		bands[i].gain=clampParam('gain',src.gain);
		if (FULL_CHOICE_BANDS.has(i)) bands[i].type=src.type;
	});
	state[side].delay  = Math.max(0,     Math.min(42.50, data.delay));
	state[side].volCal = Math.max(-24.0, Math.min(3.0,   data.volCal));
}

function importTmreq(event) {
	const file=event.target.files[0]; if(!file) return;
	const reader=new FileReader();
	reader.onload=e=>{
		try {
			const text=e.target.result;
			const presetMatch=text.match(/<Preset>([\s\S]*)<\/Preset>/);
			if (!presetMatch){alert('Invalid .tmreq file: no <Preset> found.');return;}
			const inner=presetMatch[1];
			const tagRe=/<([^/][^>]*)>/g;
			const channels=[];
			let tm;
			while ((tm=tagRe.exec(inner))!==null) {
				const tagName=tm[1].trim();
				if (tagName==='Params'||tagName.startsWith('val')) continue;
				const open=`<${tagName}>`,close=`</${tagName}>`;
				const start=inner.indexOf(open),end=inner.indexOf(close);
				if (start===-1||end===-1) continue;
				channels.push({name:tagName,text:inner.slice(start,end+close.length)});
			}
			if (channels.length===0){alert('No channels found in .tmreq file.');return;}
			if (channels.length===1){
				applyTmreqData(parseTmreqChannel(channels[0].text), activeSide);
			} else if (channels.length>=2 && isStereo) {
				applyTmreqData(parseTmreqChannel(channels[0].text), 'L');
				applyTmreqData(parseTmreqChannel(channels[1].text), 'R');
			} else {
				const names=channels.map(ch=>ch.name);
				const choice=prompt(`Found ${names.length} channels:\n${names.map((n,i)=>`  ${i+1}. ${n}`).join('\n')}\n\nEnter channel number to import:`);
				if (choice===null) return;
				const idx=parseInt(choice)-1;
				if (isNaN(idx)||idx<0||idx>=channels.length){alert('Invalid selection.');return;}
				applyTmreqData(parseTmreqChannel(channels[idx].text), activeSide);
			}
			FULL_CHOICE_BANDS.forEach(i=>{const s=document.getElementById(`ftype-${i}`);if(s) s.value=activeBands()[i].type;});
			syncKnobsFromBands();
			syncExtraKnobs();
			drawEQ();
		} catch(err){alert('File Read Error: '+err.message);}
	};
	reader.readAsText(file);
	event.target.value='';
}

// ------------------------------------------------
//  OSC BRIDGE
// ------------------------------------------------
const OSC_TYPE_TO_NAME = {0:'Bell',1:'Shelving',2:'Low Pass',3:'High Pass'};
const OSC_NAME_TO_TYPE = {'Bell':0,'Shelving':1,'Low Pass':2,'High Pass':3};

function oscChannel(side) { return side === 'R' ? oscChannelR : oscChannelL; }

function oscSend(addr, value) {
	if (!window.opener||window.opener.closed) return;
	window.opener.postMessage({type:'ROOMEQ_OSC_SEND',addr,value},'*');
}

function oscAddr(sub, side) {
	const ch = oscChannel(side);
	return ch ? `/${ch}/${sub}` : null;
}

function notifyOSC_band(bandIdx, param, sides) {
	for (const side of sides) {
		const addr = oscAddr(`roomeq/band${bandIdx+1}${param}`, side);
		if (!addr) continue;
		const b = state[side].bands[bandIdx];
		let value;
		if (param==='gain') value=b.gain;
		if (param==='freq') value=b.freq;
		if (param==='q')    value=b.q;
		if (param==='type') {
			if (!FULL_CHOICE_BANDS.has(bandIdx)) continue;
			value=OSC_NAME_TO_TYPE[b.type]??0;
		}
		oscSend(addr, value);
	}
}

function notifyOSC_extra(key, side) {
	if (key==='delay') {
		const addr=oscAddr('roomeq/delay', side);
		if (addr) oscSend(addr, state[side].delay/10);
	}
	if (key==='volCal') {
		const addr=oscAddr('volumecal', side);
		if (addr) oscSend(addr, state[side].volCal);
	}
}

function notifyOSC_bypass() {
	// Bypass is shared — send to both channels if stereo
	for (const side of (isStereo ? ['L','R'] : ['L'])) {
		const addr=oscAddr('roomeq', side);
		if (addr) oscSend(addr, bypassed?0:1);
	}
}

canvas.addEventListener('wheel', e => {
	const r=canvas.getBoundingClientRect();
	const hit=getNodeAt(e.clientX-r.left,e.clientY-r.top);
	if (hit>=0) notifyOSC_band(hit,'q', linked ? ['L','R'] : [activeSide]);
},{passive:true,capture:true});

// Inbound OSC from opener
window.addEventListener('message', e => {
	if (!e.data||e.data.type!=='ROOMEQ_OSC_RECV') return;
	const {addr,value}=e.data;

	// Determine which side this message belongs to
	let side = 'L', sub = addr;
	if (oscChannelL && addr.startsWith(`/${oscChannelL}/`)) {
		side = 'L';
		sub  = addr.slice(oscChannelL.length+2);
	} else if (oscChannelR && addr.startsWith(`/${oscChannelR}/`)) {
		side = 'R';
		sub  = addr.slice(oscChannelR.length+2);
	}

	if (sub==='roomeq') {bypassed=value===0;updateBypassBtn();drawEQ();return;}

	if (sub==='roomeq/delay') {
		state[side].delay=Math.max(0,Math.min(42.50,value*10));
		if (extraKnobs[side]?.delay) extraKnobs[side].delay.updateFromOSC(state[side].delay);
		if (side===activeSide || !isStereo) updateAllKnobColors();
		return;
	}

	if (sub==='volumecal') {
		state[side].volCal=Math.max(-24.0,Math.min(3.0,value));
		if (extraKnobs[side]?.volCal) extraKnobs[side].volCal.updateFromOSC(state[side].volCal);
		if (side===activeSide || !isStereo) updateAllKnobColors();
		return;
	}

	const mBand=sub.match(/^roomeq\/band(\d+)(gain|freq|q|type)$/);
	if (mBand) {
		const bi=parseInt(mBand[1])-1, prop=mBand[2];
		if (bi<0||bi>=N) return;
		if (prop==='gain') state[side].bands[bi].gain=clampParam('gain',value);
		if (prop==='freq') state[side].bands[bi].freq=clampParam('freq',value);
		if (prop==='q')    state[side].bands[bi].q=clampParam('q',value);
		if (prop==='type'&&FULL_CHOICE_BANDS.has(bi)) {
			const name=OSC_TYPE_TO_NAME[Math.round(value)];
			if (name) state[side].bands[bi].type=name;
		}
		// Update knobs and canvas only if this is the currently displayed side
		if (side===activeSide) {
			if (prop==='gain') bandKnobs[bi].gain.updateFromOSC(state[side].bands[bi].gain);
			if (prop==='freq') bandKnobs[bi].freq.updateFromOSC(state[side].bands[bi].freq);
			if (prop==='q')    bandKnobs[bi].q.updateFromOSC(state[side].bands[bi].q);
			if (prop==='type') {
				const sel=document.getElementById(`ftype-${bi}`);
				if (sel) sel.value=state[side].bands[bi].type;
			}
		}
		updateAllKnobColors();
		drawEQ();
	}
});

const deviceName = urlParams.get('device') || '';
const serialNum  = urlParams.get('serial') || '';
const chanMatch  = oscChannelL?.match(/(\d+)$/);
const chanNum    = chanMatch ? parseInt(chanMatch[1]) : null;
const titleEq    = chanNum
	? `Room EQ Output ${chanNum}${isStereo ? '/' + (chanNum + 1) : ''}`
	: 'Room EQ';
const titleDevice = deviceName
	? `${deviceName}${serialNum ? ' (' + serialNum + ')' : ''} - `
	: '';
const fullTitle = titleDevice + titleEq;
document.title = fullTitle;
const h1 = document.querySelector('h1');
if (h1) h1.textContent = fullTitle;

// ------------------------------------------------
//  STEREO CONTROLS INIT
// ------------------------------------------------
if (isStereo) {
	document.getElementById('stereoControls').hidden = false;
	updateSideButtons();
	updateBandLabelColors();
}

// ------------------------------------------------
//  INIT
// ------------------------------------------------
refreshPresets();
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
drawAllKnobs();
updateBypassBtn();

window.toggleBypass = toggleBypass;
window.savePreset   = savePreset;
window.deletePreset = deletePreset;
window.resetEQ      = resetEQ;
window.exportJSON   = exportJSON;
window.importJSON   = importJSON;
window.exportTmreq  = exportTmreq;
window.importTmreq  = importTmreq;
window.setSide      = setSide;
window.toggleLink   = toggleLink;
