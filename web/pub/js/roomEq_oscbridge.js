// ------------------------------------------------
//  roomEq_oscbridge.js
//
//  Manages per-output-channel RoomEQ popup windows.
//  Imported by oscmix.js as an ES module.
//
//  Usage:
//    import { RoomEQBridge } from './roomEq_oscbridge.js';
//    const bridge = new RoomEQBridge(iface);
//    bridge.register(type, index, fragment);   // call once per output channel
// ------------------------------------------------

const ROOMEQ_PARAMS = [
  'roomeq',
  'roomeq/delay',
  'volumecal',
  ...Array.from({ length: 9 }, (_, i) => [
    `roomeq/band${i+1}gain`,
    `roomeq/band${i+1}freq`,
    `roomeq/band${i+1}q`,
  ]).flat(),
  'roomeq/band1type',
  'roomeq/band8type',
  'roomeq/band9type',
];

function rightChannelKey(leftKey) {
  // "output/5" -> "output/6"
  return leftKey.replace(/(\d+)$/, n => String(+n + 1));
}

export class RoomEQBridge {
  #channels = new Map();
  #iface;
  #deviceName = '';
  #serialNum  = '';

  constructor(iface) {
    this.#iface = iface;

    window.addEventListener('message', (e) => {
      if (!e.data || e.data.type !== 'ROOMEQ_OSC_SEND') return;
      const { addr, value } = e.data;
      const isType   = addr.endsWith('type');
      const isFreq   = addr.endsWith('freq');
      const isBypass = /\/roomeq$/.test(addr);
      try {
        if (isType || isFreq || isBypass) {
          this.#iface.send(addr, ',i', [Math.round(value)]);
        } else {
          this.#iface.send(addr, ',f', [value]);
        }
      } catch (err) {
        console.warn('[RoomEQBridge] send failed:', addr, err);
      }
    });
  }

  setDeviceInfo(name, serial) {
    this.#deviceName = name  || '';
    this.#serialNum  = serial || '';
  }

  register(type, index, fragment) {
    const channelKey = `${type}/${index + 1}`;
    const prefix     = `/${channelKey}`;

    // Keep reference to stereo checkbox so we can check at popup-open time.
    // The element stays in the DOM (only its id attribute is stripped later).
    const stereoInput = fragment.getElementById('stereo');

    const entry = { popup: null, button: null, stereoInput };
    this.#channels.set(channelKey, entry);

    const btn = fragment.getElementById('roomeq-show');
    if (btn) {
      entry.button = btn;
      btn.addEventListener('click', () => this.#openPopup(channelKey, prefix));
    }

    for (const param of ROOMEQ_PARAMS) {
      const addr     = `${prefix}/${param}`;
      const existing = this.#iface.methods.get(addr);
      this.#iface.methods.set(addr, (args) => {
        if (existing) existing(args);
        this.#forwardToPopup(channelKey, addr, args[0]);
      });
    }
  }

  #openPopup(channelKey, prefix) {
    const entry    = this.#channels.get(channelKey);
    if (!entry) return;

    if (entry.popup && !entry.popup.closed) {
      entry.popup.focus();
      return;
    }

    const isStereo  = entry.stereoInput?.checked ?? false;
    const rightKey  = isStereo ? rightChannelKey(channelKey) : null;
    const rightEntry = rightKey ? this.#channels.get(rightKey) : null;

    let params = `channel=${encodeURIComponent(channelKey)}${isStereo ? '&stereo=1' : ''}`;
    if (this.#deviceName) params += `&device=${encodeURIComponent(this.#deviceName)}`;
    if (this.#serialNum)  params += `&serial=${encodeURIComponent(this.#serialNum)}`;
    const url    = `roomEq.html?${params}`;
    const popup  = window.open(url, `roomEq_${channelKey}`, 'width=1190,height=700,resizable=yes,scrollbars=no');
    entry.popup  = popup;

    // Share the same popup with the right channel so OSC is forwarded there too
    if (rightEntry) rightEntry.popup = popup;

    if (!popup) {
      console.warn('[RoomEQBridge] popup blocked for', channelKey);
      return;
    }

    popup.addEventListener('load', () => {
      this.#pushFullState(channelKey, prefix, popup);
      if (isStereo && rightKey) {
        this.#pushFullState(rightKey, `/${rightKey}`, popup);
      }
    });

    const poll = setInterval(() => {
      if (popup.closed) {
        entry.popup = null;
        if (rightEntry) rightEntry.popup = null;
        clearInterval(poll);
      }
    }, 1000);
  }

  #forwardToPopup(channelKey, addr, value) {
    const entry = this.#channels.get(channelKey);
    if (!entry?.popup || entry.popup.closed) return;
    entry.popup.postMessage({ type: 'ROOMEQ_OSC_RECV', addr, value }, '*');
  }

  #pushFullState(channelKey, prefix, popup) {
    for (const param of ROOMEQ_PARAMS) {
      const addr   = `${prefix}/${param}`;
      const method = this.#iface.methods.get(addr);
      if (method?._cachedValue !== undefined) {
        popup.postMessage({ type: 'ROOMEQ_OSC_RECV', addr, value: method._cachedValue }, '*');
      }
    }
  }
}

export function withValueCache(handler) {
  const wrapped = (args) => {
    wrapped._cachedValue = args[0];
    handler(args);
  };
  return wrapped;
}
