#include <assert.h>
#include <stddef.h>
#include "device.h"
#include "intpack.h"

#define LEN(a) (sizeof(a) / sizeof(*(a)))

static const char *const reflevel_input[] = {"+4dBu", "Lo Gain"};
static const char *const reflevel_output[] = {"+4dBu", "+13dBu", "+19dBu"};
static const char *const reflevel_phones[] = {"Low", "High"};

static const struct channelinfo inputs[] = {
	{"Analog 1",    INPUT_HAS_GAIN | INPUT_HAS_REFLEVEL,
			.gain = {0, 120},  // 0.0dB–12.0dB (in 0.1dB steps)
		.reflevel = {reflevel_input, LEN(reflevel_input)}},
	{"Analog 2",    INPUT_HAS_GAIN | INPUT_HAS_REFLEVEL,
			.gain = {0, 120},
		.reflevel = {reflevel_input, LEN(reflevel_input)}},
	{"Analog 3",    INPUT_HAS_GAIN | INPUT_HAS_REFLEVEL,
			.gain = {0, 120},
		.reflevel = {reflevel_input, LEN(reflevel_input)}},
	{"Analog 4",    INPUT_HAS_GAIN | INPUT_HAS_REFLEVEL,
			.gain = {0, 120},
		.reflevel = {reflevel_input, LEN(reflevel_input)}},
	{"Analog 5",    INPUT_HAS_GAIN | INPUT_HAS_REFLEVEL,
			.gain = {0, 120},
		.reflevel = {reflevel_input, LEN(reflevel_input)}},
	{"Analog 6",    INPUT_HAS_GAIN | INPUT_HAS_REFLEVEL,
			.gain = {0, 120},
		.reflevel = {reflevel_input, LEN(reflevel_input)}},
	{"Analog 7",    INPUT_HAS_GAIN | INPUT_HAS_REFLEVEL,
			.gain = {0, 120},
		.reflevel = {reflevel_input, LEN(reflevel_input)}},
	{"Analog 8",    INPUT_HAS_GAIN | INPUT_HAS_REFLEVEL,
			.gain = {0, 120},
		.reflevel = {reflevel_input, LEN(reflevel_input)}},
	{"Mic/Inst 9",  INPUT_HAS_48V | INPUT_HAS_HIZ},
	{"Mic/Inst 10", INPUT_HAS_48V | INPUT_HAS_HIZ},
	{"Mic/Inst 11", INPUT_HAS_48V | INPUT_HAS_HIZ},
	{"Mic/Inst 12", INPUT_HAS_48V | INPUT_HAS_HIZ},
	{"AES L"},
	{"AES R"},
	{"ADAT 1"}, {"ADAT 2"}, {"ADAT 3"}, {"ADAT 4"},
	{"ADAT 5"}, {"ADAT 6"}, {"ADAT 7"}, {"ADAT 8"},
	{"ADAT 9"}, {"ADAT 10"}, {"ADAT 11"}, {"ADAT 12"},
	{"ADAT 13"}, {"ADAT 14"}, {"ADAT 15"}, {"ADAT 16"},
};
_Static_assert(LEN(inputs) == 30, "bad inputs");

static const struct channelinfo outputs[] = {
	{"Analog 1",  OUTPUT_HAS_REFLEVEL, .reflevel={reflevel_output, LEN(reflevel_output)}},
	{"Analog 2",  OUTPUT_HAS_REFLEVEL, .reflevel={reflevel_output, LEN(reflevel_output)}},
	{"Analog 3",  OUTPUT_HAS_REFLEVEL, .reflevel={reflevel_output, LEN(reflevel_output)}},
	{"Analog 4",  OUTPUT_HAS_REFLEVEL, .reflevel={reflevel_output, LEN(reflevel_output)}},
	{"Analog 5",  OUTPUT_HAS_REFLEVEL, .reflevel={reflevel_output, LEN(reflevel_output)}},
	{"Analog 6",  OUTPUT_HAS_REFLEVEL, .reflevel={reflevel_output, LEN(reflevel_output)}},
	{"Analog 7",  OUTPUT_HAS_REFLEVEL, .reflevel={reflevel_output, LEN(reflevel_output)}},
	{"Analog 8",  OUTPUT_HAS_REFLEVEL, .reflevel={reflevel_output, LEN(reflevel_output)}},
	{"Phones 9",  OUTPUT_HAS_REFLEVEL, .reflevel={reflevel_phones, LEN(reflevel_phones)}},
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
	int idx, subreg, flags;

	if (reg < 0) return -1;

	// TODO: Needds more investigation, what causes this...
	// This reg comes up since expanded the controls in device.h
	// Workaround for the "unknown" register 0x0901
	if (reg == 0x0901) {
		return UNKNOWN;
	}


	// Input-Register: 0x0000–0x1D00 (30 Kanäle, 0x100 pro Kanal)
	if (reg < 0x1E00) {
		idx = reg >> 8; // Jeder Kanalblock ist 0x100 groß (z.B. AN1: 0x0000-0x00FF)
		subreg = reg & 0xFF;
		if (idx >= LEN(inputs)) return -1;
		p->in = idx;
		flags = inputs[idx].flags;

		switch (subreg) {
			case 0x00: return INPUT_MUTE;
			case 0x01: return INPUT_FXSEND;
			case 0x02: return INPUT_STEREO;
			case 0x03: return INPUT_RECORD;
			case 0x04: return INPUT_PLAYCHAN;
			case 0x05: return INPUT_MSPROC;
			case 0x06: return INPUT_PHASE;
			case 0x07: return (flags & INPUT_HAS_GAIN) ? INPUT_GAIN : -1;
			case 0x08: return (flags & INPUT_HAS_REFLEVEL) ? INPUT_REFLEVEL : ((flags & INPUT_HAS_48V) ? INPUT_48V : -1);

			case 0x09: return (flags & INPUT_HAS_HIZ) ? INPUT_HIZ : -1;

			case 0x20: return LOWCUT;              // Low Cut Enable (0=off, 1=on)
			case 0x21: return LOWCUT_FREQ;         // Low Cut Frequency (20Hz–500Hz)
			case 0x22: return LOWCUT_SLOPE;        // Low Cut Slope (0=6dB/oct, 1=12dB/oct, 2=18dB/oct, 3=24dB/oct)
			case 0x40: return EQ;                  // EQ Enable (0=off, 1=on)
			case 0x41: return EQ_BAND1TYPE;        // EQ Band 1 Type (0=Peak, 1=Low Shelf)
			case 0x42: return EQ_BAND1GAIN;        // EQ Band 1 Gain (1/10 fixed point, -20.0dB–20.0dB)
			case 0x43: return EQ_BAND1FREQ;        // EQ Band 1 Frequency (20Hz–20000Hz)
			case 0x44: return EQ_BAND1Q;           // EQ Band 1 Q (1/10 fixed point, 0.7–5.0)
			case 0x45: return EQ_BAND2GAIN;        // EQ Band 2 Gain (1/10 fixed point, -20.0dB–20.0dB)
			case 0x46: return EQ_BAND2FREQ;        // EQ Band 2 Frequency (20Hz–20000Hz)
			case 0x47: return EQ_BAND2Q;           // EQ Band 2 Q (1/10 fixed point, 0.7–5.0)
			case 0x48: return EQ_BAND3TYPE;        // EQ Band 3 Type (0=Peak, 1=High Shelf, 2=Low Pass)
			case 0x49: return EQ_BAND3GAIN;        // EQ Band 3 Gain (1/10 fixed point, -20.0dB–20.0dB)
			case 0x4A: return EQ_BAND3FREQ;        // EQ Band 3 Frequency (20Hz–20000Hz)
			case 0x4B: return EQ_BAND3Q;           // EQ Band 3 Q (1/10 fixed point, 0.7–5.0)
			case 0x60: return DYNAMICS;            // Dynamics Enable (0=off, 1=on)
			case 0x61: return DYNAMICS_GAIN;       // Dynamics Gain (1/10 fixed point, -30.0dB–30.0dB)
			case 0x62: return DYNAMICS_ATTACK;     // Dynamics Attack (0ms–200ms)
			case 0x63: return DYNAMICS_RELEASE;    // Dynamics Release (100ms–999ms)
			case 0x64: return DYNAMICS_COMPTHRES;  // Dynamics Compressor Threshold (1/10 fixed point, -60.0dB–0.0dB)
			case 0x65: return DYNAMICS_COMPRATIO;  // Dynamics Compressor Ratio (1/10 fixed point, 1.0–10.0)
			case 0x66: return DYNAMICS_EXPTHRES;   // Dynamics Expander Threshold (1/10 fixed point, -99.0dB––20.0dB)
			case 0x67: return DYNAMICS_EXPRATIO;   // Dynamics Expander Ratio (1/10 fixed point, 1.0–10.0)
			case 0x80: return AUTOLEVEL;           // Auto Level Enable (0=off, 1=on)
			case 0x81: return AUTOLEVEL_MAXGAIN;   // Auto Level Max Gain (1/10 fixed point, 0.0dB–18.0dB)
			case 0x82: return AUTOLEVEL_HEADROOM;  // Auto Level Headroom (1/10 fixed point, 3dB–12dB)
			case 0x83: return AUTOLEVEL_RISETIME;  // Auto Level Rise Time (1/10 fixed point, 0.1s–9.9s)
			default:   return -1;
		}
	}
	// Output-Register: 0x1E00–0x3B00 (30 Kanäle)
	else if (reg >= 0x1E00 && reg < 0x3C00) {
		idx = (reg - 0x1E00) >> 8;
		subreg = reg & 0xFF;
		if (idx >= LEN(outputs)) return -1;
		p->out = idx;
		flags = outputs[idx].flags;


		switch (subreg) {
			case 0x00: return OUTPUT_VOLUME;       // Volume (1/10 fixed point, -65.0dB–6.0dB)
			case 0x01: return OUTPUT_PAN;          // Balance (-100=left, 0=center, 100=right)
			case 0x02: return OUTPUT_MUTE;         // Mute (0=off, 1=on)
			case 0x03: return OUTPUT_FXRETURN;     // FX Return (1/10 fixed point, -65.0dB–0.0dB)
			case 0x04: return OUTPUT_STEREO;       // Stereo (0=off, 1=on)
			case 0x05: return OUTPUT_RECORD;       // Record (0=off, 1=on)
			case 0x06: return OUTPUT_PLAYCHAN;     // Play Channel (0=off, 1–60)
			case 0x07: return OUTPUT_PHASE;        // Phase Invert (0=off, 1=on)

			case 0x08: return (flags & OUTPUT_HAS_REFLEVEL) ? OUTPUT_REFLEVEL : -1;
			case 0x20: return LOWCUT;              // Low Cut Enable (0=off, 1=on)
			case 0x21: return LOWCUT_FREQ;         // Low Cut Frequency (20Hz–500Hz)
			case 0x22: return LOWCUT_SLOPE;        // Low Cut Slope (0=6dB/oct, 1=12dB/oct, 2=18dB/oct, 3=24dB/oct)
			case 0x40: return EQ;                  // EQ Enable (0=off, 1=on)
			case 0x41: return EQ_BAND1TYPE;        // EQ Band 1 Type (0=Peak, 1=Low Shelf)
			case 0x42: return EQ_BAND1GAIN;        // EQ Band 1 Gain (1/10 fixed point, -20.0dB–20.0dB)
			case 0x43: return EQ_BAND1FREQ;        // EQ Band 1 Frequency (20Hz–20000Hz)
			case 0x44: return EQ_BAND1Q;           // EQ Band 1 Q (1/10 fixed point, 0.7–5.0)
			case 0x45: return EQ_BAND2GAIN;        // EQ Band 2 Gain (1/10 fixed point, -20.0dB–20.0dB)
			case 0x46: return EQ_BAND2FREQ;        // EQ Band 2 Frequency (20Hz–20000Hz)
			case 0x47: return EQ_BAND2Q;           // EQ Band 2 Q (1/10 fixed point, 0.7–5.0)
			case 0x48: return EQ_BAND3TYPE;        // EQ Band 3 Type (0=Peak, 1=High Shelf, 2=Low Pass)
			case 0x49: return EQ_BAND3GAIN;        // EQ Band 3 Gain (1/10 fixed point, -20.0dB–20.0dB)
			case 0x4A: return EQ_BAND3FREQ;        // EQ Band 3 Frequency (20Hz–20000Hz)
			case 0x4B: return EQ_BAND3Q;           // EQ Band 3 Q (1/10 fixed point, 0.7–5.0)
			case 0x60: return DYNAMICS;            // Dynamics Enable (0=off, 1=on)
			case 0x61: return DYNAMICS_GAIN;       // Dynamics Gain (1/10 fixed point, -30.0dB–30.0dB)
			case 0x62: return DYNAMICS_ATTACK;     // Dynamics Attack (0ms–200ms)
			case 0x63: return DYNAMICS_RELEASE;    // Dynamics Release (100ms–999ms)
			case 0x64: return DYNAMICS_COMPTHRES;  // Dynamics Compressor Threshold (1/10 fixed point, -60.0dB–0.0dB)
			case 0x65: return DYNAMICS_COMPRATIO;  // Dynamics Compressor Ratio (1/10 fixed point, 1.0–10.0)
			case 0x66: return DYNAMICS_EXPTHRES;   // Dynamics Expander Threshold (1/10 fixed point, -99.0dB––20.0dB)
			case 0x67: return DYNAMICS_EXPRATIO;   // Dynamics Expander Ratio (1/10 fixed point, 1.0–10.0)
			case 0x80: return AUTOLEVEL;           // Auto Level Enable (0=off, 1=on)
			case 0x81: return AUTOLEVEL_MAXGAIN;   // Auto Level Max Gain (1/10 fixed point, 0.0dB–18.0dB)
			case 0x82: return AUTOLEVEL_HEADROOM;  // Auto Level Headroom (1/10 fixed point, 3.0dB–12.0dB)
			case 0x83: return AUTOLEVEL_RISETIME;  // Auto Level Rise Time (1/10 fixed point, 0.1s–9.9s)
			default:   return -1;                  // Unbekanntes Subregister
		}
	}
	// Mixer-Register: 0x4000–0x47FF (MIX1–MIX30)
	else if (reg >= 0x4000 && reg < 0x4800) {
		p->out = (reg - 0x4000) >> 6;  // 64 Register pro Mix (32 Inputs + 32 Playbacks)
		p->in = reg & 0x3F;
		return MIX;
	}
	// Effekte, Hardware, etc.
	switch (reg) {
			// Reverb
		case 0x3C00: return REVERB;              // Reverb Enable (0=off, 1=on)
		case 0x3C01: return REVERB_TYPE;         // Reverb Type (0=Small Room, 1=Medium Room, 2=Large Room, 3=Walls, 4=Shorty, 5=Attack, 6=Swagger, 7=Old School, 8=Echoistic, 9=8plus9, 10=Grand Wide, 11=Thicker, 12=Envelope, 13=Gated, 14=Space)
		case 0x3C02: return REVERB_PREDELAY;     // Reverb Pre-Delay (0ms–999ms)
		case 0x3C03: return REVERB_LOWCUT;       // Reverb Low Cut (20Hz–500Hz)
		case 0x3C04: return REVERB_ROOMSCALE;    // Reverb Room Scale (1/100 fixed point, 0.50–3.00)
		case 0x3C05: return REVERB_ATTACK;       // Reverb Attack Time (5ms–400ms, nur bei Envelope)
		case 0x3C06: return REVERB_HOLD;         // Reverb Hold Time (5ms–400ms, nur bei Envelope und Gated)
		case 0x3C07: return REVERB_RELEASE;      // Reverb Release Time (5ms–500ms, nur bei Envelope und Gated)
		case 0x3C08: return REVERB_HIGHCUT;      // Reverb High Cut (2kHz–20kHz)
		case 0x3C09: return REVERB_TIME;         // Reverb Time (1/10 fixed point, 0.1s–4.9s, nur bei Space)
		case 0x3C0A: return REVERB_HIGHDAMP;     // Reverb High Damp (2kHz–20kHz, nur bei Space)
		case 0x3C0B: return REVERB_SMOOTH;       // Reverb Smooth (0–100%)
		case 0x3C0C: return REVERB_VOLUME;       // Reverb Volume (1/10 fixed point, -65.0dB–6.0dB)
		case 0x3C0D: return REVERB_WIDTH;        // Reverb Width (1/100 fixed point, 0.00–1.00)

			// Echo
		case 0x3C20: return ECHO;                // Echo Enable (0=off, 1=on)
		case 0x3C21: return ECHO_TYPE;           // Echo Type (0=Stereo Echo, 1=Stereo Cross, 2=Pong Echo)
		case 0x3C22: return ECHO_DELAY;          // Echo Delay Time (1/1000 fixed point, 0.000s–2.000s)
		case 0x3C23: return ECHO_FEEDBACK;       // Echo Feedback (0–100%)
		case 0x3C24: return ECHO_HIGHCUT;        // Echo High Cut (0=off, 1=16kHz, 2=12kHz, 3=8kHz, 4=4kHz, 5=2kHz)
		case 0x3C25: return ECHO_VOLUME;         // Echo Volume (1/10 fixed point, -65.0dB–6.0dB)
		case 0x3C26: return ECHO_WIDTH;          // Echo Width (1/100 fixed point, 0.00–1.00)

			// Control Room
		case 0x3D00: return CTLROOM_MAINOUT;     // Main Out (0=1/2, 1=3/4, ..., 9=19/20)
//		case 0x3D01: return CTLROOM_MAINMONO;    // Main Mono (0=off, 1=on)
	//	case 0x3D02: return CTLROOM_PHONES_SRC;  // Phones Source (unbekannt)
		case 0x3D01: return CTLROOM_MUTEENABLE;  // Mute Enable (0=off, 1=on)
		case 0x3D02: return CTLROOM_DIMREDUCTION; // Dim Reduction (1/10 fixed point, -65.0dB–0.0dB)
		case 0x3D03: return CTLROOM_DIM;         // Dim (0=off, 1=on)
		case 0x3D04: return CTLROOM_RECALLVOLUME; // Recall Volume (1/10 fixed point, -65.0dB–0.0dB)

			// Clock
		case 0x3D20: return CLOCK_SOURCE;        // Clock Source (0=Internal, 1=Word Clock, 2=SPDIF, 3=AES, 4=Optical)
		case 0x3D21: return CLOCK_SAMPLERATE;    // Sample Rate (0=32000, 1=44100, 2=48000, 3=64000, 4=88200, 5=96000, 6=128000, 7=176400, 8=192000)
	//	case 0x3D22: return CLOCK_WCKOUT;        // Word Clock Out (0=off, 1=on)
		case 0x3D22: return CLOCK_WCKSINGLE;     // Word Clock Single Speed (0=off, 1=on)
		case 0x3D23: return CLOCK_WCKTERM;       // Word Clock Termination (0=off, 1=on)

			// Hardware

		case 0x3D40: return HARDWARE_OPTICALIN;  // Optical In (0=ADAT 2, 1=SPDIF)
		case 0x3D41: return HARDWARE_OPTICALOUT2; // Optical Out 2 (0=ADAT 1, 1=SPDIF)
		case 0x3D42: return HARDWARE_SPDIFOUT;   // AES Out Format (0=Consumer, 1=Professional)
		case 0x3D43: return HARDWARE_STANDALONEMIDI; // Standalone MIDI (0=off, 1=on)
		case 0x3D44: return HARDWARE_CCMODE;     // CC Mode (0=off, 1=on)
		case 0x3D45: return HARDWARE_STANDALONEARC;  // Standalone ARC (0=Volume, 1=1s Op, 2=Normal)
		case 0x3D46: return HARDWARE_OPTICALOUT; // Optical Out 1 (0=ADAT 2, 1=SPDIF)

	//	case 0x3D43: return HARDWARE_CCMIX;      // CC Mix (0=TotalMix, 1=6ch+Phones, 2=8ch, 3=20ch)


			//State
		case 0x3F00: return HARDWARE_DSPVERLOAD; // DSP Version/Load
		case 0x3F01: return HARDWARE_DSPSTATUS;  // DSP Function Overload
		case 0x3F02: return HARDWARE_DSPAVAIL;   // DSP Function Available

		//case 0x3D4B: return HARDWARE_ARCDELTA;   // ARC Encoder Delta

		//case 0x3F99: return REFRESH;                // Refresh
		case 0x3F05: return REFRESH; 	// Indicator if Refresh is done



			// Unbekannte Register
		default: return -1;
	}
}

static int
ctltoreg(enum control ctl, const struct param *p)
{
	int reg, idx, flags;
	//int reg, idx = -1, flags = 0;
	if ((unsigned)p->in < LEN(inputs)) {
   		flags = inputs[p->in].flags;
    	idx = p->in;
	} else if ((unsigned)p->out < LEN(outputs)) {
    	flags = outputs[p->out].flags;
    	idx = 30 + p->out;
	}


	switch (ctl) {
			/* Input Controls (0x0000–0x1DFF) */
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
		
		/* Channel FX */
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
		//ff802 needs 8 bit shift due to 0x100 channel blocks (offset)
			  						  return idx << 8 | reg; 
                            		  //return idx << 6 | reg;
		/* Mixer (0x4000–0x47FF) */
		case MIX:
    								if ((unsigned)p->out >= 30) break;   // 30 Mix-Busse
    								if ((unsigned)p->in >= 64) break;    // 32 Inputs + 32 Playbacks
    								return 0x4000 | (p->out << 6) | p->in;

		/* Global Controls */
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
		//case CTLROOM_MAINMONO:        return 0x3D01; // unknown for ff802
		case CTLROOM_MUTEENABLE:      return 0x3D01;
		case CTLROOM_DIMREDUCTION:    return 0x3D02;
		case CTLROOM_DIM:             return 0x3D03;
		case CTLROOM_RECALLVOLUME:    return 0x3D04;

		case CLOCK_SOURCE:            return 0x3D20;
		case CLOCK_SAMPLERATE:        return 0x3D21;
		case CLOCK_WCKSINGLE:         return 0x3D22;
		case CLOCK_WCKTERM:           return 0x3D23;

		case HARDWARE_OPTICALIN:      return 0x3D40; // Optical in 1
		case HARDWARE_OPTICALOUT2:    return 0x3D41; // Optical Out 2
		case HARDWARE_SPDIFOUT:       return 0x3D42; // AES channel status
		case HARDWARE_STANDALONEMIDI: return 0x3D43; // Standalone MIDI (0=off, 1=on)
		case HARDWARE_CCMODE:         return 0x3D44; // CC Mode (0=off, 1=on)
		case HARDWARE_STANDALONEARC:  return 0x3D45; // Standalone ARC (0=Volume, 1=1s Op, 2=Normal)
		case HARDWARE_OPTICALOUT:     return 0x3D46; // Optical Out 1

		case HARDWARE_DSPVERLOAD:     return 0x3F00;
		case HARDWARE_DSPSTATUS:      return 0x3F01;
		case HARDWARE_DSPAVAIL:       return 0x3F02;
		//case HARDWARE_ARCDELTA:       return 0x3D4B;

		case REFRESH:                 return 0x3F99;
		default:                      break;
	}
	return -1;
}

const struct device ff802 = {
	.id = "ff802",
	.name = "Fireface 802",
	.version = 30,
	.flags = 0,
	.inputs = inputs,
	.inputslen = LEN(inputs),
	.outputs = outputs,
	.outputslen = LEN(outputs),
	.refresh = 0x0812,
	.regtoctl = regtoctl,
	.ctltoreg = ctltoreg,
};

