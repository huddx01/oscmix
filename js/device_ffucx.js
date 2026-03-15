// device_ffucx.js

const RL_INPUT = ['-10dBV', '+4dBu', 'Lo Gain'];
const RL_OUTPUT = ['-10dBV', '+4dBu', 'Hi Gain'];

// Helper for plain digital channels with no gain or reflevel
const dig = (name) => ({ name, flags: [], gain: null, reflevel: null });

export const device_ffucx = {
	deviceName: 'Fireface UCX',
	midiPortNames: ['Port 3', ':2'],
	hasDurec:  false,
	hasRoomEq: false,
	hasHwKeys: false,
	hasHwLcd:  false,

	inputs: [
		{ name: 'Mic 1', flags: ['gain', '48v', 'autoset'], gain: { min: 0, max: 65 }, reflevel: null },
		{ name: 'Mic 2', flags: ['gain', '48v', 'autoset'], gain: { min: 0, max: 65 }, reflevel: null },
		{ name: 'AN 3', flags: ['gain', 'reflevel', 'hi-z', 'autoset'], gain: { min: 0, max: 12 }, reflevel: RL_INPUT },
		{ name: 'AN 4', flags: ['gain', 'reflevel', 'hi-z', 'autoset'], gain: { min: 0, max: 12 }, reflevel: RL_INPUT },
		{ name: 'AN 5', flags: ['reflevel'], gain: null, reflevel: RL_INPUT },
		{ name: 'AN 6', flags: ['reflevel'], gain: null, reflevel: RL_INPUT },
		{ name: 'AN 7', flags: ['reflevel'], gain: null, reflevel: RL_INPUT },
		{ name: 'AN 8', flags: ['reflevel'], gain: null, reflevel: RL_INPUT },
		dig('SPDIF L'), dig('SPDIF R'), dig('AS 1'), dig('AS 2'), dig('ADAT 3'), dig('ADAT 4'), dig('ADAT 5'), dig('ADAT 6'),
		dig('ADAT 7'), dig('ADAT 8'),
	],

	outputs: [
		{ name: 'AN 1', flags: ['reflevel'], gain: null, reflevel: RL_OUTPUT },
		{ name: 'AN 2', flags: ['reflevel'], gain: null, reflevel: RL_OUTPUT },
		{ name: 'AN 3', flags: ['reflevel'], gain: null, reflevel: RL_OUTPUT },
		{ name: 'AN 4', flags: ['reflevel'], gain: null, reflevel: RL_OUTPUT },
		{ name: 'AN 5', flags: ['reflevel'], gain: null, reflevel: RL_OUTPUT },
		{ name: 'AN 6', flags: ['reflevel'], gain: null, reflevel: RL_OUTPUT },
		{ name: 'PH 7', flags: ['reflevel'], gain: null, reflevel: RL_OUTPUT },
		{ name: 'PH 8', flags: ['reflevel'], gain: null, reflevel: RL_OUTPUT },
		dig('SPDIF L'), dig('SPDIF R'), dig('AS 1'), dig('AS 2'), dig('ADAT 3'), dig('ADAT 4'), dig('ADAT 5'), dig('ADAT 6'),
		dig('ADAT 7'), dig('ADAT 8'),
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
