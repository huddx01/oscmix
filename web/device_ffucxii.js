// device_ffucxii.js
export const device_ffucxii = {
	deviceName: 'Fireface UCX II',
	midiPortNames: ['Port 2'],
	inputNames: [
		'Mic/Line 1', 'Mic/Line 2', 'Inst/Line 3', 'Inst/Line 4',
		'Analog 5', 'Analog 6', 'Analog 7', 'Analog 8',
		'SPDIF L', 'SPDIF R', 'AES L', 'AES R',
		'ADAT 1', 'ADAT 2', 'ADAT 3', 'ADAT 4',
		'ADAT 5', 'ADAT 6', 'ADAT 7', 'ADAT 8',
	],
	outputNames: [
		'Analog 1', 'Analog 2', 'Analog 3', 'Analog 4',
		'Analog 5', 'Analog 6', 'Phones 7', 'Phones 8',
		'SPDIF L', 'SPDIF R', 'AES L', 'AES R',
		'ADAT 1', 'ADAT 2', 'ADAT 3', 'ADAT 4',
		'ADAT 5', 'ADAT 6', 'ADAT 7', 'ADAT 8',
	],
	getFlags: (type, index) => {
		const flags = [];
		if (type === 'input') {
			flags.push('input');
			if (index === 0 || index === 1)
				flags.push('48v');
			if (index === 2 || index === 3)
				flags.push('hi-z');
			if (index <= 3)
				flags.push('autoset');
			if (index <= 7) {
				if (index >= 2)
					flags.push('reflevel');
				flags.push('gain');
			}
		}
		if (type === 'playback') {
			flags.push('playback');
		}
		if (type === 'output' && index <= 7) {  
			flags.push('reflevel');
		}
		return flags;
	},
	hardware_standalonemidi: {
		names: ["Off", "On"],
		type: 'bool' // backwards compatibility
	}
};
