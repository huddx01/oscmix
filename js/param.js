
function getUrlParams() {
	const params = new URLSearchParams(window.location.search);
	return {
		midi: params.has('midi'),
		midiInput: cleanParamValue(params.get('midi-input')),
		midiOutput: cleanParamValue(params.get('midi-output')),
		autoConnect: params.get('auto-connect') === 'true',
		theme: params.get('theme')
	};
}

function cleanParamValue(value) {
	if (!value) return value;
	return value.replace(/^["']+|["']+$/g, '');
}

function setSelectByText(selectElement, textValue) {
	if (!selectElement || !textValue) return false;
	
	const normalize = str => str.toLowerCase().trim().replace(/\s+/g, ' ');
	const targetValue = normalize(textValue);
	
	for (let i = 0; i < selectElement.options.length; i++) {
		const optionText = normalize(selectElement.options[i].text);
		if (optionText === targetValue) {
			selectElement.selectedIndex = i;
			return true;
		}
	}
	
	console.warn(`Device not found: "${textValue}"`);
	return false;
}

function configureFromUrl() {
	try {
		const { midi, midiInput, midiOutput, autoConnect, theme } = getUrlParams();
		
		if (theme) {
			const themeSelect = document.getElementById('ui-style-select');
			if (themeSelect) {
				for (let option of themeSelect.options) {
					if (option.value === theme) {
						themeSelect.value = theme;
						break;
					}
				}
			}
		}
		
		if (!midi && !midiInput && !midiOutput) return;
		
		const typeSelect = document.getElementById('connection-type');
		if (typeSelect && midi) {
			typeSelect.value = 'MIDI';
			
			const event = new Event('change');
			typeSelect.dispatchEvent(event);
		}
		
		const startedAt = Date.now();
		const TIMEOUT_MS = 10000;
		const checkInterval = setInterval(() => {
			const inputSelect = document.getElementById('connection-midi-input');
			const outputSelect = document.getElementById('connection-midi-output');

			if (!inputSelect || !outputSelect) return;

			const inputReady = !midiInput || (inputSelect.options.length > 0);
			const outputReady = !midiOutput || (outputSelect.options.length > 0);
			if (!inputReady || !outputReady) {
				if (Date.now() - startedAt > TIMEOUT_MS) {
					console.warn('URL config: MIDI ports never appeared, giving up.');
					clearInterval(checkInterval);
				}
				return;
			}

			let inputOk = true, outputOk = true;
			if (midiInput) inputOk = setSelectByText(inputSelect, midiInput);
			if (midiOutput) outputOk = setSelectByText(outputSelect, midiOutput);

			// Fire change so oscmix.js updates dataset.id / currentDevice
			if (midiInput && inputOk) inputSelect.dispatchEvent(new Event('change'));
			if (midiOutput && outputOk) outputSelect.dispatchEvent(new Event('change'));

			clearInterval(checkInterval);

			if (autoConnect && inputOk && outputOk) {
				const connectBtn = document.getElementById('connection-connect');
				if (connectBtn) setTimeout(() => connectBtn.click(), 500);
			}
		}, 300);
	} catch (error) {
		console.error("Error in URL config:", error);
	}
}

window.addEventListener('DOMContentLoaded', configureFromUrl);
