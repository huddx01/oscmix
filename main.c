#define _XOPEN_SOURCE 700  /* needed for SA_RESTART on FreeBSD */
#include <assert.h>
#include <errno.h>
#include <signal.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <fcntl.h>
#include <poll.h>
#include <sys/time.h>
#include <unistd.h>
#ifdef __linux__
#include <sys/ioctl.h>
#include <sound/asound.h>
#include "usbscan.h"
#endif
#include "oscmix.h"
#include "arg.h"
#include "socket.h"
#include "util.h"

#ifdef HAVE_MDNS
#include "mdns.h"
#endif

extern int dflag;
static int lflag;
static int rfd, wfd;
static volatile sig_atomic_t timeout;

/* When true, oscmix itself owns the midi fds (opened by openmidi());
 * on disconnect we close and re-open instead of bailing out. When false,
 * the fds were inherited from a wrapper (alsarawio / alsaseqio / coremidiio)
 * and we preserve the original fatal-on-error semantics. */
static bool self_opened_midi;

#ifdef __linux__
/* Device name prefixes matched against snd_ctl_card_info.name.
 * Order matters: longer prefixes must come before their shorter cousins
 * because we use strncmp (e.g. "Fireface UCX II" before "Fireface UCX"). */
static const char *const midi_devices[] = {
	"Fireface UCX II",
	"Fireface UFX III",
	"Fireface UFX II",
	"Fireface UFX+",
	"Fireface 802",
	"Fireface UCX",
	NULL,
};
static char midiport[80];

static int
openmidi(void)
{
	int card, ctlfd, midifd, ver, i;
	char path[64];
	struct snd_ctl_card_info cardinfo;
	struct snd_rawmidi_info info;
	struct snd_rawmidi_params params;

	for (card = 0; card <= 31; ++card) {
		snprintf(path, sizeof path, "/dev/snd/controlC%d", card);
		ctlfd = open(path, O_RDONLY | O_CLOEXEC);
		if (ctlfd < 0)
			continue;
		if (ioctl(ctlfd, SNDRV_CTL_IOCTL_CARD_INFO, &cardinfo) != 0) {
			close(ctlfd);
			continue;
		}
		for (i = 0; midi_devices[i]; ++i) {
			if (strncmp((char *)cardinfo.name, midi_devices[i], strlen(midi_devices[i])) != 0)
				continue;
			if (ioctl(ctlfd, SNDRV_CTL_IOCTL_RAWMIDI_PREFER_SUBDEVICE, &(int){1}) != 0) {
				perror("ioctl SNDRV_CTL_IOCTL_RAWMIDI_PREFER_SUBDEVICE");
				close(ctlfd);
				return -1;
			}
			snprintf(path, sizeof path, "/dev/snd/midiC%dD0", card);
			midifd = open(path, O_RDWR | O_CLOEXEC);
			close(ctlfd);
			if (midifd < 0) {
				fprintf(stderr, "open %s: %s\n", path, strerror(errno));
				return -1;
			}
			if (ioctl(midifd, (int)SNDRV_RAWMIDI_IOCTL_PVERSION, &ver) != 0) {
				perror("ioctl SNDRV_RAWMIDI_IOCTL_PVERSION");
				close(midifd);
				return -1;
			}
			if (SNDRV_PROTOCOL_INCOMPATIBLE(ver, SNDRV_RAWMIDI_VERSION)) {
				fprintf(stderr, "incompatible rawmidi version\n");
				close(midifd);
				return -1;
			}
			memset(&info, 0, sizeof info);
			info.stream = SNDRV_RAWMIDI_STREAM_INPUT;
			if (ioctl(midifd, (int)SNDRV_RAWMIDI_IOCTL_INFO, &info) != 0) {
				perror("ioctl SNDRV_RAWMIDI_IOCTL_INFO");
				close(midifd);
				return -1;
			}
			if (info.subdevice != 1) {
				fprintf(stderr, "could not open subdevice 1\n");
				close(midifd);
				return -1;
			}
			snprintf(midiport, sizeof midiport, "%s", (char *)info.subname);

			memset(&params, 0, sizeof params);
			params.stream = SNDRV_RAWMIDI_STREAM_INPUT;
			params.buffer_size = 8192;
			params.avail_min = 1;
			params.no_active_sensing = 1;
			if (ioctl(midifd, (int)SNDRV_RAWMIDI_IOCTL_PARAMS, &params) != 0) {
				perror("ioctl SNDRV_RAWMIDI_IOCTL_PARAMS");
				close(midifd);
				return -1;
			}
			params.stream = SNDRV_RAWMIDI_STREAM_OUTPUT;
			if (ioctl(midifd, (int)SNDRV_RAWMIDI_IOCTL_PARAMS, &params) != 0) {
				perror("ioctl SNDRV_RAWMIDI_IOCTL_PARAMS");
				close(midifd);
				return -1;
			}
			if (dup2(midifd, 6) < 0 || dup2(midifd, 7) < 0) {
				perror("dup2");
				close(midifd);
				return -1;
			}
			close(midifd);
			return 0;
		}
		close(ctlfd);
	}
	return -1;
}

static void
close_midi(void)
{
	/* Close fds 6 and 7 and leave them unallocated. poll() with fd=-1
	 * simply ignores the entry, so the scan loop can run without a
	 * midi fd until openmidi() succeeds again. */
	close(6);
	close(7);
}

#endif /* __linux__ */

static void
usage(int status)
{
	fprintf(stderr, "usage: oscmix [-dhlmz] [-p port] [-r addr] [-s addr]\n");
	fprintf(stderr, "  -d        enable debug output\n");
	fprintf(stderr, "  -h        show this help\n");
	fprintf(stderr, "  -l        disable level metering\n");
	fprintf(stderr, "  -m [port] send to multicast address (udp!224.0.0.1!port, default port: 8222)\n");
	fprintf(stderr, "  -p port   MIDI port (default: $MIDIPORT)\n");
	fprintf(stderr, "  -r addr   OSC receive address (default: udp!127.0.0.1!7222)\n");
	fprintf(stderr, "  -s addr   OSC send address (default: udp!127.0.0.1!8222)\n");
	fprintf(stderr, "  -z        register OSC service via mDNS/DNS-SD\n");
	fprintf(stderr, "\nexamples (Linux):\n");
	fprintf(stderr, "  alsarawio 0,0,3 oscmix\n");
	fprintf(stderr, "  alsaseqio 16:0 oscmix\n");
	fprintf(stderr, "  alsaseqio 16:0 oscmix -r udp!0.0.0.0!7222 -s udp!192.168.1.100!8222\n");
	fprintf(stderr, "  alsaseqio 16:0 oscmix -m 8233 -z\n");
	fprintf(stderr, "\nexamples (macOS):\n");
	fprintf(stderr, "  coremidiio -f 6,7 -p 2 oscmix\n");
	fprintf(stderr, "  coremidiio -f 6,7 -p 2 oscmix -m -z\n");
	fprintf(stderr, "  MIDIPORT='Fireface 802 (12345678) Port 2' coremidiio -f 6,7 oscmix -m -z\n");
	exit(status);
}

/* Returns 0 on success (including partial read), -1 if the midi device
 * went away (EIO / ENODEV / EBADF / ENXIO / unexpected EOF). Other errors
 * still call fatal() to preserve the previous behavior for truly
 * unexpected failures. */
static int
midiread(int fd)
{
	static unsigned char data[8192], *dataend = data;
	unsigned char *datapos, *nextpos;
	uint_least32_t payload[sizeof data / 4];
	ssize_t ret;

	ret = read(fd, dataend, (data + sizeof data) - dataend);
	if (ret < 0) {
		if (self_opened_midi && (errno == EIO || errno == ENODEV
				|| errno == EBADF || errno == ENXIO))
			return -1;
		fatal("read %d:", fd);
	}
	if (ret == 0) {
		/* Driver signaled EOF: only treat as disconnect when we own
		 * the fd ourselves. Wrapper-inherited mode keeps the old
		 * behavior of falling through (which would be a no-op read). */
		if (self_opened_midi) {
			dataend = data;
			return -1;
		}
		dataend = data;
		return 0;
	}
	dataend += ret;
	datapos = data;
	for (;;) {
		assert(datapos <= dataend);
		datapos = memchr(datapos, 0xf0, dataend - datapos);
		if (!datapos) {
			dataend = data;
			break;
		}
		nextpos = memchr(datapos + 1, 0xf7, dataend - datapos - 1);
		if (!nextpos) {
			if (dataend == data + sizeof data) {
				fprintf(stderr, "sysex packet too large; dropping\n");
				dataend = data;
			} else {
				memmove(data, datapos, dataend - datapos);
				dataend -= datapos - data;
			}
			break;
		}
		++nextpos;
		handlesysex(datapos, nextpos - datapos, payload);
		datapos = nextpos;
	}
	return 0;
}

static void
oscread(int fd)
{
	unsigned char buf[8192];
	ssize_t ret;

	ret = read(fd, buf, sizeof buf);
	if (ret < 0) {
		perror("recv");
		return;
	}
	handleosc(buf, ret);
}

void
writemidi(const void *buf, size_t len)
{
	const unsigned char *pos;
	ssize_t ret;

	pos = buf;
	while (len > 0) {
		ret = write(7, pos, len);
		if (ret < 0) {
			if (self_opened_midi && (errno == EIO || errno == ENODEV
					|| errno == EBADF || errno == ENXIO || errno == EPIPE)) {
				/* Device went away while we were writing. The read
				 * side will see the same error next poll cycle and
				 * transition to scanning state; drop the packet. */
				return;
			}
			fatal("write 7:");
		}
		pos += ret;
		len -= ret;
	}
}

void
writeosc(const void *buf, size_t len)
{
	ssize_t ret;

	ret = write(wfd, buf, len);
	if (ret < 0) {
		if (errno != ECONNREFUSED)
			perror("write");
	} else if (ret != len) {
		fprintf(stderr, "write: %zd != %zu", ret, len);
	}
}

static void
sighandler(int sig)
{
	timeout = 1;
}

int
main(int argc, char *argv[])
{
	static char defrecvaddr[] = "udp!127.0.0.1!7222";
	static char defsendaddr[] = "udp!127.0.0.1!8222";
	static char mcastaddr[]   = "udp!224.0.0.1!8222";
	static const unsigned char refreshosc[] = "/refresh\0\0\0\0,\0\0\0";
	char mcastbuf[48];
	char *recvaddr, *sendaddr;
	struct itimerval it;
	struct sigaction sa;
	struct pollfd pfd[2];
	const char *port;
	int mflag = 0, zflag = 0;

	recvaddr = defrecvaddr;
	sendaddr = defsendaddr;
	port = NULL;

	ARGBEGIN {
	case 'd':
		dflag = 1;
		break;
	case 'h':
		usage(0);
		break;
	case 'l':
		lflag = 1;
		break;
	case 'm': {
		/* Optional port: -m 8233 or -m8233 (default: 8222).
		 * Next arg is consumed only if it looks like a port number. */
		const char *mport = NULL;
		if (*(opt_ + 1)) {
			mport = opt_ + 1;
			done_ = 1;
		} else if (argc > 1 && argv[1][0] >= '0' && argv[1][0] <= '9') {
			mport = *++argv;
			--argc;
		}
		snprintf(mcastbuf, sizeof mcastbuf, "udp!224.0.0.1!%.10s",
			mport ? mport : "8222");
		sendaddr = mcastbuf;
		mflag = 1;
		break;
	}
	case 'r':
		recvaddr = EARGF(usage(1));
		break;
	case 's':
		sendaddr = EARGF(usage(1));
		break;
	case 'p':
		port = EARGF(usage(1));
		break;
	case 'z':
		zflag = 1;
		break;
	default:
		usage(1);
		break;
	} ARGEND

	/* Detect multicast send address even when set via -s instead of -m.
	 * Multicast range: 224.0.0.0/4 (first octet 224-239).
	 * Address format: "udp!<addr>!<port>" - IP starts after first '!'. */
	if (!mflag) {
		const char *first = strchr(sendaddr, '!');
		if (first) {
			int octet = atoi(first + 1);
			if (octet >= 224 && octet <= 239)
				mflag = 1;
		}
	}

	bool have_midi = (fcntl(6, F_GETFD) >= 0 && fcntl(7, F_GETFD) >= 0);

	if (!have_midi) {
#ifdef __linux__
		/* No wrapper present: scan /dev/snd/controlC* ourselves for
		 * a supported RME card. If nothing is connected yet we still
		 * proceed — the poll loop below will keep retrying and the
		 * daemon stays alive, announcing an offline state to
		 * frontends until a device shows up. */
		self_opened_midi = true;
		if (openmidi() == 0) {
			have_midi = true;
			if (!port)
				port = midiport;
		} else {
			fprintf(stderr, "oscmix: no supported RME device found; "
					"waiting for a device to be connected...\n");
		}
#else
		fprintf(stderr, "error: MIDI file descriptors 6 and 7 are not open.\n"
		                "       Use alsarawio, alsaseqio (Linux) or coremidiio (macOS)\n"
		                "       to set up MIDI I/O before invoking oscmix.\n\n");
		usage(1);
#endif
	}

	/* Ignore SIGPIPE so that failed writes (e.g. to a multicast socket
	 * with no active listeners) return EPIPE instead of killing the process. */
	signal(SIGPIPE, SIG_IGN);

	/* Parse ports before sockopen() modifies the address strings in-place. */
	uint16_t recvport = sockaddrport(recvaddr);
	uint16_t sendport = sockaddrport(sendaddr);

	rfd = sockopen(recvaddr, 1);
	wfd = sockopen(sendaddr, 0);

	bool initialized = false;
	if (have_midi) {
		if (!port) {
			port = getenv("MIDIPORT");
			if (!port)
				fatal("device is not specified; pass -p or set MIDIPORT");
		}
		if (init(port) != 0)
			return 1;
		initialized = true;
	}

#ifdef HAVE_MDNS
	if (zflag && have_midi) {
		struct oscmix_devinfo dev;
		char svc_name[320];
		char txt_id[80], txt_uid[320], txt_flags[32];
		char txt_inputs[32], txt_outputs[32];
		char txt_recvport[32], txt_sendport[32], txt_mcast[16];

		oscmix_getdevinfo(&dev);

		/* Service instance name: "oscmix @ <uid>" */
		snprintf(svc_name,    sizeof svc_name,    "oscmix @ %s",   dev.uid ? dev.uid : "unknown");
		snprintf(txt_id,      sizeof txt_id,      "id=%s",          dev.id  ? dev.id  : "");
		snprintf(txt_uid,     sizeof txt_uid,     "uid=%s",         dev.uid ? dev.uid : "");
		snprintf(txt_flags,   sizeof txt_flags,   "flags=%d",       dev.flags);
		snprintf(txt_inputs,  sizeof txt_inputs,  "inputs=%d",      dev.inputs);
		snprintf(txt_outputs, sizeof txt_outputs, "outputs=%d",     dev.outputs);
		snprintf(txt_recvport,sizeof txt_recvport,"recvport=%u",    recvport);
		snprintf(txt_sendport,sizeof txt_sendport,"sendport=%u",    sendport);
		snprintf(txt_mcast,   sizeof txt_mcast,   "mcast=%d",       mflag);

		const char *txt[] = {
			"txtvers=1",
			"version=1.1",
			"uri=oscmix",
			"types=ifs",
			txt_id,
			txt_uid,
			txt_flags,
			txt_inputs,
			txt_outputs,
			txt_recvport,
			txt_sendport,
			txt_mcast,
			NULL
		};

		mdns_register(svc_name, recvport, txt);
	}
#endif /* HAVE_MDNS */

	memset(&sa, 0, sizeof sa);
	sa.sa_handler = sighandler;
	sa.sa_flags = SA_RESTART;
	if (sigaction(SIGALRM, &sa, NULL) != 0)
		fatal("sigaction:");
	it.it_interval.tv_sec = 0;
	it.it_interval.tv_usec = 100000;
	it.it_value = it.it_interval;
	if (setitimer(ITIMER_REAL, &it, NULL) != 0)
		fatal("setitimer:");

	pfd[0].events = POLLIN;
	pfd[1].fd = rfd;
	pfd[1].events = POLLIN;

	bool online = have_midi;
	if (online) {
		pfd[0].fd = 6;
		handleosc(refreshosc, sizeof refreshosc - 1);
	} else {
		pfd[0].fd = -1;   /* ignored by poll() */
		oscmix_announce_offline();
	}

	/* 100ms timer ticks; every 10 ticks (= 1s) we try openmidi() again
	 * while offline, and re-announce the offline state so frontends
	 * that connected after we went offline catch the signal. */
	int scan_tick = 0;

	for (;;) {
		if (poll(pfd, 2, -1) < 0 && errno != EINTR)
			fatal("poll:");

		if (online && (pfd[0].revents & POLLIN)) {
			if (midiread(6) < 0) {
				/* Device went away. Transition to scanning state:
				 * close the midi fds, tell frontends, and have the
				 * poll loop stop reading midi until openmidi()
				 * succeeds again. */
				fprintf(stderr, "oscmix: midi device disconnected; "
						"entering scanning state\n");
#ifdef __linux__
				close_midi();
#endif
				pfd[0].fd = -1;
				online = false;
				oscmix_announce_offline();
				scan_tick = 0;
			}
		}

		if (pfd[1].revents & POLLIN) {
			if (online) {
				oscread(rfd);
			} else {
				/* Drain any incoming OSC while offline and
				 * re-announce; a frontend that sends /refresh
				 * gets a prompt offline acknowledgement. */
				unsigned char buf[8192];
				ssize_t ret = read(rfd, buf, sizeof buf);
				(void)ret;
				oscmix_announce_offline();
			}
		}

		if (timeout) {
			timeout = 0;
			if (online) {
				handletimer(lflag == 0);
			} else if (++scan_tick >= 10) {
				scan_tick = 0;
				oscmix_announce_offline();
#ifdef __linux__
				if (self_opened_midi && openmidi() != 0) {
					/* ALSA scan came up empty. Probe sysfs
					 * for a plugged-in RME device; a positive
					 * hit without an ALSA card means the
					 * kernel driver hasn't bound yet, so
					 * log and keep retrying instead of
					 * treating the absence as fatal. */
					const char *usb_id = NULL;
					if (usbscan_find(&usb_id)) {
						static bool logged_race;
						if (!logged_race) {
							fprintf(stderr, "oscmix: detected "
								"RME device (%s) via USB but "
								"ALSA card not ready yet; "
								"waiting...\n", usb_id);
							logged_race = true;
						}
					}
				} else if (self_opened_midi) {
					/* First-time startup also lands here
					 * if the device was offline when oscmix
					 * launched; init() hasn't run yet in
					 * that case. */
					if (!initialized) {
						const char *p = port ? port : midiport;
						if (init(p) != 0) {
							fprintf(stderr, "oscmix: init "
								"failed for '%s'; will keep "
								"scanning\n", p);
							close_midi();
							pfd[0].fd = -1;
							continue;
						}
						initialized = true;
					}
					fprintf(stderr, "oscmix: midi device "
						"(re)connected\n");
					pfd[0].fd = 6;
					online = true;
					handleosc(refreshosc,
						sizeof refreshosc - 1);
				}
#endif
			}
		}
	}
}