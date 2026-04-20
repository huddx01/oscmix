#include <assert.h>
#include <stddef.h>
#include "device.h"
#include "intpack.h"

#define LEN(a) (sizeof(a) / sizeof(*(a)))

// MARK: ffufx is quite similar to 802 (almost all definitions are taken from 802)
// TODO: RoomEq and all LED related reegs need further investigation

/* MIX_LEVEL register layout (output-major, 0x40 stride per output):
 *   input channels  : 0x4000 + out*0x40 + in
 *   playback channels: 0x4000 + out*0x40 + 0x20 + pb_idx
 */

static const char *const reflevel_input[] = {"+4dBu", "Lo Gain"};
static const char *const reflevel_output[] = {"+4dBu", "+13dBu", "+19dBu"};
static const char *const reflevel_output_xlr[] = {"+4dBu", "+13dBu", "+19dBu", "+24dBu"};
static const char *const reflevel_phones[] = {"Low", "High"};

static const struct channelinfo inputs[] = {
	{"Analog 1", INPUT_HAS_REFLEVEL, .reflevel={reflevel_input, LEN(reflevel_input)}},
	{"Analog 2", INPUT_HAS_REFLEVEL, .reflevel={reflevel_input, LEN(reflevel_input)}},
	{"Analog 3", INPUT_HAS_REFLEVEL, .reflevel={reflevel_input, LEN(reflevel_input)}},
	{"Analog 4", INPUT_HAS_REFLEVEL, .reflevel={reflevel_input, LEN(reflevel_input)}},
	{"Analog 5", INPUT_HAS_REFLEVEL, .reflevel={reflevel_input, LEN(reflevel_input)}},
	{"Analog 6", INPUT_HAS_REFLEVEL, .reflevel={reflevel_input, LEN(reflevel_input)}},
	{"Analog 7", INPUT_HAS_REFLEVEL, .reflevel={reflevel_input, LEN(reflevel_input)}},
	{"Analog 8", INPUT_HAS_REFLEVEL, .reflevel={reflevel_input, LEN(reflevel_input)}},
	{"Mic/Inst 9",  INPUT_HAS_GAIN | INPUT_HAS_48V | INPUT_HAS_AUTOSET | INPUT_HAS_HIZ, .gain={0, 650}},
	{"Mic/Inst 10", INPUT_HAS_GAIN | INPUT_HAS_48V | INPUT_HAS_AUTOSET | INPUT_HAS_HIZ, .gain={0, 650}},
	{"Mic/Inst 11", INPUT_HAS_GAIN | INPUT_HAS_48V | INPUT_HAS_AUTOSET | INPUT_HAS_HIZ, .gain={0, 650}},
	{"Mic/Inst 12", INPUT_HAS_GAIN | INPUT_HAS_48V | INPUT_HAS_AUTOSET | INPUT_HAS_HIZ, .gain={0, 650}},
	{"AES L"},
	{"AES R"},
	{"ADAT 1"}, {"ADAT 2"}, {"ADAT 3"}, {"ADAT 4"},
	{"ADAT 5"}, {"ADAT 6"}, {"ADAT 7"}, {"ADAT 8"},
	{"ADAT 9"}, {"ADAT 10"}, {"ADAT 11"}, {"ADAT 12"},
	{"ADAT 13"}, {"ADAT 14"}, {"ADAT 15"}, {"ADAT 16"},
};
_Static_assert(LEN(inputs) == 30, "bad inputs");

static const struct channelinfo outputs[] = {
	{"Analog 1", OUTPUT_HAS_REFLEVEL, .reflevel={reflevel_output_xlr, LEN(reflevel_output_xlr)}},
	{"Analog 2", OUTPUT_HAS_REFLEVEL, .reflevel={reflevel_output_xlr, LEN(reflevel_output_xlr)}},
	{"Analog 3", OUTPUT_HAS_REFLEVEL, .reflevel={reflevel_output, LEN(reflevel_output)}},
	{"Analog 4", OUTPUT_HAS_REFLEVEL, .reflevel={reflevel_output, LEN(reflevel_output)}},
	{"Analog 5", OUTPUT_HAS_REFLEVEL, .reflevel={reflevel_output, LEN(reflevel_output)}},
	{"Analog 6", OUTPUT_HAS_REFLEVEL, .reflevel={reflevel_output, LEN(reflevel_output)}},
	{"Analog 7", OUTPUT_HAS_REFLEVEL, .reflevel={reflevel_output, LEN(reflevel_output)}},
	{"Analog 8", OUTPUT_HAS_REFLEVEL, .reflevel={reflevel_output, LEN(reflevel_output)}},
	{"Phones 9", OUTPUT_HAS_REFLEVEL, .reflevel={reflevel_phones, LEN(reflevel_phones)}},
	{"Phones 10", OUTPUT_HAS_REFLEVEL, .reflevel={reflevel_phones, LEN(reflevel_phones)}},
	{"Phones 11", OUTPUT_HAS_REFLEVEL, .reflevel={reflevel_phones, LEN(reflevel_phones)}},
	{"Phones 12", OUTPUT_HAS_REFLEVEL, .reflevel={reflevel_phones, LEN(reflevel_phones)}},
	{"AES L"}, {"AES R"},
	{"ADAT 1"}, {"ADAT 2"}, {"ADAT 3"}, {"ADAT 4"},
	{"ADAT 5"}, {"ADAT 6"}, {"ADAT 7"}, {"ADAT 8"},
	{"ADAT 9"}, {"ADAT 10"}, {"ADAT 11"}, {"ADAT 12"},
	{"ADAT 13"}, {"ADAT 14"}, {"ADAT 15"}, {"ADAT 16"},
};
_Static_assert(LEN(outputs) == 30, "bad outputs");

static enum control regtoctl(int reg, struct param *p) {
	int idx, flags;

	if (reg < 0)
		return -1;
	if (reg < 0x3C00) {
		idx = reg >> 8;
		reg &= 0xFF; 
		if (idx < LEN(inputs)) {
			p->in = idx;
			flags = inputs[idx].flags;
		} else {
			idx -= LEN(inputs);
			if (idx >= LEN(outputs))
				return -1;
			p->out = idx;
			flags = outputs[idx].flags;
			// TODO: We need the return MIX somehow. This seems to break correct input mapping - so commented for now
//			if (reg >= 0xE0) {
//				p->in = reg - 0xE0;
//				if ((unsigned)p->in >= LEN(inputs))
//					return -1;
//				return MIX;
//			}
			if (reg < 0x20) {
				reg |= 0x1E00;
			}
		}
	}
	switch (reg) {
		case 0x0000: return INPUT_MUTE;
		case 0x0001: return INPUT_FXSEND;
		case 0x0002: return INPUT_STEREO;
		case 0x0003: return INPUT_RECORD;
		case 0x0004: return INPUT_PLAYCHAN;
		case 0x0005: return INPUT_MSPROC;
		case 0x0006: return INPUT_PHASE;
		case 0x0007: return (flags & INPUT_HAS_GAIN) ? INPUT_GAIN : -1;
		case 0x0008: return (flags & INPUT_HAS_REFLEVEL) ? INPUT_REFLEVEL : ((flags & INPUT_HAS_48V) ? INPUT_48V : -1);
		case 0x0009: return (flags & INPUT_HAS_HIZ) ? INPUT_HIZ : -1;

		case 0x1E00: return OUTPUT_VOLUME;
		case 0x1E01: return OUTPUT_PAN;
		case 0x1E02: return OUTPUT_MUTE;
		case 0x1E03: return OUTPUT_FXRETURN;
		case 0x1E04: return OUTPUT_STEREO;
		case 0x1E05: return OUTPUT_RECORD;
		case 0x1E06: return OUTPUT_PLAYCHAN;
		case 0x1E07: return OUTPUT_PHASE;
		case 0x1E08: return OUTPUT_REFLEVEL;

		case 0x0020: return LOWCUT;
		case 0x0021: return LOWCUT_FREQ;
		case 0x0022: return LOWCUT_SLOPE;
		case 0x0040: return EQ;
		case 0x0041: return EQ_BAND1TYPE;
		case 0x0042: return EQ_BAND1GAIN;
		case 0x0043: return EQ_BAND1FREQ;
		case 0x0044: return EQ_BAND1Q;
		case 0x0045: return EQ_BAND2GAIN;
		case 0x0046: return EQ_BAND2FREQ;
		case 0x0047: return EQ_BAND2Q;
		case 0x0048: return EQ_BAND3TYPE;
		case 0x0049: return EQ_BAND3GAIN;
		case 0x004A: return EQ_BAND3FREQ;
		case 0x004B: return EQ_BAND3Q;
		case 0x0060: return DYNAMICS;
		case 0x0061: return DYNAMICS_GAIN;
		case 0x0062: return DYNAMICS_ATTACK;
		case 0x0063: return DYNAMICS_RELEASE;
		case 0x0064: return DYNAMICS_COMPTHRES;
		case 0x0065: return DYNAMICS_COMPRATIO;
		case 0x0066: return DYNAMICS_EXPTHRES;
		case 0x0067: return DYNAMICS_EXPRATIO;
		case 0x0080: return AUTOLEVEL;
		case 0x0081: return AUTOLEVEL_MAXGAIN;
		case 0x0082: return AUTOLEVEL_HEADROOM;
		case 0x0083: return AUTOLEVEL_RISETIME;

		case 0x3C00: return REVERB;
		case 0x3C01: return REVERB_TYPE;
		case 0x3C02: return REVERB_PREDELAY;
		case 0x3C03: return REVERB_LOWCUT;
		case 0x3C04: return REVERB_ROOMSCALE;
		case 0x3C05: return REVERB_ATTACK;
		case 0x3C06: return REVERB_HOLD;
		case 0x3C07: return REVERB_RELEASE;
		case 0x3C08: return REVERB_HIGHCUT;
		case 0x3C09: return REVERB_TIME;
		case 0x3C0A: return REVERB_HIGHDAMP;
		case 0x3C0B: return REVERB_SMOOTH;
		case 0x3C0C: return REVERB_VOLUME;
		case 0x3C0D: return REVERB_WIDTH;

		case 0x3C20: return ECHO;
		case 0x3C21: return ECHO_TYPE;
		case 0x3C22: return ECHO_DELAY;
		case 0x3C23: return ECHO_FEEDBACK;
		case 0x3C24: return ECHO_HIGHCUT;
		case 0x3C25: return ECHO_VOLUME;
		case 0x3C26: return ECHO_WIDTH;

		case 0x3D00: return CTLROOM_MAINOUT;
		case 0x3D01: return CTLROOM_MUTEENABLE;
		case 0x3D02: return CTLROOM_DIMREDUCTION;
		case 0x3D03: return CTLROOM_DIM;
		case 0x3D04: return CTLROOM_RECALLVOLUME;

		case 0x3D20: return CLOCK_SOURCE;
		case 0x3D21: return CLOCK_SAMPLERATE;
		case 0x3D22: return CLOCK_WCKSINGLE;

		case 0x3D40: return HARDWARE_OPTICALIN2;
		case 0x3D41: return HARDWARE_OPTICALOUT2;
		case 0x3D42: return HARDWARE_SPDIFOUT;
		case 0x3D43: return HARDWARE_STANDALONEMIDI;
		case 0x3D44: return HARDWARE_CCMODE;
		case 0x3D45: return HARDWARE_STANDALONEARC;
		case 0x3D46: return HARDWARE_OPTICALOUT;

		case 0x3F00: return HARDWARE_DSPVERLOAD;
		case 0x3F01: return HARDWARE_DSPSTATUS;
		case 0x3F02: return HARDWARE_DSPAVAIL;

		case 0x3F9E: return SETUP_ARCLEDS;

		default:     return UNKNOWN;
	}
	return -1;
}

static int
ctltoreg(enum control ctl, const struct param *p)
{
	int reg, idx, flags;
	if ((unsigned)p->in < LEN(inputs)) {
		flags = inputs[p->in].flags;
		idx = p->in;
	} else if ((unsigned)p->out < LEN(outputs)) {
		flags = outputs[p->out].flags;
		idx = 30 + p->out;
	}
	switch (ctl) {
		case INPUT_MUTE:              reg = 0x00; goto channel;
		case INPUT_FXSEND:            reg = 0x01; goto channel;
		case INPUT_STEREO:            reg = 0x02; goto channel;
		case INPUT_RECORD:            reg = 0x03; goto channel;
		case INPUT_PLAYCHAN:          reg = 0x04; goto channel;
		case INPUT_MSPROC:            reg = 0x05; goto channel;
		case INPUT_PHASE:             reg = 0x06; goto channel;
		case INPUT_GAIN:              if (!(flags & INPUT_HAS_GAIN)) break;
			reg = 0x07; goto channel;
		case INPUT_REFLEVEL:          if (!(flags & INPUT_HAS_REFLEVEL)) break;
			reg = 0x08; goto channel;
		case INPUT_48V:               if (!(flags & INPUT_HAS_48V)) break;
			reg = 0x08; goto channel;
		case INPUT_HIZ:               if (!(flags & INPUT_HAS_HIZ)) break;
			reg = 0x09; goto channel;

		case OUTPUT_VOLUME:           reg = 0x00; goto channel;
		case OUTPUT_PAN:              reg = 0x01; goto channel;
		case OUTPUT_MUTE:             reg = 0x02; goto channel;
		case OUTPUT_FXRETURN:         reg = 0x03; goto channel;
		case OUTPUT_STEREO:           reg = 0x04; goto channel;
		case OUTPUT_RECORD:           reg = 0x05; goto channel;
		case OUTPUT_PLAYCHAN:         reg = 0x06; goto channel;
		case OUTPUT_PHASE:            if (!(flags & INPUT_HAS_REFLEVEL)) break;
			reg = 0x07; goto channel;
		case OUTPUT_REFLEVEL:         reg = 0x08; goto channel;

		case LOWCUT:                  reg = 0x20; goto channel;
		case LOWCUT_FREQ:             reg = 0x21; goto channel;
		case LOWCUT_SLOPE:            reg = 0x22; goto channel;
		case EQ:                      reg = 0x40; goto channel;
		case EQ_BAND1TYPE:            reg = 0x41; goto channel;
		case EQ_BAND1GAIN:            reg = 0x42; goto channel;
		case EQ_BAND1FREQ:            reg = 0x43; goto channel;
		case EQ_BAND1Q:               reg = 0x44; goto channel;
		case EQ_BAND2GAIN:            reg = 0x45; goto channel;
		case EQ_BAND2FREQ:            reg = 0x46; goto channel;
		case EQ_BAND2Q:               reg = 0x47; goto channel;
		case EQ_BAND3TYPE:            reg = 0x48; goto channel;
		case EQ_BAND3GAIN:            reg = 0x49; goto channel;
		case EQ_BAND3FREQ:            reg = 0x4A; goto channel;
		case EQ_BAND3Q:               reg = 0x4B; goto channel;
		case DYNAMICS:                reg = 0x60; goto channel;
		case DYNAMICS_GAIN:           reg = 0x61; goto channel;
		case DYNAMICS_ATTACK:         reg = 0x62; goto channel;
		case DYNAMICS_RELEASE:        reg = 0x63; goto channel;
		case DYNAMICS_COMPTHRES:      reg = 0x64; goto channel;
		case DYNAMICS_COMPRATIO:      reg = 0x65; goto channel;
		case DYNAMICS_EXPTHRES:       reg = 0x66; goto channel;
		case DYNAMICS_EXPRATIO:       reg = 0x67; goto channel;
		case AUTOLEVEL:               reg = 0x80; goto channel;
		case AUTOLEVEL_MAXGAIN:       reg = 0x81; goto channel;
		case AUTOLEVEL_HEADROOM:      reg = 0x82; goto channel;
		case AUTOLEVEL_RISETIME:      reg = 0x83; goto channel;
			channel:                      if (idx == -1) break;
			return idx << 8 | reg;
		case MIX:
			if ((unsigned)p->out >= LEN(outputs)) {
				break;
			}
			if ((unsigned)p->in >= LEN(inputs)){
				break;
			}
			/* Write address: sequential per-output layout, stride 0x100.
			 * p->in is in [0..29] and the base_reg low byte is 0xE0,
			 * so OR and ADD are equivalent (no bit overlap). */
			int base_reg = 0x1EE0 + (p->out * 0x100);
			return base_reg | p->in;
		case MIX_LEVEL: {
			if ((unsigned)p->out >= LEN(outputs)) break;
			if ((unsigned)p->in >= LEN(inputs) + LEN(outputs)) break;
			unsigned base = 0x4000 + (unsigned)p->out * 0x40;
			if ((unsigned)p->in < LEN(inputs)) {
				return base + (unsigned)p->in;
			} else {
				unsigned pb_idx = (unsigned)p->in - LEN(inputs);
				return base + 0x20 + pb_idx;
			}
		}
		case REVERB:                  return 0x3C00;
		case REVERB_TYPE:             return 0x3C01;
		case REVERB_PREDELAY:         return 0x3C02;
		case REVERB_LOWCUT:           return 0x3C03;
		case REVERB_ROOMSCALE:        return 0x3C04;
		case REVERB_ATTACK:           return 0x3C05;
		case REVERB_HOLD:             return 0x3C06;
		case REVERB_RELEASE:          return 0x3C07;
		case REVERB_HIGHCUT:          return 0x3C08;
		case REVERB_TIME:             return 0x3C09;
		case REVERB_HIGHDAMP:         return 0x3C0A;
		case REVERB_SMOOTH:           return 0x3C0B;
		case REVERB_VOLUME:           return 0x3C0C;
		case REVERB_WIDTH:            return 0x3C0D;

		case ECHO:                    return 0x3C20;
		case ECHO_TYPE:               return 0x3C21;
		case ECHO_DELAY:              return 0x3C22;
		case ECHO_FEEDBACK:           return 0x3C23;
		case ECHO_HIGHCUT:            return 0x3C24;
		case ECHO_VOLUME:             return 0x3C25;
		case ECHO_WIDTH:              return 0x3C26;

		case CTLROOM_MAINOUT:         return 0x3D00;
		case CTLROOM_MUTEENABLE:      return 0x3D01;
		case CTLROOM_DIMREDUCTION:    return 0x3D02;
		case CTLROOM_DIM:             return 0x3D03;
		case CTLROOM_RECALLVOLUME:    return 0x3D04;

		case CLOCK_SOURCE:            return 0x3D20;
		case CLOCK_SAMPLERATE:        return 0x3D21;
		case CLOCK_WCKSINGLE:         return 0x3D22;

		case HARDWARE_OPTICALIN2:     return 0x3D40;
		case HARDWARE_OPTICALOUT2:    return 0x3D41;
		case HARDWARE_SPDIFOUT:       return 0x3D42;
		case HARDWARE_STANDALONEMIDI: return 0x3D43;
		case HARDWARE_CCMODE:         return 0x3D44;
		case HARDWARE_STANDALONEARC:  return 0x3D45;
		case HARDWARE_OPTICALOUT:     return 0x3D46;

		case HARDWARE_DSPVERLOAD:     return 0x3F00;
		case HARDWARE_DSPSTATUS:      return 0x3F01;
		case HARDWARE_DSPAVAIL:       return 0x3F02;

		case SETUP_STORE:             return 0x3F97;

		case REFRESH:                 return 0x3F99;
		default:                      break;
	}
	return -1;
}

const struct device ffufx = {
	.id = "ffufx",
	.name = "Fireface UFX",
	.version = 163,
	.flags = DEVICE_HAS_DUREC,
	.inputs = inputs,
	.inputslen = LEN(inputs),
	.outputs = outputs,
	.outputslen = LEN(outputs),
	.refresh = 0x0812,
	.regtoctl = regtoctl,
	.ctltoreg = ctltoreg,
};
