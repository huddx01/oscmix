"use strict";

export class Knob {
	#canvas;
	#valueEl;
	#min; #max; #step; #value;
	#scale; #bipolar;
	#format;
	#size;
	#resetValue;
	#sendDuringDrag; #sendInterval; #lastSent;
	#isDragging; #startY; #startVal; #valueChanged;
	#accentOverride; #accentBrightOverride;

	constructor(options) {
		this.#min        = parseFloat(options.min);
		this.#max        = parseFloat(options.max);
		this.#step       = options.step !== undefined ? parseFloat(options.step) : 0;
		this.#scale      = options.scale ?? 'linear';
		this.#bipolar    = options.bipolar ?? false;
		this.#size       = options.size ?? 38;
		this.#resetValue = options.resetValue !== undefined ? parseFloat(options.resetValue) : this.#min;
		this.#format     = options.format ?? null;
		this.unit        = options.unit ?? '';
		this.#sendDuringDrag = options.sendDuringDrag ?? false;
		this.#sendInterval   = options.sendInterval ?? 100;
		this.#lastSent   = 0;
		this.#isDragging = false;
		this.#value      = this.#clamp(parseFloat(options.value ?? options.min));

		this.container = document.createElement('div');
		this.container.className = 'knob-container';
		if (options.id) this.container.id = `knob-${options.id}`;

		if (options.label) {
			const lbl = document.createElement('div');
			lbl.className = 'knob-label';
			lbl.textContent = options.label;
			this.container.appendChild(lbl);
		}

		this.#canvas = document.createElement('canvas');
		this.#canvas.className = 'knob';
		this.#canvas.width  = this.#size;
		this.#canvas.height = this.#size;
		this.container.appendChild(this.#canvas);

		this.#valueEl = document.createElement('div');
		this.#valueEl.className = 'knob-value';
		this.container.appendChild(this.#valueEl);

		this.#setupEvents();
		this.draw();
	}

	// -- Compat getters/setters (oscmix.js uses these) --
	get min()           { return this.#min; }
	get max()           { return this.#max; }
	get step()          { return this.#step; }
	get value()         { return this.#value; }
	get element()       { return this.container; }
	get type()          { return 'number'; }
	get valueAsNumber() { return this.#value; }

	set min(v)           { this.#min  = parseFloat(v); }
	set max(v)           { this.#max  = parseFloat(v); }
	set step(v)          { this.#step = parseFloat(v); }
	set value(v)         { this.#value = this.#clamp(this.#quantize(parseFloat(v))); this.draw(); }
	set valueAsNumber(v) { this.value = v; }

	// -- Internal helpers --
	#clamp(v)    { return Math.max(this.#min, Math.min(this.#max, v)); }
	#quantize(v) { return this.#step > 0 ? Math.round(v / this.#step) * this.#step : v; }

	#toNorm(val) {
		if (this.#scale === 'log') {
			return (Math.log10(val) - Math.log10(this.#min)) /
			       (Math.log10(this.#max) - Math.log10(this.#min));
		}
		return (val - this.#min) / (this.#max - this.#min);
	}

	#fromNorm(norm) {
		if (this.#scale === 'log') {
			return Math.pow(10, Math.log10(this.#min) +
			       norm * (Math.log10(this.#max) - Math.log10(this.#min)));
		}
		return this.#min + norm * (this.#max - this.#min);
	}

	setAccentColor(accent, accentBright) {
		this.#accentOverride      = accent      || null;
		this.#accentBrightOverride = accentBright || null;
		this.draw();
	}

	#theme() {
		const s = getComputedStyle(document.documentElement);
		const v = (name, fb) => s.getPropertyValue(name).trim() || fb;
		return {
			track:        v('--clr-knob-track',        '#444'),
			accent:       this.#accentOverride       ?? v('--clr-knob-accent',        'orange'),
			accentBright: this.#accentBrightOverride ?? v('--clr-knob-accent-bright', '#ffcc00'),
			valueColor:   v('--clr-knob-value',        ''),
		};
	}

	draw() {
		const c  = this.#canvas.getContext('2d');
		const W  = this.#canvas.width, H = this.#canvas.height;
		const cx = W / 2, cy = H / 2, R = W / 2 - 3;
		const norm   = Math.max(0, Math.min(1, this.#toNorm(this.#value)));
		const startA = Math.PI * 0.75;
		const totalA = Math.PI * 1.5;
		const angle  = startA + norm * totalA;
		const t      = this.#theme();

		c.clearRect(0, 0, W, H);

		// grey track ring
		c.beginPath();
		c.arc(cx, cy, R, startA, startA + totalA);
		c.strokeStyle = t.track; c.lineWidth = 3.5; c.stroke();

		// accent arc — bipolar: from center; unipolar: from startA
		if (this.#bipolar) {
			const centerA = startA + totalA * 0.5;
			const arcMin  = Math.min(centerA, angle);
			const arcMax  = Math.max(centerA, angle);
			if (arcMax - arcMin > 0.01) {
				c.beginPath(); c.arc(cx, cy, R, arcMin, arcMax);
				c.strokeStyle = t.accent; c.lineWidth = 3.5; c.stroke();
			}
		} else if (norm > 0.005) {
			c.beginPath(); c.arc(cx, cy, R, startA, angle);
			c.strokeStyle = t.accent; c.lineWidth = 3.5; c.stroke();
		}

		// pointer line
		c.beginPath();
		c.moveTo(cx, cy);
		c.lineTo(cx + Math.cos(angle) * (R - 1), cy + Math.sin(angle) * (R - 1));
		c.strokeStyle = t.accentBright; c.lineWidth = 2; c.stroke();

		// value label
		this.#valueEl.textContent = this.#format ? this.#format(this.#value) : this.#defaultFormat();
		if (t.valueColor) this.#valueEl.style.color = t.valueColor;
	}

	#defaultFormat() {
		const v = this.#value;
		if (!this.#step || this.#step >= 1) return Math.round(v) + (this.unit ? ' ' + this.unit : '');
		const dec = Math.max(0, -Math.floor(Math.log10(this.#step)));
		return v.toFixed(dec) + (this.unit ? ' ' + this.unit : '');
	}

	// drag delta (pixels up = positive) -> new value
	#applyDrag(deltaY) {
		let newVal;
		if (this.#scale === 'log') {
			const norm = Math.max(0, Math.min(1, this.#toNorm(this.#startVal) + deltaY * 0.003));
			newVal = this.#fromNorm(norm);
		} else {
			newVal = this.#startVal + deltaY * ((this.#max - this.#min) / 130);
		}
		return this.#clamp(this.#quantize(newVal));
	}

	#setupEvents() {
		const onDown = (clientY) => {
			this.#isDragging   = true;
			this.#startY       = clientY;
			this.#startVal     = this.#value;
			this.#valueChanged = false;
		};

		const onMove = (clientY) => {
			if (!this.#isDragging) return;
			const newVal = this.#applyDrag(this.#startY - clientY);
			if (newVal !== this.#value) {
				this.#value        = newVal;
				this.#valueChanged = true;
				this.draw();
				if (this.#sendDuringDrag) {
					const now = Date.now();
					if (now - this.#lastSent > this.#sendInterval) {
						this.#fire();
						this.#lastSent = now;
					}
				}
			}
		};

		const onUp = () => {
			if (!this.#isDragging) return;
			this.#isDragging = false;
			if (this.#valueChanged) this.#fire();
		};

		this.#canvas.addEventListener('mousedown', e => { e.preventDefault(); onDown(e.clientY); });
		document.addEventListener('mousemove', e => onMove(e.clientY));
		document.addEventListener('mouseup', onUp);

		this.#canvas.addEventListener('touchstart', e => {
			e.preventDefault(); onDown(e.touches[0].clientY);
		}, { passive: false });
		document.addEventListener('touchmove', e => {
			if (this.#isDragging) onMove(e.touches[0].clientY);
		});
		document.addEventListener('touchend', onUp);

		this.#canvas.addEventListener('dblclick', () => {
			this.#value = this.#clamp(this.#resetValue);
			this.draw();
			this.#fire();
		});

		this.#canvas.addEventListener('wheel', e => {
			e.preventDefault();
			const dir = e.deltaY < 0 ? 1 : -1;
			let newVal;
			if (this.#scale === 'log') {
				const norm = Math.max(0, Math.min(1, this.#toNorm(this.#value) + dir * 0.01));
				newVal = this.#fromNorm(norm);
			} else {
				const step = this.#step > 0 ? this.#step : (this.#max - this.#min) / 100;
				newVal = this.#value + dir * step;
			}
			newVal = this.#clamp(this.#quantize(newVal));
			if (newVal !== this.#value) {
				this.#value = newVal;
				this.draw();
				this.#fire();
			}
		}, { passive: false });
	}

	#fire() {
		this.container.dispatchEvent(new CustomEvent('user-change', {
			detail: { value: this.#value, id: this.container.id },
			bubbles: true,
		}));
	}

	// Update value from external source (OSC/state sync) — no user-change event.
	updateFromOSC(value) {
		const v = this.#clamp(this.#quantize(parseFloat(value)));
		if (Math.abs(v - this.#value) > 1e-9) { this.#value = v; this.draw(); }
	}

	triggerChangeEvent() {
		this.container.dispatchEvent(new Event('change', { bubbles: true }));
	}
}
