"use strict";

import { Knob }       from './knob.js';
import { Button }     from './button.js';
import { EQGraph }    from './eqGraph.js';
import { EQBandRow }  from './eqBandRow.js';

// ------------------------------------------------
//  URL config
// ------------------------------------------------
const urlParams  = new URLSearchParams(window.location.search);
const channelKey = urlParams.get('channel') || '';     // e.g. "input/3"
const deviceName = urlParams.get('device')  || '';
const serialNum  = urlParams.get('serial')  || '';

if (!channelKey) {
	document.body.textContent = 'Missing ?channel= URL parameter.';
	throw new Error('channelEq: no channel param');
}
const oscPrefix = `/${channelKey}`;

// ------------------------------------------------
//  Persist & restore window size
// ------------------------------------------------
(function rememberWindowSize() {
	const KEY = 'channelEq_windowSize';
	try {
		const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
		if (saved && saved.w >= 400 && saved.h >= 300) {
			window.resizeTo(saved.w, saved.h);
		}
	} catch (e) { /* ignore */ }

	let timer = null;
	window.addEventListener('resize', () => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			try {
				localStorage.setItem(KEY, JSON.stringify({
					w: window.outerWidth,
					h: window.outerHeight,
				}));
			} catch (e) { /* ignore */ }
		}, 200);
	});
})();

// ------------------------------------------------
//  Title
// ------------------------------------------------
const channelDisplay = channelKey
	.replace('/', ' ')
	.replace(/^./, c => c.toUpperCase());      // "input/3" → "Input 3"
const fullTitle = [deviceName, serialNum && `(${serialNum})`, channelDisplay, 'EQ']
	.filter(Boolean).join(' ');
document.title = fullTitle;
const h1 = document.getElementById('title');
if (h1) h1.textContent = fullTitle;

// ------------------------------------------------
//  Constants
// ------------------------------------------------
const N           = 3;
const DB_MAX = 20, DB_MIN = -20;
const Q_MIN  = 0.4, Q_MAX = 9.9;
const FREQ_MIN = 20, FREQ_MAX = 20000;

const BAND_COLORS = [
	{ accent: '#e87c2a', accentBright: '#ff9940' }, // band 1 — orange
	{ accent: '#5fcc5f', accentBright: '#88ee88' }, // band 2 — green
	{ accent: '#5fb8ee', accentBright: '#88d4ff' }, // band 3 — blue
];
const LOWCUT_COLOR = { accent: '#e87c2a', accentBright: '#ff9940' };

// Band 1: PEAK | LOW_SHELF | HIGH_PASS | LOW_PASS  → indices 0..3
// Band 3: PEAK | HIGH_SHELF | LOW_PASS | HIGH_PASS → indices 0..3
const BAND1_TYPES = ['Bell', 'Low Shelf', 'High Pass', 'Low Pass'];
const BAND3_TYPES = ['Bell', 'High Shelf', 'Low Pass', 'High Pass'];
const TYPES_PER_BAND = { 0: BAND1_TYPES, 2: BAND3_TYPES };
const FULL_CHOICE    = new Set([0, 2]);
const SLOPES         = [6, 12, 18, 24];

// ------------------------------------------------
//  State
// ------------------------------------------------
const state = {
	enabled: true,
	bands: [
		{ type: 'Bell', gain: 0, freq: 100,   q: 1 },
		{ type: 'Bell', gain: 0, freq: 1000,  q: 1 },
		{ type: 'Bell', gain: 0, freq: 10000, q: 1 },
	],
	lc: { enabled: false, freq: 100, slope: 1 },
};

// ------------------------------------------------
//  OSC bridge (postMessage to opener)
// ------------------------------------------------
function sendOsc(addr, value) {
	if (!window.opener || window.opener.closed) return;
	window.opener.postMessage({ type: 'CHEQ_OSC_SEND', addr, value }, '*');
}

// ------------------------------------------------
//  Tooltip
// ------------------------------------------------
const tooltipEl = document.getElementById('tooltip');
function showTooltip(txt, color) {
	tooltipEl.textContent = txt;
	tooltipEl.style.borderColor = color || '';
	tooltipEl.style.color       = color || '';
	tooltipEl.style.display     = 'block';
}
function hideTooltip() { tooltipEl.style.display = 'none'; }
window.addEventListener('mousemove', (e) => {
	tooltipEl.style.left = (e.clientX + 14) + 'px';
	tooltipEl.style.top  = (e.clientY - 20) + 'px';
});

// ------------------------------------------------
//  Toolbar — EQ bypass
// ------------------------------------------------
const eqBypassBtn = new Button({
	variant: 'bypass',
	label: 'EQ',
	active: state.enabled,
	title: 'Toggle EQ',
});
document.getElementById('bypassBtnSlot').replaceWith(eqBypassBtn.element);
eqBypassBtn.element.addEventListener('user-change', () => {
	state.enabled = eqBypassBtn.active;
	sendOsc(`${oscPrefix}/eq`, state.enabled ? 1 : 0);
	eqGraph.draw();
});

// ------------------------------------------------
//  Canvas / EQ graph
// ------------------------------------------------
const canvas = document.getElementById('eqCanvas');

const graphBands = () => {
	const out = state.bands.map(b => ({ ...b, enabled: state.enabled }));
	out.push({
		type:    'Low Cut',
		freq:    state.lc.freq,
		slope:   state.lc.slope,
		enabled: state.lc.enabled,
	});
	return out;
};

let eqBandRow;     // forward refs
let lcSlopeKnob, lcFreqKnob;

const eqGraph = new EQGraph(canvas, {
	limits: {
		db:   { min: DB_MIN, max: DB_MAX },
		freq: { min: FREQ_MIN, max: FREQ_MAX },
		q:    { min: Q_MIN, max: Q_MAX },
	},
	displayLimits: {
		db:   { min: DB_MIN - 2.5, max: DB_MAX + 2.5 },
		freq: { min: 10, max: FREQ_MAX },
	},
	getBands:       graphBands,
	getActiveColor: () => BAND_COLORS[0],
	getNodeColor:   (i) => i < 3 ? BAND_COLORS[i] : LOWCUT_COLOR,
	onBandDrag: (i, { freq, gain }) => {
		if (i >= 3) {
			state.lc.freq = freq;
			lcFreqKnob?.updateFromOSC(freq);
			return;
		}
		state.bands[i].freq = freq;
		state.bands[i].gain = gain;
		eqBandRow?.setKnobValue(i, 'freq', freq);
		eqBandRow?.setKnobValue(i, 'gain', gain);
	},
	onBandRelease: (i) => {
		if (i >= 3) {
			sendOsc(`${oscPrefix}/lowcut/freq`, state.lc.freq);
			return;
		}
		sendOsc(`${oscPrefix}/eq/band${i+1}freq`, state.bands[i].freq);
		sendOsc(`${oscPrefix}/eq/band${i+1}gain`, state.bands[i].gain);
	},
	onBandQ: (i, q) => {
		if (i >= 3) return;
		state.bands[i].q = q;
		eqBandRow?.setKnobValue(i, 'q', q);
		sendOsc(`${oscPrefix}/eq/band${i+1}q`, q);
	},
	onTooltipShow: (txt, clr) => showTooltip(txt, clr),
	onTooltipHide: () => hideTooltip(),
	formatBandFull: (i, b) => {
		if (b.type === 'Low Cut') {
			const f = b.freq >= 1000 ? (b.freq/1000).toFixed(1)+' kHz' : Math.round(b.freq)+' Hz';
			return `Low Cut  ${f}  ${SLOPES[Math.round(b.slope ?? 0)]} dB/oct`;
		}
		const f = b.freq >= 1000 ? (b.freq/1000).toFixed(b.freq%1000===0?0:1)+' kHz' : Math.round(b.freq)+' Hz';
		return `B${i+1}  ${f}  ${(b.gain>=0?'+':'')+b.gain.toFixed(1)} dB  Q:${b.q.toFixed(2)}`;
	},
	formatBandQ: (i, b) => `B${i+1} Q: ${b.q.toFixed(2)}`,
});

// ------------------------------------------------
//  Band knob row
// ------------------------------------------------
eqBandRow = new EQBandRow({
	bandCount: N,
	fullChoiceBands: FULL_CHOICE,
	filterTypesPerBand: TYPES_PER_BAND,
	limits: {
		db:   { min: DB_MIN, max: DB_MAX },
		freq: { min: FREQ_MIN, max: FREQ_MAX },
		q:    { min: Q_MIN, max: Q_MAX },
	},
	defaults: (i) => state.bands[i],
	knobOptions: {
		gain: { label: 'Gain', size: 38 },
		freq: { label: 'Freq', size: 38 },
		q:    { label: 'Q',    size: 38 },
	},
	idPrefix: 'cheq',
	onBandChange: (i, param, val) => {
		if (param === 'type') {
			const types = TYPES_PER_BAND[i];
			const idx   = Math.max(0, types.indexOf(val));
			state.bands[i].type = val;
			sendOsc(`${oscPrefix}/eq/band${i+1}type`, idx);
			eqGraph.draw();
			return;
		}
		state.bands[i][param] = val;
		sendOsc(`${oscPrefix}/eq/band${i+1}${param}`, val);
		eqGraph.draw();
	},
	onKnobLeave: () => hideTooltip(),
});

for (let i = 0; i < N; i++) {
	for (const param of ['gain', 'freq', 'q']) {
		eqBandRow.setKnobAccent(i, param, BAND_COLORS[i].accent, BAND_COLORS[i].accentBright);
	}
}

// Build band columns DOM
const bandCols = document.getElementById('bandCols');
for (let i = 0; i < N; i++) {
	const col = document.createElement('div');
	col.className = 'band'; col.id = `band-${i}`;
	col.style.setProperty('--band-accent',        BAND_COLORS[i].accent);
	col.style.setProperty('--band-accent-bright', BAND_COLORS[i].accentBright);

	const lbl = document.createElement('div');
	lbl.className = 'band-label'; lbl.textContent = `B${i+1}`;
	col.appendChild(lbl);

	const sel = eqBandRow.typeSelect(i);
	if (sel) col.appendChild(sel);
	else {
		const fixed = document.createElement('span');
		fixed.className = 'type-fixed'; fixed.textContent = 'Bell';
		col.appendChild(fixed);
	}
	col.appendChild(eqBandRow.bandKnob(i, 'gain').element);
	col.appendChild(eqBandRow.bandKnob(i, 'freq').element);
	col.appendChild(eqBandRow.bandKnob(i, 'q').element);

	bandCols.appendChild(col);
}

// ------------------------------------------------
//  LowCut column
// ------------------------------------------------
const lcCol = document.getElementById('lcCol');
lcCol.style.setProperty('--band-accent',        LOWCUT_COLOR.accent);
lcCol.style.setProperty('--band-accent-bright', LOWCUT_COLOR.accentBright);

const lcLabel = document.createElement('div');
lcLabel.className = 'band-label'; lcLabel.textContent = 'LC';
lcCol.appendChild(lcLabel);

const lcBypassBtn = new Button({
	variant: 'bypass',
	label: 'LC',
	active: state.lc.enabled,
	title: 'Toggle Low Cut',
});
lcCol.appendChild(lcBypassBtn.element);
lcBypassBtn.element.addEventListener('user-change', () => {
	state.lc.enabled = lcBypassBtn.active;
	sendOsc(`${oscPrefix}/lowcut`, state.lc.enabled ? 1 : 0);
	eqGraph.draw();
});

const lcKnobsEl = document.createElement('div');
lcKnobsEl.className = 'lc-knobs';
lcCol.appendChild(lcKnobsEl);

lcSlopeKnob = new Knob({
	id: 'cheq-lc-slope',
	label: 'dB/oct',
	min: 0, max: 3, step: 1,
	value: state.lc.slope, resetValue: 1,
	format: (v) => String(SLOPES[Math.round(v)] ?? '?'),
	size: 38,
});
lcSlopeKnob.setAccentColor(LOWCUT_COLOR.accent, LOWCUT_COLOR.accentBright);
lcKnobsEl.appendChild(lcSlopeKnob.element);
lcSlopeKnob.element.addEventListener('user-change', (e) => {
	const slope = Math.round(e.detail.value);
	state.lc.slope = slope;
	sendOsc(`${oscPrefix}/lowcut/slope`, slope);
	eqGraph.draw();
});

lcFreqKnob = new Knob({
	id: 'cheq-lc-freq',
	label: 'Freq',
	min: 20, max: 500,
	value: state.lc.freq, resetValue: 100,
	scale: 'log',
	format: (v) => Math.round(v) + ' Hz',
	size: 38,
	sendDuringDrag: true, sendInterval: 30,
});
lcFreqKnob.setAccentColor(LOWCUT_COLOR.accent, LOWCUT_COLOR.accentBright);
lcKnobsEl.appendChild(lcFreqKnob.element);
lcFreqKnob.element.addEventListener('user-change', (e) => {
	state.lc.freq = e.detail.value;
	sendOsc(`${oscPrefix}/lowcut/freq`, e.detail.value);
	eqGraph.draw();
});

// ------------------------------------------------
//  Incoming OSC from opener
// ------------------------------------------------
window.addEventListener('message', (e) => {
	if (!e.data || e.data.type !== 'CHEQ_OSC_RECV') return;
	const { addr, value } = e.data;
	if (!addr.startsWith(oscPrefix + '/')) return;
	const sub = addr.slice(oscPrefix.length + 1);

	if (sub === 'eq') {
		state.enabled = !!value;
		eqBypassBtn.active = state.enabled;
		eqGraph.draw();
		return;
	}
	if (sub === 'lowcut') {
		state.lc.enabled = !!value;
		lcBypassBtn.active = state.lc.enabled;
		eqGraph.draw();
		return;
	}
	if (sub === 'lowcut/freq') {
		state.lc.freq = value;
		lcFreqKnob.updateFromOSC(value);
		eqGraph.draw();
		return;
	}
	if (sub === 'lowcut/slope') {
		state.lc.slope = value;
		lcSlopeKnob.updateFromOSC(value);
		eqGraph.draw();
		return;
	}
	const bandMatch = sub.match(/^eq\/band(\d)(type|gain|freq|q)$/);
	if (bandMatch) {
		const i = parseInt(bandMatch[1], 10) - 1;
		const prop = bandMatch[2];
		if (prop === 'type') {
			const types = TYPES_PER_BAND[i];
			if (!types) return;
			const t = types[value] ?? 'Bell';
			state.bands[i].type = t;
			eqBandRow.setType(i, t);
		} else {
			state.bands[i][prop] = value;
			eqBandRow.setKnobValue(i, prop, value);
		}
		eqGraph.draw();
	}
});

// ------------------------------------------------
//  Init
// ------------------------------------------------
requestAnimationFrame(() => eqGraph.resize());
