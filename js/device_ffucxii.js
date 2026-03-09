// device_ffucxii.js

const RL_INPUT = ['+13dBu', '+19dBu'];
const RL_OUTPUT = ['+4dBu', '+13dBu', '+19dBu'];
const RL_PHONES = ['Low', 'High'];

// Helper for plain digital channels with no gain or reflevel
const dig = (name) => ({ name, flags: [], gain: null, reflevel: null });

export const device_ffucxii = {
	deviceName: 'Fireface UCX II',
	midiPortNames: ['Port 2'],

	inputs: [
		{ name: 'Mic/Line 1', flags: ['gain', '48v', 'autoset'], gain: { min: 0, max: 75 }, reflevel: null },
		{ name: 'Mic/Line 2', flags: ['gain', '48v', 'autoset'], gain: { min: 0, max: 75 }, reflevel: null },
		{ name: 'Inst/Line 3', flags: ['gain', 'reflevel', 'hi-z', 'autoset'], gain: { min: 0, max: 24 }, reflevel: RL_INPUT },
		{ name: 'Inst/Line 4', flags: ['gain', 'reflevel', 'hi-z', 'autoset'], gain: { min: 0, max: 24 }, reflevel: RL_INPUT },
		{ name: 'Analog 5', flags: ['gain', 'reflevel'], gain: null, reflevel: RL_INPUT },
		{ name: 'Analog 6', flags: ['gain', 'reflevel'], gain: null, reflevel: RL_INPUT },
		{ name: 'Analog 7', flags: ['gain', 'reflevel'], gain: null, reflevel: RL_INPUT },
		{ name: 'Analog 8', flags: ['gain', 'reflevel'], gain: null, reflevel: RL_INPUT },
		dig('SPDIF L'), dig('SPDIF R'), dig('AES L'), dig('AES R'), dig('ADAT 1'), dig('ADAT 2'), dig('ADAT 3'), dig('ADAT 4'),
		dig('ADAT 5'), dig('ADAT 6'), dig('ADAT 7'), dig('ADAT 8'),
	],

	outputs: [
		{ name: 'Analog 1', flags: ['reflevel'], gain: null, reflevel: RL_OUTPUT },
		{ name: 'Analog 2', flags: ['reflevel'], gain: null, reflevel: RL_OUTPUT },
		{ name: 'Analog 3', flags: ['reflevel'], gain: null, reflevel: RL_OUTPUT },
		{ name: 'Analog 4', flags: ['reflevel'], gain: null, reflevel: RL_OUTPUT },
		{ name: 'Analog 5', flags: ['reflevel'], gain: null, reflevel: RL_OUTPUT },
		{ name: 'Analog 6', flags: ['reflevel'], gain: null, reflevel: RL_OUTPUT },
		{ name: 'Phones 7', flags: ['reflevel'], gain: null, reflevel: RL_PHONES },
		{ name: 'Phones 8', flags: ['reflevel'], gain: null, reflevel: RL_PHONES },
		dig('SPDIF L'), dig('SPDIF R'), dig('AES L'), dig('AES R'), dig('ADAT 1'), dig('ADAT 2'), dig('ADAT 3'), dig('ADAT 4'),
		dig('ADAT 5'), dig('ADAT 6'), dig('ADAT 7'), dig('ADAT 8'),
	],

	get inputNames()  { return this.inputs.map(ch => ch.name);  },
	get outputNames() { return this.outputs.map(ch => ch.name); },

	getFlags(type, index) {
		if (type === 'input')    return [...(this.inputs[index]?.flags  ?? []), 'input'];
		if (type === 'output')   return [...(this.outputs[index]?.flags ?? []), 'output'];
		if (type === 'playback') return ['playback'];
		return [];
	},

	hardware_standalonemidi: { names: ['Off', 'MIDI 1', 'MIDI 2'], type: 'enum' },
};
