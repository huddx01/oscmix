// device_ff802.js

const RL_INPUT = ['+4dBu', 'Lo Gain'];
const RL_OUTPUT = ['-10dBV', '+4dBu', 'Hi Gain'];

// Helper for plain digital channels with no gain or reflevel
const dig = (name) => ({ name, flags: [], gain: null, reflevel: null });

export const device_ff802 = {
	deviceName: 'Fireface 802',
	midiPortNames: ['Port 2'],

	inputs: [
		{ name: 'Analog 1', flags: ['gain', 'reflevel'], gain: { min: 0, max: 12 }, reflevel: RL_INPUT },
		{ name: 'Analog 2', flags: ['gain', 'reflevel'], gain: { min: 0, max: 12 }, reflevel: RL_INPUT },
		{ name: 'Analog 3', flags: ['gain', 'reflevel'], gain: { min: 0, max: 12 }, reflevel: RL_INPUT },
		{ name: 'Analog 4', flags: ['gain', 'reflevel'], gain: { min: 0, max: 12 }, reflevel: RL_INPUT },
		{ name: 'Analog 5', flags: ['gain', 'reflevel'], gain: { min: 0, max: 12 }, reflevel: RL_INPUT },
		{ name: 'Analog 6', flags: ['gain', 'reflevel'], gain: { min: 0, max: 12 }, reflevel: RL_INPUT },
		{ name: 'Analog 7', flags: ['gain', 'reflevel'], gain: { min: 0, max: 12 }, reflevel: RL_INPUT },
		{ name: 'Analog 8', flags: ['gain', 'reflevel'], gain: { min: 0, max: 12 }, reflevel: RL_INPUT },
		{ name: 'Mic/Inst 9', flags: ['48v', 'hi-z'], gain: null, reflevel: null },
		{ name: 'Mic/Inst 10', flags: ['48v', 'hi-z'], gain: null, reflevel: null },
		{ name: 'Mic/Inst 11', flags: ['48v', 'hi-z'], gain: null, reflevel: null },
		{ name: 'Mic/Inst 12', flags: ['48v', 'hi-z'], gain: null, reflevel: null },
		dig('AES L'), dig('AES R'), dig('ADAT 1'), dig('ADAT 2'), dig('ADAT 3'), dig('ADAT 4'), dig('ADAT 5'), dig('ADAT 6'),
		dig('ADAT 7'), dig('ADAT 8'), dig('ADAT 9'), dig('ADAT 10'), dig('ADAT 11'), dig('ADAT 12'), dig('ADAT 13'), dig('ADAT 14'),
		dig('ADAT 15'), dig('ADAT 16'),
	],

	outputs: [
		{ name: 'Analog 1', flags: ['reflevel'], gain: null, reflevel: RL_OUTPUT },
		{ name: 'Analog 2', flags: ['reflevel'], gain: null, reflevel: RL_OUTPUT },
		{ name: 'Analog 3', flags: ['reflevel'], gain: null, reflevel: RL_OUTPUT },
		{ name: 'Analog 4', flags: ['reflevel'], gain: null, reflevel: RL_OUTPUT },
		{ name: 'Analog 5', flags: ['reflevel'], gain: null, reflevel: RL_OUTPUT },
		{ name: 'Analog 6', flags: ['reflevel'], gain: null, reflevel: RL_OUTPUT },
		{ name: 'Analog 7', flags: ['reflevel'], gain: null, reflevel: RL_OUTPUT },
		{ name: 'Analog 8', flags: ['reflevel'], gain: null, reflevel: RL_OUTPUT },
		dig('Phones 9'), dig('Phones 10'), dig('Phones 11'), dig('Phones 12'), dig('AES L'), dig('AES R'), dig('ADAT 1'), dig('ADAT 2'),
		dig('ADAT 3'), dig('ADAT 4'), dig('ADAT 5'), dig('ADAT 6'), dig('ADAT 7'), dig('ADAT 8'), dig('ADAT 9'), dig('ADAT 10'),
		dig('ADAT 11'), dig('ADAT 12'), dig('ADAT 13'), dig('ADAT 14'), dig('ADAT 15'), dig('ADAT 16'),
	],

	get inputNames()  { return this.inputs.map(ch => ch.name);  },
	get outputNames() { return this.outputs.map(ch => ch.name); },

	getFlags(type, index) {
		if (type === 'input')    return [...(this.inputs[index]?.flags  ?? []), 'input'];
		if (type === 'output')   return [...(this.outputs[index]?.flags ?? []), 'output'];
		if (type === 'playback') return ['playback'];
		return [];
	},

	hardware_standalonemidi: { names: ['Off', 'On'], type: 'bool' },
};
