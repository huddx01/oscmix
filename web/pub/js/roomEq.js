"use strict";
import { Knob }      from './knob.js';
import { Button }    from './button.js';
import { EQGraph }   from './eqGraph.js';
import { EQBandRow } from './eqBandRow.js';

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
		const sel = eqBandRow.typeSelect(i);
		if (!sel) return;
		const typeEqual = isStereo && state.L.bands[i].type === state.R.bands[i].type;
		sel.style.borderColor = (linked && typeEqual) ? CLR.link.accent : CLR[activeSide].accent;
	});
}

// ------------------------------------------------
//  BUILD DOM — Band Knobs
// ------------------------------------------------
const container  = document.getElementById('bandsContainer');
const extraKnobs = { L: {}, R: {} };

const eqBandRow = new EQBandRow({
	bandCount: N,
	fullChoiceBands: FULL_CHOICE_BANDS,
	filterTypes: FILTER_TYPES,
	limits: {
		db:   { min: DB_MIN,   max: DB_MAX   },
		freq: { min: FREQ_MIN, max: FREQ_MAX },
		q:    { min: Q_MIN,    max: Q_MAX    },
	},
	defaults: (i) => ({
		gain: DEFAULT_GAIN,
		freq: DEFAULT_FREQS[i],
		q:    DEFAULT_Q,
		type: 'Bell',
	}),
	knobOptions: {
		gain: { label: 'Gain', size: 38 },
		freq: { label: 'Freq', size: 38 },
		q:    { label: 'Q',    size: 38 },
	},
	idPrefix: 'b',
	onBandChange: (i, param, val) => {
		if (param === 'type') {
			activeBands()[i].type = val;
			if (linked) state[otherSide(activeSide)].bands[i].type = val;
			drawEQ();
			notifyOSC_band(i, 'type', linked ? ['L','R'] : [activeSide]);
			updateDropdownColors();
			return;
		}
		// gain | freq | q
		activeBands()[i][param] = val;
		const knob = eqBandRow.bandKnob(i, param);
		if (linked) {
			const other = otherSide(activeSide);
			state[other].bands[i][param] = val;
			notifyOSC_band(i, param, [other]);
			applyKnobColor(knob, CLR.link);
		} else {
			applyKnobColor(knob, CLR[activeSide]);
		}
		drawEQ();
		notifyOSC_band(i, param, [activeSide]);
		showTooltip(tooltipStr(i, param), (linked ? CLR.link : CLR[activeSide]).accent);
	},
	onKnobLeave: () => hideTooltip(),
});

// Compatibility alias used throughout the file
const bandKnobs = eqBandRow.knobs;

// roomEq layout: each band is a vertical column with label + knobs + optional select
for (let i = 0; i < N; i++) {
	const div = document.createElement('div');
	div.className = 'band'; div.id = `band-${i}`;

	const lbl = document.createElement('div');
	lbl.className = 'band-label'; lbl.textContent = `B${i+1}`;
	div.appendChild(lbl);

	div.appendChild(eqBandRow.bandKnob(i, 'gain').element);
	div.appendChild(eqBandRow.bandKnob(i, 'freq').element);
	div.appendChild(eqBandRow.bandKnob(i, 'q').element);

	const sel = eqBandRow.typeSelect(i);
	if (sel) div.appendChild(sel);

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
//  CANVAS / EQ DRAW (delegated to EQGraph)
// ------------------------------------------------
const canvas = document.getElementById('eqCanvas');

const eqGraph = new EQGraph(canvas, {
	limits: {
		db:   { min: DB_MIN,   max: DB_MAX   },
		freq: { min: FREQ_MIN, max: FREQ_MAX },
		q:    { min: Q_MIN,    max: Q_MAX    },
	},
	displayLimits: {
		// 2.5 dB headroom above/below; start the freq axis at 10 Hz so the
		// 20 Hz grid label sits inside the canvas instead of behind the dB labels.
		db:   { min: DB_MIN - 2.5, max: DB_MAX + 2.5 },
		freq: { min: 10, max: FREQ_MAX },
	},
	getBands:         () => activeBands().map((b, i) => ({
		// Bands not in FULL_CHOICE_BANDS render as Bell regardless of stored type
		type: FULL_CHOICE_BANDS.has(i) ? b.type : 'Bell',
		gain: b.gain, freq: b.freq, q: b.q,
	})),
	getInactiveBands: () => isStereo
		? state[otherSide(activeSide)].bands.map((b, i) => ({
			type: FULL_CHOICE_BANDS.has(i) ? b.type : 'Bell',
			gain: b.gain, freq: b.freq, q: b.q,
		}))
		: null,
	isBypassed:       () => bypassed,
	getActiveColor:   () => CLR[activeSide],
	getInactiveColor: () => CLR[otherSide(activeSide)],
	getNodeColor:     (i) => nodeColor(i),

	onBandDrag: (i, { freq, gain }) => {
		const b = activeBands()[i];
		b.freq = freq; b.gain = gain;
		if (linked) {
			const o = state[otherSide(activeSide)].bands[i];
			o.freq = freq; o.gain = gain;
		}
		bandKnobs[i].gain.updateFromOSC(gain);
		bandKnobs[i].freq.updateFromOSC(freq);
		if (linked) updateAllKnobColors();
	},
	onBandRelease: (i) => {
		notifyOSC_band(i, 'gain', linked ? ['L','R'] : [activeSide]);
		notifyOSC_band(i, 'freq', linked ? ['L','R'] : [activeSide]);
	},
	onBandFocus: (i) => {
		const bandEl = document.getElementById(`band-${i}`);
		if (!bandEl) return;
		bandEl.classList.add('active');
		bandEl.style.borderColor = (linked ? CLR.link : CLR[activeSide]).accent;
	},
	onBandBlur: (i) => {
		const bandEl = document.getElementById(`band-${i}`);
		if (!bandEl) return;
		bandEl.classList.remove('active');
		bandEl.style.borderColor = '';
	},
	onBandQ: (i, q) => {
		activeBands()[i].q = q;
		if (linked) state[otherSide(activeSide)].bands[i].q = q;
		bandKnobs[i].q.updateFromOSC(q);
		notifyOSC_band(i, 'q', linked ? ['L','R'] : [activeSide]);
	},

	onTooltipShow: (txt, clr) => showTooltip(txt, clr),
	onTooltipHide: ()         => hideTooltip(),

	formatBandFull: (i, b) =>
		`B${i+1}  ${formatFreq(b.freq)}  ${(b.gain>=0?'+':'')+b.gain.toFixed(1)} dB  Q:${b.q.toFixed(2)}`,
	formatBandQ:    (i, b) => `B${i+1} Q: ${b.q.toFixed(2)}`,
});

function drawEQ() { eqGraph.draw(); }

// Persist & restore the popup window size.
(function rememberWindowSize() {
	const KEY = 'roomEq_windowSize';
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
	const sides = linked ? (isStereo ? ['L','R'] : ['L']) : [activeSide];
	for (const side of sides) {
		presets[n].forEach((src,i) => Object.assign(state[side].bands[i],src));
	}
	FULL_CHOICE_BANDS.forEach(i => {
		const s=eqBandRow.typeSelect(i); if(s) s.value=activeBands()[i].type;
	});
	syncKnobsFromBands();
	drawEQ();
	notifyOSC_allBands(sides);
});

// ------------------------------------------------
//  RESET / BYPASS
// ------------------------------------------------
function resetEQ() {
	const sides = isStereo ? ['L','R'] : ['L'];
	for (const side of sides) {
		state[side].bands.forEach((b,i) => {b.gain=DEFAULT_GAIN;b.freq=DEFAULT_FREQS[i];b.q=DEFAULT_Q;b.type='Bell';});
		state[side].delay=0.00; state[side].volCal=0.00;
	}
	FULL_CHOICE_BANDS.forEach(i => {
		const s=eqBandRow.typeSelect(i); if(s) s.value='Bell';
	});
	syncKnobsFromBands();
	syncExtraKnobs();
	drawEQ();
	notifyOSC_all(sides);
}

// Toolbar buttons (constructed once, then state-driven via .active)
const bypassBtn = new Button({
	variant: 'bypass',
	id: 'bypassBtn',
	onLabel:  'On',
	offLabel: 'Off',
	active:   true,  // bypassed=false initially -> button shows On
});
document.getElementById('bypassBtnSlot').replaceWith(bypassBtn.element);
bypassBtn.element.addEventListener('user-change', () => {
	bypassed = !bypassBtn.active;
	drawEQ();
	notifyOSC_bypass();
});

const sideLBtn = new Button({
	variant: 'side', side: 'L', id: 'sideLBtn',
	label: 'LEFT', active: true,
});
const sideRBtn = new Button({
	variant: 'side', side: 'R', id: 'sideRBtn',
	label: 'RIGHT', active: false,
});
const linkBtn = new Button({
	variant: 'link', id: 'linkBtn',
	onHtml: '\u{1F517}', offHtml: '\u{1F517}',
	active: false,
});
document.getElementById('sideLBtnSlot').replaceWith(sideLBtn.element);
document.getElementById('linkBtnSlot').replaceWith(linkBtn.element);
document.getElementById('sideRBtnSlot').replaceWith(sideRBtn.element);

sideLBtn.element.addEventListener('user-change', () => setSide('L'));
sideRBtn.element.addEventListener('user-change', () => setSide('R'));
linkBtn.element.addEventListener('user-change', () => {
	linked = linkBtn.active;
	updateAllKnobColors();
	updateBandLabelColors();
	drawEQ();
});

function updateBypassBtn() {
	bypassBtn.active = !bypassed;
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
		const s = eqBandRow.typeSelect(i);
		if (s) s.value = activeBands()[i].type;
	});
	updateSideButtons();
	updateBandLabelColors();
	drawEQ();
}

function updateSideButtons() {
	sideLBtn.active = activeSide === 'L';
	sideRBtn.active = activeSide === 'R';
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
			FULL_CHOICE_BANDS.forEach(i=>{const s=eqBandRow.typeSelect(i);if(s)s.value=bands[i].type;});
			syncKnobsFromBands();
			syncExtraKnobs();
			drawEQ();
			notifyOSC_all([activeSide]);
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
			let appliedSides;
			if (channels.length===1){
				applyTmreqData(parseTmreqChannel(channels[0].text), activeSide);
				appliedSides = [activeSide];
			} else if (channels.length>=2 && isStereo) {
				applyTmreqData(parseTmreqChannel(channels[0].text), 'L');
				applyTmreqData(parseTmreqChannel(channels[1].text), 'R');
				appliedSides = ['L','R'];
			} else {
				const names=channels.map(ch=>ch.name);
				const choice=prompt(`Found ${names.length} channels:\n${names.map((n,i)=>`  ${i+1}. ${n}`).join('\n')}\n\nEnter channel number to import:`);
				if (choice===null) return;
				const idx=parseInt(choice)-1;
				if (isNaN(idx)||idx<0||idx>=channels.length){alert('Invalid selection.');return;}
				applyTmreqData(parseTmreqChannel(channels[idx].text), activeSide);
				appliedSides = [activeSide];
			}
			FULL_CHOICE_BANDS.forEach(i=>{const s=eqBandRow.typeSelect(i);if(s) s.value=activeBands()[i].type;});
			syncKnobsFromBands();
			syncExtraKnobs();
			drawEQ();
			notifyOSC_allBands(appliedSides);
			notifyOSC_allExtras(appliedSides);
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
	for (const side of (isStereo ? ['L','R'] : ['L'])) {
		const addr=oscAddr('roomeq', side);
		if (addr) oscSend(addr, bypassed?0:1);
	}
}

function notifyOSC_allBands(sides) {
	for (let i=0; i<N; i++) {
		notifyOSC_band(i, 'gain', sides);
		notifyOSC_band(i, 'freq', sides);
		notifyOSC_band(i, 'q',    sides);
		if (FULL_CHOICE_BANDS.has(i)) notifyOSC_band(i, 'type', sides);
	}
}

function notifyOSC_allExtras(sides) {
	for (const side of sides) {
		notifyOSC_extra('delay',  side);
		notifyOSC_extra('volCal', side);
	}
}

function notifyOSC_all(sides) {
	notifyOSC_allBands(sides);
	notifyOSC_allExtras(sides);
	notifyOSC_bypass();
}

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
				eqBandRow.setType(bi, state[side].bands[bi].type);
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
eqGraph.resize();        // initial sizing + first draw
drawAllKnobs();
updateBypassBtn();

// Exposed for the remaining inline-onclick handlers in roomEq.html
// (preset/reset/import/export buttons — these will move to button.js in a later step)
window.savePreset   = savePreset;
window.deletePreset = deletePreset;
window.resetEQ      = resetEQ;
window.exportJSON   = exportJSON;
window.importJSON   = importJSON;
window.exportTmreq  = exportTmreq;
window.importTmreq  = importTmreq;
