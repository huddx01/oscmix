// device_ffucx.js
export const device_ffucx = {
	deviceName: 'Fireface UCX',
	midiPortNames: ['Port 2'],
	inputNames: [
		'Mic 1', 'Mic 2', 'Inst/Line 3', 'Inst/Line 4',
		'Analog 5', 'Analog 6', 'Analog 7', 'Analog 8',
		'SPDIF 9', 'SPDIF 10', 'A/S 11', 'A/S 12',
		'ADAT 13', 'ADAT 14', 'ADAT 15', 'ADAT 16',
		'ADAT 17', 'ADAT 18'
	],
	outputNames: [
		'Analog 1', 'Analog 2', 'Analog 3', 'Analog 4',
		'Analog 5', 'Analog 6', 'Phones 7', 'Phones 8',
		'SPDIF 9', 'SPDIF 10', 'A/S 11', 'A/S 12',
		'ADAT 13', 'ADAT 14', 'ADAT 15', 'ADAT 16',
		'ADAT 17', 'ADAT 18'
	],
	getFlags: (type, index) => {
		const flags = [];
		if (type === 'input') {
			flags.push('input');
			if (index === 0 || index === 1)
				flags.push('48v', 'gain', 'autoset');
			else if (index === 2 || index === 3)
				flags.push('hi-z', 'gain', 'reflevel', 'autoset');
			else if (index >= 4 && index <= 7)
				flags.push('reflevel');
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
		type: 'bool'
	}
};
