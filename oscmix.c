#define _XOPEN_SOURCE 700  /* for memccpy */
#include <assert.h>
#include <limits.h>
#include <math.h>
#include <stdarg.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>  /* for strcasecmp */
#include "device.h"
#include "intpack.h"
#include "oscmix.h"
#include "osc.h"
#include "sysex.h"
#include "util.h"

#define LEN(a) (sizeof (a) / sizeof *(a))
#define PI 3.14159265358979323846

struct context {
	const struct node *node;
	const char *pattern;
	char *addr, *addrpos, *addrend;
	struct param param;
	bool exact;
	int reg;  /* actual register number (for name handling) */
};

struct node {
	const char *name;
	enum control ctl;
	void (*set)(struct context *ctx, struct oscmsg *msg);
	void (*new)(struct context *ctx, int val);
	union {
		struct {
			const char *const *const names;
			size_t nameslen;
		};
		struct {
			short min;
			short max;
			float scale;
		};
	};
	const struct node *tree;
};

struct input {
	bool stereo;
	bool mute;
	int width;
	char name[12];
};

struct output {
	bool stereo;
	float *mix;
	char name[12];
};

struct durecfile {
	short reg[6];
	char name[9];
	unsigned long samplerate;
	unsigned channels;
	unsigned length;
};

int dflag;
static const struct device *device;
static char deviceuid[256];  /* "Device Name (SERIALNO)" - derived once in init() */
static struct input *inputs;
static struct output *outputs;
/* FX level buffers sized device->inputslen+2 / device->outputslen+2 at init */
static uint_least32_t *inputpeakfx;
static uint_least32_t *outputpeakfx;
static uint_least64_t *inputrmsfx;
static uint_least64_t *outputrmsfx;
static struct {
	int status;
	int position;
	int time;
	int usberrors;
	int usbload;
	float totalspace;
	float freespace;
	struct durecfile *files;
	size_t fileslen;
	int file;
	int recordtime;
	int index;
	int next;
	int playmode;
} durec = {.index = -1};
static struct {
	int vers;
	int load;
} dsp;

static void oscsend(const char *addr, const char *type, ...);
static void oscflush(void);
static void oscsendenum(const char *addr, int val, const char *const names[], size_t nameslen);

static void
dump(const char *name, const void *ptr, size_t len)
{
	size_t i;
	const unsigned char *buf;

	buf = ptr;
	if (name)
		fputs(name, stdout);
	if (len > 0) {
		if (name)
			putchar('\t');
		printf("%.2x", buf[0]);
	}
	for (i = 1; i < len; ++i)
		printf(" %.2x", buf[i]);
	putchar('\n');
}

static void
writesysex(int subid, const unsigned char *buf, size_t len, unsigned char *sysexbuf)
{
	struct sysex sysex;
	size_t sysexlen;

	sysex.mfrid = 0x200d;
	sysex.devid = 0x10;
	sysex.data = NULL;
	sysex.datalen = len * 5 / 4;
	sysex.subid = subid;
	sysexlen = sysexenc(&sysex, sysexbuf, SYSEX_MFRID | SYSEX_DEVID | SYSEX_SUBID);
	base128enc(sysex.data, buf, len);
	writemidi(sysexbuf, sysexlen);
}

static int
setreg(unsigned reg, unsigned val)
{
	unsigned long regval;
	unsigned char buf[4], sysexbuf[7 + 5];
	unsigned par;

	val &= 0xffff;
	if (dflag && reg != 0x3f00)
		fprintf(stderr, "setreg %.4X %.4X\n", reg, val);
	regval = (reg & 0x7fff) << 16 | val;
	par = regval >> 16 ^ regval;
	par ^= par >> 8;
	par ^= par >> 4;
	par ^= par >> 2;
	par ^= par >> 1;
	regval |= (~par & 1) << 31;
	putle32(buf, regval);

	writesysex(0, buf, sizeof buf, sysexbuf);
	return 0;
}

static void
setval(struct context *ctx, int val)
{
	int reg;

	reg = device->ctltoreg(ctx->node->ctl, &ctx->param);
	if (reg != -1)
		setreg(reg, val);
}

static void
setint(struct context *ctx, struct oscmsg *msg)
{
	int_least32_t val;

	val = oscgetint(msg);
	if (oscend(msg) != 0)
		return;
	setval(ctx, val);
}

static void
newint(struct context *ctx, int val)
{
	oscsend(ctx->addr, ",i", val);
}

static void
setfixed(struct context *ctx, struct oscmsg *msg)
{
	float val;

	val = oscgetfloat(msg);
	if (oscend(msg) != 0)
		return;
	setval(ctx, lroundf(val / ctx->node->scale));
}

static void
newfixed(struct context *ctx, int val)
{
	oscsend(ctx->addr, ",f", val * ctx->node->scale);
}

static void
setenum(struct context *ctx, struct oscmsg *msg)
{
	const char *str;
	int val;

	switch (*msg->type) {
		case 's':
			str = oscgetstr(msg);
			if (str) {
				for (val = 0; val < ctx->node->nameslen; ++val) {
					if (strcasecmp(str, ctx->node->names[val]) == 0)
						break;
				}
				if (val == ctx->node->nameslen)
					return;
			}
			break;
		default:
			val = oscgetint(msg);
			break;
	}
	if (oscend(msg) != 0)
		return;
	setval(ctx, val);
}

static void
newenum(struct context *ctx, int val)
{
	oscsendenum(ctx->addr, val, ctx->node->names, ctx->node->nameslen);
}

static void
setbool(struct context *ctx, struct oscmsg *msg)
{
	bool val;

	if (!ctx->exact)
		return;
	val = oscgetint(msg);
	if (oscend(msg) != 0)
		return;
	setval(ctx, val);
}

static void
newbool(struct context *ctx, int val)
{
	if (ctx->exact)
		oscsend(ctx->addr, ",i", val != 0);
}




static void
setmixlevel(const struct input *in, const struct output *out, float level)
{
	int reg;
	long val;
	struct param p;

	p.in = in - inputs;
	p.out = out - outputs;
	reg = device->ctltoreg(MIX_LEVEL, &p);
	if (reg == -1)
		return;

	if (device->flags & DEVICE_MIXER_V2) {
		/* UFX* mixer format:
		 * bits[0-13]: 14-bit signed 1/10 dB (0 = 0 dB, negative = attenuation, -3000 = mute)
		 * bit[14]:    parameter (0 = volume)
		 * bit[15]:    channel  (0 = left/odd output, 1 = right/even output) */
		int val_bits, channel_bit;
		float db;

		channel_bit = (p.out % 2) ? 0x8000 : 0x0000;

		if (level <= 0.0f) {
			val_bits = (-3000) & 0x3FFF;  /* mute sentinel: -300.0 dB in 14-bit signed */
			db = -300.0f;
		} else {
			db = 20.0f * log10f(level);
			val_bits = (int)lroundf(db * 10.0f) & 0x3FFF;  /* signed: 0 at 0 dB, negative for attenuation */
		}

		val = channel_bit | val_bits;

		if (dflag)
			fprintf(stderr, "setmixlevel [V2] in=%d out=%d reg=0x%04X"
					" ch=%s db=%.1f val_bits=0x%03X full=0x%04lX\n",
					p.in, p.out, reg,
					channel_bit ? "R" : "L",
					db, val_bits, val);
	} else {
		/* UCX II / FF802 format: signed linear amplitude */
		val = lroundf(level * 0x8000);
		assert(val >= 0);
		assert(val <= 0x10000);
		if (val > 0x4000)
			val = (val >> 3) - 0x8000;

		if (dflag)
			fprintf(stderr, "setmixlevel [V1] in=%d out=%d reg=0x%X val=0x%lX (level=%.3f)\n",
					p.in, p.out, reg, val, level);
	}

	setreg(reg, val);
}

static void
setmixpan(const struct input *in, const struct output *out, int pan)
{
	int reg;
	long val;
	struct param p;

	if (!(device->flags & DEVICE_MIXER_V2))
		return;

	p.in = in - inputs;
	p.out = out - outputs;
	reg = device->ctltoreg(MIX_LEVEL, &p);
	if (reg == -1)
		return;

	/* pan register: bit14=1 (parameter=pan), bits[7:0] = pan as 8-bit two's complement
	 * R100=100=0x64, center=0, L100=-100=0x9C */
	val = 0x4000 | (pan & 0xFF);

	if (dflag)
		fprintf(stderr, "setmixpan [V2] in=%d out=%d reg=0x%04X pan=%d val=0x%04lX\n",
				p.in, p.out, reg, pan, val);

	setreg(reg, val);
}

static void
setchannel(struct context *ctx, struct oscmsg *msg)
{
	char *end;
	long index;

	index = strtol(ctx->pattern + 1, &end, 10);
	if (*end != '/' || index < 1)
		return;
	--index;
	if (strcmp(ctx->node->name, "input") == 0) {
		if (index >= device->inputslen + device->outputslen)
			return;
		ctx->param.in = index;
	} else if (strcmp(ctx->node->name, "playback") == 0) {
		if (index >= device->outputslen)
			return;
		ctx->param.in = device->inputslen + index;
	} else if (strcmp(ctx->node->name, "output") == 0) {
		if (index >= device->outputslen)
			return;
		ctx->param.out = index;
	} else {
		assert(0);
		return;
	}
	ctx->pattern = end;
}

static void
newchannel(struct context *ctx, int val)
{
	const char *type;
	int ret, chan;

	if (ctx->param.in != -1) {
		type = "input";
		chan = ctx->param.in;
	} else {
		type = "output";
		chan = ctx->param.out;
	}
	ret = snprintf(ctx->addr, ctx->addrend - ctx->addr, "/%s/%d", type, chan + 1);
	if (ret >= 0)
		ctx->addrpos = ctx->addr + ret;
}

static void
muteinput(struct input *in, bool mute)
{
	const struct output *out;
	const float *mix;

	if (in->mute == mute)
		return;
	if (in->stereo && (in - inputs) & 1)
		--in;
	in[0].mute = mute;
	if (in->stereo)
		in[1].mute = mute;
	for (out = outputs; out != outputs + device->outputslen; ++out) {
		mix = &out->mix[in - inputs];
		if (!in->stereo && (device->flags & DEVICE_MIXER_V2) && out->stereo) {
			/* V2 mono-in stereo-out: restore full volume (not pre-panned) to both L/R.
			 * Snap to L output to get both ll and lr from the stereo pair cache. */
			const struct output *out_l = out - ((out - outputs) & 1);
			float ll = out_l[0].mix[in - inputs];
			float lr = out_l[1].mix[in - inputs];
			float full_vol = sqrtf(ll * ll + lr * lr);
			setmixlevel(in, out, mute ? 0.f : full_vol);
		} else {
			if (mix[0] > 0)
				setmixlevel(in, out, mute ? 0 : mix[0]);
			if (in->stereo && mix[1] > 0)
				setmixlevel(in + 1, out, mute ? 0 : mix[1]);
		}
	}
}

static void
setinputmute(struct context *ctx, struct oscmsg *msg)
{
	struct input *in;
	bool val;

	val = oscgetint(msg);
	if (oscend(msg) != 0)
		return;
	assert((unsigned)ctx->param.in < device->inputslen + device->outputslen);
	in = &inputs[ctx->param.in];
	setval(ctx, val);
	muteinput(in, val);
}

static void
newinputmute(struct context *ctx, int val)
{
	struct input *in;

	assert((unsigned)ctx->param.in < device->inputslen);
	in = &inputs[ctx->param.in];
	muteinput(in, val);
	newbool(ctx, val);
}

static void
setinputstereo(struct context *ctx, struct oscmsg *msg)
{
	struct input *in;
	bool val;

	val = oscgetint(msg);
	if (oscend(msg) != 0)
		return;
	in = &inputs[ctx->param.in & ~1];
	in[0].stereo = in[1].stereo = val;
	setval(ctx, val);
	ctx->param.in ^= 1;
	setval(ctx, val);
}

static void
newinputstereo(struct context *ctx, int val)
{
	struct input *in;

	assert((unsigned)ctx->param.in < device->inputslen);
	in = &inputs[ctx->param.in & ~1];
	in[0].stereo = val;
	in[1].stereo = val;
	snprintf(ctx->addr, ctx->addrend - ctx->addr, "/input/%d/stereo", (int)(in - inputs) + 1);
	oscsend(ctx->addr, ",i", val != 0);
	snprintf(ctx->addr, ctx->addrend - ctx->addr, "/input/%d/stereo", (int)(in - inputs) + 2);
	oscsend(ctx->addr, ",i", val != 0);
}

static void
newoutputstereo(struct context *ctx, int val)
{
	struct output *out;

	assert((unsigned)ctx->param.out < device->outputslen);
	out = &outputs[ctx->param.out & ~1];
	out[0].stereo = val;
	out[1].stereo = val;
	snprintf(ctx->addr, ctx->addrend - ctx->addr, "/output/%d/stereo", (int)(out - outputs + 1));
	oscsend(ctx->addr, ",i", val != 0);
	snprintf(ctx->addr, ctx->addrend - ctx->addr, "/output/%d/stereo", (int)(out - outputs + 2));
	oscsend(ctx->addr, ",i", val != 0);
}

static void
setname(struct context *ctx, struct oscmsg *msg)
{
	const char *name;
	char namebuf[12];
	int i, reg, val;

	name = oscgetstr(msg);
	if (oscend(msg) != 0)
		return;
	reg = device->ctltoreg(ctx->node->ctl, &ctx->param);
	if (reg == -1)
		return;
	strncpy(namebuf, name, sizeof namebuf - 1);
	namebuf[sizeof namebuf - 1] = '\0';
	for (i = 0; i < sizeof namebuf; i += 2, ++reg) {
		val = getle16(namebuf + i);
		setreg(reg, val);
	}
}

static void
newname(struct context *ctx, int val)
{
	char *namebuf;
	int basereg, off;

	/* Get pointer to the correct name buffer based on input/output */
	if (ctx->param.in != -1) {
		if (ctx->param.in >= device->inputslen + device->outputslen)
			return;
		namebuf = inputs[ctx->param.in].name;
	} else if (ctx->param.out != -1) {
		if (ctx->param.out >= device->outputslen)
			return;
		namebuf = outputs[ctx->param.out].name;
	} else {
		return;
	}

	/*
	 * Get the base register for this channel's name
	 * ctltoreg returns the FIRST register of the name block
	 * For ffufxiii: 0x2800 + (channel_idx * 8)
	 */
	basereg = device->ctltoreg(NAME, &ctx->param);
	if (basereg == -1)
		return;

	/*
	 * Calculate byte offset within the name (0, 2, 4, 6, 8, or 10)
	 * ctx->reg contains the actual register that triggered this call
	 * Each register holds 2 bytes, so offset = (register_offset * 2)
	 */
	off = (ctx->reg - basereg) * 2;

	/* Validate offset (should be 0-10 for 6 registers = 12 bytes) */
	if (off < 0 || off > 10) {
		if (dflag)
			fprintf(stderr, "newname: invalid offset %d (reg=0x%X, basereg=0x%X)\n",
					off, ctx->reg, basereg);
		return;
	}

	/* Update the 2 bytes at this position */
	putle16(namebuf + off, val);

	/* If this is the last register (offset 10), send the complete name */
	if (off == 10) {
		namebuf[11] = '\0';  /* Ensure null termination */
		oscsend(ctx->addr, ",s", namebuf);
	}
}

static void
setinputgain(struct context *ctx, struct oscmsg *msg)
{
	const struct channelinfo *info;
	float val;

	val = oscgetfloat(msg);
	if (oscend(msg) != 0)
		return;
	assert((unsigned)ctx->param.in < device->inputslen);
	info = &device->inputs[ctx->param.in];
	if (info->flags & INPUT_HAS_GAIN) {
		if (val < info->gain.min)
			val = info->gain.min;
		if (val > info->gain.max)
			val = info->gain.max;
		setval(ctx, val * 10);
	}
}

static void
newinputgain(struct context *ctx, int val)
{
	oscsend(ctx->addr, ",f", val / 10.0);
}

static void
newinputreflevel(struct context *ctx, int val)
{
	const struct channelinfo *info;

	assert((unsigned)ctx->param.in < device->inputslen);
	info = &device->inputs[ctx->param.in];
	oscsendenum(ctx->addr, val & 0xf, info->reflevel.names, info->reflevel.nameslen);
}

static void
setoutputloopback(struct context *ctx, struct oscmsg *msg)
{
	bool val;
	unsigned char buf[4], sysexbuf[7 + 5];

	val = oscgetint(msg);
	if (oscend(msg) != 0)
		return;
	putle32(buf, val << 7 | ctx->param.in);
	writesysex(3, buf, sizeof buf, sysexbuf);
}

static void
seteqdrecord(struct context *ctx, struct oscmsg *msg)
{
	bool val;
	unsigned char buf[4], sysexbuf[7 + 5];

	val = oscgetint(msg);
	if (oscend(msg) != 0)
		return;
	putle32(buf, val);
	writesysex(4, buf, sizeof buf, sysexbuf);
}

static void
newdspload(struct context *ctx, int val)
{
	if (dsp.load != (val & 0xff)) {
		dsp.load = val & 0xff;
		oscsend("/hardware/dspload", ",i", dsp.load);
	}
	if (dsp.vers != val >> 8) {
		dsp.vers = val >> 8;
		oscsend("/hardware/dspvers", ",i", dsp.vers);
	}
}

static void
newdspavail(struct context *ctx, int val)
{
}

static void
newdspstatus(struct context *ctx, int val)
{
}

static void
newdim(struct context *ctx, int val)
{
	oscsend(ctx->addr, ",i", val < 0 ? 0 : val);
}

static void
newarcdelta(struct context *ctx, int val)
{
	oscsend("/hardware/arcdelta", ",i", val );
}

static void
newarcbuttons(struct context *ctx, int val)
{
	oscsend("/hardware/arcbuttons", ",i", val );
}

static void
setdb(const struct output *out, const struct input *in, float db)
{
	int reg, val;
	struct param p;

	p.in = in - inputs;
	p.out = out - outputs;
	reg = device->ctltoreg(MIX, &p);
	if (reg == -1)
		return;
	val = (isinf(db) && db < 0 ? -650 : lroundf(db * 10.f)) & 0x7fff;
	setreg(reg, val);
}




static void
setpan(const struct output *out, const struct input *in, int pan)
{
	int reg, val;
	struct param p;

	p.in = in - inputs;
	p.out = out - outputs;
	reg = device->ctltoreg(MIX, &p);
	if (reg == -1) {
		if (dflag)
			fprintf(stderr, "setpan in=%d out=%d pan=%d -> no MIX reg\n",
					p.in, p.out, pan);
		return;
	}
	val = (pan & 0x7fff) | 0x8000;

	if (dflag)
		fprintf(stderr, "setpan in=%d out=%d reg=0x%04X pan=%d val=0x%04X\n",
				p.in, p.out, reg, pan, (unsigned)val & 0xffff);

	setreg(reg, val);
}

struct level {
	float vol;  /* 0 (mute) to 1 (0dB) */
	short pan;  /* -100 (left) to 100 (right) */
	short width;  /* -100 (reversed) to 100 (full stereo) */
};

static void
calclevel(const struct output *out, const struct input *in, bool instereo, struct level *l)
{
	int ich;
	float ll, lr, rl, rr, w;

	if (instereo)
		instereo = in->stereo;
	if (instereo && (in - inputs) & 1)
		--in;
	if (out->stereo && (out - outputs) & 1)
		--out;
	ich = in - inputs;
	if (out->stereo) {
		ll = out[0].mix[ich];
		lr = out[1].mix[ich];
		if (instereo) {
			rl = out[0].mix[ich + 1];
			rr = out[1].mix[ich + 1];
			w = ll + rl == 0 ? 1 : 2 * ll / (ll + rl) - 1;
			if (ll < rr) {  /* p > 0 */
				l->vol = 2 * rr / (1 + w);
				l->pan = lroundf(100 * (1 - ll / rr));
			} else {
				l->vol = 2 * ll / (1 + w);
				l->pan = ll == 0 ? 0 : lroundf(100 * (rr / ll - 1));
			}
			l->width = lroundf(100 * w);
		} else {
			l->vol = sqrtf(ll * ll + lr * lr);
			l->pan = l->vol > 0.f ? lroundf(acosf(ll / l->vol) * 400.f / PI - 100.f) : 0;
		}
	} else {
		ll = out[0].mix[ich];
		if (instereo) {
			rl = out[0].mix[ich + 1];
			if (ll < rl) {  /* p > 0 */
				l->vol = 2 * rl;
				l->pan = lroundf(100 * (1 - ll / rl));
			} else {
				l->vol = 2 * ll;
				l->pan = ll == 0 ? 0 : lroundf(100 * (rl / ll - 1));
			}
		} else {
			l->vol = ll;
			l->pan = 0;
		}
	}
}

static void
setlevel(struct output *out, const struct input *in, bool instereo, const struct level *l)
{
	float w, theta;
	float ll, lr, rl, rr;
	float *mix[2];

	if (instereo)
		instereo = in->stereo;
	if (instereo && (in - inputs) & 1)
		--in;
	if (out->stereo && (out - outputs) & 1)
		--out;
	mix[0] = &out[0].mix[in - inputs];
	if (out->stereo) {
		mix[1] = &out[1].mix[in - inputs];
		if (instereo) {
			w = l->width / 100.f;
			if (l->pan > 0) {
				ll = (100 - l->pan) * (1 + w) / 200.f * l->vol;
				lr = (1 - w) / 2.f * l->vol;
				rl = (100 - l->pan) * (1 - w) / 200.f * l->vol;
				rr = (1 + w) / 2.f * l->vol;
			} else {
				ll = (1 + w) / 2.f * l->vol;
				lr = (100 + l->pan) * (1 - w) / 200.f * l->vol;
				rl = (1 - w) / 2.f * l->vol;
				rr = (100 + l->pan) * (1 + w) / 200.f * l->vol;
			}
			mix[0][1] = rl;
			mix[1][1] = rr;
			if (!in->mute) {
				setmixlevel(in + 1, out, rl);
				setmixlevel(in + 1, out + 1, rr);
			}
		} else {
			theta = (l->pan + 100) * PI / 400.f;
			ll = cosf(theta) * l->vol;
			lr = sinf(theta) * l->vol;
		}
		mix[0][0] = ll;
		mix[1][0] = lr;
		if (!instereo && (device->flags & DEVICE_MIXER_V2)) {
			/* V2 mono-in stereo-out: write full volume to both L/R, pan via hardware register.
			 * Cache still holds cosine-panned ll/lr so calclevel can reconstruct vol/pan. */
			if (!in->mute) {
				setmixlevel(in, out, l->vol);
				setmixlevel(in, out + 1, l->vol);
			}
			setmixpan(in, out, l->pan);
		} else {
			if (!in->mute) {
				setmixlevel(in, out, ll);
				setmixlevel(in, out + 1, lr);
			}
		}
	} else {
		if (instereo) {
			if (l->pan > 0) {
				ll = (100 - l->pan) / 200.f * l->vol;
				rl = l->vol / 2;
			} else {
				ll = l->vol / 2;
				rl = (100 + l->pan) / 200.f * l->vol;
			}
			mix[0][1] = rl;
			if (!in->mute)
				setmixlevel(in + 1, out, rl);
		} else {
			ll = l->vol;
		}
		mix[0][0] = ll;
		if (!in->mute)
			setmixlevel(in, out, ll);
	}
}

static void
setmix(struct context *ctx, struct oscmsg *msg)
{
	unsigned long i;
	char *end;
	float vol;
	struct level level;
	struct output *out;
	struct input *in;
	int base;

	i = strtoul(ctx->pattern + 1, &end, 10) - 1;
	if (*end != '/' || i >= device->outputslen)
		return;
	ctx->param.out = i;
	ctx->pattern = end;
	out = &outputs[i];

	if (oscmatch(ctx->pattern, "input", &end))
		base = 0;
	else if (oscmatch(ctx->pattern, "playback", &end))
		base = device->inputslen;
	else
		return;
	i = strtoul(end + 1, &end, 10) - 1;
	if (*end || i >= device->inputslen + device->outputslen - base)
		return;
	i += base;
	ctx->param.in = i;
	ctx->pattern = end;
	in = &inputs[i];

	if (out->stereo && (out - outputs) & 1)
		--out;
	if (in->stereo && (in - inputs) & 1)
		--in;

	calclevel(out, in, 1, &level);
	level.width = in->width;
	if (*msg->type == 'N') {
		++msg->type;
	} else {
		vol = oscgetfloat(msg);
		level.vol = vol <= -65.f ? 0 : powf(10.f, vol / 20.f);
	}

	if (*msg->type) {
		level.pan = oscgetint(msg);
		if (level.pan < -100)
			level.pan = -100;
		else if (level.pan > 100)
			level.pan = 100;
	}
	if (oscend(msg) != 0)
		return;
	if (dflag)
		fprintf(stderr, "setmix: out=%lu(%s) in=%lu(%s) vol=%.1fdB pan=%d width=%d\n",
				(unsigned long)(out - outputs) + 1, out->name,
				(unsigned long)(in - inputs) + 1, in->name,
				level.vol > 0 ? 20.f * log10f(level.vol) : -INFINITY,
				level.pan, level.width);
	setlevel(out, in, 1, &level);
	calclevel(out, in, 0, &level);
	setdb(out, in, 20.f * log10f(level.vol));
	setpan(out, in, level.pan);
	if (in->stereo) {
		calclevel(out, in + 1, 0, &level);
		setdb(out, in + 1, 20.f * log10f(level.vol));
		setpan(out, in + 1, level.pan);
	}
}

static void
newmix(struct context *ctx, int val)
{
	struct output *out;
	struct input *in;
	bool ispan;
	struct level level;

	if (ctx->param.out >= device->outputslen || ctx->param.in >= device->inputslen)
		return;
	assert(ctx->param.in >= 0);
	assert(ctx->param.out >= 0);
	in = &inputs[ctx->param.in];
	out = &outputs[ctx->param.out];
	if ((out - outputs) & 1 && out->stereo)
		return;
	ispan = val & 0x8000;
	val = ((val & 0x7fff) ^ 0x4000) - 0x4000;
	calclevel(out, in, 0, &level);
	if (ispan) {
		if (val < -100)
			val = -100;
		if (val > 100)
			val = 100;
		level.pan = val;
	} else {
		level.vol = val <= -650 ? 0 : powf(10.f, val / 200.f);
		if (level.vol > 2)
			level.vol = 2;
	}
	if (dflag)
		fprintf(stderr, "newmix: out=%d(%s) in=%d(%s) %s=%d -> vol=%.1fdB pan=%d\n",
				ctx->param.out + 1, out->name,
				ctx->param.in + 1, in->name,
				ispan ? "pan" : "vol", val,
				level.vol > 0 ? 20.f * log10f(level.vol) : -INFINITY,
				level.pan);
	setlevel(out, in, 0, &level);
	if (in->stereo) {
		if ((in - inputs) & 1)
			--in;
		calclevel(out, in, 1, &level);
		in->width = level.width;
	}
	snprintf(ctx->addr, ctx->addrend - ctx->addr, "/mix/%d/input/%d", (int)(out - outputs) + 1, (int)(in - inputs) + 1);
	oscsend(ctx->addr, ",fi", level.vol > 0 ? 20.f * log10f(level.vol) : -INFINITY, level.pan);
}

static long
getsamplerate(int val)
{
	static const long samplerate[] = {
		32000,
		44100,
		48000,
		64000,
		88200,
		96000,
		128000,
		176400,
		192000,
	};
	return val >= 0 && val < LEN(samplerate) ? samplerate[val] : 0;
}

static void
newsamplerate(struct context *ctx, int val)
{
	long rate;

	rate = getsamplerate(val);
	if (rate != 0)
		oscsend(ctx->addr, ",i", rate);
}

// see register in maptree (line 1483) why this is commented out...
/*
 static void
 setregs(struct context *ctx, struct oscmsg *msg)
 {
 int reg, val;

 while (*msg->type) {
 if (*msg->type != 'i') {
 msg->err = "expected integer for register";
 break;
 }
 reg = oscgetint(msg);
 if (msg->err) break;

 if (*msg->type != 'i') {
 msg->err = "expected integer for value";
 break;
 }
 val = oscgetint(msg);
 if (msg->err) break;

 setreg(reg, val);
 }
 oscend(msg);
 }
 */
static void
newmeter(struct context *ctx, int val)
{
	const char *type, *name;
	int chan;

	if (ctx->param.in != -1) {
		type = "input";
		chan = ctx->param.in;
	} else {
		type = "output";
		chan = ctx->param.out;
	}
	name = ctx->node->ctl == AUTOLEVEL_METER ? "autolevel" : "dynamics";
	snprintf(ctx->addr, ctx->addrend - ctx->addr, "/%s/%d/%s/meter", type, chan + 1, name);
	oscsend(ctx->addr, ",i", val >> 8 & 0xFF);
	snprintf(ctx->addr, ctx->addrend - ctx->addr, "/%s/%d/%s/meter", type, chan + 2, name);
	oscsend(ctx->addr, ",i", val & 0xFF);
}

static void
newdurecstatus(struct context *ctx, int val)
{
	static const char *const names[] = {
		"No Media", "Filesystem Error", "Initializing", "Reinitializing",
		[5] = "Stopped", "Recording",
		[10] = "Playing", "Paused",
	};
	int status;
	int position;

	status = val & 0xF;
	if (status != durec.status) {
		durec.status = status;
		oscsendenum("/durec/status", status, names, LEN(names));
	}
	position = (val >> 8) * 100 / 65;
	if (position != durec.position) {
		durec.position = position;
		oscsend("/durec/position", ",i", position);
	}
}

static void
newdurectime(struct context *ctx, int val)
{
	if (val != durec.time) {
		durec.time = val;
		oscsend("/durec/time", ",i", val);
	}
}

static void
newdurecusbstatus(struct context *ctx, int val)
{
	int usbload, usberrors;

	usbload = val >> 8;
	if (usbload != durec.usbload) {
		durec.usbload = usbload;
		oscsend("/durec/usbload", ",i", val >> 8);
	}
	usberrors = val & 0xff;
	if (usberrors != durec.usberrors) {
		durec.usberrors = usberrors;
		oscsend("/durec/usberrors", ",i", val & 0xff);
	}
}

static void
newdurectotalspace(struct context *ctx, int val)
{
	float totalspace;

	totalspace = val / 16.f;
	if (totalspace != durec.totalspace) {
		durec.totalspace = totalspace;
		oscsend("/durec/totalspace", ",f", totalspace);
	}
}

static void
newdurecfreespace(struct context *ctx, int val)
{
	float freespace;

	freespace = val / 16.f;
	if (freespace != durec.freespace) {
		durec.freespace = freespace;
		oscsend("/durec/freespace", ",f", freespace);
	}
}

static void
resizedurecfiles(size_t len)
{
	if (len < 0 || len == durec.fileslen)
		return;
	durec.files = realloc(durec.files, len * sizeof *durec.files);
	if (!durec.files)
		fatal(NULL);  /* XXX: probably shouldn't exit */
	if (len > durec.fileslen)
		memset(durec.files + durec.fileslen, 0, (len - durec.fileslen) * sizeof *durec.files);
	durec.fileslen = len;
	if (durec.index >= durec.fileslen)
		durec.index = -1;
	oscsend("/durec/numfiles", ",i", len);
}

static void
newdurecfileslen(struct context *ctx, int val)
{
	resizedurecfiles(val);
}

static void
setdurecfile(struct context *ctx, struct oscmsg *msg)
{
	int val;

	val = oscgetint(msg);
	if (oscend(msg) != 0)
		return;
	setval(ctx, val | 0x8000);
}

static void
newdurecfile(struct context *ctx, int val)
{
	if (val != durec.file) {
		durec.file = val;
		oscsend(ctx->addr, ",i", val);
	}
}

static void
newdurecnext(struct context *ctx, int val)
{
	static const char *const names[] = {
		"Single", "UFX Single", "Continuous", "Single Next", "Repeat Single", "Repeat All",
	};
	int next, playmode;

	next = ((val & 0xfff) ^ 0x800) - 0x800;
	if (next != durec.next) {
		durec.next = next;
		oscsend("/durec/next", ",i", next);
	}
	playmode = val >> 12;
	if (playmode != durec.playmode) {
		durec.playmode = playmode;
		oscsendenum("/durec/playmode", playmode, names, LEN(names));
	}
}

static void
newdurecrecordtime(struct context *ctx, int val)
{
	unsigned time;

	time = (unsigned)val & 0xFFFF;
	if (time != durec.recordtime) {
		durec.recordtime = time;
		oscsend("/durec/recordtime", ",i", time);
	}
}

static void
newdurecindex(struct context *ctx, int val)
{
	if (val + 1 > durec.fileslen)
		resizedurecfiles(val + 1);
	durec.index = val;
}

static void
newdurecname(struct context *ctx, int val)
{
	struct durecfile *f;
	char *pos, old[2];
	int off;

	if (durec.index == -1)
		return;
	assert(durec.index < durec.fileslen);
	f = &durec.files[durec.index];
	off = (ctx->node->ctl - DUREC_NAME0) * 2;
	assert(off >= 0 && off < sizeof f->name);
	pos = f->name + off;
	memcpy(old, pos, sizeof old);
	putle16(pos, val);
	if (memcmp(old, pos, sizeof old) != 0)
		oscsend("/durec/name", ",is", durec.index, f->name);
}

static void
newdurecinfo(struct context *ctx, int val)
{
	struct durecfile *f;
	unsigned long samplerate;
	int channels;

	if (durec.index == -1)
		return;
	f = &durec.files[durec.index];
	samplerate = getsamplerate(val & 0xFF);
	if (samplerate != f->samplerate) {
		f->samplerate = samplerate;
		oscsend("/durec/samplerate", ",ii", durec.index, samplerate);
	}
	channels = val >> 8;
	if (channels != f->channels) {
		f->channels = channels;
		oscsend("/durec/channels", ",ii", durec.index, channels);
	}
}

static void
newdureclength(struct context *ctx, int val)
{
	struct durecfile *f;

	if (durec.index == -1)
		return;
	f = &durec.files[durec.index];
	if (val != f->length) {
		f->length = val;
		oscsend("/durec/length", ",ii", durec.index, val);
	}
}

static void
setdurecstop(struct context *ctx, struct oscmsg *msg)
{
	if (oscend(msg) != 0)
		return;
	setval(ctx, 0x8120);
}

static void
setdurecplay(struct context *ctx, struct oscmsg *msg)
{
	if (oscend(msg) != 0)
		return;
	setval(ctx, 0x8123);
}

static void
setdurecrecord(struct context *ctx, struct oscmsg *msg)
{
	if (oscend(msg) != 0)
		return;
	setval(ctx, 0x8122);
}

static void
setdurecdelete(struct context *ctx, struct oscmsg *msg)
{
	int val;

	val = oscgetint(msg);
	if (oscend(msg) != 0)
		return;
	setval(ctx, 0x8000 | val);
}

static void
setsetupstore(struct context *ctx, struct oscmsg *msg)
{
	int val;

	val = oscgetint(msg);
	if (oscend(msg) != 0)
		return;
	if (val < 0 || val >= 6)
		return;
	setval(ctx, 0x0910 | val);
}

static void
setsetuparcleds(struct context *ctx, struct oscmsg *msg)
{
	int val = oscgetint(msg);
	if (oscend(msg) != 0) return;

	setval(ctx, val);
}

/* djb2 hash of s, formatted as "Device Name (XXXXXXXX)" into buf. */
static void
uidfromport(const char *port, char *buf, size_t bufsz)
{
	uint32_t h = 5381;
	const unsigned char *p = (const unsigned char *)port;

	while (*p)
		h = h * 33 ^ *p++;
	snprintf(buf, bufsz, "%s (%08X)", device->name, h);
}

static void
setrefresh(struct context *ctx, struct oscmsg *msg)
{
	struct input *pb;
	char addr[256];
	int i;

	dsp.vers = -1;
	dsp.load = -1;
	/* Send device identity first so clients can configure themselves */
	oscsend("/device/id",   ",s", device->id);
	oscsend("/device/name", ",s", device->name);
	oscsend("/device/uid",  ",s", deviceuid);

	oscsend("/device/flags", ",i", device->flags);
	oscsend("/device/inputs", ",i", device->inputslen);
	oscsend("/device/outputs", ",i", device->outputslen);

	/* Send per-channel info so clients can configure their UI */
	for (i = 0; i < device->inputslen; ++i) {
		const struct channelinfo *ch = &device->inputs[i];
		snprintf(addr, sizeof addr, "/input/%d/flags", i + 1);
		oscsend(addr, ",i", ch->flags);
		if (ch->flags & INPUT_HAS_GAIN) {
			snprintf(addr, sizeof addr, "/input/%d/gainrange", i + 1);
			oscsend(addr, ",ii", (int)ch->gain.min, (int)ch->gain.max);
		}
		if (ch->flags & INPUT_HAS_REFLEVEL && ch->reflevel.nameslen > 0) {
			char buf[256];
			size_t off = 0;
			for (size_t j = 0; j < ch->reflevel.nameslen; ++j) {
				if (j > 0 && off < sizeof buf - 1)
					buf[off++] = ',';
				size_t slen = strlen(ch->reflevel.names[j]);
				if (off + slen < sizeof buf) {
					memcpy(buf + off, ch->reflevel.names[j], slen);
					off += slen;
				}
			}
			buf[off] = '\0';
			snprintf(addr, sizeof addr, "/input/%d/reflevels", i + 1);
			oscsend(addr, ",s", buf);
		}
	}
	for (i = 0; i < device->outputslen; ++i) {
		const struct channelinfo *ch = &device->outputs[i];
		snprintf(addr, sizeof addr, "/output/%d/flags", i + 1);
		oscsend(addr, ",i", ch->flags);
		if (ch->flags & OUTPUT_HAS_REFLEVEL && ch->reflevel.nameslen > 0) {
			char buf[256];
			size_t off = 0;
			for (size_t j = 0; j < ch->reflevel.nameslen; ++j) {
				if (j > 0 && off < sizeof buf - 1)
					buf[off++] = ',';
				size_t slen = strlen(ch->reflevel.names[j]);
				if (off + slen < sizeof buf) {
					memcpy(buf + off, ch->reflevel.names[j], slen);
					off += slen;
				}
			}
			buf[off] = '\0';
			snprintf(addr, sizeof addr, "/output/%d/reflevels", i + 1);
			oscsend(addr, ",s", buf);
		}
	}

	setval(ctx, device->refresh);
	/* FIXME: needs lock */
	for (i = 0; i < device->outputslen; ++i) {
		pb = &inputs[device->inputslen + i];
		snprintf(addr, sizeof addr, "/playback/%d/stereo", i + 1);
		oscsend(addr, ",i", pb->stereo);
	}
	oscflush();
}

static const struct node lowcuttree[] = {
	{"freq", LOWCUT_FREQ, .set=setint, .new=newint, .min=20, .max=500},
	{"slope", LOWCUT_SLOPE, .set=setint, .new=newint},
	{0},
};

static const struct node eqtree[] = {
	{"band1freq", EQ_BAND1FREQ, .set=setint, .new=newint, .min=20, .max=20000},
	{"band1gain", EQ_BAND1GAIN, .set=setfixed, .new=newfixed, .scale=0.1, .min=-200, .max=200},
	{"band1q", EQ_BAND1Q, .set=setfixed, .new=newfixed, .scale=0.1, .min=4, .max=99},
	{"band1type", EQ_BAND1TYPE, .set=setenum, .new=newenum, .names=(const char *const[]){
		"Peak", "Low Shelf", "High Pass", "Low Pass",
	}, .nameslen=4},
	{"band2freq", EQ_BAND2FREQ, .set=setint, .new=newint, .min=20, .max=20000},
	{"band2gain", EQ_BAND2GAIN, .set=setfixed, .new=newfixed, .scale=0.1, .min=-200, .max=200},
	{"band2q", EQ_BAND2Q, .set=setfixed, .new=newfixed, .scale=0.1, .min=4, .max=99},
	{"band3freq", EQ_BAND3FREQ, .set=setint, .new=newint, .min=20, .max=20000},
	{"band3gain", EQ_BAND3GAIN, .set=setfixed, .new=newfixed, .scale=0.1, .min=-200, .max=200},
	{"band3q", EQ_BAND3Q, .set=setfixed, .new=newfixed, .scale=0.1, .min=4, .max=99},
	{"band3type", EQ_BAND3TYPE, .set=setenum, .new=newenum, .names=(const char *const[]){
		"Peak", "High Shelf", "Low Pass", "High Pass",
	}, .nameslen=4},
	{0},
};

static const struct node dynamicstree[] = {
	{"gain", DYNAMICS_GAIN, .set=setfixed, .new=newfixed, .scale=0.1, .min=-300, .max=300},
	{"attack", DYNAMICS_ATTACK, .set=setint, .new=newint, .min=0, .max=200},
	{"release", DYNAMICS_RELEASE, .set=setint, .new=newint, .min=100, .max=999},
	{"compthres", DYNAMICS_COMPTHRES, .set=setfixed, .new=newfixed, .scale=0.1, .min=-600, .max=0},
	{"compratio", DYNAMICS_COMPRATIO, .set=setfixed, .new=newfixed, .scale=0.1, .min=10, .max=100},
	{"expthres", DYNAMICS_EXPTHRES, .set=setfixed, .new=newfixed, .scale=0.1, .min=-990, .max=200},
	{"expratio", DYNAMICS_EXPRATIO, .set=setfixed, .new=newfixed, .scale=0.1, .min=10, .max=100},
	{NULL, DYNAMICS_METER, .new=newmeter},
	{0},
};

static const struct node autoleveltree[] = {
	{"maxgain", AUTOLEVEL_MAXGAIN, .set=setfixed, .new=newfixed, .scale=0.1, .min=0, .max=180},
	{"headroom", AUTOLEVEL_HEADROOM, .set=setfixed, .new=newfixed, .scale=0.1, .min=30, .max=120},
	{"risetime", AUTOLEVEL_RISETIME, .set=setfixed, .new=newfixed, .scale=0.1, .min=1, .max=99},
	{NULL, AUTOLEVEL_METER, .new=newmeter},
	{""},
};

static const struct node roomeqtree[] = {
	{"delay", ROOMEQ_DELAY, .set=setfixed, .new=newfixed, .min=0, .max=425, .scale=0.001},
	{"band1type", ROOMEQ_BAND1TYPE, .set=setenum, .new=newenum, .names=(const char *const[]){
		"Peak", "Low Shelf", "High Pass", "Low Pass",
	}, .nameslen=4},
	{"band1gain", ROOMEQ_BAND1GAIN, .set=setfixed, .new=newfixed, .min=-200, .max=200, .scale=0.1},
	{"band1freq", ROOMEQ_BAND1FREQ, .set=setint, .new=newint, .min=20, .max=20000},
	{"band1q", ROOMEQ_BAND1Q, .set=setfixed, .new=newfixed, .min=4, .max=99, .scale=0.1},
	{"band2gain", ROOMEQ_BAND2GAIN, .set=setfixed, .new=newfixed, .min=-200, .max=200, .scale=0.1},
	{"band2freq", ROOMEQ_BAND2FREQ, .set=setint, .new=newint, .min=20, .max=20000},
	{"band2q", ROOMEQ_BAND2Q, .set=setfixed, .new=newfixed, .min=4, .max=99, .scale=0.1},
	{"band3gain", ROOMEQ_BAND3GAIN, .set=setfixed, .new=newfixed, .min=-200, .max=200, .scale=0.1},
	{"band3freq", ROOMEQ_BAND3FREQ, .set=setint, .new=newint, .min=20, .max=20000},
	{"band3q", ROOMEQ_BAND3Q, .set=setfixed, .new=newfixed, .min=4, .max=99, .scale=0.1},
	{"band4gain", ROOMEQ_BAND4GAIN, .set=setfixed, .new=newfixed, .min=-200, .max=200, .scale=0.1},
	{"band4freq", ROOMEQ_BAND4FREQ, .set=setint, .new=newint, .min=20, .max=20000},
	{"band4q", ROOMEQ_BAND4Q, .set=setfixed, .new=newfixed, .min=4, .max=99, .scale=0.1},
	{"band5gain", ROOMEQ_BAND5GAIN, .set=setfixed, .new=newfixed, .min=-200, .max=200, .scale=0.1},
	{"band5freq", ROOMEQ_BAND5FREQ, .set=setint, .new=newint, .min=20, .max=20000},
	{"band5q", ROOMEQ_BAND5Q, .set=setfixed, .new=newfixed, .min=4, .max=99, .scale=0.1},
	{"band6gain", ROOMEQ_BAND6GAIN, .set=setfixed, .new=newfixed, .min=-200, .max=200, .scale=0.1},
	{"band6freq", ROOMEQ_BAND6FREQ, .set=setint, .new=newint, .min=20, .max=20000},
	{"band6q", ROOMEQ_BAND6Q, .set=setfixed, .new=newfixed, .min=4, .max=99, .scale=0.1},
	{"band7gain", ROOMEQ_BAND7GAIN, .set=setfixed, .new=newfixed, .min=-200, .max=200, .scale=0.1},
	{"band7freq", ROOMEQ_BAND7FREQ, .set=setint, .new=newint, .min=20, .max=20000},
	{"band7q", ROOMEQ_BAND7Q, .set=setfixed, .new=newfixed, .min=4, .max=99, .scale=0.1},
	{"band8type", ROOMEQ_BAND8TYPE, .set=setenum, .new=newenum, .names=(const char *const[]){
		"Peak", "High Shelf", "Low Pass", "High Pass",
	}, .nameslen=4},
	{"band8gain", ROOMEQ_BAND8GAIN, .set=setfixed, .new=newfixed, .min=-200, .max=200, .scale=0.1},
	{"band8freq", ROOMEQ_BAND8FREQ, .set=setint, .new=newint, .min=20, .max=20000},
	{"band8q", ROOMEQ_BAND8Q, .set=setfixed, .new=newfixed, .min=4, .max=99, .scale=0.1},
	{"band9type", ROOMEQ_BAND9TYPE, .set=setenum, .new=newenum, .names=(const char *const[]){
		"Peak", "High Shelf", "Low Pass", "High Pass",
	}, .nameslen=4},
	{"band9gain", ROOMEQ_BAND9GAIN, .set=setfixed, .new=newfixed, .min=-200, .max=200, .scale=0.1},
	{"band9freq", ROOMEQ_BAND9FREQ, .set=setint, .new=newint, .min=20, .max=20000},
	{"band9q", ROOMEQ_BAND9Q, .set=setfixed, .new=newfixed, .min=4, .max=99, .scale=0.1},
	{0},
};

static const char *const programkey_names[] = {
	"Default", "Load Setup 1", "Load Setup 2", "Load Setup 3", "Load Setup 4", "Load Setup 5", "Load Setup 6",
	"DIM", "Recall", "Mute Enable", "Main Mono", "Main Mute",
	"Main Out Low Cut", "Main Out EQ", "Main Out Dynamics", "Main Out AutoLevel",
	"Phones 9/10 Mute", "Phones 9/10 Low Cut", "Phones 9/10 EQ", "Phones 9/10 Dynamics", "Phones 9/10 AutoLevel",
	"Phones 11/12 Mute", "Phones 11/12 Low Cut", "Phones 11/12 EQ", "Phones 11/12 Dynamics", "Phones 11/12 AutoLevel",
	"Reverb enable", "Echo enable",
	"Durec Record", "Durec Play/Pause", "Durec Stop", "Durec Previous", "Durec Next",
	"TotalMix",
};
#define PROGRAMKEY_NAMESLEN (sizeof(programkey_names)/sizeof(programkey_names[0]))

static const struct node roottree[] = {
	{"input", .set=setchannel, .new=newchannel, .tree=(const struct node[]){
		{"mute", INPUT_MUTE, .set=setinputmute, .new=newinputmute},
		{"fx", INPUT_FXSEND, .set=setfixed, .new=newfixed, .min=-650, .max=0, .scale=0.1},
		{"stereo", INPUT_STEREO, .set=setinputstereo, .new=newinputstereo},
		{"record", INPUT_RECORD, .set=setbool, .new=newbool},
		{"name", NAME, .set=setname, .new=newname},
		{"playchan", INPUT_PLAYCHAN, .set=setint, .new=newint, .min=1, .max=60},
		{"msproc", INPUT_MSPROC, .set=setbool, .new=newbool},
		{"phase", INPUT_PHASE, .set=setbool, .new=newbool},
		{"gain", INPUT_GAIN, .set=setinputgain, .new=newinputgain},
		{"reflevel", INPUT_REFLEVEL, .set=setint, .new=newinputreflevel},
		{"48v", INPUT_48V, .set=setbool, .new=newbool},
		{"autoset", INPUT_AUTOSET, .set=setbool, .new=newbool},
		{"hi-z", INPUT_HIZ, .set=setbool, .new=newbool},
		{"lowcut", LOWCUT, .set=setbool, .new=newbool, .tree=lowcuttree},
		{"eq", EQ, .set=setbool, .new=newbool, .tree=eqtree},
		{"dynamics", DYNAMICS, .set=setbool, .new=newbool, .tree=dynamicstree},
		{"autolevel", AUTOLEVEL, .set=setbool, .new=newbool, .tree=autoleveltree},
		{0},
	}},
	{"output", .set=setchannel, .new=newchannel, .tree=(const struct node[]){
		{"volume", OUTPUT_VOLUME, .set=setfixed, .new=newfixed, .scale=0.1, .min=-65.0, .max=6.0},
		{"pan", OUTPUT_PAN, .set=setint, .new=newint, .min=-100, .max=100},
		{"mute", OUTPUT_MUTE, .set=setbool, .new=newbool},
		{"fx", OUTPUT_FXRETURN, .set=setfixed, .new=newfixed, .scale=0.1, .min=-65.0, .max=0.0},
		{"stereo", OUTPUT_STEREO, .set=setbool, .new=newoutputstereo},
		{"record", OUTPUT_RECORD, .set=setbool, .new=newbool},
		{"name", NAME, .set=setname, .new=newname},
		{"playchan", OUTPUT_PLAYCHAN, .set=setint, .new=newint},
		{"phase", OUTPUT_PHASE, .set=setbool, .new=newbool},
		{"reflevel", OUTPUT_REFLEVEL, .set=setenum, .new=newenum, .names=(const char *const[]){
			"+4dBu", "+13dBu", "+19dBu", "+24dBu",
		}, .nameslen=4},
		{"crossfeed", OUTPUT_CROSSFEED, .set=setint, .new=newint},
		{"volumecal", OUTPUT_VOLUMECAL, .set=setfixed, .new=newfixed, .min=-2400, .max=300, .scale=0.01},
		{"lowcut", LOWCUT, .set=setbool, .new=newbool, .tree=lowcuttree},
		{"eq", EQ, .set=setbool, .new=newbool, .tree=eqtree},
		{"dynamics", DYNAMICS, .set=setbool, .new=newbool, .tree=dynamicstree},
		{"autolevel", AUTOLEVEL, .set=setbool, .new=newbool, .tree=autoleveltree},
		{"roomeq", ROOMEQ, .set=setbool, .new=newbool, .tree=roomeqtree},
		{"loopback", .new=newbool, .set=setoutputloopback},
		{0},
	}},
	{"playback", .set=setchannel, .tree=(const struct node[]){
		{"mute", .set=setinputmute},
		{"stereo", .set=setinputstereo},
		{0},
	}},
	{"mix", MIX, .set=setmix, .new=newmix},
	{"reverb", REVERB, .set=setbool, .new=newbool, .tree=(const struct node[]){
		{"type", REVERB_TYPE, .set=setenum, .new=newenum, .names=(const char *const[]){
			"Small Room", "Medium Room", "Large Room", "Walls",
			"Shorty", "Attack", "Swagger", "Old School",
			"Echoistic", "8plus9", "Grand Wide", "Thicker",
			"Envelope", "Gated", "Space",
		}, .nameslen=15},
		{"predelay", REVERB_PREDELAY, .set=setint, .new=newint},
		{"lowcut", REVERB_LOWCUT, .set=setint, .new=newint},
		{"roomscale", REVERB_ROOMSCALE, .set=setfixed, .new=newfixed, .scale=0.01},
		{"attack", REVERB_ATTACK, .set=setint, .new=newint},
		{"hold", REVERB_HOLD, .set=setint, .new=newint},
		{"release", REVERB_RELEASE, .set=setint, .new=newint},
		{"highcut", REVERB_HIGHCUT, .set=setint, .new=newint},
		{"time", REVERB_TIME, .set=setfixed, .new=newfixed, .scale=0.1},
		{"highdamp", REVERB_HIGHDAMP, .set=setint, .new=newint},
		{"smooth", REVERB_SMOOTH, .set=setint, .new=newint},
		{"volume", REVERB_VOLUME, .set=setfixed, .new=newfixed, .scale=0.1},
		{"width", REVERB_WIDTH, .set=setfixed, .new=newfixed, .scale=0.01},
		{0},
	}},
	{"echo", ECHO, .set=setbool, .new=newbool, .tree=(const struct node[]){
		{"type", ECHO_TYPE, .set=setenum, .new=newenum, .names=(const char *const[]){
			"Stereo Echo",
			"Stereo Cross",
			"Pong Echo",
		}, .nameslen=3},
		{"delay", ECHO_DELAY, .set=setfixed, .new=newfixed, .scale=0.001, .min=0, .max=2000},
		{"feedback", ECHO_FEEDBACK, .set=setint, .new=newint},
		{"highcut", ECHO_HIGHCUT, .set=setenum, .new=newenum, .names=(const char *const[]){
			"Off", "16kHz", "12kHz", "8kHz", "4kHz", "2kHz",
		}, .nameslen=6},
		{"volume", ECHO_VOLUME, .set=setfixed, .new=newfixed, .scale=0.1, .min=-650, .max=60},
		{"width", ECHO_WIDTH, .set=setfixed, .new=newfixed, .scale=0.01},
		{0},
	}},
	{"controlroom", .tree=(const struct node[]){
		{"mainout", CTLROOM_MAINOUT, .set=setenum, .new=newenum, .names=(const char *const[]){
			"1/2", "3/4", "5/6", "7/8", "9/10",
			"11/12", "13/14", "15/16", "17/18", "19/20",
			"21/22", "23/24", "25/26", "27/28", "29/30",
			"31/32", "33/34", "35/36", "37/38", "39/40",
			"41/42", "43/44", "45/46", "47/48", "49/50",
			"51/52", "53/54", "55/56", "57/58", "59/60",
			"61/62", "63/64", "65/66", "67/68", "69/70",
			"71/72", "73/74", "75/76", "77/78", "79/80",
			"81/82", "83/84", "85/86", "87/88", "89/90",
			"91/92", "93/94",
		}, .nameslen=47},
		{"mainmono", CTLROOM_MAINMONO, .set=setbool, .new=newbool},
		{"muteenable", CTLROOM_MUTEENABLE, .set=setbool, .new=newbool},
		{"dimreduction", CTLROOM_DIMREDUCTION, .set=setfixed, .new=newfixed, .scale=0.1, .min=-650, .max=0},
		{"dim", CTLROOM_DIM, .set=setbool, .new=newdim},
		{"recallvolume", CTLROOM_RECALLVOLUME, .set=setfixed, .new=newfixed, .scale=0.1, .min=-650, .max=0},
		{0},
	}},
	{"clock", .tree=(const struct node[]){
		{"source", CLOCK_SOURCE, .set=setenum, .new=newenum, .names=(const char *const[]){
			"Internal", "Word Clock", "AES", "Opt. 1", "Opt. 2", "MADI Opt.", "MADI Coax.",
		}, .nameslen=7},
		{"samplerate", CLOCK_SAMPLERATE, .new=newsamplerate},
		{"wckout", CLOCK_WCKOUT, .set=setbool, .new=newbool},
		{"wcksingle", CLOCK_WCKSINGLE, .set=setbool, .new=newbool},
		{"wckterm", CLOCK_WCKTERM, .set=setbool, .new=newbool},
		{0},
	}},
	{"setup", .tree=(const struct node[]){
		{"store", SETUP_STORE, .set=setsetupstore, .new=NULL, .names=(const char *const[]){
			"Slot 1", "Slot 2", "Slot 3", "Slot 4", "Slot 5", "Slot 6",
		}, .nameslen=6},
		{"arcleds", SETUP_ARCLEDS, .set=setsetuparcleds, .new=NULL, .names=(const char *const[]){
			"LED 1", "LED 2", "LED 3", "LED 4", "LED 5", "LED 6", "LED 7", "LED 8",
			"LED 9", "LED 10", "LED 11", "LED 12", "LED 13", "LED 14",
			"LED 15",
		}, .nameslen=15},
		{0},
	}},
	{"hardware", .tree=(const struct node[]){
		{"aesin", HARDWARE_AESIN , .set=setenum, .new=newenum, .names=(const char *const[]){
			"XLR", "Opt. 2",
		}, .nameslen=2},
		{"opticalin", HARDWARE_OPTICALIN, .set=setenum, .new=newenum, .names=(const char *const[]){
			"ADAT", "SPDIF",
		}, .nameslen=2},
		{"opticalin2", HARDWARE_OPTICALIN2, .set=setenum, .new=newenum, .names=(const char *const[]){
			"ADAT 2", "SPDIF",
		}, .nameslen=2},
		{"opticalout", HARDWARE_OPTICALOUT, .set=setenum, .new=newenum, .names=(const char *const[]){
			"ADAT", "SPDIF",
		}, .nameslen=2},
		{"opticalout2", HARDWARE_OPTICALOUT2, .set=setenum, .new=newenum, .names=(const char *const[]){
			"ADAT 2", "SPDIF", "AES",
		}, .nameslen=3},
		{"spdifout", HARDWARE_SPDIFOUT, .set=setenum, .new=newenum, .names=(const char *const[]){
			"Consumer", "Professional",
		}, .nameslen=2},
		{"ccmode", HARDWARE_CCMODE, .new=newbool},
		{"ccmix", HARDWARE_CCMIX, .set=setenum, .new=newenum, .names=(const char *const[]){
			"TotalMix App", "6ch + phones", "8ch", "20ch",
		}, .nameslen=4},
		{"interfacemode", HARDWARE_INTERFACEMODE, .set=setenum, .new=newenum, .names=(const char *const[]){
			"Auto", "USB2", "USB3", "CC",
		}, .nameslen=4},
		{"ccrouting", HARDWARE_CCROUTING, .set=setenum, .new=newenum, .names=(const char *const[]){
			"All Ch.", "Phones",
		}, .nameslen=2},
		{"standalonemidi", HARDWARE_STANDALONEMIDI, .set=setenum, .new=newenum, .names=(const char *const[]){
			"Off", "MIDI 1", "MIDI 2", "MADI Opt.", "MADI Coax.",
		}, .nameslen=5},
		{"standalonearc", HARDWARE_STANDALONEARC, .set=setenum, .new=newenum, .names=(const char *const[]){
			"Volume", "1s Op", "Normal",
		}, .nameslen=3},
		{"lockkeys", HARDWARE_LOCKKEYS, .set=setenum, .new=newenum, .names=(const char *const[]){
			"Off", "Keys", "All",
		}, .nameslen=3},
		{"remapkeys", HARDWARE_REMAPKEYS, .set=setbool, .new=newbool},
		{"programkey01", HARDWARE_PROGRAMKEY01, .set=setenum, .new=newenum, .names=programkey_names, .nameslen=PROGRAMKEY_NAMESLEN},
		{"programkey02", HARDWARE_PROGRAMKEY02, .set=setenum, .new=newenum, .names=programkey_names, .nameslen=PROGRAMKEY_NAMESLEN},
		{"programkey03", HARDWARE_PROGRAMKEY03, .set=setenum, .new=newenum, .names=programkey_names, .nameslen=PROGRAMKEY_NAMESLEN},
		{"programkey04", HARDWARE_PROGRAMKEY04, .set=setenum, .new=newenum, .names=programkey_names, .nameslen=PROGRAMKEY_NAMESLEN},
		{"lcdcontrast", HARDWARE_LCDCONTRAST, .set=setint, .new=newint},
		{"madiinput", HARDWARE_MADIINPUT, .set=setenum, .new=newenum, .names=(const char *const[]){
			"Optical", "Coaxial", "Auto", "Split"
		}, .nameslen=4},
		{"madioutput", HARDWARE_MADIOUTPUT, .set=setenum, .new=newenum, .names=(const char *const[]){
			"Optical", "Mirror", "Split"
		}, .nameslen=3},
		{"madiframe", HARDWARE_MADIFRAME, .set=setenum, .new=newenum, .names=(const char *const[]){
			"96K Frame", "48K Frame"
		}, .nameslen=2},
		{"madiformat", HARDWARE_MADIFORMAT, .set=setenum, .new=newenum, .names=(const char *const[]){
			"56 (28) ch", "64 (32 ch)"
		}, .nameslen=2},
		{"eqdrecord", .set=seteqdrecord},
		{NULL, HARDWARE_DSPVERLOAD, .new=newdspload},
		{NULL, HARDWARE_DSPAVAIL, .new=newdspavail},
		{NULL, HARDWARE_DSPSTATUS, .new=newdspstatus},
		{NULL, HARDWARE_ARCDELTA, .new=newarcdelta},
		{NULL, HARDWARE_ARCBUTTONS, .new=newarcbuttons},
		{0},
	}},
	{"durec", .tree=(const struct node[]){
		{"play", .set=setdurecplay},
		{"stop", .set=setdurecstop},
		{"record", .set=setdurecrecord},
		{"delete", .set=setdurecdelete},
		{"file", DUREC_FILE, .set=setdurecfile, .new=newdurecfile},
		{NULL, DUREC_STATUS, .new=newdurecstatus},
		{NULL, DUREC_TIME, .new=newdurectime},
		{NULL, DUREC_USBLOAD, .new=newdurecusbstatus},
		{NULL, DUREC_TOTALSPACE, .new=newdurectotalspace},
		{NULL, DUREC_FREESPACE, .new=newdurecfreespace},
		{NULL, DUREC_NUMFILES, .new=newdurecfileslen},
		{NULL, DUREC_NEXT, .new=newdurecnext},
		{NULL, DUREC_RECORDTIME, .new=newdurecrecordtime},
		{NULL, DUREC_INDEX, .new=newdurecindex},
		{NULL, DUREC_NAME0, .new=newdurecname},
		{NULL, DUREC_NAME1, .new=newdurecname},
		{NULL, DUREC_NAME2, .new=newdurecname},
		{NULL, DUREC_NAME3, .new=newdurecname},
		{NULL, DUREC_INFO, .new=newdurecinfo},
		{NULL, DUREC_LENGTH, .new=newdureclength},
		{0},
	}},

	// {"register", -1, .set=setregs},	// generates stack overflow inside maptree() because node->ctl will be -1
	// correct - michaelforney removed this in https://github.com/michaelforney/oscmix/commit/42372e8decf30ead9e4d0134b3f05c7efa7b2aad
	// I reimplemented this to be able to set regs/vals from webui for debugging/testing purposes.
	// But its not really necessary -> commented out the function in (line 836)

	{"refresh", REFRESH, .set=setrefresh},
	{0},
};

/* maps control number to indices into roottree */
static unsigned char nodeindex[NUMCTLS][4];

int
handleosc(const unsigned char *buf, size_t len)
{
	const struct node *node;
	struct context ctx;
	struct oscmsg msg;
	const char *pattern;
	char *end;

	if (len % 4 != 0)
		return -1;
	msg.err = NULL;
	msg.buf = (unsigned char *)buf;
	msg.end = (unsigned char *)buf + len;
	msg.type = "ss";

	pattern = oscgetstr(&msg);
	msg.type = oscgetstr(&msg);
	if (msg.err) {
		fprintf(stderr, "invalid osc message: %s\n", msg.err);
		return -1;
	}
	if (pattern[0] != '/') {
		fprintf(stderr, "invalid osc address '%s'\n", pattern);
		return -1;
	}
	if (msg.type[0] != ',') {
		fprintf(stderr, "invalid osc types '%s'\n", msg.type);
		return -1;
	}
	++msg.type;

	ctx.pattern = pattern;
	ctx.param.in = ctx.param.out = -1;
	for (node = roottree; ctx.pattern[0] && node && node->name;) {
		if (!oscmatch(ctx.pattern, node->name, &end)) {
			++node;
			continue;
		}
		ctx.pattern = end;
		ctx.node = node;
		if (node->set) {
			ctx.exact = !ctx.pattern[0];
			node->set(&ctx, &msg);
			if (msg.err)
				fprintf(stderr, "%s: %s\n", pattern, msg.err);
		}
		node = node->tree;
	}
	return 0;
}

static unsigned char oscbuf[8192];
static struct oscmsg oscmsg;

static void
oscsend(const char *addr, const char *type, ...)
{
	unsigned char *len;
	va_list ap;

	_Static_assert(sizeof(float) == sizeof(uint32_t), "unsupported float type");
	assert(addr[0] == '/');
	assert(type[0] == ',');

	if (!oscmsg.buf) {
		oscmsg.buf = oscbuf;
		oscmsg.end = oscbuf + sizeof oscbuf;
		oscmsg.type = NULL;
		oscputstr(&oscmsg, "#bundle");
		oscputint(&oscmsg, 0);
		oscputint(&oscmsg, 1);
	} else if (oscmsg.buf + 512 > oscmsg.end) {
		/* Buffer nearly full: flush current bundle and start a new one */
		oscflush();
		oscmsg.buf = oscbuf;
		oscmsg.end = oscbuf + sizeof oscbuf;
		oscmsg.type = NULL;
		oscputstr(&oscmsg, "#bundle");
		oscputint(&oscmsg, 0);
		oscputint(&oscmsg, 1);
	}

	len = oscmsg.buf;
	oscmsg.type = NULL;
	oscputint(&oscmsg, 0);
	oscputstr(&oscmsg, addr);
	oscputstr(&oscmsg, type);
	oscmsg.type = ++type;
	va_start(ap, type);
	for (; *type; ++type) {
		switch (*type) {
			case 'f': oscputfloat(&oscmsg, va_arg(ap, double)); break;
			case 'i': oscputint(&oscmsg, va_arg(ap, int)); break;
			case 's': oscputstr(&oscmsg, va_arg(ap, const char *)); break;
			default: assert(0);
		}
	}
	va_end(ap);
	putbe32(len, oscmsg.buf - len - 4);
}

static void
oscsendenum(const char *addr, int val, const char *const names[], size_t nameslen)
{
	if (val >= 0 && val < nameslen) {
		oscsend(addr, ",is", val, names[val]);
	} else {
		fprintf(stderr, "unexpected enum value %d\n", val);

		oscsend(addr, ",i", val);
	}
}

static void
oscflush(void)
{
	if (oscmsg.buf) {
		writeosc(oscbuf, oscmsg.buf - oscbuf);
		oscmsg.buf = NULL;
	}
}

static void
handleregs(uint_least32_t *payload, size_t len)
{
	size_t i;
	struct context ctx;
	enum control ctl;
	int reg, val;
	const struct node *tree, *node;
	const unsigned char *idx, *end;
	char addr[256];

	ctx.addr = addr;
	ctx.addrend = addr + sizeof addr;
	for (i = 0; i < len; ++i) {
		reg = payload[i] >> 16 & 0x7fff;
		val = (long)((payload[i] & 0xffff) ^ 0x8000) - 0x8000;

		ctx.param.in = ctx.param.out = -1;
		ctx.reg = reg;  /* Store actual register number */
		ctl = device->regtoctl(reg, &ctx.param);
		if (ctl == -1) {
			if (dflag)
				fprintf(stderr, "[%.4X]=%.4X\n", reg, val & 0xFFFFU);
			continue;
		}
		if (ctl == UNKNOWN)
			continue;
		assert(ctl < LEN(nodeindex));
		assert(nodeindex[ctl][0] != 0xFF);

		if (dflag)
			fprintf(stderr, "handleregs verbose %.4X %.4X\n", reg, val);

		ctx.addrpos = addr;
		tree = roottree;
		for (idx = nodeindex[ctl], end = idx + sizeof nodeindex[ctl]; idx != end && *idx != 0xFF; ++idx) {
			node = &tree[*idx];
			if (node->name) {
				*ctx.addrpos++ = '/';
				ctx.addrpos = memccpy(ctx.addrpos, node->name, '\0', ctx.addrend - ctx.addrpos);
				assert(ctx.addrpos);
				--ctx.addrpos;
			}
			ctx.node = node;
			if (node->new) {
				ctx.exact = idx == end || idx[1] == 0xFF;
				node->new(&ctx, val);
			}
			tree = node->tree;
		}
	}
}

static void
handlelevels(int subid, uint_least32_t *payload, size_t len)
{
	uint_least32_t peak, *peakfx;
	uint_least64_t rms, *rmsfx;
	float peakdb, peakfxdb, rmsdb, rmsfxdb;
	const char *type;
	char addr[128];
	size_t i, maxfx;

	if (len % 3 != 0) {
		fprintf(stderr, "unexpected levels data\n");
		return;
	}
	len /= 3;
	type = NULL;
	peakfx = NULL;
	rmsfx = NULL;
	switch (subid) {
		case 4: type = "input";  /* fallthrough */
		case 1: peakfx = inputpeakfx, rmsfx = inputrmsfx; break;
		case 5: type = "output";  /* fallthrough */
		case 3: peakfx = outputpeakfx, rmsfx = outputrmsfx; break;
		case 2: type = "playback"; break;
		default: assert(0);
	}
	/* clamp to allocated buffer size to guard against unexpected packet lengths */
	maxfx = (peakfx == inputpeakfx ? device->inputslen : device->outputslen) + 2;
	if (len > maxfx) {
		fprintf(stderr, "levels packet too large: got %zu, expected <= %zu\n", len, maxfx);
		len = maxfx;
	}
	for (i = 0; i < len; ++i) {
		rms = *payload++;
		rms |= (uint_least64_t)*payload++ << 32;
		peak = *payload++;
		if (type) {
			peakdb = 20 * log10((peak >> 4) / 0x1p23);
			rmsdb = 10 * log10(rms / 0x1p54);
			snprintf(addr, sizeof addr, "/%s/%d/level", type, (int)i + 1);
			if (peakfx) {
				peakfxdb = 20 * log10((peakfx[i] >> 4) / 0x1p23);
				rmsfxdb = 10 * log10(rmsfx[i] / 0x1p54);
				oscsend(addr, ",ffffi", peakdb, rmsdb, peakfxdb, rmsfxdb, (int)(peak & peakfx[i] & 1));
			} else {
				oscsend(addr, ",ffi", peakdb, rmsdb, (int)(peak & 1));
			}
		} else {
			*peakfx++ = peak;
			*rmsfx++ = rms;
		}
	}
}

void
handlesysex(const unsigned char *buf, size_t len, uint_least32_t *payload)
{
	struct sysex sysex;
	int ret;
	size_t i;
	uint_least32_t *pos;

	ret = sysexdec(&sysex, buf, len, SYSEX_MFRID | SYSEX_DEVID | SYSEX_SUBID);
	if (ret != 0 || sysex.mfrid != 0x200d || sysex.devid != 0x10 || sysex.datalen % 5 != 0) {
		if (ret == 0)
			fprintf(stderr, "ignoring unknown sysex packet (mfr=%x devid=%x datalen=%zu)\n", sysex.mfrid, sysex.devid, sysex.datalen);
		else
			fprintf(stderr, "ignoring unknown sysex packet\n");
		return;
	}
	pos = payload;
	for (i = 0; i < sysex.datalen; i += 5)
		*pos++ = getle32_7bit(sysex.data + i);
	switch (sysex.subid) {
		case 0:
			handleregs(payload, pos - payload);
			fflush(stdout);
			fflush(stderr);
			break;
		case 1: case 2: case 3: case 4: case 5:
			handlelevels(sysex.subid, payload, pos - payload);
			break;
		default:
			fprintf(stderr, "ignoring unknown sysex sub ID\n");
	}
	oscflush();
}

void
handletimer(bool levels)
{
	static int serial;
	unsigned char buf[7];

	if (levels) {
		/* XXX: ~60 times per second levels, ~30 times per second serial */
		writesysex(2, NULL, 0, buf);
	}

	setreg(0x3F00, serial);
	serial = (serial + 1) & 0xf;
}

static void
maptree(const struct node *tree, int i)
{
	static unsigned char index[sizeof nodeindex[0]];
	const struct node *node;

	assert(i < sizeof index);
	index[i] = 0;
	for (node = tree; node->set || node->new || node->tree; ++node, ++index[i]) {
		if (node->ctl) {
			memcpy(nodeindex[node->ctl], index, i + 1);
			memset(nodeindex[node->ctl] + i + 1, 0xFF, sizeof index - (i + 1));
		}
		if (node->tree)
			maptree(node->tree, i + 1);
	}
}

int
init(const char *port)
{
	extern const struct device ffucxii;
	extern const struct device ff802;
	extern const struct device ffufxiii;
	extern const struct device ffucx;
	extern const struct device ffufxp;
	extern const struct device ffufxii;
	static const struct device *devices[] = {
		&ffucxii, &ff802, &ffufxiii, &ffucx, &ffufxp, &ffufxii
	};
	int i;
	size_t namelen;

	for (i = 0; i < LEN(devices); ++i) {
		device = devices[i];
		if (strcmp(port, device->id) == 0)
			break;
		namelen = strlen(device->name);
		if (strncmp(port, device->name, namelen) == 0) {
			if (!port[namelen] || (port[namelen] == ' ' && port[namelen + 1] == '('))
				break;
		}
	}
	if (i == LEN(devices)) {
		fprintf(stderr, "Unsupported Device: '%s'\n", port);
		return -1;
	}

	/* Print port and detected device name */
	fprintf(stderr, "Detected Device: %s (ID: %s)\n", device->name, device->id);
	fprintf(stderr, "Using MIDI Port: %s\n", port);

	/* Derive UID from the first parenthesized group in the port name.
	 * Uses only the first '(' / ')' pair to handle formats like:
	 *   "Fireface UCX II (12345678):Fireface UCX II (12345678) Port 2"
	 *   "Fireface UCX II (12345678) 16:1"
	 * Falls back to a deterministic djb2 hash when no serial is present. */
	{
	const char *open  = strchr(port, '(');
	const char *close = open ? strchr(open, ')') : NULL;
	if (open && close) {
		size_t len = (size_t)(close - port) + 1;
		if (len < sizeof deviceuid) {
			memcpy(deviceuid, port, len);
			deviceuid[len] = '\0';
		} else {
			uidfromport(port, deviceuid, sizeof deviceuid);
		}
	} else {
		uidfromport(port, deviceuid, sizeof deviceuid);
	}
	}

	memset(nodeindex, 0xFF, sizeof nodeindex);
	maptree(roottree, 0);

	inputs = calloc(device->inputslen + device->outputslen, sizeof *inputs);
	outputs = calloc(device->outputslen, sizeof *outputs);
	inputpeakfx = calloc(device->inputslen + 2, sizeof *inputpeakfx);
	outputpeakfx = calloc(device->outputslen + 2, sizeof *outputpeakfx);
	inputrmsfx = calloc(device->inputslen + 2, sizeof *inputrmsfx);
	outputrmsfx = calloc(device->outputslen + 2, sizeof *outputrmsfx);
	if (!inputs || !outputs || !inputpeakfx || !outputpeakfx || !inputrmsfx || !outputrmsfx) {
		perror(NULL);
		return -1;
	}
	for (i = 0; i < device->inputslen + device->outputslen; ++i) {
		struct input *in;

		in = &inputs[i];
		in->width = 100;
	}
	for (i = 0; i < device->outputslen; ++i) {
		struct output *out;

		inputs[device->inputslen + i].stereo = true;
		out = &outputs[i];
		out->mix = calloc(device->inputslen + device->outputslen, sizeof *out->mix);
		if (!out->mix) {
			perror(NULL);
			return -1;
		}
	}
	return 0;
}

void
oscmix_getdevinfo(struct oscmix_devinfo *out)
{
	out->id      = device ? device->id : NULL;
	out->uid     = deviceuid;
	out->flags   = device ? device->flags : 0;
	out->inputs  = device ? device->inputslen : 0;
	out->outputs = device ? device->outputslen : 0;
}

void
oscmix_announce_offline(void)
{
	oscsend("/device/id",   ",s", "");
	oscsend("/device/name", ",s", "");
	oscflush();
}
