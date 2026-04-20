#include <assert.h>
#include <stddef.h>
#include "device.h"
#include "intpack.h"

#include <stdio.h>
#define LEN(a) (sizeof (a) / sizeof *(a))

static const char *const reflevel_input[] = {"+4dBu", "Lo Gain"};
static const char *const reflevel_output[] = {"-10dBV", "+4dBu", "Hi Gain"};
static const char *const reflevel_output_xlr[] = {"-10dBV", "+4dBu", "Hi Gain", "+24dBu"};
static const char *const reflevel_phones[] = {"Low", "High"};


#define MIX_IN_BASE  0x4000
#define MIX_PB_BASE  0x5780
#define MIX_STRIDE   64

static const struct channelinfo inputs[] = {
	{"Analog 1",  INPUT_HAS_GAIN | INPUT_HAS_REFLEVEL, .gain={0, 120}, .reflevel={reflevel_input, LEN(reflevel_input)}},
	{"Analog 2",  INPUT_HAS_GAIN | INPUT_HAS_REFLEVEL, .gain={0, 120}, .reflevel={reflevel_input, LEN(reflevel_input)}},
	{"Analog 3",  INPUT_HAS_GAIN | INPUT_HAS_REFLEVEL, .gain={0, 120}, .reflevel={reflevel_input, LEN(reflevel_input)}},
	{"Analog 4",  INPUT_HAS_GAIN | INPUT_HAS_REFLEVEL, .gain={0, 120}, .reflevel={reflevel_input, LEN(reflevel_input)}},
	{"Analog 5",  INPUT_HAS_GAIN | INPUT_HAS_REFLEVEL, .gain={0, 120}, .reflevel={reflevel_input, LEN(reflevel_input)}},
	{"Analog 6",  INPUT_HAS_GAIN | INPUT_HAS_REFLEVEL, .gain={0, 120}, .reflevel={reflevel_input, LEN(reflevel_input)}},
	{"Analog 7",  INPUT_HAS_GAIN | INPUT_HAS_REFLEVEL, .gain={0, 120}, .reflevel={reflevel_input, LEN(reflevel_input)}},
	{"Analog 8",  INPUT_HAS_GAIN | INPUT_HAS_REFLEVEL, .gain={0, 120}, .reflevel={reflevel_input, LEN(reflevel_input)}},
	{"Mic/Inst 9",  INPUT_HAS_GAIN | INPUT_HAS_48V | INPUT_HAS_AUTOSET | INPUT_HAS_HIZ, .gain={0, 750}},
	{"Mic/Inst 10", INPUT_HAS_GAIN | INPUT_HAS_48V | INPUT_HAS_AUTOSET | INPUT_HAS_HIZ, .gain={0, 750}},
	{"Mic/Inst 11", INPUT_HAS_GAIN | INPUT_HAS_48V | INPUT_HAS_AUTOSET | INPUT_HAS_HIZ, .gain={0, 750}},
	{"Mic/Inst 12", INPUT_HAS_GAIN | INPUT_HAS_48V | INPUT_HAS_AUTOSET | INPUT_HAS_HIZ, .gain={0, 750}},
	{"AES L"}, {"AES R"},
	{"ADAT 1"}, {"ADAT 2"}, {"ADAT 3"}, {"ADAT 4"}, {"ADAT 5"}, {"ADAT 6"}, {"ADAT 7"}, {"ADAT 8"},
	{"ADAT 9"}, {"ADAT 10"}, {"ADAT 11"}, {"ADAT 12"}, {"ADAT 13"}, {"ADAT 14"}, {"ADAT 15"}, {"ADAT 16"},
	{"MADI 1"}, {"MADI 2"}, {"MADI 3"}, {"MADI 4"}, {"MADI 5"}, {"MADI 6"}, {"MADI 7"}, {"MADI 8"},
	{"MADI 9"}, {"MADI 10"}, {"MADI 11"}, {"MADI 12"}, {"MADI 13"}, {"MADI 14"}, {"MADI 15"}, {"MADI 16"},
	{"MADI 17"}, {"MADI 18"}, {"MADI 19"}, {"MADI 20"}, {"MADI 21"}, {"MADI 22"}, {"MADI 23"}, {"MADI 24"},
	{"MADI 25"}, {"MADI 26"}, {"MADI 27"}, {"MADI 28"}, {"MADI 29"}, {"MADI 30"}, {"MADI 31"}, {"MADI 32"},
	{"MADI 33"}, {"MADI 34"}, {"MADI 35"}, {"MADI 36"}, {"MADI 37"}, {"MADI 38"}, {"MADI 39"}, {"MADI 40"},
	{"MADI 41"}, {"MADI 42"}, {"MADI 43"}, {"MADI 44"}, {"MADI 45"}, {"MADI 46"}, {"MADI 47"}, {"MADI 48"},
	{"MADI 49"}, {"MADI 50"}, {"MADI 51"}, {"MADI 52"}, {"MADI 53"}, {"MADI 54"}, {"MADI 55"}, {"MADI 56"},
	{"MADI 57"}, {"MADI 58"}, {"MADI 59"}, {"MADI 60"}, {"MADI 61"}, {"MADI 62"}, {"MADI 63"}, {"MADI 64"}
};
_Static_assert(LEN(inputs) == 94, "bad inputs");

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
	{"ADAT 1"}, {"ADAT 2"}, {"ADAT 3"}, {"ADAT 4"}, {"ADAT 5"}, {"ADAT 6"}, {"ADAT 7"}, {"ADAT 8"},
	{"ADAT 9"}, {"ADAT 10"}, {"ADAT 11"}, {"ADAT 12"}, {"ADAT 13"}, {"ADAT 14"}, {"ADAT 15"}, {"ADAT 16"},
	{"MADI 1"}, {"MADI 2"}, {"MADI 3"}, {"MADI 4"}, {"MADI 5"}, {"MADI 6"}, {"MADI 7"}, {"MADI 8"},
	{"MADI 9"}, {"MADI 10"}, {"MADI 11"}, {"MADI 12"}, {"MADI 13"}, {"MADI 14"}, {"MADI 15"}, {"MADI 16"},
	{"MADI 17"}, {"MADI 18"}, {"MADI 19"}, {"MADI 20"}, {"MADI 21"}, {"MADI 22"}, {"MADI 23"}, {"MADI 24"},
	{"MADI 25"}, {"MADI 26"}, {"MADI 27"}, {"MADI 28"}, {"MADI 29"}, {"MADI 30"}, {"MADI 31"}, {"MADI 32"},
	{"MADI 33"}, {"MADI 34"}, {"MADI 35"}, {"MADI 36"}, {"MADI 37"}, {"MADI 38"}, {"MADI 39"}, {"MADI 40"},
	{"MADI 41"}, {"MADI 42"}, {"MADI 43"}, {"MADI 44"}, {"MADI 45"}, {"MADI 46"}, {"MADI 47"}, {"MADI 48"},
	{"MADI 49"}, {"MADI 50"}, {"MADI 51"}, {"MADI 52"}, {"MADI 53"}, {"MADI 54"}, {"MADI 55"}, {"MADI 56"},
	{"MADI 57"}, {"MADI 58"}, {"MADI 59"}, {"MADI 60"}, {"MADI 61"}, {"MADI 62"}, {"MADI 63"}, {"MADI 64"}
};
_Static_assert(LEN(outputs) == 94, "bad outputs");

static enum control
regtoctl(int reg, struct param *p)
{
	int idx = -1, flags = 0;

	if (reg < 0)
		return -1;

	if (reg < 0x2340) {
		idx = reg / 0x30;
		reg = reg % 0x30;
		if (idx < LEN(inputs)) {
			p->in = idx;
			flags = inputs[idx].flags;
		} else {
			idx -= LEN(inputs);
			if (idx >= LEN(outputs))
				return -1;
			p->out = idx;
			flags = outputs[idx].flags;
			if (reg < 0x0D) {
				reg |= 0x11A0;
			}
		}
	}
	else if (reg - 0x3426U < 0x20 * LEN(outputs)) {
		unsigned base = reg - 0x3426;
		p->out = base >> 5;
		unsigned subreg = base & 0x1F;
		switch (subreg) {
			case 0x00: return ROOMEQ_DELAY;
			case 0x01: return ROOMEQ;
			case 0x02: return ROOMEQ_BAND1TYPE;
			case 0x03: return ROOMEQ_BAND1GAIN;
			case 0x04: return ROOMEQ_BAND1FREQ;
			case 0x05: return ROOMEQ_BAND1Q;
			case 0x06: return ROOMEQ_BAND2GAIN;
			case 0x07: return ROOMEQ_BAND2FREQ;
			case 0x08: return ROOMEQ_BAND2Q;
			case 0x09: return ROOMEQ_BAND3GAIN;
			case 0x0A: return ROOMEQ_BAND3FREQ;
			case 0x0B: return ROOMEQ_BAND3Q;
			case 0x0C: return ROOMEQ_BAND4GAIN;
			case 0x0D: return ROOMEQ_BAND4FREQ;
			case 0x0E: return ROOMEQ_BAND4Q;
			case 0x0F: return ROOMEQ_BAND5GAIN;
			case 0x10: return ROOMEQ_BAND5FREQ;
			case 0x11: return ROOMEQ_BAND5Q;
			case 0x12: return ROOMEQ_BAND6GAIN;
			case 0x13: return ROOMEQ_BAND6FREQ;
			case 0x14: return ROOMEQ_BAND6Q;
			case 0x15: return ROOMEQ_BAND7GAIN;
			case 0x16: return ROOMEQ_BAND7FREQ;
			case 0x17: return ROOMEQ_BAND7Q;
			case 0x18: return ROOMEQ_BAND8TYPE;
			case 0x19: return ROOMEQ_BAND8GAIN;
			case 0x1A: return ROOMEQ_BAND8FREQ;
			case 0x1B: return ROOMEQ_BAND8Q;
			case 0x1C: return ROOMEQ_BAND9TYPE;
			case 0x1D: return ROOMEQ_BAND9GAIN;
			case 0x1E: return ROOMEQ_BAND9FREQ;
			case 0x1F: return ROOMEQ_BAND9Q;
			default: return -1;
		}
	}
	else if (reg >= 0x2340 && reg < 0x2430) {
		idx = (reg - 0x2340) / 0x0A;
		unsigned par = reg - (0x2340 + 0x0A * idx);
		switch (par) {
			case 0x0: return MIX;
			case 0x1: return MIX;
			case 0x2: return MIX;
			case 0x3: return MIX;
			case 0x4: return MIX;
			case 0x5: return MIX;
			default: return -1;
		}
	}
	switch (reg) {
		case 0x0000: return INPUT_MUTE;
		case 0x0001: return INPUT_FXSEND;
		case 0x0002: return INPUT_STEREO;
		case 0x0003: return INPUT_RECORD;
		case 0x0004: return UNKNOWN;
		case 0x0005: return INPUT_PLAYCHAN;
		case 0x0006: return UNKNOWN;
		case 0x0007: return INPUT_MSPROC;
		case 0x0008: return INPUT_PHASE;
		case 0x0009: return INPUT_GAIN;
		case 0x000A: return flags & INPUT_HAS_48V ? INPUT_48V : INPUT_REFLEVEL;
		case 0x000B: return INPUT_HIZ;
		case 0x000C: return INPUT_AUTOSET;

		case 0x11A0: return OUTPUT_VOLUME;
		case 0x11A1: return OUTPUT_PAN;
		case 0x11A2: return OUTPUT_MUTE;
		case 0x11A3: return OUTPUT_FXRETURN;
		case 0x11A4: return OUTPUT_STEREO;
		case 0x11A5: return OUTPUT_RECORD;
		case 0x11A6: return UNKNOWN;
		case 0x11A7: return OUTPUT_PLAYCHAN;
		case 0x11A8: return OUTPUT_PHASE;
		case 0x11A9: return OUTPUT_REFLEVEL;
		case 0x11AA: return OUTPUT_CROSSFEED;
		case 0x11AB: return OUTPUT_VOLUMECAL;
		case 0x11AC: return UNKNOWN;

		case 0x000D: return LOWCUT;
		case 0x000E: return LOWCUT_FREQ;
		case 0x000F: return LOWCUT_SLOPE;
		case 0x0010: return EQ;
		case 0x0011: return EQ_BAND1TYPE;
		case 0x0012: return EQ_BAND1GAIN;
		case 0x0013: return EQ_BAND1FREQ;
		case 0x0014: return EQ_BAND1Q;
		case 0x0015: return EQ_BAND2GAIN;
		case 0x0016: return EQ_BAND2FREQ;
		case 0x0017: return EQ_BAND2Q;
		case 0x0018: return EQ_BAND3TYPE;
		case 0x0019: return EQ_BAND3GAIN;
		case 0x001A: return EQ_BAND3FREQ;
		case 0x001B: return EQ_BAND3Q;
		case 0x001C: return DYNAMICS;
		case 0x001D: return DYNAMICS_GAIN;
		case 0x001E: return DYNAMICS_ATTACK;
		case 0x001F: return DYNAMICS_RELEASE;
		case 0x0020: return DYNAMICS_COMPTHRES;
		case 0x0021: return DYNAMICS_COMPRATIO;
		case 0x0022: return DYNAMICS_EXPTHRES;
		case 0x0023: return DYNAMICS_EXPRATIO;
		case 0x0024: return AUTOLEVEL;
		case 0x0025: return AUTOLEVEL_MAXGAIN;
		case 0x0026: return AUTOLEVEL_HEADROOM;
		case 0x0027: return AUTOLEVEL_RISETIME;

		case 0x3000: return REVERB;
		case 0x3001: return REVERB_TYPE;
		case 0x3002: return REVERB_PREDELAY;
		case 0x3003: return REVERB_LOWCUT;
		case 0x3004: return REVERB_ROOMSCALE;
		case 0x3005: return REVERB_ATTACK;
		case 0x3006: return REVERB_HOLD;
		case 0x3007: return REVERB_RELEASE;
		case 0x3008: return REVERB_HIGHCUT;
		case 0x3009: return REVERB_TIME;
		case 0x300A: return REVERB_HIGHDAMP;
		case 0x300B: return REVERB_SMOOTH;
		case 0x300C: return REVERB_VOLUME;
		case 0x300D: return REVERB_WIDTH;

		case 0x3014: return ECHO;
		case 0x3015: return ECHO_TYPE;
		case 0x3016: return ECHO_DELAY;
		case 0x3017: return ECHO_FEEDBACK;
		case 0x3018: return ECHO_HIGHCUT;
		case 0x3019: return ECHO_VOLUME;
		case 0x301A: return ECHO_WIDTH;

		case 0x3050: return CTLROOM_MAINOUT;
		case 0x3051: return CTLROOM_MAINMONO;
		case 0x3052: return CTLROOM_MUTEENABLE;

		case 0x3053: return CTLROOM_DIMREDUCTION;
		case 0x3054: return CTLROOM_DIM;
		case 0x3055: return CTLROOM_RECALLVOLUME;

		case 0x3064: return CLOCK_SOURCE;
		case 0x3065: return CLOCK_SAMPLERATE;
		case 0x3066: return CLOCK_WCKSINGLE;
		case 0x3067: return CLOCK_WCKTERM;
		case 0x3068: return UNKNOWN;

		case 0x3078: return HARDWARE_AESIN;
		case 0x307A: return HARDWARE_SPDIFOUT;
		case 0x307C: return HARDWARE_INTERFACEMODE;
		case 0x307D: return HARDWARE_CCROUTING;
		case 0x307E: return HARDWARE_STANDALONEMIDI;
		case 0x307F: return HARDWARE_STANDALONEARC;
		case 0x3080: return HARDWARE_LOCKKEYS;
		case 0x3081: return HARDWARE_REMAPKEYS;
		case 0x3082: return HARDWARE_PROGRAMKEY01;
		case 0x3083: return HARDWARE_PROGRAMKEY02;
		case 0x3084: return HARDWARE_PROGRAMKEY03;
		case 0x3085: return HARDWARE_PROGRAMKEY04;
		case 0x3086: return HARDWARE_LCDCONTRAST;
		case 0x3087: return HARDWARE_OPTICALOUT;
		case 0x3088: return HARDWARE_OPTICALOUT2;

		case 0x308C: return HARDWARE_MADIINPUT;
		case 0x308D: return HARDWARE_MADIOUTPUT;
		case 0x308E: return HARDWARE_MADIFRAME;
		case 0x308F: return HARDWARE_MADIFORMAT;
		case 0x3200: return HARDWARE_DSPVERLOAD;
		case 0x3201: return HARDWARE_DSPAVAIL;
		case 0x3202: return HARDWARE_DSPSTATUS;
		case 0x3203: return HARDWARE_ARCDELTA;
		case 0x3204: return HARDWARE_ARCBUTTONS;


		case 0x3580: return DUREC_STATUS;
		case 0x3581: return DUREC_TIME;
		case 0x3582: return UNKNOWN;
		case 0x3583: return DUREC_USBLOAD;
		case 0x3584: return DUREC_TOTALSPACE;
		case 0x3585: return DUREC_FREESPACE;
		case 0x3586: return DUREC_NUMFILES;
		case 0x3587: return DUREC_FILE;
		case 0x3588: return DUREC_NEXT;
		case 0x3589: return DUREC_RECORDTIME;
		case 0x358A: return DUREC_INDEX;
		case 0x358B: return DUREC_NAME0;
		case 0x358C: return DUREC_NAME1;
		case 0x358D: return DUREC_NAME2;
		case 0x358E: return DUREC_NAME3;
		case 0x358F: return DUREC_INFO;
		case 0x3590: return DUREC_LENGTH;
		case 0x3E02: return SETUP_ARCLEDS;
	}
	return -1;
}
static int ctltoreg(enum control ctl, const struct param *p)
{
	int reg, idx = -1, flags = 0;
	if ((unsigned)p->in < LEN(inputs)) {
		flags = inputs[p->in].flags;
		idx = p->in;
	} else if ((unsigned)p->out < LEN(outputs)) {
		flags = outputs[p->out].flags;
		idx = 94 + p->out;
	}
	switch (ctl) {
		case INPUT_MUTE:        reg = 0x00; goto channel;
		case INPUT_FXSEND:      reg = 0x01; goto channel;
		case INPUT_STEREO:      reg = 0x02; goto channel;
		case INPUT_RECORD:      reg = 0x03; goto channel;
		case INPUT_PLAYCHAN:    reg = 0x05; goto channel;
		case INPUT_MSPROC:      reg = 0x07; goto channel;
		case INPUT_PHASE:       reg = 0x08; goto channel;
		case INPUT_GAIN:        if (!(flags & INPUT_HAS_GAIN)) break;
		reg = 0x09; goto channel;
		case INPUT_REFLEVEL:    if (!(flags & INPUT_HAS_REFLEVEL)) break;
		reg = 0x0A; goto channel;
		case INPUT_48V:         if (!(flags & INPUT_HAS_48V)) break;
		reg = 0x0A; goto channel;
		case INPUT_HIZ:         if (!(flags & INPUT_HAS_HIZ)) break;
		reg = 0x0B; goto channel;
		case INPUT_AUTOSET:        if (!(flags & INPUT_HAS_AUTOSET)) break;
		reg = 0x0C; goto channel;
		case OUTPUT_VOLUME:      reg = 0x00; goto channel;
		case OUTPUT_PAN:         reg = 0x01; goto channel;
		case OUTPUT_MUTE:        reg = 0x02; goto channel;
		case OUTPUT_FXRETURN:    reg = 0x03; goto channel;
		case OUTPUT_STEREO:      reg = 0x04; goto channel;
		case OUTPUT_RECORD:      reg = 0x05; goto channel;
		case OUTPUT_PLAYCHAN:    reg = 0x07; goto channel;
		case OUTPUT_PHASE:       reg = 0x08; goto channel;
		case OUTPUT_REFLEVEL:    if (!(flags & OUTPUT_HAS_REFLEVEL)) break;
		reg = 0x09; goto channel;
		case OUTPUT_CROSSFEED:   reg = 0x0A; goto channel;
		case OUTPUT_VOLUMECAL:   reg = 0x0B; goto channel;
		case LOWCUT:             reg = 0x0D; goto channel;
		case LOWCUT_FREQ:        reg = 0x0E; goto channel;
		case LOWCUT_SLOPE:       reg = 0x0F; goto channel;
		case EQ:                 reg = 0x10; goto channel;
		case EQ_BAND1TYPE:       reg = 0x11; goto channel;
		case EQ_BAND1GAIN:       reg = 0x12; goto channel;
		case EQ_BAND1FREQ:       reg = 0x13; goto channel;
		case EQ_BAND1Q:          reg = 0x14; goto channel;
		case EQ_BAND2GAIN:       reg = 0x15; goto channel;
		case EQ_BAND2FREQ:       reg = 0x16; goto channel;
		case EQ_BAND2Q:          reg = 0x17; goto channel;
		case EQ_BAND3TYPE:       reg = 0x18; goto channel;
		case EQ_BAND3GAIN:       reg = 0x19; goto channel;
		case EQ_BAND3FREQ:       reg = 0x1A; goto channel;
		case EQ_BAND3Q:          reg = 0x1B; goto channel;
		case DYNAMICS:           reg = 0x1C; goto channel;
		case DYNAMICS_GAIN:      reg = 0x1D; goto channel;
		case DYNAMICS_ATTACK:    reg = 0x1E; goto channel;
		case DYNAMICS_RELEASE:   reg = 0x1F; goto channel;
		case DYNAMICS_COMPTHRES: reg = 0x20; goto channel;
		case DYNAMICS_COMPRATIO: reg = 0x21; goto channel;
		case DYNAMICS_EXPTHRES:  reg = 0x22; goto channel;
		case DYNAMICS_EXPRATIO:  reg = 0x23; goto channel;
		case AUTOLEVEL:          reg = 0x24; goto channel;
		case AUTOLEVEL_MAXGAIN:  reg = 0x25; goto channel;
		case AUTOLEVEL_HEADROOM: reg = 0x26; goto channel;
		case AUTOLEVEL_RISETIME: reg = 0x27; goto channel;
		channel:                      if (idx == -1) break;
		return idx * 0x30 | reg;
		case NAME:
			if (idx == -1) break;
			return 0x2800 + (idx << 3);
		case MIX:
			if ((unsigned)p->out >= LEN(outputs)) break;
			if ((unsigned)p->in >= LEN(inputs)) break;
			return 0x2340 + p->out * 0x30 + p->in;
		case MIX_LEVEL: {
			if ((unsigned)p->out >= LEN(outputs)) break;
			if ((unsigned)p->in >= LEN(inputs) + LEN(outputs)) break;
			unsigned output_pair = p->out / 2;
			if (p->in < LEN(inputs)) {
				return MIX_IN_BASE + (p->in << 6) + output_pair;
			} else {
				unsigned pb_idx = p->in - LEN(inputs);
				return MIX_PB_BASE + (pb_idx << 6) + output_pair;
			}
		}
		case REVERB:                  return 0x3000;
		case REVERB_TYPE:             return 0x3001;
		case REVERB_PREDELAY:         return 0x3002;
		case REVERB_LOWCUT:           return 0x3003;
		case REVERB_ROOMSCALE:        return 0x3004;
		case REVERB_ATTACK:           return 0x3005;
		case REVERB_HOLD:             return 0x3006;
		case REVERB_RELEASE:          return 0x3007;
		case REVERB_HIGHCUT:          return 0x3008;
		case REVERB_TIME:             return 0x3009;
		case REVERB_HIGHDAMP:         return 0x300A;
		case REVERB_SMOOTH:           return 0x300B;
		case REVERB_VOLUME:           return 0x300C;
		case REVERB_WIDTH:            return 0x300D;
		case ECHO:                    return 0x3014;
		case ECHO_TYPE:               return 0x3015;
		case ECHO_DELAY:              return 0x3016;
		case ECHO_FEEDBACK:           return 0x3017;
		case ECHO_HIGHCUT:            return 0x3018;
		case ECHO_VOLUME:             return 0x3019;
		case ECHO_WIDTH:              return 0x301A;

		case CTLROOM_MAINOUT:         return 0x3050;
		case CTLROOM_MAINMONO:        return 0x3051;
		case CTLROOM_MUTEENABLE:      return 0x3052;
		case CTLROOM_DIMREDUCTION:    return 0x3053;
		case CTLROOM_DIM:             return 0x3054;
		case CTLROOM_RECALLVOLUME:    return 0x3055;

		case CLOCK_SOURCE:            return 0x3064;
		case CLOCK_SAMPLERATE:        return 0x3065;
		case CLOCK_WCKSINGLE:         return 0x3066;
		case CLOCK_WCKTERM:           return 0x3067;

		case HARDWARE_AESIN:          return 0x3078;
		case HARDWARE_SPDIFOUT:       return 0x307A;


		case HARDWARE_INTERFACEMODE:  return 0x307C;
		case HARDWARE_CCROUTING:      return 0x307D;
		case HARDWARE_STANDALONEMIDI: return 0x307E;
		case HARDWARE_STANDALONEARC:  return 0x307F;

		case HARDWARE_LOCKKEYS:       return 0x3080;
		case HARDWARE_REMAPKEYS:      return 0x3081;
		case HARDWARE_PROGRAMKEY01:   return 0x3082;
		case HARDWARE_PROGRAMKEY02:   return 0x3083;
		case HARDWARE_PROGRAMKEY03:   return 0x3084;
		case HARDWARE_PROGRAMKEY04:   return 0x3085;
		case HARDWARE_LCDCONTRAST:    return 0x3086;

		case HARDWARE_OPTICALOUT:     return 0x3087;
		case HARDWARE_OPTICALOUT2:    return 0x3088;

		case HARDWARE_MADIINPUT:      return 0x308C;
		case HARDWARE_MADIOUTPUT:     return 0x308D;
		case HARDWARE_MADIFRAME:      return 0x308E;
		case HARDWARE_MADIFORMAT:     return 0x308F;

		case HARDWARE_DSPVERLOAD:     return 0x3200;
		case HARDWARE_DSPAVAIL:       return 0x3201;
		case HARDWARE_DSPSTATUS:      return 0x3202;
		case HARDWARE_ARCDELTA:       return 0x3203;
		case HARDWARE_ARCBUTTONS:     return 0x3204;

		case ROOMEQ_DELAY:            reg = 0x30A0; goto roomeq;
		case ROOMEQ:                  reg = 0x30A1; goto roomeq;
		case ROOMEQ_BAND1TYPE:        reg = 0x30A2; goto roomeq;
		case ROOMEQ_BAND1GAIN:        reg = 0x30A3; goto roomeq;
		case ROOMEQ_BAND1FREQ:        reg = 0x30A4; goto roomeq;
		case ROOMEQ_BAND1Q:           reg = 0x30A5; goto roomeq;
		case ROOMEQ_BAND2GAIN:        reg = 0x30A6; goto roomeq;
		case ROOMEQ_BAND2FREQ:        reg = 0x30A7; goto roomeq;
		case ROOMEQ_BAND2Q:           reg = 0x30A8; goto roomeq;
		case ROOMEQ_BAND3GAIN:        reg = 0x30A9; goto roomeq;
		case ROOMEQ_BAND3FREQ:        reg = 0x30AA; goto roomeq;
		case ROOMEQ_BAND3Q:           reg = 0x30AB; goto roomeq;
		case ROOMEQ_BAND4GAIN:        reg = 0x30AC; goto roomeq;
		case ROOMEQ_BAND4FREQ:        reg = 0x30AD; goto roomeq;
		case ROOMEQ_BAND4Q:           reg = 0x30AE; goto roomeq;
		case ROOMEQ_BAND5GAIN:        reg = 0x30AF; goto roomeq;
		case ROOMEQ_BAND5FREQ:        reg = 0x30B0; goto roomeq;
		case ROOMEQ_BAND5Q:           reg = 0x30B1; goto roomeq;
		case ROOMEQ_BAND6GAIN:        reg = 0x30B2; goto roomeq;
		case ROOMEQ_BAND6FREQ:        reg = 0x30B3; goto roomeq;
		case ROOMEQ_BAND6Q:           reg = 0x30B4; goto roomeq;
		case ROOMEQ_BAND7GAIN:        reg = 0x30B5; goto roomeq;
		case ROOMEQ_BAND7FREQ:        reg = 0x30B6; goto roomeq;
		case ROOMEQ_BAND7Q:           reg = 0x30B7; goto roomeq;
		case ROOMEQ_BAND8TYPE:        reg = 0x30B8; goto roomeq;
		case ROOMEQ_BAND8GAIN:        reg = 0x30B9; goto roomeq;
		case ROOMEQ_BAND8FREQ:        reg = 0x30BA; goto roomeq;
		case ROOMEQ_BAND8Q:           reg = 0x30BB; goto roomeq;
		case ROOMEQ_BAND9TYPE:        reg = 0x30BC; goto roomeq;
		case ROOMEQ_BAND9GAIN:        reg = 0x30BD; goto roomeq;
		case ROOMEQ_BAND9FREQ:        reg = 0x30BE; goto roomeq;
		case ROOMEQ_BAND9Q:           reg = 0x30BF; goto roomeq;
		roomeq:
		if (p->out == -1) break;
		return reg + (p->out << 5);
		case SETUP_ARCLEDS:           return 0x3E02;
		case REFRESH:                 return 0x3E03;
		case SETUP_STORE:             return 0x3E06;
		case DUREC_CONTROL:           return 0x3E9A;
		case DUREC_DELETE:            return 0x3E9B;
		case DUREC_FILE:              return 0x3E9C;
		case DUREC_SEEK:              return 0x3E9D;
		case DUREC_PLAYMODE:          return 0x3EA0;
		default: break;
	}
	return -1;
}

const struct device ffufxp = {
	.id = "ffufxp",
	.name = "Fireface UFX+",
	.version = 23,
	.flags = DEVICE_HAS_DUREC | DEVICE_HAS_ROOMEQ | DEVICE_MIXER_V2,
	.inputs = inputs,
	.inputslen = LEN(inputs),
	.outputs = outputs,
	.outputslen = LEN(outputs),
	.refresh = 0x234A, // 0x67CD,
	.regtoctl = regtoctl,
	.ctltoreg = ctltoreg,
};
