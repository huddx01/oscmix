"use strict";

/*
 * Button — reusable styled button component.
 *
 * Variants:
 *   default — plain button, no toggle state. Just fires `user-change` on click.
 *   bypass  — On/Off toggle. Active = accent fill (e.g. EQ on, RoomEQ on).
 *   toggle  — generic on/off toggle. Active = accent fill.
 *   side    — L or R button. Click always activates this button (radio-style).
 *             Pass side: 'L' | 'R'. Caller manages deactivating siblings.
 *   link    — link toggle (linked/not). Active = link-color fill.
 *
 * Options:
 *   id, title, className                 — passed through to <button>
 *   variant                              — see above
 *   side                                 — 'L' | 'R'  (only for variant 'side')
 *   label                                — fixed label (used for both states)
 *   onLabel, offLabel                    — distinct labels per state (e.g. 'On'/'Off')
 *   onHtml,  offHtml                     — innerHTML alternatives (for icons)
 *   active                               — initial state (default false)
 *   autoToggle                           — override click behavior:
 *                                          'flip' (default for bypass/toggle/link),
 *                                          'on'   (default for side),
 *                                          false  (default for default; just fire event)
 *
 * Events:
 *   'user-change' — { detail: { active } }
 *
 * API:
 *   .element        — the <button> element
 *   .active         — read/write current state
 */
export class Button {
	#element;
	#variant;
	#side;
	#onLabel;
	#offLabel;
	#onHtml;
	#offHtml;
	#autoToggle;
	#active = false;

	constructor(options = {}) {
		const variant = options.variant ?? 'default';
		this.#variant = variant;
		this.#side    = options.side ? options.side.toLowerCase() : null;

		const label   = options.label ?? '';
		this.#onLabel  = options.onLabel  ?? label;
		this.#offLabel = options.offLabel ?? label;
		this.#onHtml   = options.onHtml   ?? null;
		this.#offHtml  = options.offHtml  ?? null;

		this.#autoToggle = options.autoToggle ?? (
			variant === 'side'    ? 'on'   :
			variant === 'default' ? false  :
			                        'flip'
		);

		const btn = document.createElement('button');
		btn.type = 'button'; // never submit a parent form
		btn.classList.add('btn');
		if (variant && variant !== 'default') btn.classList.add(`btn-${variant}`);
		if (this.#side) btn.classList.add(`side-${this.#side}`);
		if (options.id)        btn.id = options.id;
		if (options.title)     btn.title = options.title;
		if (options.className) btn.classList.add(...options.className.split(/\s+/).filter(Boolean));

		btn.addEventListener('click', (e) => {
			e.preventDefault();
			if (this.#autoToggle === 'flip')    this.active = !this.#active;
			else if (this.#autoToggle === 'on') this.active = true;
			btn.dispatchEvent(new CustomEvent('user-change', {
				detail: { active: this.#active }
			}));
		});

		this.#element = btn;
		this.active = options.active ?? false;
	}

	get element() { return this.#element; }
	get active()  { return this.#active; }

	set label(text) {
		this.#onLabel = this.#offLabel = text;
		if (this.#onHtml == null) {
			this.#element.textContent = this.#active ? this.#onLabel : this.#offLabel;
		}
	}

	set active(v) {
		this.#active = !!v;
		this.#render();
	}

	#render() {
		const e = this.#element;
		e.classList.toggle('is-active', this.#active);

		// Variant-specific class hooks (kept for clarity; main styling uses .is-active)
		switch (this.#variant) {
			case 'bypass':
				e.classList.toggle('state-on',  this.#active);
				e.classList.toggle('state-off', !this.#active);
				break;
			case 'side':
				e.classList.toggle('active', this.#active);
				break;
			case 'link':
				e.classList.toggle('linked', this.#active);
				break;
		}

		const html = this.#active ? this.#onHtml : this.#offHtml;
		const text = this.#active ? this.#onLabel : this.#offLabel;
		if (html != null) e.innerHTML = html;
		else               e.textContent = text;
	}
}
