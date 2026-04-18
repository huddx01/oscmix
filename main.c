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

static void
midiread(int fd)
{
	static unsigned char data[8192], *dataend = data;
	unsigned char *datapos, *nextpos;
	uint_least32_t payload[sizeof data / 4];
	ssize_t ret;

	ret = read(fd, dataend, (data + sizeof data) - dataend);
	if (ret < 0)
		fatal("read %d:", fd);
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
		if (ret < 0)
			fatal("write 7:");
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

	if (fcntl(6, F_GETFD) < 0 || fcntl(7, F_GETFD) < 0) {
		fprintf(stderr, "error: MIDI file descriptors 6 and 7 are not open.\n"
		                "       Use alsarawio, alsaseqio (Linux) or coremidiio (macOS)\n"
		                "       to set up MIDI I/O before invoking oscmix.\n\n");
		usage(1);
	}

	/* Ignore SIGPIPE so that failed writes (e.g. to a multicast socket
	 * with no active listeners) return EPIPE instead of killing the process. */
	signal(SIGPIPE, SIG_IGN);

	/* Parse ports before sockopen() modifies the address strings in-place. */
	uint16_t recvport = sockaddrport(recvaddr);
	uint16_t sendport = sockaddrport(sendaddr);

	rfd = sockopen(recvaddr, 1);
	wfd = sockopen(sendaddr, 0);

	if (!port) {
		port = getenv("MIDIPORT");
		if (!port)
			fatal("device is not specified; pass -p or set MIDIPORT");
	}
	if (init(port) != 0)
		return 1;

#ifdef HAVE_MDNS
	if (zflag) {
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

	pfd[0].fd = 6;
	pfd[0].events = POLLIN;
	pfd[1].fd = rfd;
	pfd[1].events = POLLIN;
	handleosc(refreshosc, sizeof refreshosc - 1);
	for (;;) {
		if (poll(pfd, 2, -1) < 0 && errno != EINTR)
			fatal("poll:");
		if (pfd[0].revents & POLLIN)
			midiread(6);
		if (pfd[1].revents & POLLIN)
			oscread(rfd);
		if (timeout) {
			timeout = 0;
			handletimer(lflag == 0);
		}
	}
}