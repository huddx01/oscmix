#define _POSIX_C_SOURCE 200809L
#include "usbscan.h"

#include <dirent.h>
#include <fcntl.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

struct usb_id {
	uint16_t vid;
	uint16_t pid;
	const char *oscmix_id;
};

/* Known RME vid/pid pairs. Incomplete: only values verified by
 * contributors are listed; others default to the ALSA card-name scan.
 * Extend as real hardware lets us confirm each pair in CC-mode and
 * USB-mode. */
static const struct usb_id known[] = {
	/* Vasco Santos reported this pair for a Fireface UCX via lsusb
	 * in huddx01/oscmix issue #13. */
	{ 0x0424, 0x3fb9, "ffucx" },
};

static int
read_hex4(const char *path, uint16_t *out)
{
	int fd, ret;
	char buf[8];
	unsigned long val;

	fd = open(path, O_RDONLY | O_CLOEXEC);
	if (fd < 0)
		return -1;
	ret = read(fd, buf, sizeof buf - 1);
	close(fd);
	if (ret <= 0)
		return -1;
	buf[ret] = '\0';
	val = strtoul(buf, NULL, 16);
	if (val > 0xffff)
		return -1;
	*out = (uint16_t)val;
	return 0;
}

bool
usbscan_find(const char **out_id)
{
	DIR *dir;
	struct dirent *ent;
	char path[256];
	uint16_t vid, pid;
	size_t i;

	dir = opendir("/sys/bus/usb/devices");
	if (!dir)
		return false;

	while ((ent = readdir(dir)) != NULL) {
		if (ent->d_name[0] == '.')
			continue;
		/* Skip "usbN" root hubs — they never carry a real vid/pid
		 * we care about. Real devices have names like "1-1" or
		 * "1-1.2". */
		if (ent->d_name[0] == 'u' && ent->d_name[1] == 's'
				&& ent->d_name[2] == 'b')
			continue;
		/* Skip interface nodes ("1-1:1.0") — we only want the
		 * per-device directory. */
		if (strchr(ent->d_name, ':'))
			continue;

		snprintf(path, sizeof path, "/sys/bus/usb/devices/%s/idVendor",
				ent->d_name);
		if (read_hex4(path, &vid) != 0)
			continue;
		snprintf(path, sizeof path, "/sys/bus/usb/devices/%s/idProduct",
				ent->d_name);
		if (read_hex4(path, &pid) != 0)
			continue;

		for (i = 0; i < sizeof known / sizeof known[0]; ++i) {
			if (known[i].vid == vid && known[i].pid == pid) {
				if (out_id)
					*out_id = known[i].oscmix_id;
				closedir(dir);
				return true;
			}
		}
	}

	closedir(dir);
	return false;
}
