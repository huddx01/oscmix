#ifndef OSCMIX_USBSCAN_H
#define OSCMIX_USBSCAN_H

#include <stdbool.h>

/* Diagnostic USB scan: walks /sys/bus/usb/devices/*\/{idVendor,idProduct}
 * and reports whether a supported RME device is plugged in, even if the
 * ALSA midi subsystem has not yet claimed it. The primary detection path
 * remains the ALSA card scan in main.c:openmidi() — this is only a hint
 * used to distinguish "no hardware" from "driver race" during the
 * reconnect loop.
 *
 * Returns true and writes the matched oscmix device id (e.g. "ffucx")
 * to *out_id when a known vid/pid pair is present in sysfs. Returns
 * false otherwise. The pointer returned in *out_id has static lifetime.
 */
bool usbscan_find(const char **out_id);

#endif
