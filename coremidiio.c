#define _DEFAULT_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <spawn.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <CoreFoundation/CoreFoundation.h>
#include <CoreMIDI/MIDIServices.h>
#include "arg.h"
#include "fatal.h"
#include "spawn.h"

struct context {
	MIDIPortRef port;
	MIDIEndpointRef ep;
	int fd;
};

static void
usage(void)
{
	fprintf(stderr, "usage: coremidiio [-rw] [-f RFD[,WFD]] [-p PORT] COMMAND [ARGS...]\n");
	fprintf(stderr, "       coremidiio -l\n");
	fprintf(stderr, "       coremidiio -n NAME COMMAND [ARGS...]\n\n");
	fprintf(stderr, "CoreMIDI I/O bridge\n\n");
	fprintf(stderr, "Options:\n");
	fprintf(stderr, "  -r             Read from CoreMIDI port (receive MIDI input)\n");
	fprintf(stderr, "  -w             Write to CoreMIDI port (send MIDI output)\n");
	fprintf(stderr, "  -f RFD[,WFD]   File descriptors for MIDI I/O (default: 6,7)\n");
	fprintf(stderr, "                 If only one is given, used for both read and write\n");
	fprintf(stderr, "  -p PORT        CoreMIDI port number (use -l to list)\n");
	fprintf(stderr, "  -n NAME        Create a virtual port with the given name\n");
	fprintf(stderr, "  -l             List available CoreMIDI ports and exit\n\n");
	fprintf(stderr, "Arguments:\n");
	fprintf(stderr, "  COMMAND        Program to execute with MIDI I/O\n");
	fprintf(stderr, "  ARGS           Optional arguments for COMMAND\n\n");
	fprintf(stderr, "Description:\n");
	fprintf(stderr, "  Connects to a CoreMIDI port (or creates a virtual port with -n)\n");
	fprintf(stderr, "  and executes COMMAND with MIDI input/output on the specified\n");
	fprintf(stderr, "  file descriptors (default: fd 6 for read, fd 7 for write).\n");
	fprintf(stderr, "  The MIDIPORT environment variable is set automatically to the port name.\n\n");
	fprintf(stderr, "Examples:\n");
	fprintf(stderr, "  coremidiio -l                                          # List available MIDI ports\n");
	fprintf(stderr, "  coremidiio -p 2 oscmix                                 # Connect to port 2\n");
	fprintf(stderr, "  coremidiio -p 2 oscmix -m -z                           # With multicast and mDNS\n");
	fprintf(stderr, "  coremidiio -n \"Fireface 802 (12345678) Port 2\" oscmix  # Create virtual port\n");
	fprintf(stderr, "  coremidiio -r -p 2 cat > output.mid                    # Record MIDI to file\n");
	fprintf(stderr, "  coremidiio -p 2 ssh usr@mylinux alsaseqio              # Bridge CoreMIDI port to ALSA sequencer port via ssh to Linux host\n\n");
	fprintf(stderr, "File descriptor modes:\n");
	fprintf(stderr, "  -r: Read from port, write MIDI to fd (default: 7)\n");
	fprintf(stderr, "  -w: Read MIDI from fd (default: 6), write to port\n");
	fprintf(stderr, "  -rw (default): Bidirectional MIDI on fds 6 and 7\n");
	exit(1);
}

static void
epname(MIDIObjectRef obj, char *buf, size_t len)
{
	CFStringRef name;
	CFIndex used;
	CFRange range;
	OSStatus err;

	err = MIDIObjectGetStringProperty(obj, kMIDIPropertyDisplayName, &name);
	if (err)
		fatal("MIDIObjectGetStringProperty: %d", err);
	range = CFRangeMake(0, CFStringGetLength(name));
	CFStringGetBytes(name, range, kCFStringEncodingUTF8, 0, false, (uint8_t *)buf, len - 1, &used);
	CFRelease(name);
	buf[used] = '\0';
}

static void
setportenv(MIDIEndpointRef ep)
{
	char name[256];
	epname(ep, name, sizeof name);
	setenv("MIDIPORT", name, 1);
}

static void
listports(void)
{
	ItemCount i, n;
	MIDIEndpointRef ep;
	char name[256];

	printf("Sources:\n");
	n = MIDIGetNumberOfSources();
	for (i = 0; i < n; ++i) {
		ep = MIDIGetSource(i);
		epname(ep, name, sizeof name);
		printf("%d\t%s\n", (int)i, name);
	}

	printf("\nDestinations:\n");
	n = MIDIGetNumberOfDestinations();
	for (i = 0; i < n; ++i) {
		ep = MIDIGetDestination(i);
		epname(ep, name, sizeof name);
		printf("%d\t%s\n", (int)i, name);
	}
}

static void
midiread(const MIDIPacketList *list, void *info, void *src)
{
	struct context *ctx;
	UInt32 i;
	UInt16 len;
	ssize_t ret;
	const MIDIPacket *p;
	const Byte *pos;

	ctx = info;
	p = &list->packet[0];
	for (i = 0; i < list->numPackets; ++i) {
		len = p->length;
		pos = p->data;
		while (len > 0) {
			ret = write(ctx->fd, pos, len);
			if (ret < 0)
				fatal("write:");
			pos += ret;
			len -= ret;
		}
		p = MIDIPacketNext(p);
	}
}

static OSStatus
midiwrite(struct context *ctx, MIDIPacketList *list)
{
	if (ctx->port)
		return MIDISend(ctx->port, ctx->ep, list);
	return MIDIReceived(ctx->ep, list);
}

static MIDIPacket *
addpacket(struct context *ctx, MIDIPacketList *list, size_t listlen, MIDIPacket *p, const unsigned char *data, size_t datalen)
{
	int err;

	p = MIDIPacketListAdd(list, listlen, p, 0, datalen, data);
	if (p)
		return p;
	err = midiwrite(ctx, list);
	if (err)
		fatal("MIDISend: %d", err);
	p = MIDIPacketListInit(list);
	p = MIDIPacketListAdd(list, listlen, p, 0, datalen, data);
	if (!p)
		fatal("MIDIPacketListAdd failed");
	return p;
}

static void
handleinput(CFFileDescriptorRef file, CFOptionFlags flags, void *info)
{
	static unsigned char data[2], *datapos, *dataend;
	struct context *ctx;
	ssize_t ret;
	MIDIPacket *p;
	int b, err;
	const unsigned char *pos, *end, *tmp;
	unsigned char buf[1024];
	union {
		MIDIPacketList list;
		unsigned char data[2048];
	} u;

	ctx = info;
	ret = read(ctx->fd, buf, sizeof buf);
	if (ret < 0)
		fatal("read");
	if (ret == 0) {
		CFRunLoopStop(CFRunLoopGetMain());
		return;
	}
	CFFileDescriptorEnableCallBacks(file, kCFFileDescriptorReadCallBack);
	p = MIDIPacketListInit(&u.list);
	pos = buf;
	end = buf + ret;
	if (data[0] == 0xF0) {
	sysex:
		tmp = pos;
		while (++pos != end) {
			if (*pos & 0x80) {
				if (*pos == 0xF7) {
					data[0] = 0;
					++pos;
				}
				break;
			}
		}
		p = addpacket(ctx, &u.list, sizeof u, p, tmp, pos - tmp);
	}
	for (; pos != end; ++pos) {
		b = *pos & 0xFF;
		if (b & 0x80) {
			datapos = data;
			switch (b >> 4 & 7) {
			case 4: case 5:
				dataend = datapos + 2;
				break;
			case 0: case 1: case 2: case 3: case 6:
				dataend = datapos + 3;
				break;
			case 7:
				if (b >= 0xF8) {
					dataend = datapos + 1;
					break;
				}
				switch (b & 7) {
				case 0: dataend = NULL; break;
				case 6:
				case 7: dataend = datapos + 1; break;
				case 1:
				case 3: dataend = datapos + 2; break;
				case 2: dataend = datapos + 3; break;
				case 4:
				case 5: continue;  /* invalid status byte */
				}
				break;
			}
		} else if (!data[0]) {
			continue;  /* invalid (no status byte) */
		} else if (datapos == dataend)  {
			/* running status */
			datapos = data + 1;
		}
		*datapos++ = b;
		if (b == 0xF0)
			goto sysex;
		if (datapos == dataend)
			p = addpacket(ctx, &u.list, sizeof u, p, data, dataend - data);
	}
	if (u.list.numPackets > 0) {
		err = midiwrite(ctx, &u.list);
		if (err)
			fatal("MIDISend: %d", err);
	}
}

static void
initreader(struct context *ctx, MIDIClientRef client, CFStringRef name, int index, int fd)
{
	int err;

	ctx->fd = fd;
	if (index != -1) {
		ctx->ep = MIDIGetSource(index);
		if (!ctx->ep)
			fatal("MIDIGetSource %d failed", index);
		err = MIDIInputPortCreate(client, name, midiread, ctx, &ctx->port);
		if (err)
			fatal("MIDIInputPortCreate: %d", err);
		err = MIDIPortConnectSource(ctx->port, ctx->ep, NULL);
		if (err)
			fatal("MIDIPortConnectSource: %d", err);
	} else {
		ctx->port = 0;
		err = MIDIDestinationCreate(client, name, midiread, ctx, &ctx->ep);
		if (err)
			fatal("MIDIDestinationCreate: %d", err);
	}
}

static void
initwriter(struct context *ctx, MIDIClientRef client, CFStringRef name, int index, int fd)
{
	CFFileDescriptorRef file;
	CFFileDescriptorContext filectx;
	CFRunLoopSourceRef source;
	int err;

	ctx->fd = fd;
	if (index != -1) {
		ctx->ep = MIDIGetDestination(index);
		if (!ctx->ep)
			fatal("MIDIGetDestination %d failed", index);
		err = MIDIOutputPortCreate(client, name, &ctx->port);
		if (err)
			fatal("MIDIOutputPortCreate: %d", err);
	} else {
		ctx->port = 0;
		err = MIDISourceCreate(client, name, &ctx->ep);
		if (err)
			fatal("MIDISourceCreate: %d", err);
	}
	memset(&filectx, 0, sizeof filectx);
	filectx.info = ctx;
	file = CFFileDescriptorCreate(NULL, ctx->fd, false, handleinput, &filectx);
	if (!file)
		fatal("CFFileDescriptorCreate %d failed", 0);
	CFFileDescriptorEnableCallBacks(file, kCFFileDescriptorReadCallBack);
	source = CFFileDescriptorCreateRunLoopSource(NULL, file, 0);
	if (!source)
		fatal("CFFileDescriptorCreateRunLoopSource failed");
	CFRunLoopAddSource(CFRunLoopGetMain(), source, kCFRunLoopDefaultMode);
}

static void
notify(const struct MIDINotification *n, void *info)
{
	struct context *ctx;
	MIDIObjectRef obj;

	ctx = info;
	if (n->messageID == kMIDIMsgObjectRemoved) {
		obj = ((MIDIObjectAddRemoveNotification *)n)->child;
		if (obj == ctx[0].ep || obj == ctx[1].ep)
			CFRunLoopStop(CFRunLoopGetMain());
	}
}

static int
safefd(int fd, int min)
{
	int nfd;

	if (fd >= min)
		return fd;
	nfd = fcntl(fd, F_DUPFD, min);
	if (nfd < 0)
		fatal("fcntl F_DUPFD:");
	close(fd);
	return nfd;
}

static void
parseintpair(const char *arg, int num[static 2])
{
	char *end;
	long n;

	num[0] = -1;
	if (*arg != ',') {
		n = strtol(arg, &end, 10);
		if (end == arg || n < 0 || n > INT_MAX)
			usage();
		num[0] = (int)n;
		if (!*end) {
			num[1] = num[0];
			return;
		}
		if (*end != ',')
			usage();
		arg = end + 1;
	}
	num[1] = -1;
	if (*arg) {
		n = strtol(arg, &end, 10);
		if (end == arg || *end || n < 0 || n > INT_MAX)
			usage();
		num[1] = (int)n;
	}
}

int
main(int argc, char *argv[])
{
	MIDIClientRef client;
	OSStatus err;
	int port[2], fd[2];
	const char *vepname;
	CFStringRef name;
	int mode;
	struct context ctx[2];

	port[0] = -1;
	port[1] = -1;
	fd[0] = 0;
	fd[1] = 1;
	vepname = NULL;
	name = CFSTR("coremidiio");
	mode = 0;
	memset(ctx, 0, sizeof ctx);
	ARGBEGIN {
	case 'l':
		listports();
		return 0;
	case 'r':
		mode |= READ;
		break;
	case 'w':
		mode |= WRITE;
		break;
	case 'n':
		vepname = EARGF(usage());
		name = CFStringCreateWithCStringNoCopy(NULL, vepname, kCFStringEncodingUTF8, kCFAllocatorNull);
		if (!name)
			fatal("CFStringCreateWithCStringNoCopy failed");
		break;
	case 'p':
		parseintpair(EARGF(usage()), port);
		break;
	case 'f':
		parseintpair(EARGF(usage()), fd);
		break;
	default:
		usage();
	} ARGEND

	if (mode == 0)
		mode = READ | WRITE;

	/* set MIDIPORT env var */
	if (port[0] != -1 || port[1] != -1) {
		int index = (mode & READ) ? port[0] : port[1];
		if (index != -1) {
			MIDIEndpointRef ep;
			ep = (mode & READ) ? MIDIGetSource(index) : MIDIGetDestination(index);
			if (ep)
				setportenv(ep);
		}
	} else if (vepname) {
		setenv("MIDIPORT", vepname, 1);
	}

	if (argc) {
		extern char **environ;
		posix_spawn_file_actions_t actions;
		posix_spawnattr_t attr;
		pid_t pid;
		int rp[2], wp[2], serr, minfd;

		/* ensure pipe fds don't collide with target fds */
		minfd = (fd[0] > fd[1] ? fd[0] : fd[1]) + 1;
		posix_spawn_file_actions_init(&actions);
		posix_spawnattr_init(&attr);
		posix_spawnattr_setflags(&attr, POSIX_SPAWN_CLOEXEC_DEFAULT);
		posix_spawn_file_actions_addinherit_np(&actions, STDIN_FILENO);
		posix_spawn_file_actions_addinherit_np(&actions, STDOUT_FILENO);
		posix_spawn_file_actions_addinherit_np(&actions, STDERR_FILENO);
		if (mode & READ) {
			if (pipe(rp) != 0)
				fatal("pipe:");
			rp[0] = safefd(rp[0], minfd);
			rp[1] = safefd(rp[1], minfd);
			posix_spawn_file_actions_adddup2(&actions, rp[0], fd[0]);
		}
		if (mode & WRITE) {
			if (pipe(wp) != 0)
				fatal("pipe:");
			wp[0] = safefd(wp[0], minfd);
			wp[1] = safefd(wp[1], minfd);
			posix_spawn_file_actions_adddup2(&actions, wp[1], fd[1]);
		}
		serr = posix_spawnp(&pid, argv[0], &actions, &attr, argv, environ);
		posix_spawnattr_destroy(&attr);
		posix_spawn_file_actions_destroy(&actions);
		if (serr) {
			errno = serr;
			fatal("exec %s:", argv[0]);
		}
		if (mode & READ) {
			close(rp[0]);
			fd[1] = rp[1];
		}
		if (mode & WRITE) {
			close(wp[1]);
			fd[0] = wp[0];
		}
	}

	err = MIDIClientCreate(name, notify, ctx, &client);
	if (err)
		fatal("MIDIClientCreate: %d", err);
	if (mode & READ)
		initreader(&ctx[0], client, name, port[0], fd[1]);
	if (mode & WRITE)
		initwriter(&ctx[1], client, name, port[1], fd[0]);
	CFRunLoopRun();
}
