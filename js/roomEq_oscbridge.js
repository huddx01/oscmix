// ════════════════════════════════════════════════
//  roomEq_oscbridge.js
//
//  Manages per-output-channel RoomEQ popup windows.
//  Imported by oscmix.js as an ES module.
//
//  Usage:
//    import { RoomEQBridge } from './roomEq_oscbridge.js';
//    const bridge = new RoomEQBridge(iface);
//    bridge.register(type, index);   // call once per output channel
// ════════════════════════════════════════════════

// OSC addresses that belong to the RoomEQ subsystem for a given channel prefix.
// These are registered as iface.methods so incoming OSC is forwarded to the popup.
const ROOMEQ_PARAMS = [
  'roomeq',
  'roomeq/delay',
  'volumecal',
  ...Array.from({ length: 9 }, (_, i) => [
    `roomeq/band${i+1}gain`,
    `roomeq/band${i+1}freq`,
    `roomeq/band${i+1}q`,
  ]).flat(),
  // Type addresses — only bands 1, 8, 9
  'roomeq/band1type',
  'roomeq/band8type',
  'roomeq/band9type',
];

export class RoomEQBridge {
  // Map of channelKey → { popup: Window|null, button: HTMLElement }
  #channels = new Map();
  #iface;

  constructor(iface) {
    this.#iface = iface;

    // Listen for outbound OSC messages from any popup window
    window.addEventListener('message', (e) => {
      if (!e.data || e.data.type !== 'ROOMEQ_OSC_SEND') return;
      const { addr, value } = e.data;
      // Determine OSC type: q use float, type/freq uses int, rest use float
      const isType = addr.endsWith('type');
      const isFreq = addr.endsWith('freq');
      const isBypass = addr.match(/\/roomeq$/);
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

  /**
   * Register a channel with the bridge.
   * Hooks into iface.methods for all roomeq OSC addresses
   * and wires up the "Room EQ" button in the channel strip.
   *
   * @param {string} type    - 'output' | 'input' | 'playback'
   * @param {number} index   - 0-based channel index
   * @param {Element} fragment - the cloned channel DOM fragment
   */
  register(type, index, fragment) {
    const channelKey = `${type}/${index + 1}`;
    const prefix     = `/${channelKey}`;

    const entry = { popup: null, button: null };
    this.#channels.set(channelKey, entry);

    // ── Wire up the "Room EQ" show button ──
    const btn = fragment.getElementById('roomeq-show');
    if (btn) {
      entry.button = btn;
      btn.addEventListener('click', () => this.#openPopup(channelKey, prefix));
    }

    // ── Register iface.methods for all roomeq params ──
    // When oscmix receives an OSC update for this channel,
    // forward it to the popup (if open).
    for (const param of ROOMEQ_PARAMS) {
      const addr = `${prefix}/${param}`;
      // Store original handler if one exists (from the generic bind loop)
      const existing = this.#iface.methods.get(addr);
      this.#iface.methods.set(addr, (args) => {
        // Call existing handler first (updates native range inputs if present)
        if (existing) existing(args);
        // Forward to popup
        this.#forwardToPopup(channelKey, addr, args[0]);
      });
    }
  }

  // ── Open or focus the popup for a channel ──
  #openPopup(channelKey, prefix) {
    const entry = this.#channels.get(channelKey);
    if (!entry) return;

    if (entry.popup && !entry.popup.closed) {
      entry.popup.focus();
      return;
    }

    const url = `roomEq.html?channel=${encodeURIComponent(channelKey)}`;
    const features = 'width=1150,height=520,resizable=yes,scrollbars=no';
    const popup = window.open(url, `roomEq_${channelKey}`, features);
    entry.popup = popup;

    if (!popup) {
      console.warn('[RoomEQBridge] popup blocked for', channelKey);
      return;
    }

    // Once popup is ready, push current state from iface
    popup.addEventListener('load', () => {
      this.#pushFullState(channelKey, prefix, popup);
    });

    // Clean up reference when popup closes
    const poll = setInterval(() => {
      if (popup.closed) {
        entry.popup = null;
        clearInterval(poll);
      }
    }, 1000);
  }

  // ── Forward a single OSC value to the popup ──
  #forwardToPopup(channelKey, addr, value) {
    const entry = this.#channels.get(channelKey);
    if (!entry?.popup || entry.popup.closed) return;
    entry.popup.postMessage({ type: 'ROOMEQ_OSC_RECV', addr, value }, '*');
  }

  // ── Push all known roomeq state to a freshly opened popup ──
  // Reads current values from the DOM inputs that the generic bind() keeps updated.
  #pushFullState(channelKey, prefix, popup) {
    for (const param of ROOMEQ_PARAMS) {
      const addr = `${prefix}/${param}`;
      // Find the DOM element that holds the current value.
      // The generic bind() system updates obj[prop] from OSC, so we can
      // read from the fragment's now-removed inputs via iface.methods closure—
      // but those are gone after removeAttribute('id'). Instead we store
      // a value cache on the iface.methods handler.
      const method = this.#iface.methods.get(addr);
      if (method?._cachedValue !== undefined) {
        popup.postMessage({
          type: 'ROOMEQ_OSC_RECV',
          addr,
          value: method._cachedValue
        }, '*');
      }
    }
  }
}

// ════════════════════════════════════════════════
//  Value cache helper
//  Wraps an iface.methods handler to cache the last received value,
//  so #pushFullState can replay it to a newly opened popup.
// ════════════════════════════════════════════════
export function withValueCache(handler) {
  const wrapped = (args) => {
    wrapped._cachedValue = args[0];
    handler(args);
  };
  return wrapped;
}
