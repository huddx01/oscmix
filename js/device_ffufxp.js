// device_ffufxp.js

const RL_INPUT = ['+13dBu', '+19dBu'];
const RL_OUTPUT_XLR = ['+4dBu', '+13dBu', '+19dBu', '+24dBu'];
const RL_OUTPUT = ['+4dBu', '+13dBu', '+19dBu'];
const RL_PHONES = ['Low', 'High'];

// Helper for plain digital channels with no gain or reflevel
const dig = (name) => ({ name, flags: [], gain: null, reflevel: null });

export const device_ffufxp = {
	deviceName: 'Fireface UFX+',
	midiPortNames: ['Port 4', ':3'],
	hasDurec:  true,
	hasRoomEq: true,
	hasHwKeys: true,
	hasHwLcd:  true,
	
	inputs: [
		{ name: 'Analog 1', flags: ['gain', 'reflevel'], gain: { min: 0, max: 12 }, reflevel: RL_INPUT },
		{ name: 'Analog 2', flags: ['gain', 'reflevel'], gain: { min: 0, max: 12 }, reflevel: RL_INPUT },
		{ name: 'Analog 3', flags: ['gain', 'reflevel'], gain: { min: 0, max: 12 }, reflevel: RL_INPUT },
		{ name: 'Analog 4', flags: ['gain', 'reflevel'], gain: { min: 0, max: 12 }, reflevel: RL_INPUT },
		{ name: 'Analog 5', flags: ['gain', 'reflevel'], gain: { min: 0, max: 12 }, reflevel: RL_INPUT },
		{ name: 'Analog 6', flags: ['gain', 'reflevel'], gain: { min: 0, max: 12 }, reflevel: RL_INPUT },
		{ name: 'Analog 7', flags: ['gain', 'reflevel'], gain: { min: 0, max: 12 }, reflevel: RL_INPUT },
		{ name: 'Analog 8', flags: ['gain', 'reflevel'], gain: { min: 0, max: 12 }, reflevel: RL_INPUT },
		{ name: 'Mic/Inst 9', flags: ['gain', '48v', 'hi-z', 'autoset'], gain: { min: 0, max: 75 }, reflevel: null },
		{ name: 'Mic/Inst 10', flags: ['gain', '48v', 'hi-z', 'autoset'], gain: { min: 0, max: 75 }, reflevel: null },
		{ name: 'Mic/Inst 11', flags: ['gain', '48v', 'hi-z', 'autoset'], gain: { min: 0, max: 75 }, reflevel: null },
		{ name: 'Mic/Inst 12', flags: ['gain', '48v', 'hi-z', 'autoset'], gain: { min: 0, max: 75 }, reflevel: null },
		dig('AES L'), dig('AES R'), dig('ADAT 1'), dig('ADAT 2'), dig('ADAT 3'), dig('ADAT 4'), dig('ADAT 5'), dig('ADAT 6'),
		dig('ADAT 7'), dig('ADAT 8'), dig('ADAT 9'), dig('ADAT 10'), dig('ADAT 11'), dig('ADAT 12'), dig('ADAT 13'), dig('ADAT 14'),
		dig('ADAT 15'), dig('ADAT 16'), dig('MADI 1'), dig('MADI 2'), dig('MADI 3'), dig('MADI 4'), dig('MADI 5'), dig('MADI 6'),
		dig('MADI 7'), dig('MADI 8'), dig('MADI 9'), dig('MADI 10'), dig('MADI 11'), dig('MADI 12'), dig('MADI 13'), dig('MADI 14'),
		dig('MADI 15'), dig('MADI 16'), dig('MADI 17'), dig('MADI 18'), dig('MADI 19'), dig('MADI 20'), dig('MADI 21'), dig('MADI 22'),
		dig('MADI 23'), dig('MADI 24'), dig('MADI 25'), dig('MADI 26'), dig('MADI 27'), dig('MADI 28'), dig('MADI 29'), dig('MADI 30'),
		dig('MADI 31'), dig('MADI 32'), dig('MADI 33'), dig('MADI 34'), dig('MADI 35'), dig('MADI 36'), dig('MADI 37'), dig('MADI 38'),
		dig('MADI 39'), dig('MADI 40'), dig('MADI 41'), dig('MADI 42'), dig('MADI 43'), dig('MADI 44'), dig('MADI 45'), dig('MADI 46'),
		dig('MADI 47'), dig('MADI 48'), dig('MADI 49'), dig('MADI 50'), dig('MADI 51'), dig('MADI 52'), dig('MADI 53'), dig('MADI 54'),
		dig('MADI 55'), dig('MADI 56'), dig('MADI 57'), dig('MADI 58'), dig('MADI 59'), dig('MADI 60'), dig('MADI 61'), dig('MADI 62'),
		dig('MADI 63'), dig('MADI 64'),
	],

	outputs: [
		{ name: 'Analog 1', flags: ['reflevel'], gain: null, reflevel: RL_OUTPUT_XLR },
		{ name: 'Analog 2', flags: ['reflevel'], gain: null, reflevel: RL_OUTPUT_XLR },
		{ name: 'Analog 3', flags: ['reflevel'], gain: null, reflevel: RL_OUTPUT },
		{ name: 'Analog 4', flags: ['reflevel'], gain: null, reflevel: RL_OUTPUT },
		{ name: 'Analog 5', flags: ['reflevel'], gain: null, reflevel: RL_OUTPUT },
		{ name: 'Analog 6', flags: ['reflevel'], gain: null, reflevel: RL_OUTPUT },
		{ name: 'Analog 7', flags: ['reflevel'], gain: null, reflevel: RL_OUTPUT },
		{ name: 'Analog 8', flags: ['reflevel'], gain: null, reflevel: RL_OUTPUT },
		{ name: 'Phones 9', flags: ['reflevel'], gain: null, reflevel: RL_PHONES },
		{ name: 'Phones 10', flags: ['reflevel'], gain: null, reflevel: RL_PHONES },
		{ name: 'Phones 11', flags: ['reflevel'], gain: null, reflevel: RL_PHONES },
		{ name: 'Phones 12', flags: ['reflevel'], gain: null, reflevel: RL_PHONES },
		dig('AES L'), dig('AES R'), dig('ADAT 1'), dig('ADAT 2'), dig('ADAT 3'), dig('ADAT 4'), dig('ADAT 5'), dig('ADAT 6'),
		dig('ADAT 7'), dig('ADAT 8'), dig('ADAT 9'), dig('ADAT 10'), dig('ADAT 11'), dig('ADAT 12'), dig('ADAT 13'), dig('ADAT 14'),
		dig('ADAT 15'), dig('ADAT 16'), dig('MADI 1'), dig('MADI 2'), dig('MADI 3'), dig('MADI 4'), dig('MADI 5'), dig('MADI 6'),
		dig('MADI 7'), dig('MADI 8'), dig('MADI 9'), dig('MADI 10'), dig('MADI 11'), dig('MADI 12'), dig('MADI 13'), dig('MADI 14'),
		dig('MADI 15'), dig('MADI 16'), dig('MADI 17'), dig('MADI 18'), dig('MADI 19'), dig('MADI 20'), dig('MADI 21'), dig('MADI 22'),
		dig('MADI 23'), dig('MADI 24'), dig('MADI 25'), dig('MADI 26'), dig('MADI 27'), dig('MADI 28'), dig('MADI 29'), dig('MADI 30'),
		dig('MADI 31'), dig('MADI 32'), dig('MADI 33'), dig('MADI 34'), dig('MADI 35'), dig('MADI 36'), dig('MADI 37'), dig('MADI 38'),
		dig('MADI 39'), dig('MADI 40'), dig('MADI 41'), dig('MADI 42'), dig('MADI 43'), dig('MADI 44'), dig('MADI 45'), dig('MADI 46'),
		dig('MADI 47'), dig('MADI 48'), dig('MADI 49'), dig('MADI 50'), dig('MADI 51'), dig('MADI 52'), dig('MADI 53'), dig('MADI 54'),
		dig('MADI 55'), dig('MADI 56'), dig('MADI 57'), dig('MADI 58'), dig('MADI 59'), dig('MADI 60'), dig('MADI 61'), dig('MADI 62'),
		dig('MADI 63'), dig('MADI 64'),
	],

	get inputNames()  { return this.inputs.map(ch => ch.name);  },
	get outputNames() { return this.outputs.map(ch => ch.name); },

	getFlags(type, index) {
		if (type === 'input')    return [...(this.inputs[index]?.flags  ?? []), 'input'];
		if (type === 'output')   return [...(this.outputs[index]?.flags ?? []), 'output'];
		if (type === 'playback') return ['playback'];
		return [];
	},

	hardware_standalonemidi: { names: ['Off', 'MIDI 1', 'MIDI 2', 'MADI O', 'MADI C'], type: 'enum' },
};
