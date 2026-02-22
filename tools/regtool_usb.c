#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <unistd.h>
#include <signal.h>
#include <pthread.h>
#include <libusb.h>
#include <time.h>

// Change here, if needed, to match your device's VID, PID, and endpoints
#define VENDOR_ID   0x2a39    // RME
#define PRODUCT_ID  0x3f83    // UFX3 in USB 3 mode
#define DEFAULT_INTERFACE 1   // Use interface 1!
#define EP_OUT      0x05      // Bulk OUT Endpoint 5 (Interface 1)
#define EP_IN       0x8A      // Bulk IN Endpoint 10 (0x80 | 10 = 0x8A)
#define TIMEOUT_MS  5000
#define HEARTBEAT_ADDR 0x3dff // Heartbeat register address
#define DUMP_CMD_ADDR  0x3E04 // Dump register address
#define DUMP_CMD_VAL   0x67CD // Dump register value
// No further changes should be needed below this line for basic functionality

// Global variables
static int current_interface = DEFAULT_INTERFACE;
static volatile int heartbeat_active = 0;
static volatile int monitor_active = 0;
static pthread_t heartbeat_thread;
static pthread_t monitor_thread;
static libusb_device_handle* global_handle = NULL;

// Function prototypes
int write_heartbeat(libusb_device_handle* handle);
void* heartbeat_thread_func(void* arg);
void* monitor_thread_func(void* arg);
void signal_handler(int sig);

libusb_device_handle* open_device() {
	libusb_device_handle* handle = NULL;

	int rc = libusb_init(NULL);
	if (rc < 0) {
		fprintf(stderr, "libusb_init failed: %s\n", libusb_error_name(rc));
		return NULL;
	}

	// Enable debugging for more information
	libusb_set_option(NULL, LIBUSB_OPTION_LOG_LEVEL, LIBUSB_LOG_LEVEL_WARNING);

	handle = libusb_open_device_with_vid_pid(NULL, VENDOR_ID, PRODUCT_ID);
	if (!handle) {
		fprintf(stderr, "Device 0x%04x:0x%04x not found\n", VENDOR_ID, PRODUCT_ID);
		libusb_exit(NULL);
		return NULL;
	}

	printf("Device opened successfully\n");

	// Try default interface first
	current_interface = DEFAULT_INTERFACE;

	// Detach kernel driver if active for current interface
	if (libusb_kernel_driver_active(handle, current_interface) == 1) {
		printf("Detaching kernel driver for interface %d...\n", current_interface);
		libusb_detach_kernel_driver(handle, current_interface);
	}

	// IMPORTANT: Claim the interface
	rc = libusb_claim_interface(handle, current_interface);
	if (rc < 0) {
		fprintf(stderr, "Cannot claim interface %d: %s\n", current_interface, libusb_error_name(rc));

		// Try interface 0 as fallback
		printf("Trying interface 0 as fallback...\n");
		current_interface = 0;

		if (libusb_kernel_driver_active(handle, current_interface) == 1) {
			libusb_detach_kernel_driver(handle, current_interface);
		}

		rc = libusb_claim_interface(handle, current_interface);
		if (rc < 0) {
			fprintf(stderr, "Cannot claim interface %d either: %s\n", current_interface, libusb_error_name(rc));
			libusb_close(handle);
			libusb_exit(NULL);
			return NULL;
		}
	}

	printf("Interface %d claimed successfully\n", current_interface);

	// Set alternate setting 0 for the interface
	rc = libusb_set_interface_alt_setting(handle, current_interface, 0);
	if (rc < 0 && rc != LIBUSB_ERROR_NOT_FOUND) {
		fprintf(stderr, "Warning: Cannot set alternate setting: %s\n", libusb_error_name(rc));
	}

	// Signal handler for clean exit
	signal(SIGINT, signal_handler);
	signal(SIGTERM, signal_handler);

	return handle;
}

void close_device(libusb_device_handle* handle) {
	if (handle) {
		// Stop heartbeat if active
		if (heartbeat_active) {
			heartbeat_active = 0;
			pthread_join(heartbeat_thread, NULL);
			printf("Heartbeat stopped\n");
		}

		// Stop monitor if active
		if (monitor_active) {
			monitor_active = 0;
			pthread_join(monitor_thread, NULL);
			printf("Monitor stopped\n");
		}

		libusb_release_interface(handle, current_interface);
		libusb_close(handle);
		libusb_exit(NULL);
	}
}

// Signal handler for clean exit
void signal_handler(int sig) {
	printf("\nSignal %d received, cleaning up...\n", sig);
	monitor_active = 0;
	heartbeat_active = 0;
	sleep(1); // Give some time for cleanup
}

// Write heartbeat to 0x3dff (cycle 0x0000-0x000f)
int write_heartbeat(libusb_device_handle* handle) {
	static uint32_t cycle_value = 0;
	uint32_t data[2] = {HEARTBEAT_ADDR, cycle_value & 0x0000000f};
	int transferred = 0;

	// Debug output only on changes or every 20 cycles
	static int debug_counter = 0;
	if (debug_counter++ % 20 == 0) {
		printf("Heartbeat to 0x%08X: 0x%08X (cycle %u)\n",
			   HEARTBEAT_ADDR, cycle_value & 0x0000000f, debug_counter);
	}

	int rc = libusb_bulk_transfer(
								  handle,
								  EP_OUT,
								  (unsigned char*)data,
								  sizeof(data),
								  &transferred,
								  1000  // Short timeout for heartbeat
								  );

	if (rc == 0 && transferred == sizeof(data)) {
		// Increment cycle value (0-15)
		cycle_value = (cycle_value + 1) & 0x0000000f;
		return 0;
	} else {
		fprintf(stderr, "Heartbeat write failed: %s (transferred: %d)\n",
				libusb_error_name(rc), transferred);
		return -1;
	}
}

// Heartbeat thread function (5 times per second = every 200ms)
void* heartbeat_thread_func(void* arg) {
	libusb_device_handle* handle = (libusb_device_handle*)arg;

	printf("Heartbeat thread started (5 Hz)\n");

	while (heartbeat_active) {
		write_heartbeat(handle);
		usleep(200000); // 200ms = 5 Hz
	}

	printf("Heartbeat thread stopped\n");
	return NULL;
}

// Monitor thread function (continuously reads from EP 0x8A)
void* monitor_thread_func(void* arg) {
	libusb_device_handle* handle = (libusb_device_handle*)arg;

	printf("Monitor thread started - listening for register updates...\n");
	printf("Format: [timestamp] REG(0xXXXX) = 0xYYYY\n");
	printf("----------------------------------------\n");

	uint32_t buffer[256];
	int packet_count = 0;

	while (monitor_active) {
		int transferred = 0;

		// Read data with short timeout
		int rc = libusb_bulk_transfer(
									  handle,
									  EP_IN,
									  (unsigned char*)buffer,
									  sizeof(buffer),
									  &transferred,
									  100  // Short timeout for responsive exit
									  );

		if (rc == 0 && transferred > 0) {
			int words = transferred / sizeof(uint32_t);

			// Timestamp for this message
			time_t now = time(NULL);
			struct tm* tm_info = localtime(&now);
			char timestamp[20];
			strftime(timestamp, sizeof(timestamp), "%H:%M:%S", tm_info);

			if (words % 2 == 0) {
				// Register-value pairs
				for (int i = 0; i < words; i += 2) {
					printf("[%s] REG(0x%04X) = 0x%04X\n",
						   timestamp,
						   buffer[i] & 0xFFFF,
						   buffer[i+1] & 0xFFFF);

					// Alternative full 32-bit display
					if (buffer[i] > 0xFFFF || buffer[i+1] > 0xFFFF) {
						printf("      Full 32-bit: 0x%08X = 0x%08X\n",
							   buffer[i], buffer[i+1]);
					}
				}
			} else {
				// Incomplete data or different format
				printf("[%s] RAW data (%d words): ", timestamp, words);
				for (int i = 0; i < words; i++) {
					printf("0x%08X ", buffer[i]);
				}
				printf("\n");
			}

			packet_count++;
		} else if (rc == LIBUSB_ERROR_TIMEOUT) {
			// Timeout is normal, just continue
			continue;
		} else if (rc == LIBUSB_ERROR_INTERRUPTED) {
			// Interrupted, probably exiting
			break;
		} else {
			if (monitor_active) { // Only show if not exiting
				fprintf(stderr, "Monitor read error: %s\n", libusb_error_name(rc));
			}
			usleep(100000); // 100ms pause on error
		}
	}

	printf("Monitor thread stopped. Received %d packets.\n", packet_count);
	return NULL;
}

// Start heartbeat thread
int start_heartbeat(libusb_device_handle* handle) {
	if (heartbeat_active) {
		printf("Heartbeat already active\n");
		return 0;
	}

	heartbeat_active = 1;

	int rc = pthread_create(&heartbeat_thread, NULL, heartbeat_thread_func, handle);
	if (rc != 0) {
		fprintf(stderr, "Failed to create heartbeat thread: %d\n", rc);
		heartbeat_active = 0;
		return -1;
	}

	printf("Heartbeat thread created successfully (5Hz)\n");
	return 0;
}

// Stop heartbeat thread
int stop_heartbeat() {
	if (!heartbeat_active) {
		printf("Heartbeat not active\n");
		return 0;
	}

	heartbeat_active = 0;
	pthread_join(heartbeat_thread, NULL);
	printf("Heartbeat stopped\n");
	return 0;
}

// Start monitor thread
int start_monitor(libusb_device_handle* handle) {
	if (monitor_active) {
		printf("Monitor already active\n");
		return 0;
	}

	monitor_active = 1;

	int rc = pthread_create(&monitor_thread, NULL, monitor_thread_func, handle);
	if (rc != 0) {
		fprintf(stderr, "Failed to create monitor thread: %d\n", rc);
		monitor_active = 0;
		return -1;
	}

	printf("Monitor thread created successfully\n");
	printf("Press Ctrl+C to stop monitoring\n");
	return 0;
}

// Stop monitor thread
int stop_monitor() {
	if (!monitor_active) {
		printf("Monitor not active\n");
		return 0;
	}

	monitor_active = 0;
	pthread_join(monitor_thread, NULL);
	printf("Monitor stopped\n");
	return 0;
}

// Send dump register command (0x3E04 = 0x67CD)
int send_dump_command(libusb_device_handle* handle) {
	printf("Sending dump command: REG(0x%04X) = 0x%04X\n", DUMP_CMD_ADDR, DUMP_CMD_VAL);

	// Optional: heartbeat before writing if no thread running
	if (!heartbeat_active) {
		write_heartbeat(handle);
	}

	uint32_t data[2] = {DUMP_CMD_ADDR, DUMP_CMD_VAL};
	int transferred = 0;

	int rc = libusb_bulk_transfer(
								  handle,
								  EP_OUT,
								  (unsigned char*)data,
								  sizeof(data),
								  &transferred,
								  TIMEOUT_MS
								  );

	if (rc == 0 && transferred == sizeof(data)) {
		printf("✓ Dump command sent successfully\n");
		printf("   The device should now send register data to EP 0x%02X\n", EP_IN);
		return 0;
	} else {
		fprintf(stderr, "✗ Dump command failed: %s (transferred: %d/8 bytes)\n",
				libusb_error_name(rc), transferred);
		return -1;
	}
}

int write_register(libusb_device_handle* handle, uint32_t address, uint32_t value) {
	uint32_t data[2] = {address, value};
	int transferred = 0;

	printf("Writing to EP 0x%02X: addr=0x%08X, value=0x%08X\n", EP_OUT, address, value);

	// Optional: heartbeat before writing if no thread running
	if (!heartbeat_active) {
		write_heartbeat(handle);
	}

	int rc = libusb_bulk_transfer(
								  handle,
								  EP_OUT,
								  (unsigned char*)data,
								  sizeof(data),
								  &transferred,
								  TIMEOUT_MS
								  );

	if (rc == 0 && transferred == sizeof(data)) {
		printf("✓ Register 0x%08X written with value 0x%08X\n", address, value);
		return 0;
	} else {
		fprintf(stderr, "✗ Write failed: %s (transferred: %d/8 bytes)\n",
				libusb_error_name(rc), transferred);
		return -1;
	}
}

int read_register(libusb_device_handle* handle, uint32_t address) {
	uint32_t write_data = address;
	uint32_t read_data = 0;
	int transferred = 0;

	printf("Reading from register 0x%08X\n", address);

	// Optional: heartbeat before reading if no thread running
	if (!heartbeat_active) {
		write_heartbeat(handle);
	}

	// Send register address
	int rc = libusb_bulk_transfer(
								  handle,
								  EP_OUT,
								  (unsigned char*)&write_data,
								  sizeof(write_data),
								  &transferred,
								  TIMEOUT_MS
								  );

	if (rc != 0 || transferred != sizeof(write_data)) {
		fprintf(stderr, "✗ Address write failed: %s (transferred: %d/4 bytes)\n",
				libusb_error_name(rc), transferred);
		return -1;
	}

	// Read value from device
	rc = libusb_bulk_transfer(
							  handle,
							  EP_IN,
							  (unsigned char*)&read_data,
							  sizeof(read_data),
							  &transferred,
							  TIMEOUT_MS
							  );

	if (rc == 0 && transferred == sizeof(read_data)) {
		printf("✓ Register 0x%08X: 0x%08X (%u decimal)\n", address, read_data, read_data);
		return 0;
	} else {
		fprintf(stderr, "✗ Read failed: %s (transferred: %d/4 bytes)\n",
				libusb_error_name(rc), transferred);
		return -1;
	}
}

int bulk_write(libusb_device_handle* handle, uint32_t* data, int word_count) {
	int transferred = 0;

	printf("Bulk write %d words to EP 0x%02X\n", word_count, EP_OUT);

	// Optional: heartbeat before writing if no thread running
	if (!heartbeat_active) {
		write_heartbeat(handle);
	}

	int rc = libusb_bulk_transfer(
								  handle,
								  EP_OUT,
								  (unsigned char*)data,
								  word_count * sizeof(uint32_t),
								  &transferred,
								  TIMEOUT_MS
								  );

	if (rc == 0) {
		printf("✓ %zu words written (%d bytes)\n",
			   transferred / sizeof(uint32_t), transferred);
		return 0;
	} else {
		fprintf(stderr, "✗ Bulk write failed: %s (transferred: %d bytes)\n",
				libusb_error_name(rc), transferred);
		return -1;
	}
}

int bulk_read(libusb_device_handle* handle, uint32_t* buffer, int max_words) {
	int transferred = 0;

	printf("Bulk read up to %d words from EP 0x%02X\n", max_words, EP_IN);

	// Optional: heartbeat before reading if no thread running
	if (!heartbeat_active) {
		write_heartbeat(handle);
	}

	// Send a read command first (if needed)
	uint32_t cmd = 0x00000001; // Example: Read command
	int rc = libusb_bulk_transfer(
								  handle,
								  EP_OUT,
								  (unsigned char*)&cmd,
								  sizeof(cmd),
								  &transferred,
								  1000
								  );

	if (rc != 0) {
		printf("Note: Read command not required or failed: %s\n", libusb_error_name(rc));
		// Try reading anyway
	}

	// Read data
	rc = libusb_bulk_transfer(
							  handle,
							  EP_IN,
							  (unsigned char*)buffer,
							  max_words * sizeof(uint32_t),
							  &transferred,
							  TIMEOUT_MS
							  );

	if (rc == 0) {
		size_t words_read = transferred / sizeof(uint32_t);
		printf("✓ %zu words read (%d bytes):\n", words_read, transferred);
		for (size_t i = 0; i < words_read; i++) {
			printf("  [%02zu]: 0x%08X (%u)\n", i, buffer[i], buffer[i]);
		}
		return (int)words_read;
	} else if (rc == LIBUSB_ERROR_TIMEOUT) {
		printf("⚠ Timeout - no data available\n");
		return 0;
	} else {
		fprintf(stderr, "✗ Bulk read failed: %s (transferred: %d bytes)\n",
				libusb_error_name(rc), transferred);
		return -1;
	}
}

void print_usage(const char* prog_name) {
	printf("USB Register Tool for VID:PID 0x%04x:0x%04x\n", VENDOR_ID, PRODUCT_ID);
	printf("Default Interface: %d, Endpoints: OUT=0x%02X, IN=0x%02X\n\n", DEFAULT_INTERFACE, EP_OUT, EP_IN);
	printf("Special registers:\n");
	printf("  Heartbeat: 0x%04X (cycles 0x0000-0x000f at 5Hz)\n", HEARTBEAT_ADDR);
	printf("  Dump command: 0x%04X = 0x%04X\n\n", DUMP_CMD_ADDR, DUMP_CMD_VAL);
	printf("Usage:\n");
	printf("  %s write <addr_hex> <value_hex>   - Write register\n", prog_name);
	printf("  %s read <addr_hex>                - Read register\n", prog_name);
	printf("  %s bulkwrite <word1> <word2> ...  - Write multiple words\n", prog_name);
	printf("  %s bulkread <count>               - Read words (with command)\n", prog_name);
	printf("  %s test                           - Test endpoints\n", prog_name);
	printf("  %s reset                          - Send USB reset\n", prog_name);
	printf("  %s iface <interface_num>          - Change interface (0-3)\n", prog_name);
	printf("  %s heartbeat start                - Start heartbeat thread (5Hz)\n", prog_name);
	printf("  %s heartbeat stop                 - Stop heartbeat thread\n", prog_name);
	printf("  %s heartbeat once                 - Send single heartbeat\n", prog_name);
	printf("  %s monitor start                  - Start monitoring register updates\n", prog_name);
	printf("  %s monitor stop                   - Stop monitoring\n", prog_name);
	printf("  %s dump                           - Send dump registers command\n", prog_name);
	printf("  %s auto                           - Auto mode: heartbeat + monitor\n", prog_name);
	printf("\nExamples for testing:\n");
	printf("  Terminal 1: %s auto\n", prog_name);
	printf("  Terminal 2: %s write 0x3E04 0x67CD\n", prog_name);
	printf("  Terminal 2: %s write 0x1000 0x1234\n", prog_name);
}

int test_endpoints(libusb_device_handle* handle) {
	unsigned char buffer[64];
	int transferred;

	printf("=== Testing endpoints on Interface %d ===\n", current_interface);

	// Heartbeat before test if no thread running
	if (!heartbeat_active) {
		write_heartbeat(handle);
	}

	printf("1. Testing EP 0x%02X (OUT) with simple write...\n", EP_OUT);
	uint32_t test_data = 0xDEADBEEF;
	int rc = libusb_bulk_transfer(
								  handle,
								  EP_OUT,
								  (unsigned char*)&test_data,
								  sizeof(test_data),
								  &transferred,
								  1000
								  );
	printf("   Result: %s (transferred: %d)\n", libusb_error_name(rc), transferred);

	printf("\n2. Testing EP 0x%02X (IN) with read...\n", EP_IN);
	rc = libusb_bulk_transfer(
							  handle,
							  EP_IN,
							  buffer,
							  sizeof(buffer),
							  &transferred,
							  1000
							  );
	printf("   Result: %s (transferred: %d)\n", libusb_error_name(rc), transferred);

	if (transferred > 0) {
		printf("   Data received (hex): ");
		for (int i = 0; i < transferred; i++) {
			printf("%02X ", buffer[i]);
			if ((i + 1) % 16 == 0) printf("\n                   ");
		}
		printf("\n");

		// Try to interpret as 32-bit words
		if (transferred % 4 == 0) {
			printf("   As 32-bit words:\n");
			uint32_t* words = (uint32_t*)buffer;
			for (int i = 0; i < transferred/4; i++) {
				printf("     [%d]: 0x%08X\n", i, words[i]);
			}
		}
	}

	return 0;
}

int send_reset(libusb_device_handle* handle) {
	printf("Sending USB reset to device...\n");
	int rc = libusb_reset_device(handle);
	if (rc == 0) {
		printf("✓ Reset successful\n");
	} else {
		fprintf(stderr, "✗ Reset failed: %s\n", libusb_error_name(rc));
	}
	return rc;
}

int change_interface(libusb_device_handle* handle, int new_interface) {
	if (new_interface < 0 || new_interface > 3) {
		fprintf(stderr, "Interface must be between 0 and 3\n");
		return -1;
	}

	printf("Changing from interface %d to interface %d...\n", current_interface, new_interface);

	// First release old interface
	libusb_release_interface(handle, current_interface);

	// Claim new interface
	current_interface = new_interface;

	if (libusb_kernel_driver_active(handle, current_interface) == 1) {
		printf("Detaching kernel driver for interface %d...\n", current_interface);
		libusb_detach_kernel_driver(handle, current_interface);
	}

	int rc = libusb_claim_interface(handle, current_interface);
	if (rc < 0) {
		fprintf(stderr, "Cannot claim interface %d: %s\n", current_interface, libusb_error_name(rc));
		return -1;
	}

	printf("✓ Successfully switched to interface %d\n", current_interface);
	return 0;
}

// Auto mode: Start heartbeat and monitor together
int start_auto_mode(libusb_device_handle* handle) {
	printf("Starting auto mode: heartbeat + monitor\n");
	printf("----------------------------------------\n");

	// Start heartbeat
	if (!heartbeat_active) {
		if (start_heartbeat(handle) != 0) {
			fprintf(stderr, "Failed to start heartbeat\n");
			return -1;
		}
	}

	// Short pause for initialization
	sleep(1);

	// Start monitor
	if (!monitor_active) {
		if (start_monitor(handle) != 0) {
			fprintf(stderr, "Failed to start monitor\n");
			return -1;
		}
	}

	printf("\nAuto mode running. Press Ctrl+C in this terminal to stop.\n");
	printf("In another terminal, try:\n");
	printf("  sudo %s write 0x3E04 0x67CD  # Send dump command\n", "usb_regtool");
	printf("  sudo %s write 0x1000 0x1234  # Test register write\n", "usb_regtool");
	printf("\n");

	// Wait until Ctrl+C is pressed
	while (heartbeat_active || monitor_active) {
		sleep(1);
	}

	return 0;
}

int main(int argc, char** argv) {
	if (argc < 2) {
		print_usage(argv[0]);
		return 1;
	}

	libusb_device_handle* handle = open_device();
	if (!handle) {
		return 1;
	}

	int result = 0;

	if (strcmp(argv[1], "write") == 0 && argc == 4) {
		uint32_t addr = strtoul(argv[2], NULL, 0);
		uint32_t value = strtoul(argv[3], NULL, 0);
		result = write_register(handle, addr, value);
	}
	else if (strcmp(argv[1], "read") == 0 && argc == 3) {
		uint32_t addr = strtoul(argv[2], NULL, 0);
		result = read_register(handle, addr);
	}
	else if (strcmp(argv[1], "bulkwrite") == 0 && argc > 2) {
		uint32_t* data = malloc((argc - 2) * sizeof(uint32_t));
		for (int i = 0; i < argc - 2; i++) {
			data[i] = strtoul(argv[i + 2], NULL, 0);
		}
		result = bulk_write(handle, data, argc - 2);
		free(data);
	}
	else if (strcmp(argv[1], "bulkread") == 0 && argc == 3) {
		int count = atoi(argv[2]);
		if (count <= 0 || count > 100) {
			fprintf(stderr, "Count must be between 1 and 100\n");
			result = 1;
		} else {
			uint32_t* buffer = malloc(count * sizeof(uint32_t));
			result = bulk_read(handle, buffer, count);
			free(buffer);
		}
	}
	else if (strcmp(argv[1], "test") == 0) {
		result = test_endpoints(handle);
	}
	else if (strcmp(argv[1], "reset") == 0) {
		result = send_reset(handle);
	}
	else if (strcmp(argv[1], "iface") == 0 && argc == 3) {
		int new_iface = atoi(argv[2]);
		result = change_interface(handle, new_iface);
	}
	else if (strcmp(argv[1], "heartbeat") == 0 && argc == 3) {
		if (strcmp(argv[2], "start") == 0) {
			result = start_heartbeat(handle);
			if (result == 0) {
				printf("Heartbeat started. Press Ctrl+C to stop.\n");
				// Wait until Ctrl+C is pressed
				while (heartbeat_active) {
					sleep(1);
				}
			}
		}
		else if (strcmp(argv[2], "stop") == 0) {
			result = stop_heartbeat();
		}
		else if (strcmp(argv[2], "once") == 0) {
			result = write_heartbeat(handle);
		}
		else {
			fprintf(stderr, "Unknown heartbeat command: %s\n", argv[2]);
			fprintf(stderr, "Use: start, stop, or once\n");
			result = 1;
		}
	}
	else if (strcmp(argv[1], "monitor") == 0 && argc == 3) {
		if (strcmp(argv[2], "start") == 0) {
			result = start_monitor(handle);
			if (result == 0) {
				// Wait until monitor is stopped
				while (monitor_active) {
					sleep(1);
				}
			}
		}
		else if (strcmp(argv[2], "stop") == 0) {
			result = stop_monitor();
		}
		else {
			fprintf(stderr, "Unknown monitor command: %s\n", argv[2]);
			fprintf(stderr, "Use: start or stop\n");
			result = 1;
		}
	}
	else if (strcmp(argv[1], "dump") == 0) {
		result = send_dump_command(handle);
	}
	else if (strcmp(argv[1], "auto") == 0) {
		result = start_auto_mode(handle);
	}
	else {
		print_usage(argv[0]);
		result = 1;
	}

	close_device(handle);
	return result;
}
