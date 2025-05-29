// device_ffufxiii.js
export const device_ffufxiii = {
	deviceName: 'Fireface UFX III',
	midiPortNames: ['Port R', 'Port 4'], // Possible MIDI port names
	inputNames: [
		'Analog 1', 'Analog 2', 'Analog 3', 'Analog 4',
		'Analog 5', 'Analog 6', 'Analog 7', 'Analog 8',
		'Mic/Inst 9', 'Mic/Inst 10', 'Mic/Inst 11', 'Mic/Inst 12',
		'AES L', 'AES R',
		'ADAT 1', 'ADAT 2', 'ADAT 3', 'ADAT 4',
		'ADAT 5', 'ADAT 6', 'ADAT 7', 'ADAT 8',
		'ADAT 9', 'ADAT 10', 'ADAT 11', 'ADAT 12',
		'ADAT 13', 'ADAT 14', 'ADAT 15', 'ADAT 16',
		'MADI 1', 'MADI 2', 'MADI 3', 'MADI 4', 'MADI 5', 'MADI 6', 'MADI 7', 'MADI 8',
		'MADI 9', 'MADI 10', 'MADI 11', 'MADI 12', 'MADI 13', 'MADI 14', 'MADI 15', 'MADI 16',
		'MADI 17', 'MADI 18', 'MADI 19', 'MADI 20', 'MADI 21', 'MADI 22', 'MADI 23', 'MADI 24',
		'MADI 25', 'MADI 26', 'MADI 27', 'MADI 28', 'MADI 29', 'MADI 30', 'MADI 31', 'MADI 32',
		'MADI 33', 'MADI 34', 'MADI 35', 'MADI 36', 'MADI 37', 'MADI 38', 'MADI 39', 'MADI 40',
		'MADI 41', 'MADI 42', 'MADI 43', 'MADI 44', 'MADI 45', 'MADI 46', 'MADI 47', 'MADI 48',
		'MADI 49', 'MADI 50', 'MADI 51', 'MADI 52', 'MADI 53', 'MADI 54', 'MADI 55', 'MADI 56',
		'MADI 57', 'MADI 58', 'MADI 59', 'MADI 60', 'MADI 61', 'MADI 62', 'MADI 63', 'MADI 64',
	],
	outputNames: [
		'Analog 1', 'Analog 2', 'Analog 3', 'Analog 4',
		'Analog 5', 'Analog 6', 'Analog 7', 'Analog 8',
		'Phones 9', 'Phones 10', 'Phones 11', 'Phones 12',
		'AES L', 'AES R',
		'ADAT 1', 'ADAT 2', 'ADAT 3', 'ADAT 4',
		'ADAT 5', 'ADAT 6', 'ADAT 7', 'ADAT 8',
		'ADAT 9', 'ADAT 10', 'ADAT 11', 'ADAT 12',
		'ADAT 13', 'ADAT 14', 'ADAT 15', 'ADAT 16',
		'MADI 1', 'MADI 2', 'MADI 3', 'MADI 4', 'MADI 5', 'MADI 6', 'MADI 7', 'MADI 8',
		'MADI 9', 'MADI 10', 'MADI 11', 'MADI 12', 'MADI 13', 'MADI 14', 'MADI 15', 'MADI 16',
		'MADI 17', 'MADI 18', 'MADI 19', 'MADI 20', 'MADI 21', 'MADI 22', 'MADI 23', 'MADI 24',
		'MADI 25', 'MADI 26', 'MADI 27', 'MADI 28', 'MADI 29', 'MADI 30', 'MADI 31', 'MADI 32',
		'MADI 33', 'MADI 34', 'MADI 35', 'MADI 36', 'MADI 37', 'MADI 38', 'MADI 39', 'MADI 40',
		'MADI 41', 'MADI 42', 'MADI 43', 'MADI 44', 'MADI 45', 'MADI 46', 'MADI 47', 'MADI 48',
		'MADI 49', 'MADI 50', 'MADI 51', 'MADI 52', 'MADI 53', 'MADI 54', 'MADI 55', 'MADI 56',
		'MADI 57', 'MADI 58', 'MADI 59', 'MADI 60', 'MADI 61', 'MADI 62', 'MADI 63', 'MADI 64',
	],
	getFlags: (type, index) => {
		const flags = [];
		if (type === 'input') {
			if ([8, 9, 10, 11].includes(index)) {
				flags.push('48v', 'hi-z');
				flags.push('autoset');
			}
			if (index <= 11) {
				flags.push('gain');
				if (index <= 7)
					flags.push('reflevel');
			}
		}
		if (type === 'playback') flags.push('playback');
		if (type === 'output') {
			if (index <= 11) flags.push('reflevel');
		}
		return flags;
	},
	hardware_standalonemidi: {
		names: ["Off", "MIDI 1", "MIDI 2", "MADI O", "MADI C"],
		type: 'enum'
	}
};
