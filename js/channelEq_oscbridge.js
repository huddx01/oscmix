// ------------------------------------------------
//  channelEq_oscbridge.js
//
//  Manages per-channel popup windows for the channel EQ (3 bands + LowCut).
//  Mirrors RoomEQBridge but for the smaller per-channel param set.
// ------------------------------------------------

const CHEQ_PARAMS = [
	'eq',
	'eq/band1type',
	'eq/band1gain', 'eq/band1freq', 'eq/band1q',
	                'eq/band2gain', 'eq/band2freq', 'eq/band2q',
	'eq/band3type',
	'eq/band3gain', 'eq/band3freq', 'eq/band3q',
	'lowcut', 'lowcut/freq', 'lowcut/slope',
];

// Suffixes that travel as int over OSC. Everything else is float.
const INT_SUFFIXES = ['/eq', '/eq/band1type', '/eq/band3type', '/lowcut', '/lowcut/slope'];

function isIntAddr(addr) {
	for (const s of INT_SUFFIXES) if (addr.endsWith(s)) return true;
	return false;
}

export class ChannelEQBridge {
	#channels        = new Map();   // channelKey ("input/3") → { popup }
	#originalMethods = new Map();   // addr → inline handler captured before wrapping
	#iface;
	#deviceName = '';
	#serialNum  = '';

	constructor(iface) {
		this.#iface = iface;

		window.addEventListener('message', (e) => {
			if (!e.data || e.data.type !== 'CHEQ_OSC_SEND') return;
			const { addr, value } = e.data;
			try {
				const isInt = isIntAddr(addr);
				const sentValue = isInt ? Math.round(value) : value;
				this.#iface.send(addr, isInt ? ',i' : ',f', [sentValue]);
				// Mirror outgoing into central cache so a re-opened popup is consistent.
				this.#iface.values.set(addr, sentValue);
				// Update the inline view (original handler only — not the wrapped one,
				// which would loop the value back to the popup that just sent it).
				this.#originalMethods.get(addr)?.([sentValue]);
			} catch (err) {
				console.warn('[ChannelEQBridge] send failed:', addr, err);
			}
		});
	}

	setDeviceInfo(name, serial) {
		this.#deviceName = name  || '';
		this.#serialNum  = serial || '';
	}

	register(channelKey) {
		if (this.#channels.has(channelKey)) return;
		const prefix = `/${channelKey}`;
		const entry  = { popup: null };
		this.#channels.set(channelKey, entry);

		for (const param of CHEQ_PARAMS) {
			const addr     = `${prefix}/${param}`;
			const existing = this.#iface.methods.get(addr);
			if (existing) this.#originalMethods.set(addr, existing);
			const wrapped = (args) => {
				if (existing) existing(args);
				this.#forwardToPopup(channelKey, addr, args[0]);
			};
			this.#iface.methods.set(addr, wrapped);
		}
	}

	openPopup(channelKey) {
		const entry = this.#channels.get(channelKey);
		if (!entry) {
			console.warn('[ChannelEQBridge] openPopup: not registered:', channelKey);
			return;
		}
		if (entry.popup && !entry.popup.closed) {
			entry.popup.focus();
			return;
		}

		let params = `channel=${encodeURIComponent(channelKey)}`;
		if (this.#deviceName) params += `&device=${encodeURIComponent(this.#deviceName)}`;
		if (this.#serialNum)  params += `&serial=${encodeURIComponent(this.#serialNum)}`;

		const popup = window.open(
			`channelEq.html?${params}`,
			`chEq_${channelKey}`,
			'width=900,height=520,resizable=yes,scrollbars=no'
		);
		if (!popup) {
			console.warn('[ChannelEQBridge] popup blocked for', channelKey);
			return;
		}
		entry.popup = popup;

		popup.addEventListener('load', () => this.#pushFullState(channelKey, popup));

		const poll = setInterval(() => {
			if (popup.closed) {
				entry.popup = null;
				clearInterval(poll);
			}
		}, 1000);
	}

	#forwardToPopup(channelKey, addr, value) {
		const entry = this.#channels.get(channelKey);
		if (!entry?.popup || entry.popup.closed) return;
		entry.popup.postMessage({ type: 'CHEQ_OSC_RECV', addr, value }, '*');
	}

	#pushFullState(channelKey, popup) {
		const prefix = `/${channelKey}`;
		for (const param of CHEQ_PARAMS) {
			const addr  = `${prefix}/${param}`;
			const value = this.#iface.getCached(addr);
			if (value !== undefined) {
				popup.postMessage({ type: 'CHEQ_OSC_RECV', addr, value }, '*');
			}
		}
	}
}
