.POSIX:

-include ../config.mk

WASM_CC?=clang --target=wasm32-unknown-wasi
WASM_CFLAGS?=-O2 -Wall -Wpedantic
WASM_LDFLAGS?=-mexec-model=reactor

CC=$(WASM_CC)
CFLAGS=$(WASM_CFLAGS)
LDFLAGS=$(WASM_LDFLAGS)

.PHONY: all
all: oscmix.wasm

OBJ=oscmix.o osc.o sysex.o util.o wasm.o device_ff802.o device_ffucx.o device_ffucxii.o device_ffufx.o device_ffufxii.o device_ffufxiii.o device_ffufxp.o

oscmix.o: ../oscmix.c
	$(CC) $(CFLAGS) -c -o $@ ../oscmix.c

osc.o: ../osc.c
	$(CC) $(CFLAGS) -c -o $@ ../osc.c

sysex.o: ../sysex.c
	$(CC) $(CFLAGS) -c -o $@ ../sysex.c

util.o: ../util.c
	$(CC) $(CFLAGS) -c -o $@ ../util.c

device_ff802.o: ../device_ff802.c
	$(CC) $(CFLAGS) -c -o $@ ../device_ff802.c

device_ffucx.o: ../device_ffucx.c
	$(CC) $(CFLAGS) -c -o $@ ../device_ffucx.c

device_ffucxii.o: ../device_ffucxii.c
	$(CC) $(CFLAGS) -c -o $@ ../device_ffucxii.c

device_ffufx.o: ../device_ffufx.c
	$(CC) $(CFLAGS) -c -o $@ ../device_ffufx.c

device_ffufxii.o: ../device_ffufxii.c
	$(CC) $(CFLAGS) -c -o $@ ../device_ffufxii.c

device_ffufxiii.o: ../device_ffufxiii.c
	$(CC) $(CFLAGS) -c -o $@ ../device_ffufxiii.c

device_ffufxp.o: ../device_ffufxp.c
	$(CC) $(CFLAGS) -c -o $@ ../device_ffufxp.c

oscmix.wasm: $(OBJ) oscmix.imports
	$(CC) $(LDFLAGS) -o $@ -Wl,--export=init,--export=handletimer,--export=handlesysex,--export=handleosc,--export=jsdata,--export=jsdatalen -Wl,--allow-undefined-file=oscmix.imports $(OBJ)

.PHONY: clean
clean:
	rm -f oscmix.wasm $(OBJ)
