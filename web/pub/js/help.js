
document.addEventListener('DOMContentLoaded', function() {
	fetch('help.html?v=' + Date.now(), { cache: 'no-store' })
		.then(response => response.text())
		.then(html => {
			document.getElementById('help-container').innerHTML = html;
			setupHelpPopup();
			updateStaticExamples();
			setupBuilder();
		})
		.catch(error => console.error('Fehler beim Laden des Hilfe-Popups:', error));
});

function setupHelpPopup() {
	const helpButton = document.getElementById('url-help-button');
	const helpPopup = document.getElementById('help-popup');
	const helpOverlay = document.getElementById('help-overlay');
	const closeButton = document.getElementById('close-help');

	if (!helpButton || !helpPopup || !helpOverlay || !closeButton) return;

	const open = () => {
		helpPopup.style.display = 'block';
		helpOverlay.style.display = 'block';
		// Refresh dynamic data each time it's opened
		if (typeof refreshBuilder === 'function') refreshBuilder();
	};
	const close = () => {
		helpPopup.style.display = 'none';
		helpOverlay.style.display = 'none';
	};

	helpButton.addEventListener('click', open);
	closeButton.addEventListener('click', close);
	helpOverlay.addEventListener('click', close);
	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && helpPopup.style.display === 'block') close();
	});
}

function updateStaticExamples() {
	const baseUrl = window.location.origin + window.location.pathname;
	const baseUrlElement = document.getElementById('current-base-url');
	if (baseUrlElement) baseUrlElement.textContent = baseUrl;

	document.querySelectorAll('.url-example').forEach(element => {
		const params = element.getAttribute('data-params');
		element.textContent = `${baseUrl}?${params}`;
	});
}

let refreshBuilder = () => {};

function setupBuilder() {
	const form = document.getElementById('url-builder');
	const midiCheck = document.getElementById('builder-midi');
	const autoCheck = document.getElementById('builder-auto-connect');
	const inputSelect = document.getElementById('builder-midi-input');
	const outputSelect = document.getElementById('builder-midi-output');
	const themeSelect = document.getElementById('builder-theme');
	const urlField = document.getElementById('builder-url');
	const copyBtn = document.getElementById('builder-copy');
	const openBtn = document.getElementById('builder-open');
	const loadBtn = document.getElementById('builder-load-midi');
	const midiStatus = document.getElementById('builder-midi-status');
	const copyStatus = document.getElementById('copy-status');

	if (!form || !midiCheck || !autoCheck || !inputSelect || !outputSelect ||
		!themeSelect || !urlField || !copyBtn || !openBtn || !loadBtn) {
		console.warn('URL builder: missing DOM elements — likely a stale help.html cache. Hard-reload (Cmd+Shift+R) to fix.');
		return;
	}

	// Populate theme dropdown from the existing UI Settings select
	const uiThemeSelect = document.getElementById('ui-style-select');
	if (uiThemeSelect) {
		for (const option of uiThemeSelect.options) {
			const opt = new Option(option.text, option.value);
			themeSelect.add(opt);
		}
	}

	// Helpers ---------------------------------------------------------------
	const setPortOptions = (select, names) => {
		const previous = select.value;
		// Reset (keep the "none" option)
		select.length = 1;
		for (const name of names) select.add(new Option(name, name));
		// Restore previous selection if still available
		if (previous && Array.from(select.options).some(o => o.value === previous)) {
			select.value = previous;
		}
	};

	const populateFromExistingSelects = () => {
		const liveIn = document.getElementById('connection-midi-input');
		const liveOut = document.getElementById('connection-midi-output');
		const inNames = liveIn ? Array.from(liveIn.options).map(o => o.text).filter(Boolean) : [];
		const outNames = liveOut ? Array.from(liveOut.options).map(o => o.text).filter(Boolean) : [];
		if (inNames.length || outNames.length) {
			setPortOptions(inputSelect, inNames);
			setPortOptions(outputSelect, outNames);
			midiStatus.textContent = `${inNames.length} input(s), ${outNames.length} output(s) detected.`;
			loadBtn.style.display = 'none';
			return true;
		}
		return false;
	};

	const requestMidi = () => {
		if (!navigator.requestMIDIAccess) {
			midiStatus.textContent = 'Web MIDI not supported in this browser.';
			return;
		}
		midiStatus.textContent = 'Requesting MIDI access…';
		navigator.requestMIDIAccess({ sysex: true }).then(access => {
			const inNames = Array.from(access.inputs.values()).map(p => p.name);
			const outNames = Array.from(access.outputs.values()).map(p => p.name);
			setPortOptions(inputSelect, inNames);
			setPortOptions(outputSelect, outNames);
			midiStatus.textContent = `${inNames.length} input(s), ${outNames.length} output(s) detected.`;
			loadBtn.style.display = 'none';
			updateUrl();
		}).catch(err => {
			midiStatus.textContent = 'MIDI access denied.';
			console.error(err);
		});
	};

	const buildUrl = () => {
		const base = window.location.origin + window.location.pathname;
		const parts = [];
		if (midiCheck.checked) parts.push('midi');
		if (inputSelect.value) parts.push('midi-input=' + encodeURIComponent(inputSelect.value));
		if (outputSelect.value) parts.push('midi-output=' + encodeURIComponent(outputSelect.value));
		if (autoCheck.checked) parts.push('auto-connect=true');
		if (themeSelect.value) parts.push('theme=' + encodeURIComponent(themeSelect.value));
		return parts.length ? `${base}?${parts.join('&')}` : base;
	};

	const updateUrl = () => { urlField.value = buildUrl(); };

	// Wire up events --------------------------------------------------------
	[midiCheck, autoCheck, inputSelect, outputSelect, themeSelect].forEach(el => {
		el.addEventListener('change', updateUrl);
		el.addEventListener('input', updateUrl);
	});

	// Selecting a port implies "MIDI on"; convenient default
	[inputSelect, outputSelect].forEach(sel => {
		sel.addEventListener('change', () => {
			if (sel.value) midiCheck.checked = true;
			updateUrl();
		});
	});

	loadBtn.addEventListener('click', requestMidi);

	copyBtn.addEventListener('click', () => {
		navigator.clipboard.writeText(urlField.value)
			.then(() => {
				copyStatus.textContent = 'Copied!';
				setTimeout(() => (copyStatus.textContent = ''), 2000);
			})
			.catch(err => {
				copyStatus.textContent = 'Failed to copy';
				console.error(err);
			});
	});

	openBtn.addEventListener('click', () => {
		window.open(urlField.value, '_blank', 'noopener');
	});

	// Initial fill
	refreshBuilder = () => {
		populateFromExistingSelects();
		updateUrl();
	};
	refreshBuilder();
}
