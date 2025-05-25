//device_ff802.js
export const device_ff802 = {
	deviceName: 'Fireface 802',
	inputNames: [
		'Analog 1', 'Analog 2', 'Analog 3', 'Analog 4',
		'Analog 5', 'Analog 6', 'Analog 7', 'Analog 8',
		'Mic/Inst 9', 'Mic/Inst 10', 'Mic/Inst 11', 'Mic/Inst 12',
		'AES L', 'AES R',
		'ADAT 1', 'ADAT 2', 'ADAT 3', 'ADAT 4',
		'ADAT 5', 'ADAT 6', 'ADAT 7', 'ADAT 8',
		'ADAT 9', 'ADAT 10', 'ADAT 11', 'ADAT 12',
		'ADAT 13', 'ADAT 14', 'ADAT 15', 'ADAT 16',
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
	],
	getFlags: (type, index) => {
		const flags = [];
		if (type === 'input') {
			if ([8, 9, 10, 11].includes(index)) {
				flags.push('48v', 'hi-z');
			}
			if (index <= 7) {
				flags.push('gain');
				flags.push('reflevel');
			}
		}
		if (type === 'playback') flags.push('playback');
		if (type === 'output') {
			if (index <= 7) flags.push('reflevel');
		}
		return flags;
	}
};

