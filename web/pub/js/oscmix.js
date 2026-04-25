"use strict";

import { Knob } from "./knob.js";
import { device_ff802 } from "./device_ff802.js";
import { device_ffucx } from "./device_ffucx.js";
import { device_ffucxii } from "./device_ffucxii.js";
import { device_ffufx } from "./device_ffufx.js";
import { device_ffufxii } from "./device_ffufxii.js";
import { device_ffufxiii } from "./device_ffufxiii.js";
import { device_ffufxp } from "./device_ffufxp.js";

import { RoomEQBridge, withValueCache } from './roomEq_oscbridge.js';

// Order matters here: specific/longer device names MUST come before their prefixes
// (e.g., UFX+ before UFX, UCXII before UCX, UFXIII before UFXII before UFX)
const devices = [
	device_ff802,
	device_ffucxii,
	device_ffucx,
	device_ffufxiii,
	device_ffufxii,
	device_ffufxp,
	device_ffufx
];

let currentDevice = device_ffufxiii;

let arcControlWindow = null;

// Debug flags
let debugFlags = {
	incoming: false,
	outgoing: false,
	level: false,
	arc: false,
	other: false,
	wasm: false
};


function loadDebugFlags() {
	const saved = localStorage.getItem('debugFlags');
	if (saved) {
		try {
			const parsed = JSON.parse(saved);
			debugFlags = { ...debugFlags, ...parsed };
		} catch (e) {}
	}

	for (const key in debugFlags) {
		const cb = document.getElementById(`debug-${key}`);
		if (cb) cb.checked = debugFlags[key];
	}

	const wasmLevel = parseInt(localStorage.getItem('debugWasmLevel') ?? '0', 10);
	debugFlags.wasm = wasmLevel > 0;
	const wasmLevelSelect = document.getElementById('debug-wasm-level');
	if (wasmLevelSelect) wasmLevelSelect.value = 'd' + wasmLevel;
}

function saveDebugFlags() {
	localStorage.setItem('debugFlags', JSON.stringify(debugFlags));
}

function setupDebugListeners() {
	for (const key in debugFlags) {
		const cb = document.getElementById(`debug-${key}`);
		if (cb) {
			cb.addEventListener('change', (e) => {
				debugFlags[key] = e.target.checked;
				saveDebugFlags();
			});
		}
	}

	const wasmLevelSelect = document.getElementById('debug-wasm-level');
	if (wasmLevelSelect) {
		wasmLevelSelect.addEventListener('change', (e) => {
			const level = parseInt(e.target.value.replace('d', ''), 10);
			debugFlags.wasm = level > 0;
			localStorage.setItem('debugWasmLevel', level);
			try { iface.send('/debug', ',i', [level]); } catch (_) {}
		});
	}
}

let connectionStatus = {
	connected: false,
	oscActive: false,
	deviceName: "Disconnected"
};

// Extracted MIDI device label (e.g. "Fireface 802 (12345678)"), null for WebSocket
let midiPortLabel = null;

updatePageTitle();

/* Style Handling */
const styleSelector = document.getElementById("ui-style-select");
const styleLink = document.querySelector('link[rel="stylesheet"]');
const savedStyle = localStorage.getItem("selectedStyle");
if (savedStyle) {
	styleLink.href = savedStyle;
	styleSelector.value = savedStyle;
}
styleSelector.addEventListener("change", (e) => {
	styleLink.href = e.target.value;
	localStorage.setItem("selectedStyle", e.target.value);
});

/* Ad-hoc Fader Group */
const FaderGroup = (() => {
	// Map<channelKey, { entry: { setValue(db), get currentValue(), outerEl }, baseDb: number }>
	// baseDb = value at the time the channel joined the group.
	// Sync formula: targetDb = member.baseDb + (newDb - source.baseDb)
	// This preserves relative offsets exactly, even after clamping.
	const members = new Map();
	let _toggle         = null;
	// Map<channelKey, baseDb> loaded from localStorage before channel construction.
	let _pendingRestore = new Map();

	function deviceKey() {
		return (currentDevice?.deviceName ?? 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
	}

	function updateToggle() {
		if (!_toggle) _toggle = document.getElementById('main-adhocfaderenable');
		if (!_toggle) return;
		const active = members.size > 0;
		_toggle.checked = active;
		document.body.classList.toggle('fader-group-active', active);
	}

	// Persist keys AND baseDb values so relative offsets survive a page reload.
	// Storage format: [[key, baseDb], ...]
	function persist() {
		const data = [...members.entries()].map(([key, { baseDb }]) => [key, baseDb]);
		localStorage.setItem('faderGroup_' + deviceKey(), JSON.stringify(data));
	}

	const api = {
		get size() { return members.size; },

		has(channelKey) { return members.has(channelKey); },

		// Internal: add with an explicit baseDb (used by restore path).
		_addWithBase(channelKey, entry, baseDb) {
			members.set(channelKey, { entry, baseDb });
			entry.outerEl.classList.add('fader-group-member');
			updateToggle();
		},

		add(channelKey, entry) {
			api._addWithBase(channelKey, entry, entry.currentValue);
			persist();
		},

		remove(channelKey) {
			const rec = members.get(channelKey);
			if (rec) rec.entry.outerEl.classList.remove('fader-group-member');
			members.delete(channelKey);
			updateToggle();
			persist();
		},

		toggle(channelKey, entry) {
			if (members.has(channelKey)) api.remove(channelKey);
			else api.add(channelKey, entry);
		},

		// Clear all group members.
		// Pass save=true when triggered by the user (toggle off) to also wipe localStorage.
		// Called without argument from reinitializeUI() to avoid clearing saved state.
		clear(save = false) {
			for (const [, { entry }] of members) {
				entry.outerEl.classList.remove('fader-group-member');
			}
			members.clear();
			_pendingRestore = new Map();
			updateToggle();
			if (save) persist();
		},

		// Offset-based sync: all members move relative to their base values.
		// Only call this when the source channel IS a group member (checked by caller).
		syncFrom(sourceKey, newDb) {
			if (members.size < 2) return;
			const source = members.get(sourceKey);
			if (!source) return;
			const offset = newDb - source.baseDb;
			for (const [key, { entry, baseDb }] of members) {
				if (key === sourceKey) continue;
				const clamped = Math.min(6, Math.max(-65, baseDb + offset));
				entry.setValue(clamped);
			}
		},

		// Load saved keys + baseDb values into the pending-restore map.
		// Must be called BEFORE channel construction so registerChannel() can match.
		restore() {
			const raw = localStorage.getItem('faderGroup_' + deviceKey());
			if (!raw) { _pendingRestore = new Map(); return; }
			try {
				const parsed = JSON.parse(raw);
				// Support both legacy format (array of keys) and current format ([[key, baseDb], ...]).
				_pendingRestore = new Map(
					Array.isArray(parsed[0])
						? parsed                          // current: [[key, baseDb], ...]
						: parsed.map(k => [k, null])      // legacy: [key, ...]
				);
			} catch (e) {
				_pendingRestore = new Map();
			}
		},

		// Called by each Channel constructor - silently restores membership if needed.
		// Uses the stored baseDb so relative offsets survive a page reload.
		registerChannel(channelKey, entry) {
			if (!_pendingRestore.has(channelKey)) return;
			const storedBase = _pendingRestore.get(channelKey);
			// Use stored baseDb if available; fall back to current value otherwise.
			const baseDb = storedBase !== null ? storedBase : entry.currentValue;
			api._addWithBase(channelKey, entry, baseDb);
			_pendingRestore.delete(channelKey);
		},

		// Wire the global toggle once at startup.
		initToggle() {
			_toggle = document.getElementById('main-adhocfaderenable');
			if (!_toggle) return;
			_toggle.addEventListener('change', () => {
				// Turning off clears the group AND wipes localStorage (user intent).
				// Turning on manually is a no-op - members are only added via shift+click.
				if (!_toggle.checked) api.clear(true);
			});
		}
	};

	return api;
})();

/* OSC */
class OSCDecoder {
	constructor(buffer, offset = 0, length = buffer.byteLength) {
		this.buffer = buffer;
		this.offset = offset;
		this.length = length;
		this.textDecoder = new TextDecoder();
	}
	getString() {
		const data = new Uint8Array(this.buffer, this.offset, this.length);
		const end = data.indexOf(0);
		if (end == -1) throw new Error("OSC string is not nul-terminated");
		const str = this.textDecoder.decode(data.subarray(0, end));
		const len = (end + 4) & -4;
		this.offset += len;
		this.length -= len;
		return str;
	}
	getInt() {
		const view = new DataView(this.buffer, this.offset, this.length);
		this.offset += 4;
		this.length -= 4;
		return view.getInt32(0);
	}
	getFloat() {
		const view = new DataView(this.buffer, this.offset, this.length);
		this.offset += 4;
		this.length -= 4;
		return view.getFloat32(0);
	}
}

class OSCEncoder {
	constructor() {
		this.buffer = new ArrayBuffer(1024);
		this.offset = 0;
		this.textEncoder = new TextEncoder();
	}
	data() {
		return new Uint8Array(this.buffer, 0, this.offset);
	}
	#ensureSpace(length) {
		while (this.buffer.length - this.offset < length) this.buffer.resize(this.buffer.length * 2);
	}
	putString(value) {
		this.#ensureSpace(value.length + 1);
		const data = new Uint8Array(this.buffer, this.offset, value.length);
		const { read } = this.textEncoder.encodeInto(value, data);
		if (read < value.length) throw new Error("string contains non-ASCII characters");
		this.offset += (value.length + 4) & -4;
	}
	putInt(value) {
		this.#ensureSpace(4);
		new DataView(this.buffer, this.offset, 4).setInt32(0, value);
		this.offset += 4;
	}
	putFloat(value) {
		this.#ensureSpace(4);
		new DataView(this.buffer, this.offset, 4).setFloat32(0, value);
		this.offset += 4;
	}
}

const WASI = {
	EBADF: 8,
	ENOTSUP: 58
};

class ConnectionWebSocket extends AbortController {
	constructor(socket) {
		super();
		this.ready = new Promise((resolve, reject) => {
			socket.addEventListener("open", resolve, { once: true, signal: this.signal });
			socket.addEventListener(
									"close",
									(event) => {
										const error = new Error("WebSocket closed with code " + event.code);
										reject(error);
										this.abort(error);
									},
									{ once: true, signal: this.signal }
									);
			this.signal.addEventListener(
										 "abort",
										 (event) => {
											 reject(event.target.reason);
											 socket.close();
										 },
										 { once: true }
										 );
		});
		socket.addEventListener(
								"message",
								(event) => {
									if (this.recv) event.data.arrayBuffer().then(this.recv.bind(this));
								},
								{ signal: this.signal }
								);
		this.send = (data) => {
			socket.send(data);
		};
	}
}

class ConnectionMIDI extends AbortController {
	static #module;
	constructor(input, output) {
		super();
		let instance;
		let stderrBuf = "";
		const imports = {
			env: {
				writeosc: function (buf, len) {
					if (this.recv) this.recv(instance.exports.memory.buffer, buf, len);
				}.bind(this),
				writemidi(buf, len) {
					output.send(new Uint8Array(instance.exports.memory.buffer, buf, len));
				}
			},
			wasi_snapshot_preview1: {
				fd_close() {
					return WASI.ENOTSUP;
				},
				fd_fdstat_get() {
					return WASI.ENOTSUP;
				},
				fd_seek() {
					return WASI.ENOTSUP;
				},
				fd_write(fd, iovsPtr, iovsLen, ret) {
					if (fd != 2) return WASI.EBADF;
					const text = new TextDecoder();
					const memory = instance.exports.memory.buffer;
					const iovs = new Uint32Array(memory, iovsPtr, 2 * iovsLen);
					let length = 0;
					for (let i = 0; i < iovs.length; i += 2) {
						length += iovs[i + 1];
						stderrBuf += text.decode(new Uint8Array(memory, iovs[i], iovs[i + 1]));
					}
					if (debugFlags.wasm) {
						let nl;
						while ((nl = stderrBuf.indexOf('\n')) !== -1) {
							console.debug("[WASM]", stderrBuf.slice(0, nl));
							stderrBuf = stderrBuf.slice(nl + 1);
						}
					} else {
						// discard complete lines even when logging is off
						const last = stderrBuf.lastIndexOf('\n');
						if (last !== -1) stderrBuf = stderrBuf.slice(last + 1);
					}
					new Uint32Array(memory, ret)[0] = length;
					return 0;
				},
				proc_exit: function (status) {
					this.abort(new Error("oscmix.wasm exited with status " + status));
				}.bind(this)
			}
		};
		if (!ConnectionMIDI.#module) ConnectionMIDI.#module = WebAssembly.compileStreaming(fetch("wasm/oscmix.wasm"));
		this.ready = ConnectionMIDI.#module
		.then(async (module) => {
			instance = await WebAssembly.instantiate(module, imports);
			this.signal.throwIfAborted();
			for (const symbol of ["jsdata", "jsdatalen"]) {
				if (!(symbol in instance.exports)) throw Error(`wasm module does not export '${symbol}'`);
			}
			const jsdata = instance.exports.jsdata;
			const jsdataLen = new Uint32Array(instance.exports.memory.buffer, instance.exports.jsdatalen, 4)[0];

			instance.exports._initialize();
			const name = new Uint8Array(instance.exports.memory.buffer, jsdata, jsdataLen);
			const { read } = new TextEncoder().encodeInto(input.name + "\0", name);
			if (read < input.name.length + 1) throw Error("MIDI port name is too long");
			if (instance.exports.init(jsdata) != 0) throw Error("oscmix init failed");
			input.addEventListener(
								   "midimessage",
								   (event) => {
									   try {
										   if (event.data[0] != 0xf0 || event.data[event.data.length - 1] != 0xf7) return;
										   if (event.data.length > jsdataLen) {
											   console.warn("dropping long sysex");
											   return;
										   }
										   const sysex = new Uint8Array(instance.exports.memory.buffer, jsdata, event.data.length);
										   sysex.set(event.data);
										   instance.exports.handlesysex(sysex.byteOffset, sysex.byteLength, jsdata);
									   } catch (e) {
										   console.error("Error processing sysex:", e);
									   }
								   },
								   { signal: this.signal }
								   );
			const stateHandler = (event) => {
				if (event.target.state == "disconnected") this.abort();
			};
			input.addEventListener("statechange", stateHandler, { signal: this.signal });
			output.addEventListener("statechange", stateHandler, { signal: this.signal });
			await Promise.all([input.open(), output.open()]);
			this.signal.throwIfAborted();
			const interval = setInterval(instance.exports.handletimer.bind(null, true), 100);
			this.signal.addEventListener(
										 "abort",
										 () => {
											 clearInterval(interval);
											 input.close();
											 output.close();
										 },
										 { once: true }
										 );
		})
		.catch((error) => {
			this.abort(error);
			throw error;
		});
		this.send = (data) => {
			const osc = new Uint8Array(instance.exports.memory.buffer, instance.exports.jsdata, data.length);
			osc.set(data);
			instance.exports.handleosc(osc.byteOffset, osc.byteLength);
		};
	}
}

class Interface {
	constructor() {
		this.methods = new Map();
		this.durecFiles = [];
		this.currentFile = -1;

		for (let i = 0; i < currentDevice.outputNames.length; i++) {
			this.methods.set(`/output/${i + 1}/volumecal`, (args) => {
				if (debugFlags.incoming && debugFlags.other) console.debug("[OSC IN]", `/output/${i + 1}/volumecal`, args[0]);
			});
		}
	}

	initDurec() {
		const formatTime = (seconds) => {
			const hrs = Math.floor(seconds / 3600);
			const min = Math.floor((seconds % 3600) / 60);
			const sec = seconds % 60;
			return `${hrs.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
		};

		iface.methods.set("/durec/numfiles", (args) => {
			this.durecFiles.length = args[0];
			this.updateDurecFileList();
		});

		iface.methods.set("/durec/name", (args) => {
			this.durecFiles[args[0]] = {
				...this.durecFiles[args[0]],
				name: args[1]
			};
			this.updateDurecFileList();
		});

		iface.methods.set("/durec/samplerate", (args) => {
			this.durecFiles[args[0]] = {
				...this.durecFiles[args[0]],
				samplerate: args[1]
			};
		});

		iface.methods.set("/durec/channels", (args) => {
			this.durecFiles[args[0]] = {
				...this.durecFiles[args[0]],
				channels: args[1]
			};
		});

		iface.methods.set("/durec/length", (args) => {
			this.durecFiles[args[0]] = {
				...this.durecFiles[args[0]],
				length: args[1]
			};
			document.getElementById("durec-time").max = args[1];
		});

		document.getElementById("durec-play").addEventListener("click", () => {
			if (this.currentFile >= 0) {
				iface.send("/durec/file", ",i", [this.currentFile]);
			}
			iface.send("/durec/play", ",", []);
		});
		document.getElementById("durec-record").addEventListener("click", () => {
			iface.send("/durec/record", ",", []);
		});

		document.getElementById("durec-stop").addEventListener("click", () => {
			iface.send("/durec/stop", ",", []);
			iface.send("/durec/stoprecord", ",", []);
		});

		document.getElementById("durec-delete").addEventListener("click", () => {
			iface.send("/durec/delete", ",i", [this.currentFile]);
		});

		document.getElementById("durec-file").addEventListener("change", (e) => {
			this.currentFile = parseInt(e.target.value);
			const file = this.durecFiles[this.currentFile];
			if (file) {
				document.getElementById("durec-samplerate").textContent = file.samplerate || "---";
				document.getElementById("durec-channels").textContent = file.channels || "--";
			}
		});

		document.getElementById("durec-time").addEventListener("input", (e) => {
			document.getElementById("durec-time-display").textContent = formatTime(e.target.value);
		});

		iface.bind("/durec/time", ",i", document.getElementById("durec-time"), "value", "input");
	}

	updateDurecFileList() {
		const select = document.getElementById("durec-file");
		select.innerHTML = '<option value="-1">New Recording...</option>';

		this.durecFiles.forEach((file, index) => {
			const option = document.createElement("option");
			option.value = index;
			option.textContent = file.name || `Recording ${index + 1}`;
			select.appendChild(option);
		});
	}

	#connection;
	set connection(conn) {
		this.#connection = conn;
		conn.recv = this.handleOSC.bind(this);
		conn.signal.addEventListener("abort", () => (this.#connection = null), { once: true });
	}

	handleOSC(buffer, offset, length) {
		const decoder = new OSCDecoder(buffer, offset, length);
		const addr = decoder.getString();
		if (addr == "#bundle") {
			decoder.getInt();
			decoder.getInt();
			while (decoder.length > 0) {
				const length = decoder.getInt();
				if (length % 4 != 0) throw new Error("OSC bundle has invalid padding");
				this.handleOSC(buffer, decoder.offset, length);
				decoder.offset += length;
				decoder.length -= length;
			}
		} else {
			const types = decoder.getString();
			const args = [];
			for (const type of types.substring(1)) {
				switch (type) {
					case "s":
						args.push(decoder.getString());
						break;
					case "i":
						args.push(decoder.getInt());
						break;
					case "f":
						args.push(decoder.getFloat());
						break;
				}
			}
			///---------------
			// DEBUG LOGGING
			// -------------
			const isLevel = addr.match(/\/level$/);
			const isArc = addr.match(/\/hardware\/arc(delta|buttons)/);
			const isOther = !isLevel && !isArc;

			if ( (debugFlags.incoming && debugFlags.level && isLevel) ||
				(debugFlags.incoming && debugFlags.arc && isArc) ||
				(debugFlags.incoming && debugFlags.other && isOther) ) {
				console.debug("[OSC IN]", addr, args);
			}
			const method = this.methods.get(addr);
			if (method) method(args);
		}
	}

	send(addr, types, args) {
		if (!this.#connection) throw new Error("not connected");
		if (types[0] != "," || types.length != 1 + args.length) throw new Error("invalid OSC type string");
		if (debugFlags.outgoing) {
			console.debug("[OSC OUT]", addr, types, args);
		}
		const encoder = new OSCEncoder();
		encoder.putString(addr);
		encoder.putString(types);
		for (const [i, arg] of args.entries()) {
			switch (types[1 + i]) {
				case "i":
					encoder.putInt(arg);
					break;
				case "f":
					encoder.putFloat(arg);
					break;
				case "s":
					encoder.putString(arg);
					break;
				default:
					throw new Error(`invalid OSC type '${types[1 + i]}'`);
			}
		}
		this.#connection.send(encoder.data());
	}

	bind(addr, types, obj, prop, eventType) {
		this.methods.set(addr, withValueCache((args) => {
			if (debugFlags.incoming && debugFlags.other) console.debug("[OSC BIND]", addr, args);
			const step = obj.step;
			obj[prop] = step ? Math.round(args[0] / step) * step : args[0];
			if (eventType) obj.dispatchEvent(new OSCEvent(eventType));
		}));
		if (eventType) {
			obj.addEventListener(eventType, (event) => {
				if (!(event instanceof OSCEvent)) this.send(addr, types, [obj[prop]]);
			});
		}
	}
}

class OSCEvent extends Event {}
class SubmixEvent extends Event {}

class EQBand {
	static PEAK = 0;
	static LOW_SHELF = 1;
	static HIGH_SHELF = 2;
	static LOW_PASS = 3;
	static HIGH_PASS = 4;

	#type = EQBand.PEAK;
	#gain = 0;
	#freq = 100;
	#q = 1;

	constructor() {
		this.#updateCoeffs();
	}
	#updateCoeffs() {
		const f2 = this.#freq * this.#freq;
		const f4 = f2 * f2;
		const A = Math.pow(10, this.#gain / 40);
		const Q = this.#q;
		switch (this.#type) {
			case EQBand.PEAK:
				this.a0 = f4;
				this.a1 = ((A * A) / (Q * Q) - 2) * f2;
				this.a2 = 1;
				this.b0 = f4;
				this.b1 = (1 / (A * A * Q * Q) - 2) * f2;
				break;
			case EQBand.LOW_SHELF:
				this.a0 = A * A * f4;
				this.a1 = A * (1 / (Q * Q) - 2) * f2;
				this.a2 = 1;
				this.b0 = f4 / (A * A);
				this.b1 = ((1 / (Q * Q) - 2) / A) * f2;
				break;
			case EQBand.HIGH_SHELF:
				this.a0 = A * A * f4;
				this.a1 = A * A * A * (1 / (Q * Q) - 2) * f2;
				this.a2 = A * A * A * A;
				this.b0 = A * A * f4;
				this.b1 = A * (1 / (Q * Q) - 2) * f2;
				break;
			case EQBand.LOW_PASS:
				this.a0 = f4;
				this.a1 = 0;
				this.a2 = 0;
				this.b0 = f4;
				this.b1 = (1 / (Q * Q) - 2) * f2;
				break;
			case EQBand.HIGH_PASS:
				this.a0 = 0;
				this.a1 = 0;
				this.a2 = 1;
				this.b0 = f4;
				this.b1 = (1 / (Q * Q) - 2) * f2;
				break;
		}
	}
	set type(value) {
		this.#type = value;
		this.#updateCoeffs();
	}
	set gain(value) {
		this.#gain = value;
		this.#updateCoeffs();
	}
	set freq(value) {
		this.#freq = value;
		this.#updateCoeffs();
	}
	set q(value) {
		this.#q = value;
		this.#updateCoeffs();
	}
	eval(f2, f4) {
		return (this.a0 + this.a1 * f2 + this.a2 * f4) / (this.b0 + this.b1 * f2 + f4);
	}
}

class LowCut {
	static #k = [1, 0.655, 0.528, 0.457];
	order = 1;
	freq = 100;
	eval(f2) {
		const freq = this.freq * LowCut.#k[this.order];
		const freq2 = freq * freq;
		let y = 1;
		for (let i = 0; i <= this.order; ++i) y *= f2 / (f2 + freq2);
		return y;
	}
}

class EQPlot {
	#svg;
	#grid;
	#curve;
	bands = [];
	constructor(svg) {
		this.#svg = svg;
		this.#curve = svg.querySelector(".eq-curve");
		const grid = svg.querySelector(".eq-grid");
		const observer = new ResizeObserver(() => {
			const w = svg.clientWidth;
			const h = svg.clientHeight;
			const d = [];
			for (let i = 0; i < 5; ++i) d.push(`M 0 ${Math.round(((4 + 10 * i) * h) / 48) + 0.5} H ${w}`);
			for (let i = 0; i < 3; ++i) d.push(`M ${Math.round(((7 + 10 * i) * w) / 30) + 0.5} 0 V ${h}`);
			grid.setAttribute("d", d.join(" "));
			this.update();
		});
		observer.observe(svg);
	}
	update() {
		const w = this.#svg.clientWidth;
		const h = this.#svg.clientHeight;
		let points = [];
		for (let x = 0; x <= w; ++x) {
			const f2 = Math.pow(10, 2 * (((x - 0.5) * 3) / w + 1.3));
			const f4 = f2 * f2;
			let y = 1;
			for (const band of this.bands) {
				if (band.enabled) y *= band.eval(f2, f4);
			}
			y = Math.round(h / 2) + 0.5 + ((-10 * h) / 48) * Math.log10(y);
			points.push(x, y);
		}
		this.#curve.setAttribute("points", points.join(" "));
	}
}

class Channel {
	static INPUT = "input";
	static OUTPUT = "output";
	static PLAYBACK = "playback";

	static #elements = new Set([
		"fx",
		"stereo",
		"record",
		"playchan",
		"crossfeed",
		"loopback",
		"msproc",
		"phase",
		"gain",
		"48v",
		"reflevel",
		"autoset",
		"hi-z",
		"eq",
		"eq/band1type",
		"eq/band1gain",
		"eq/band1freq",
		"eq/band1q",
		"eq/band2gain",
		"eq/band2freq",
		"eq/band2q",
		"eq/band3type",
		"eq/band3gain",
		"eq/band3freq",
		"eq/band3q",
		"lowcut",
		"lowcut/freq",
		"lowcut/slope",
		"dynamics",
		"dynamics/gain",
		"dynamics/attack",
		"dynamics/release",
		"dynamics/compthres",
		"dynamics/compratio",
		"dynamics/expthres",
		"dynamics/expratio",
		"autolevel",
		"autolevel/maxgain",
		"autolevel/headroom",
		"autolevel/risetime",
		"roomeq",
		"roomeq/delay",
		"roomeq/band1type",
		"roomeq/band1gain",
		"roomeq/band1freq",
		"roomeq/band1q",
		"roomeq/band2gain",
		"roomeq/band2freq",
		"roomeq/band2q",
		"roomeq/band3gain",
		"roomeq/band3freq",
		"roomeq/band3q",
		"roomeq/band4gain",
		"roomeq/band4freq",
		"roomeq/band4q",
		"roomeq/band5gain",
		"roomeq/band5freq",
		"roomeq/band5q",
		"roomeq/band6gain",
		"roomeq/band6freq",
		"roomeq/band6q",
		"roomeq/band7gain",
		"roomeq/band7freq",
		"roomeq/band7q",
		"roomeq/band8type",
		"roomeq/band8gain",
		"roomeq/band8freq",
		"roomeq/band8q",
		"roomeq/band9type",
		"roomeq/band9gain",
		"roomeq/band9freq",
		"roomeq/band9q",
		"volumecal"
	]);

	static submixChanged() {
		event = new SubmixEvent("change");
		const selects = document.querySelectorAll("select.channel-volume-output");
		const index = document.forms.view.elements.submix.value;
		for (const select of selects) {
			select.selectedIndex = index;
			select.dispatchEvent(event);
		}
	}

	constructor(type, index, iface, left) {
		const template = document.getElementById("channel-template");
		const fragment = template.content.cloneNode(true);
		const volumeRange  = fragment.getElementById("volume-range");
		const volumeNumber = fragment.getElementById("volume-number");
		const channelOuter = fragment.children[0];
		const channelKey   = `${type}/${index + 1}`;
		// Assigned in the appropriate type branch below; both start as no-ops.
		let sendOutputVolume = (_db) => {};
		let sendMixVolume    = (_db) => {};
		const stereo = fragment.getElementById("stereo");
		const name = fragment.getElementById("channel-name");
		const view = document.forms.view.elements;
		const gainTarget = fragment.querySelector('label[data-flags="gain"] .knob-target');
		if (gainTarget) {
			// Read gain range from the per-channel device definition
			const chDefGain = type === Channel.INPUT
				? currentDevice.inputs[index]
				: currentDevice.outputs[index];
			const gainMin = chDefGain?.gain?.min ?? 0;
			const gainMax = chDefGain?.gain?.max ?? 75;
			const gainKnob = new Knob({
				id: `gain-${type}-${index}`,
				min: gainMin,
				max: gainMax,
				value: gainMin,
				unit: "dB",
				size: 25,
				step: 0.5,
				resetValue: gainMin,
				sendDuringDrag: true,
				sendInterval: 150,
				borderColor: "#000000ab",
				valueColor: "#ffcc00"
			});

			gainTarget.innerHTML = "";
			gainTarget.appendChild(gainKnob.element);

			gainKnob.element.addEventListener("user-change", (event) => {
				const value = event.detail.value;
				iface.send(`/${type}/${index + 1}/gain`, ",f", [value]);
			});

			iface.methods.set(`/${type}/${index + 1}/gain`, (args) => {
				gainKnob.updateFromOSC(args[0]);
			});
		}

		const panTarget = fragment.querySelector('label[id="pan"] .knob-target');
		let panKnob;
		if (panTarget) {
			panKnob = new Knob({
				id: `pan-${type}-${index}`,
				min: -100,
				max: 100,
				value: 0.0,
				unit: "",
				size: 25,
				step: 1,
				resetValue: 0,
				sendDuringDrag: true,
				sendInterval: 150,
				borderColor: "#000000ab",
				valueColor: "orange"
			});
			panTarget.innerHTML = "";
			panTarget.appendChild(panKnob.element);
			panKnob.element.addEventListener("user-change", (event) => {
				const value = event.detail.value;
				if (type === Channel.OUTPUT) {
					iface.send(`/${type}/${index + 1}/pan`, ",i", [value]);
				} else {
					const outputIndex = this.outputSelect.selectedIndex;
					iface.send(`/mix/${outputIndex + 1}/${type}/${index + 1}`, ",fi", [
						this.volume[outputIndex],
						value
					]);
				}
			});
			iface.methods.set(`/${type}/${index + 1}/pan`, (args) => {
				panKnob.updateFromOSC(args[0]);
			});
		}

		const fxInput = fragment.getElementById("fx");
		const fxSlider = fragment.querySelector(".fx-slider");
		if (fxInput && fxSlider) {
			fxSlider.value = fxInput.value;

			const sendFxValue = (value) => {
				iface.send(`/${type}/${index + 1}/fx`, ",f", [value]);
			};

			fxInput.addEventListener("change", (event) => {
				if (fxSlider.value !== event.target.value) {
					fxSlider.value = event.target.value;
				}
				sendFxValue(parseFloat(event.target.value));
			});

			fxSlider.addEventListener("input", (event) => {
				const value = parseFloat(event.target.value);
				if (fxInput.value !== value.toString()) {
					fxInput.value = value;
					sendFxValue(value);
				}
			});

			[fxInput, fxSlider].forEach((element) => {
				element.addEventListener("dblclick", (event) => {
					const target = event.target;
					const resetValue = target.valueAsNumber === 0 ? parseFloat(target.min) : 0;
					if (target.value !== resetValue.toString()) {
						target.value = resetValue;
						sendFxValue(resetValue);
					}
				});
			});
		}

		let defName;
		const prefix = `/${type}/${index + 1}`;

		// Resolve per-channel definition and build flags list
		let chInfo = null;
		if (type === Channel.INPUT)  chInfo = currentDevice.inputs[index];
		if (type === Channel.OUTPUT) chInfo = currentDevice.outputs[index];
		const flags = [...(chInfo?.flags ?? [])];

		// Populate reflevel <select> options dynamically from device def
		if (chInfo?.reflevel) {
			const reflevelSelect = fragment.getElementById('reflevel');
			if (reflevelSelect) {
				reflevelSelect.innerHTML = '';
				for (const label of chInfo.reflevel) {
					reflevelSelect.appendChild(new Option(label));
				}
			}
		}

		switch (type) {
			case Channel.INPUT:
				flags.push("input");
				defName = currentDevice.inputs[index]?.name ?? currentDevice.inputNames[index];
				break;
			case Channel.PLAYBACK:
				flags.push("playback");
				defName = currentDevice.outputs[index]?.name ?? currentDevice.outputNames[index];
				break;
			case Channel.OUTPUT:
				flags.push("output");
				defName = currentDevice.outputs[index]?.name ?? currentDevice.outputNames[index];

				const selects = document.querySelectorAll("select.channel-volume-output");
				for (const select of selects) {
					const option = new Option(defName);
					option.value = index;
					select.add(option);
				}
				if (left) {
					stereo.addEventListener("change", (event) => {
						const options = document.querySelectorAll('option[value="' + index + '"]');
						for (const option of options) option.disabled = event.target.checked;
					});
				}

				stereo.addEventListener('change', () => {
					const settingsCheckbox = fragment.querySelector('.channel-show-settings');
					if (settingsCheckbox && settingsCheckbox.checked) {
						settingsCheckbox.checked = false;
						settingsCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
					}
				});

				const submix = fragment.getElementById("submix");
				submix.value = index;
				fragment.children[0].addEventListener("click", (event) => {
					if (submix.checked) return;
					if (view.routingmode.value == "submix") {
						view.submix.value = index;
						Channel.submixChanged();
					}
				});

				sendOutputVolume = (db) => {
					iface.send(prefix + "/volume", ",f", [db]);
				};

				volumeRange.oninput = volumeNumber.onchange = (event) => {
					const newDb = parseFloat(event.target.value);
					volumeRange.value = newDb;
					volumeNumber.value = newDb;
					sendOutputVolume(newDb);
					if (FaderGroup.has(channelKey)) FaderGroup.syncFrom(channelKey, newDb);
				};
				iface.methods.set(prefix + "/volume", (args) => {
					volumeRange.value = args[0];
					volumeNumber.value = args[0];
				});
				break;
		}

		fragment.children[0].dataset.flags = flags.join(" ");
		if (type != Channel.OUTPUT) {
			this.outputSelect = fragment.getElementById("volume-output");
			this.outputSelect.addEventListener("change", (event) => {
				const outputIndex = event.target.selectedIndex;
				volumeRange.value = volumeNumber.value = this.volume[outputIndex];
				if (panKnob) {
					panKnob.updateFromOSC(this.pan[outputIndex]);
				}

				if (view.routingmode.value == "submix" && !(event instanceof SubmixEvent)) {
					view.submix.value = outputIndex;
					Channel.submixChanged();
				}
			});

			sendMixVolume = (db) => {
				iface.send(`/mix/${this.outputSelect.selectedIndex + 1}${prefix}`, ",fi", [
					db,
					this.pan[this.outputSelect.selectedIndex]
				]);
			};

			volumeRange.oninput = volumeNumber.onchange = (event) => {
				const newDb = parseFloat(event.target.value);
				volumeRange.value = newDb;
				volumeNumber.value = newDb;
				this.volume[this.outputSelect.selectedIndex] = newDb;
				sendMixVolume(newDb);
				if (FaderGroup.has(channelKey)) FaderGroup.syncFrom(channelKey, newDb);
			};
			this.volume = [];
			this.pan = [];
			for (let i = 0; i < currentDevice.outputNames.length; ++i) {
				this.volume[i] = -65;
				this.pan[i] = 0;

				iface.methods.set(`/mix/${i + 1}${prefix}`, (args) => {
					const vol = Math.max(Math.round(args[0] / volumeNumber.step) * volumeNumber.step, -65);
					const pan = args[1];
					this.volume[i] = vol;

					if (pan != null) {
						this.pan[i] = pan;
						if (this.outputSelect.selectedIndex == i && panKnob) {
							panKnob.updateFromOSC(pan);
						}
					}

					if (this.outputSelect.selectedIndex == i) {
						volumeRange.value = vol;
						volumeNumber.value = vol;
					}
				});
			}
		}
		// Shift+click toggles fader group membership for this channel.
		// preventDefault stops the range input from jumping on shift+click.
		volumeRange.addEventListener("mousedown", (event) => {
			if (!event.shiftKey) return;
			event.preventDefault();
			FaderGroup.toggle(channelKey, {
				setValue(db) {
					volumeRange.value = db;
					volumeNumber.value = db;
					if (type === Channel.OUTPUT) sendOutputVolume(db);
					else sendMixVolume(db);
				},
				get currentValue() { return parseFloat(volumeRange.value); },
				outerEl: channelOuter
			});
		});

		volumeRange.addEventListener("dblclick", (event) => {
			const target = event.target;
			if (target.valueAsNumber === 0) {
				target.value = target.min;
			} else {
				target.value = 0;
			}
			volumeNumber.value = target.value;
			target.dispatchEvent(new Event("input"));
		});
		volumeNumber.addEventListener("dblclick", (event) => {
			const target = event.target;
			if (target.valueAsNumber === 0) {
				target.value = target.min;
			} else {
				target.value = 0;
			}
			volumeRange.value = target.value;
			target.dispatchEvent(new Event("change"));
		});

		for (const node of fragment.querySelectorAll(`[data-type]:not([data-type~="${type}"])`)) node.remove();

		this.volumeDiv = fragment.getElementById("channel-volume");
		this.meterValueDiv = fragment.getElementById("channel-meter-value");

		name.value = defName;
		name.addEventListener("dblclick", (event) => {
			name.readOnly = false;
			name.select();
		});
		name.addEventListener("blur", (event) => (name.readOnly = true));
		iface.methods.set(prefix + "/name", (args) => {
			name.value = args[0];
			if (type == Channel.OUTPUT) {
				const options = document.querySelectorAll(`.channel-volume-output > option[value="${index}"]`);
				for (const option of options) option.textContent = args[0];
			}
		});
		const nameForm = fragment.getElementById("channel-name-form");
		nameForm.addEventListener("submit", (event) => {
			event.preventDefault();
			name.setSelectionRange(0, 0);
			name.blur();
			iface.send(prefix + "/name", ",s", [name.value]);
			return false;
		});
		this.meter = fragment.getElementById("volume-meter");
		this.meterValue = fragment.getElementById("volume-meter-value");
		iface.methods.set(prefix + "/level", (args) => {
			let index = 0;
			if (view.meterrms.checked) index += 1;
			if (view.meterfx.checked && args.length >= 4) index += 2;
			const value = Math.max(args[index], -65);
			const percent = Math.min(100, Math.max(0, ((6 - value) / 71) * 100));
			this.meter.querySelector(".meter-fill").style.height = `${percent}%`;
			this.meterValue.textContent = value == -Infinity ? "UFL" : value.toFixed(1);
		});
		if (left) {
			stereo.addEventListener("change", (event) => {
				if (event.target.checked) {
					left.volumeDiv.insertBefore(this.meter, left.meter.nextSibling);
					left.meterValueDiv.insertBefore(this.meterValue, left.meterValue.nextSibling);
				} else {
					this.volumeDiv.insertBefore(this.meter, this.volumeDiv.firstElementChild);
					this.meterValueDiv.insertBefore(this.meterValue, this.meterValueDiv.firstElementChild);
				}
			});
			fragment.children[0].classList.add("channel-right");
		}

		const onPanelButtonChanged = (event) => {
			for (const label of event.target.parentNode.parentNode.children) {
				const other = label.firstElementChild;
				if (other != event.target) other.checked = false;
			}
		};
		for (const node of fragment.querySelectorAll('.channel-panel-buttons input[type="checkbox"]'))
			node.onchange = onPanelButtonChanged;

		const eqSvg = fragment.getElementById("eq-plot");
		if (eqSvg) {
			this.eq = new EQPlot(eqSvg);

			const eqEnabled = fragment.getElementById("eq");
			eqEnabled.addEventListener("change", (event) => {
				for (let i = 0; i < 3; ++i) this.eq.bands[i].enabled = event.target.checked;
				this.eq.update();
			});
			const band1Type = fragment.getElementById("eq/band1type");
			band1Type.addEventListener("change", (event) => {
				this.eq.bands[0].type = EQBand[event.target.value];
				this.eq.update();
			});
			const band3Type = fragment.getElementById("eq/band3type");
			band3Type.addEventListener("change", (event) => {
				this.eq.bands[2].type = EQBand[event.target.value];
				this.eq.update();
			});
			for (let i = 0; i < 3; ++i) {
				const band = new EQBand();
				this.eq.bands.push(band);
				for (const prop of ["gain", "freq", "q"]) {
					const node = fragment.getElementById(`eq/band${i + 1}${prop}`);
					node.addEventListener("change", (event) => {
						band[prop] = event.target.valueAsNumber;
						this.eq.update();
					});
				}
			}

			const lowCut = new LowCut();
			this.eq.bands.push(lowCut);
			fragment.getElementById("lowcut").addEventListener("change", (event) => {
				lowCut.enabled = event.target.checked;
				this.eq.update();
			});
			fragment.getElementById("lowcut/slope").addEventListener("change", (event) => {
				lowCut.order = event.target.selectedIndex;
				this.eq.update();
			});
			fragment.getElementById("lowcut/freq").addEventListener("change", (event) => {
				lowCut.freq = event.target.value;
				this.eq.update();
			});
		}

		const muteCheckbox = fragment.querySelector(".mute-checkbox");
		if (muteCheckbox) {
			iface.bind(prefix + "/mute", ",i", muteCheckbox, "checked", "change");
			muteCheckbox.addEventListener("change", (event) => {
				const channelElement = event.target.closest(".channel");
				if (channelElement) {
					channelElement.classList.toggle("muted", event.target.checked);
				}
			});
		}

		const soloCheckbox = fragment.querySelector(".solo-checkbox");
		if (soloCheckbox) {
			iface.bind(prefix + "/solo", ",i", soloCheckbox, "checked", "change");
		}

		const muteEnable = document.getElementById("controlroom-muteenable");
		muteEnable.addEventListener("change", () => {
			document.body.classList.toggle("global-mute-enabled", muteEnable.checked);
		});

		const soloEnable = document.getElementById("main-soloenable");
		soloEnable.addEventListener("change", () => {
			document.body.classList.toggle("global-solo-enabled", soloEnable.checked);
		});

		const recordCheckbox = fragment.querySelector(".record-checkbox");
		if (recordCheckbox) {
			iface.bind(prefix + "/record", ",i", recordCheckbox, "checked", "change");
		}

		const playCheckbox = fragment.querySelector(".play-checkbox");
		if (playCheckbox) {
			iface.bind(prefix + "/playchan", ",i", playCheckbox, "checked", "change");
		}
		if (type === Channel.OUTPUT) {
			bridge.register(type, index, fragment);
		}
		// Hide Room EQ button and crossfeed select on devices without Room EQ.
		// Must happen before the loop below strips all IDs from the fragment.
		if (!(currentDevice?.hasRoomEq ?? true)) {
			const roomeqBtn = fragment.getElementById('roomeq-show');
			if (roomeqBtn) roomeqBtn.hidden = true;
			const crossfeedSelect = fragment.getElementById('crossfeed');
			if (crossfeedSelect) crossfeedSelect.closest('label').hidden = true;
		}
		for (const node of fragment.querySelectorAll("[id]")) {
			if (Channel.#elements.has(node.id)) {
				const type = node.step && node.step < 1 ? ",f" : ",i";
				let prop;
				let eventType = "change";
				switch (node.constructor) {
					case HTMLSelectElement:
						prop = "selectedIndex";
						break;
					case HTMLInputElement:
						switch (node.type) {
							case "number":
							case "range":
								prop = "valueAsNumber";
								break;
							case "checkbox":
								prop = "checked";
								break;
						}
						break;
				}

				if (prop) {
					iface.bind(prefix + "/" + node.id, type, node, prop, eventType);
				}
			}
			node.removeAttribute("id");
		}
		// Register with FaderGroup so saved group membership is restored on connect.
		FaderGroup.registerChannel(channelKey, {
			setValue(db) {
				volumeRange.value = db;
				volumeNumber.value = db;
				if (type === Channel.OUTPUT) sendOutputVolume(db);
				else sendMixVolume(db);
			},
			get currentValue() { return parseFloat(volumeRange.value); },
			outerEl: channelOuter
		});

		this.element = fragment;
	}
}

function updatePageTitle() {
	const label = midiPortLabel ?? (currentDevice ? currentDevice.deviceName : null);
	if (midiPortLabel) {
		const status = connectionStatus?.connected ? "connected" : "disconnected";
		document.title = `oscmix - ${midiPortLabel} - ${status}`;
	} else if (currentDevice) {
		document.title = `oscmix - ${currentDevice.deviceName}`;
	} else {
		document.title = "oscmix - Generic";
	}
}

function updateConnectionStatus(connected, oscActive, deviceName) {
	connectionStatus = {
		connected,
		oscActive,
		deviceName: deviceName || connectionStatus.deviceName
	};

	if (arcControlWindow && !arcControlWindow.closed) {
		arcControlWindow.postMessage(
			{
				type: "CONNECTION_STATUS",
				...connectionStatus
			},
			"*"
		);
	}
}

function handleStatusRequests() {
	window.addEventListener("message", (event) => {
		if (event.data.type === "REQUEST_STATUS_UPDATE") {
			if (arcControlWindow && !arcControlWindow.closed) {
				arcControlWindow.postMessage(
					{
						type: "CONNECTION_STATUS",
						...connectionStatus
					},
					"*"
				);
			}
		}
	});
}

const iface = new Interface();
const bridge = new RoomEQBridge(iface);

function setupInterface() {
	const connectionType = document.getElementById("connection-type");

	const midiPorts = {
		input: document.getElementById("connection-midi-input"),
		output: document.getElementById("connection-midi-output")
	};
	for (const select of [midiPorts.input, midiPorts.output])
		select.addEventListener("change", (event) => (event.target.dataset.id = event.target.value));
	const midiOption = document.getElementById("connection-type-midi");
	function midiAccessChanged(status) {
		const denied = status.state == "denied";
		midiOption.disabled = denied;
		if (denied) {
			connectionType.selectedIndex = 0;
			connectionType.dataset.value = connectionType.value;
		}
	}
	navigator.permissions.query({ name: "midi", sysex: true }).then((status) => {
		midiAccessChanged(status);
		status.onchange = (event) => midiAccessChanged(event.target);
	});
	function midiStateChanged(event) {
		const select = midiPorts[event.port.type];
		switch (event.port.state) {
			case "connected":
				select.add(new Option(event.port.name, event.port.id));
				break;
			case "disconnected":
				let i = 0;
				for (const option of select.options) {
					if (option.value == event.port.id) {
						select.remove(i);
						break;
					}
					++i;
				}
				break;
		}
	}

	let midiAccess;
	connectionType.dataset.value = connectionType.value;
	connectionType.addEventListener("change", (event) => {
		event.target.dataset.value = event.target.value;
		// Only request MIDI access once on first switch to MIDI; connection state is managed by buttons only
		if (event.target.value == "MIDI" && !midiAccess) {
			navigator.requestMIDIAccess({ sysex: true }).then((access) => {
				if (event.target.value != "MIDI") return;

				const detectDevice = (portName) => {
					if (!portName) return undefined;
					// Prefer an exact port-suffix match first.
					const exact = devices.find((device) =>
											   portName.startsWith(device.deviceName) &&
											   device.midiPortNames.some((port) => portName.includes(port))
											   );
					if (exact) return exact;
					// Fallback
					return devices.find((device) => portName.startsWith(device.deviceName));
				};

				const updateCurrentDevice = () => {
					const inputPort = access.inputs.get(midiPorts.input.value);
					const outputPort = access.outputs.get(midiPorts.output.value);
					currentDevice = detectDevice(inputPort?.name) || detectDevice(outputPort?.name);
					// Extract device label with serial number from port name (handles Firefox duplicate format)
					const rawName = (inputPort?.name || outputPort?.name || "").split(":")[0];
					midiPortLabel = rawName.includes("(")
						? (rawName.match(/^.+?\([^)]+\)/)?.[0]?.trim() ?? null)
						: null;
					if (currentDevice) {
						console.log("Active device:", currentDevice.deviceName);
						reinitializeUI();
						updateConnectionStatus(false, false, currentDevice.deviceName);
					}
					updatePageTitle();
				};

				for (const [select, ports] of [
					[midiPorts.input, access.inputs],
					[midiPorts.output, access.outputs]
				]) {
					let lastMatchedOption = null;
					let lastMatchedId = null;
					for (const port of ports.values()) {
						const option = new Option(port.name, port.id);
						select.add(option);
						if (detectDevice(port.name)) {
							lastMatchedOption = option;
							lastMatchedId = port.id;
						}
					}
					if (select.dataset.id) {
						// Restore previously selected port if still available
						const saved = Array.from(select.options).find(o => o.value === select.dataset.id);
						if (saved) saved.selected = true;
					} else if (lastMatchedOption) {
						// First time: auto-select the best matching device port
						lastMatchedOption.selected = true;
						select.dataset.id = lastMatchedId;
					}
					select.disabled = false;
					select.addEventListener("change", updateCurrentDevice);
				}

				midiAccess = access;
				midiAccess.addEventListener("statechange", midiStateChanged);
				updateCurrentDevice();
			});
		}
	});

	const icon = document.getElementById("connection-icon");
	let connection;
	const connectionForm = document.getElementById("connection");
	connectionForm.addEventListener("submit", (event) => {
		if (event.submitter.id == "connection-reinitialise") {
			connection.abort();
			reinitializeUI();
		}
		event.preventDefault();
		if (connection) connection.abort();
		delete icon.dataset.state;
		if (event.submitter.id == "connection-disconnect") {
			icon.textContent = "";
			updateConnectionStatus(false, false);
			updatePageTitle();
			return;
		}
		const elements = event.target.elements;
		icon.textContent = elements["connection-type"].value;
		switch (elements["connection-type"].value) {
			case "WebSocket":
				connection = new ConnectionWebSocket(new WebSocket(elements["connection-websocket-address"].value));
				break;
			case "MIDI":
				const input = midiAccess.inputs.get(elements["connection-midi-input"].value);
				if (!input) throw new Error("no MIDI input");
				const output = midiAccess.outputs.get(elements["connection-midi-output"].value);
				if (!output) throw new Error("no MIDI output");
				connection = new ConnectionMIDI(input, output);
				break;
			default:
				throw new Error("unknown connection type");
		}
		connection.signal.addEventListener(
			"abort",
			() => {
				icon.dataset.state = "failed";
				connection = null;
				updateConnectionStatus(false, false);
				updatePageTitle();
			},
			{ once: true }
		);

		// Clear MIDI label when connecting via WebSocket
		if (elements["connection-type"].value !== "MIDI") midiPortLabel = null;
		connection.ready
		.then(() => {
			iface.connection = connection;
			icon.textContent = elements["connection-type"].value;
			icon.dataset.state = "connected";
			iface.send("/refresh", ",", []);
			updateConnectionStatus(true, true, currentDevice.deviceName);
			updatePageTitle();
		})
		.catch(console.error);
	});

	FaderGroup.initToggle();
	FaderGroup.restore();  // must run before channels are constructed

	/* make channels */
	for (const [type, id] of [
		[Channel.INPUT, "inputs"],
		[Channel.PLAYBACK, "playbacks"],
		[Channel.OUTPUT, "outputs"]
	]) {
		const div = document.getElementById(id);
		let left;
		for (let i = 0; i < currentDevice.outputNames.length; ++i) {
			const channel = new Channel(type, i, iface, left);
			div.appendChild(channel.element);
			left = i % 2 == 0 ? channel : null;
		}
	}

	const routingMode = document.getElementById("routing-mode");
	routingMode.addEventListener("change", Channel.submixChanged);
	document.forms.view.elements.submix.value = 0;
	Channel.submixChanged();

	iface.bind("/reverb", ",i", document.getElementById("reverb-enabled"), "checked", "change");
	const reverbType = document.getElementById("reverb-type");
	const reverbRoomScale = document.getElementById("reverb-roomscale");
	const reverbAttack = document.getElementById("reverb-attack");
	const reverbHold = document.getElementById("reverb-hold");
	const reverbRelease = document.getElementById("reverb-release");
	const reverbTime = document.getElementById("reverb-time");
	const reverbHighDamp = document.getElementById("reverb-highdamp");
	iface.bind("/reverb/type", ",i", reverbType, "selectedIndex", "change");
	reverbType.addEventListener("change", (event) => {
		const type = event.target.selectedIndex;
		reverbRoomScale.disabled = type >= 12;
		reverbAttack.disabled = type != 12;
		reverbHold.disabled = type != 12 && type != 13;
		reverbRelease.disabled = type != 12 && type != 13;
		reverbTime.disabled = type != 14;
		reverbHighDamp.disabled = type != 14;
	});
	iface.bind("/reverb/predelay", ",i", document.getElementById("reverb-predelay"), "valueAsNumber", "change");
	iface.bind("/reverb/lowcut", ",i", document.getElementById("reverb-lowcut"), "valueAsNumber", "change");
	iface.bind("/reverb/roomscale", ",f", reverbRoomScale, "valueAsNumber", "change");
	iface.bind("/reverb/attack", ",i", reverbAttack, "valueAsNumber", "change");
	iface.bind("/reverb/hold", ",i", reverbHold, "valueAsNumber", "change");
	iface.bind("/reverb/release", ",i", reverbRelease, "valueAsNumber", "change");
	iface.bind("/reverb/highcut", ",i", document.getElementById("reverb-highcut"), "valueAsNumber", "change");
	iface.bind("/reverb/time", ",f", reverbTime, "valueAsNumber", "change");
	iface.bind("/reverb/highdamp", ",i", reverbHighDamp, "valueAsNumber", "change");
	iface.bind("/reverb/smooth", ",i", document.getElementById("reverb-smooth"), "valueAsNumber", "change");
	iface.bind("/reverb/volume", ",f", document.getElementById("reverb-volume"), "valueAsNumber", "change");
	iface.bind("/reverb/width", ",f", document.getElementById("reverb-width"), "valueAsNumber", "change");
	iface.bind("/echo", ",i", document.getElementById("echo-enabled"), "checked", "change");
	iface.bind("/echo/type", ",i", document.getElementById("echo-type"), "selectedIndex", "change");
	iface.bind("/echo/delay", ",f", document.getElementById("echo-delay"), "valueAsNumber", "change");
	iface.bind("/echo/feedback", ",i", document.getElementById("echo-feedback"), "valueAsNumber", "change");
	iface.bind("/echo/hicut", ",i", document.getElementById("echo-highcut"), "selectedIndex", "change");
	iface.bind("/echo/volume", ",f", document.getElementById("echo-volume"), "valueAsNumber", "change");
	iface.bind("/echo/width", ",f", document.getElementById("echo-width"), "valueAsNumber", "change");
	iface.bind("/controlroom/mainout", ",i", document.getElementById("controlroom-mainout"), "selectedIndex", "change");
	iface.bind("/controlroom/mainmono", ",i", document.getElementById("controlroom-mainmono"), "checked", "change");
	iface.bind("/controlroom/muteenable", ",i", document.getElementById("controlroom-muteenable"), "checked", "change");
	iface.bind("/controlroom/dimreduction", ",f",document.getElementById("controlroom-dimreduction"), "valueAsNumber", "change");
	iface.bind("/controlroom/dim", ",i", document.getElementById("controlroom-dim"), "checked", "change");
	iface.bind(
		"/controlroom/recallvolume",
		",f",
		document.getElementById("controlroom-recallvolume"),
		"valueAsNumber",
		"change"
	);
	iface.bind("/clock/source", ",i", document.getElementById("clock-source"), "selectedIndex", "change");
	iface.bind("/clock/samplerate", ",i", document.getElementById("clock-samplerate"), "textContent");
	iface.bind("/clock/wckout", ",i", document.getElementById("clock-wckout"), "checked", "change");
	iface.bind("/clock/wcksingle", ",i", document.getElementById("clock-wcksingle"), "checked", "change");
	iface.bind("/clock/wckterm", ",i", document.getElementById("clock-wckterm"), "checked", "change");
	iface.bind("/hardware/aesin", ",i", document.getElementById("hardware-aesin"), "selectedIndex", "change");
	iface.bind("/hardware/opticalin", ",i", document.getElementById("hardware-opticalin"), "selectedIndex", "change");
	iface.bind("/hardware/opticalout", ",i", document.getElementById("hardware-opticalout"), "selectedIndex", "change");
	iface.bind("/hardware/opticalin2", ",i", document.getElementById("hardware-opticalin2"), "selectedIndex", "change");
	iface.bind("/hardware/opticalout2", ",i", document.getElementById("hardware-opticalout2"), "selectedIndex", "change");
	iface.bind("/hardware/spdifout", ",i", document.getElementById("hardware-spdifout"), "selectedIndex", "change");
	iface.bind("/hardware/ccmix", ",i", document.getElementById("hardware-ccmix"), "selectedIndex", "change");
	iface.bind("/hardware/ccmode", ",i", document.getElementById("hardware-ccmode"), "checked", "change");
	iface.bind(
		"/hardware/interfacemode",
		",i",
		document.getElementById("hardware-interfacemode"),
		"selectedIndex",
		"change"
	);
	iface.bind("/hardware/ccrouting", ",i", document.getElementById("hardware-ccrouting"), "selectedIndex", "change");
	iface.bind(
		"/hardware/standalonemidi",
		",i",
		document.getElementById("hardware-standalonemidi"),
		"selectedIndex",
		"change"
	);
	iface.bind(
		"/hardware/standalonearc",
		",i",
		document.getElementById("hardware-standalonearc"),
		"selectedIndex",
		"change"
	);
	iface.bind("/hardware/lockkeys", ",i", document.getElementById("hardware-lockkeys"), "selectedIndex", "change");
	iface.bind("/hardware/remapkeys", ",i", document.getElementById("hardware-remapkeys"), "checked", "change");
	document.querySelectorAll("[id^='hardware-programkey']").forEach(function(sel) {
		document.getElementById("programkey-options").querySelectorAll("option").forEach(function(opt) {
			sel.appendChild(opt.cloneNode(true));
		});
	});
	iface.bind(
		"/hardware/programkey01",
		",i",
		document.getElementById("hardware-programkey01"),
		"selectedIndex",
		"change"
	);
	iface.bind(
		"/hardware/programkey02",
		",i",
		document.getElementById("hardware-programkey02"),
		"selectedIndex",
		"change"
	);
	iface.bind(
		"/hardware/programkey03",
		",i",
		document.getElementById("hardware-programkey03"),
		"selectedIndex",
		"change"
	);
	iface.bind(
		"/hardware/programkey04",
		",i",
		document.getElementById("hardware-programkey04"),
		"selectedIndex",
		"change"
	);
	iface.bind("/hardware/lcdcontrast", ",i", document.getElementById("hardware-lcdcontrast"), "value", "input");
	{
		const el = document.getElementById("hardware-lcdcontrast");
		el.addEventListener("input", () => { el.title = el.value + " %"; });
	}

	iface.bind("/hardware/madiinput", ",i", document.getElementById("hardware-madiinput"), "selectedIndex", "change");
	iface.bind("/hardware/madioutput", ",i", document.getElementById("hardware-madioutput"), "selectedIndex", "change");
	iface.bind("/hardware/madiframe", ",i", document.getElementById("hardware-madiframe"), "selectedIndex", "change");
	iface.bind("/hardware/madiformat", ",i", document.getElementById("hardware-madiformat"), "selectedIndex", "change");
	iface.bind("/hardware/eqdrecord", ",i", document.getElementById("hardware-eqdrecord"), "checked", "change");
	iface.bind("/hardware/dspvers", ",i", document.getElementById("hardware-dspvers"), "textContent");
	{
		const dspMeter = document.getElementById("hardware-dspload-meter");
		iface.methods.set("/hardware/dspload", (args) => {
			dspMeter.value = args[0];
			dspMeter.title = args[0] + " %";
		});
	}

	iface.bind("/hardware/dspverload", ",i", document.getElementById("hardware-dspverload"), "textContent");
	iface.bind("/hardware/dspavail", ",i", document.getElementById("hardware-dspavail"), "textContent");
	iface.bind("/hardware/dspstatus", ",i", document.getElementById("hardware-dspstatus"), "textContent");

	iface.bind("/durec/file", "i", document.getElementById("durec-file"), "value", "change");
	// Buttons don't support "checked" — use aria-pressed for OSC state feedback
	for (const [addr, id] of [
		["/durec/record", "durec-record"],
		["/durec/play",   "durec-play"],
		["/durec/stop",   "durec-stop"],
	]) {
		const btn = document.getElementById(id);
		iface.methods.set(addr, (args) => {
			btn.ariaPressed = args[0] ? "true" : "false";
		});
	}

	/* allow scrolling on number and range inputs */
	const wheel = (event) => {
		event.preventDefault();
		const step = Number(event.target.step) || 1;
		let value = event.target.valueAsNumber;
		if (event.deltaY < 0) value += step;
		else if (event.deltaY > 0) value -= step;
		event.target.valueAsNumber = Math.min(Math.max(value, event.target.min), event.target.max);
		event.target.dispatchEvent(new Event(event.target.type == "range" ? "input" : "change"));
	};
	const focus = (event) => event.target.addEventListener("wheel", wheel, { passive: false });
	const blur = (event) => event.target.removeEventListener("wheel", wheel);
	for (const node of document.querySelectorAll('input[type="number"], input[type="range"]')) {
		node.addEventListener("focus", focus);
		node.addEventListener("blur", blur);
	}
	iface.initDurec();

	document.getElementById("debug-set-register").addEventListener("click", (event) => {
		event.preventDefault();
		const regInput = document.getElementById("debug-register");
		const valInput = document.getElementById("debug-value");
		const register = parseInt(regInput.value.replace(/\s/g, ""), 16);
		const value = parseInt(valInput.value.replace(/\s/g, ""), 16);
		if (isNaN(register) || isNaN(value)) {
			alert("Only hex format allowed! (0x1234 or 5678)");
			return;
		}
		try {
			iface.send("/register", ",ii", [register, value]);
			iface.send("/refresh", ",", []);
			console.log(`Reg command sent: 0x${register.toString(16)} = 0x${value.toString(16)}`);
		} catch (e) {
			console.error("Error while tried to send Reg/Val: ", e);
		}
	});

	// Setup Store Logic
	const storeButton = document.getElementById("store-button");
	const setupSlots = document.querySelectorAll(".setup-slot");
	setupSlots[0].checked = true;
	let selectedSlot = 0;
	setupSlots.forEach((slot) => {
		slot.addEventListener("change", () => {
			if (slot.checked) {
				selectedSlot = parseInt(slot.value);
			}
		});
	});

	storeButton.addEventListener("click", () => {
		iface.send("/setup/store", ",i", [selectedSlot]);
		console.log(`Setup has been stored. Slot: ${selectedSlot + 1}`);
	});
	// ARC LEDs
	document.getElementById("open-arc-control").addEventListener("click", () => {
		if (arcControlWindow && !arcControlWindow.closed) {
			arcControlWindow.focus();
		} else {
			arcControlWindow = window.open("arc.html", "ARC Control", "width=800,height=600");

			window.addEventListener("message", (event) => {
				if (event.origin !== window.location.origin) return;

				if (event.data.type === "REQUEST_STATUS_UPDATE") {
					if (arcControlWindow && !arcControlWindow.closed) {
						arcControlWindow.postMessage(
							{
								type: "CONNECTION_STATUS",
								...connectionStatus
							},
							"*"
						);
					}
				} else if (event.data.type === "OSC_COMMAND") {
					if (debugFlags.incoming && debugFlags.arc) {
						console.debug("[ARC IN]", event.data.command, event.data.args);
					}
					iface.send(event.data.command, ",i", event.data.args);
				}
			});
		}
	});
	handleStatusRequests();
}

function reinitializeUI() {
	FaderGroup.clear();
	FaderGroup.restore();  // must run before channels are constructed
	const inputsContainer = document.getElementById("inputs");
	const outputsContainer = document.getElementById("outputs");
	const playbacksContainer = document.getElementById("playbacks");
	const mainOutSelect = document.getElementById("controlroom-mainout");
	inputsContainer.innerHTML = "";
	outputsContainer.innerHTML = "";
	playbacksContainer.innerHTML = "";
	mainOutSelect.innerHTML = "";
	for (let i = 0; i < currentDevice.outputNames.length; i += 2) {
		if (i + 1 < currentDevice.outputNames.length) {
			const left = currentDevice.outputNames[i];
			const right = currentDevice.outputNames[i + 1].split(" ").pop();
			const option = document.createElement("option");
			option.textContent = `${left}/${right}`;
			mainOutSelect.appendChild(option);
		}
	}

	for (const [type, container, names] of [
		[Channel.INPUT, inputsContainer, currentDevice.inputNames],
		[Channel.PLAYBACK, playbacksContainer, currentDevice.outputNames],
		[Channel.OUTPUT, outputsContainer, currentDevice.outputNames]
	]) {
		let left;
		for (let i = 0; i < names.length; ++i) {
			const channel = new Channel(type, i, iface, left);
			container.appendChild(channel.element);
			left = i % 2 === 0 ? channel : null;
		}
	}
	populateDeviceSpecificOptions();
	applyDeviceFeatures();

	console.log("UI reinitialized for device: ", currentDevice.deviceName);
}

function applyDeviceFeatures() {
	// Show/hide static sections based on device capability flags.
	// Channel-level elements (roomeq-show, crossfeed) are handled
	// directly in the Channel constructor while IDs are still present.
	const hasDurec  = currentDevice?.hasDurec  ?? false;
	const hasHwKeys = currentDevice?.hasHwKeys ?? true;
	const hasHwLcd  = currentDevice?.hasHwLcd  ?? true;

	// DURec section
	const durecSection = document.querySelector('details:has(#durec-file)');
	if (durecSection) {
		durecSection.hidden = !hasDurec;
		const hr = durecSection.previousElementSibling;
		if (hr?.tagName === 'HR') hr.hidden = !hasDurec;
	}

	// Keys section
	const keysSection = document.querySelector('details:has(#hardware-lockkeys)');
	if (keysSection) {
		keysSection.hidden = !hasHwKeys;
		const hr = keysSection.previousElementSibling;
		if (hr?.tagName === 'HR') hr.hidden = !hasHwKeys;
	}

	// LCD Contrast label
	const lcdLabel = document.querySelector('label:has(#hardware-lcdcontrast)');
	if (lcdLabel) lcdLabel.hidden = !hasHwLcd;
}

function populateDeviceSpecificOptions() {
	const standaloneMidiSelect = document.getElementById("hardware-standalonemidi");

	if (standaloneMidiSelect && currentDevice.hardware_standalonemidi) {
		standaloneMidiSelect.innerHTML = "";
		const options = currentDevice.hardware_standalonemidi.names;

		options.forEach((option, index) => {
			const opt = document.createElement("option");
			opt.textContent = option;
			opt.value = index;
			standaloneMidiSelect.appendChild(opt);
		});
		if (currentDevice.hardware_standalonemidi.type === "bool") {
			iface.bind("/hardware/standalonemidi", ",i", standaloneMidiSelect, "selectedIndex", "change");
		} else {
			iface.bind("/hardware/standalonemidi", ",i", standaloneMidiSelect, "selectedIndex", "change");
		}
	}
}

document.addEventListener("DOMContentLoaded", () => {
	setupInterface();
	iface.initDurec();
	setTimeout(populateDeviceSpecificOptions, 100);
	applyDeviceFeatures();
	loadDebugFlags();
	setupDebugListeners();
});
