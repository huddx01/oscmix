#ifndef OSCMIX_H
#define OSCMIX_H

int init(const char *port);

void handlesysex(const unsigned char *buf, size_t len, uint32_t *payload);
int handleosc(const unsigned char *buf, size_t len);
void handletimer(bool levels);

extern void writemidi(const void *buf, size_t len);
extern void writeosc(const void *buf, size_t len);

/* Device info available after a successful init() call.
 * Used by main() to populate mDNS/DNS-SD TXT records. */
struct oscmix_devinfo {
	const char *id;      /* short device ID, e.g. "ffucxii" */
	const char *uid;     /* device name + serial, e.g. "Fireface UCX II (12345678)" */
	int         flags;   /* device capability bitmask (see device.h) */
	int         inputs;  /* number of input channels */
	int         outputs; /* number of output channels */
};

void oscmix_getdevinfo(struct oscmix_devinfo *out);

#endif
