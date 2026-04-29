"use strict";

import { Knob } from './knob.js';

/*
 * EQBandRow — creates per-band knobs (gain/freq/q) and optional filter-type
 * selects. Owns the components; layout is the caller's responsibility.
 *
 * Options:
 *   bandCount: number
 *   fullChoiceBands: Set<number>             — band indices that get a type select
 *   filterTypesPerBand: { [idx]: string[] }  — list of filter type names per band
 *                                              (or use `filterTypes` as a shared list)
 *   filterTypes: string[]                    — fallback for all fullChoiceBands
 *   limits: { db, freq, q }                  — { min, max } per axis
 *   defaults: (idx) => { gain, freq, q, type }
 *   knobOptions: { gain?, freq?, q? }        — extra props merged into each Knob
 *   idPrefix: string                         — id prefix, default 'eqband'
 *
 *   onBandChange(idx, param, value): fires when a knob produces user-change OR a
 *     type select changes. param ∈ 'gain' | 'freq' | 'q' | 'type'.
 *   onKnobLeave(idx, param, knob): fires on knob mouseleave (e.g. for tooltip cleanup).
 *
 * API:
 *   knobs       — Array<{gain:Knob, freq:Knob, q:Knob}>
 *   typeSelects — { [idx]: HTMLSelectElement }
 *   bandKnob(idx, param)
 *   typeSelect(idx)
 *   setKnobValue(idx, param, value)              — silent display update
 *   setKnobAccent(idx, param, accent, accentBright?)
 *   setType(idx, type)                            — silent display update
 */

const KNOB_PARAMS = ['gain', 'freq', 'q'];

const DEFAULT_FORMATS = {
	gain: v => (v >= 0 ? '+' : '') + v.toFixed(1) + ' dB',
	freq: v => v >= 1000
		? (v/1000).toFixed(v % 1000 === 0 ? 0 : 1) + ' kHz'
		: Math.round(v) + ' Hz',
	q:    v => v.toFixed(2),
};

export class EQBandRow {
	#knobs       = [];
	#typeSelects = {};

	constructor(options = {}) {
		const {
			bandCount          = 3,
			fullChoiceBands    = new Set(),
			filterTypes        = ['Bell'],
			filterTypesPerBand = {},
			limits             = {},
			knobOptions        = {},
			defaults           = () => ({}),
			idPrefix           = 'eqband',
			onBandChange       = () => {},
			onKnobLeave        = () => {},
		} = options;

		const lim = {
			db:   limits.db   ?? { min: -20, max: 20    },
			freq: limits.freq ?? { min: 20,  max: 20000 },
			q:    limits.q    ?? { min: 0.4, max: 9.9   },
		};

		for (let i = 0; i < bandCount; i++) {
			const def = defaults(i) ?? {};

			const k = {
				gain: new Knob({
					id: `${idPrefix}-${i}-gain`,
					min: lim.db.min, max: lim.db.max, step: 0.1,
					value:      def.gain ?? 0,
					resetValue: def.gain ?? 0,
					bipolar: true,
					format: DEFAULT_FORMATS.gain,
					sendDuringDrag: true, sendInterval: 30,
					...(knobOptions.gain ?? {}),
				}),
				freq: new Knob({
					id: `${idPrefix}-${i}-freq`,
					min: lim.freq.min, max: lim.freq.max,
					value:      def.freq ?? 1000,
					resetValue: def.freq ?? 1000,
					scale: 'log',
					format: DEFAULT_FORMATS.freq,
					sendDuringDrag: true, sendInterval: 30,
					...(knobOptions.freq ?? {}),
				}),
				q: new Knob({
					id: `${idPrefix}-${i}-q`,
					min: lim.q.min, max: lim.q.max, step: 0.01,
					value:      def.q ?? 1.0,
					resetValue: def.q ?? 1.0,
					format: DEFAULT_FORMATS.q,
					sendDuringDrag: true, sendInterval: 30,
					...(knobOptions.q ?? {}),
				}),
			};

			for (const param of KNOB_PARAMS) {
				const knob = k[param];
				knob.element.addEventListener('user-change', (e) => {
					onBandChange(i, param, e.detail.value);
				});
				knob.element.addEventListener('mouseleave', () => {
					onKnobLeave(i, param, knob);
				});
			}

			this.#knobs.push(k);

			// Optional filter-type select
			if (fullChoiceBands.has(i)) {
				const types = filterTypesPerBand[i] ?? filterTypes;
				if (types?.length) {
					const sel = document.createElement('select');
					sel.className = 'filter-select';
					sel.id = `${idPrefix}-${i}-type`;
					for (const t of types) {
						const opt = document.createElement('option');
						opt.value = t; opt.textContent = t;
						sel.appendChild(opt);
					}
					if (def.type) sel.value = def.type;
					sel.addEventListener('change', () => {
						onBandChange(i, 'type', sel.value);
					});
					this.#typeSelects[i] = sel;
				}
			}
		}
	}

	get knobs()       { return this.#knobs; }
	get typeSelects() { return this.#typeSelects; }

	bandKnob(idx, param) { return this.#knobs[idx]?.[param]; }
	typeSelect(idx)      { return this.#typeSelects[idx]; }

	setKnobValue(idx, param, value) {
		const k = this.#knobs[idx]?.[param];
		if (k) k.updateFromOSC(value);
	}

	setKnobAccent(idx, param, accent, accentBright) {
		const k = this.#knobs[idx]?.[param];
		if (k) k.setAccentColor(accent, accentBright);
	}

	setType(idx, type) {
		const sel = this.#typeSelects[idx];
		if (sel) sel.value = type;
	}
}
