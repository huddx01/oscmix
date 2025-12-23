.POSIX:

CC=cc -std=c11
PREFIX=/usr/local
BINDIR=$(PREFIX)/bin
MANDIR=$(PREFIX)/share/man

-include config.mk

OS!=uname
OS?=$(shell uname)
OS-$(OS)=y

ARCH!=uname -m
ARCH?=$(shell uname -m)

ALSA?=$(OS-Linux)
ALSA_CFLAGS?=$$(pkg-config --cflags alsa)
ALSA_LDFLAGS?=$$(pkg-config --libs-only-L --libs-only-other alsa)
ALSA_LDLIBS?=$$(pkg-config --libs-only-l alsa)

COREMIDI?=$(OS-Darwin)
COREMIDI_LDLIBS?=-framework CoreMIDI -framework CoreFoundation

REGTOOL_GENERIC_LIBS-$(OS-Linux)=$(ALSA_LDFLAGS) $(ALSA_LDLIBS)
REGTOOL_GENERIC_LIBS-$(OS-Darwin)=fatal.o $(COREMIDI_LDLIBS)

GTK?=y
WEB?=n

BIN=oscmix $(BIN-y)
BIN-$(ALSA)+=alsarawio alsaseqio
BIN-$(COREMIDI)+=coremidiio
BIN-$(WEB)+=wsdgram

TARGET=$(BIN) $(TARGET-y)
TARGET-$(GTK)+=gtk
TARGET-$(WEB)+=web

all: $(TARGET)

.PHONY: gtk
gtk:
	$(MAKE) -C gtk

.PHONY: web
web:
	$(MAKE) -C web

DEVICES=\
	device_ff802.o\
	device_ffucxii.o\
	device_ffufxiii.o\
	device_ffucx.o\
	device_ffufxp.o

OSCMIX_OBJ=\
	main.o\
	osc.o\
	oscmix.o\
	socket.o\
	sysex.o\
	util.o\
	$(DEVICES)

WSDGRAM_OBJ=\
	wsdgram.o\
	base64.o\
	http.o\
	sha1.o\
	socket.o\
	util.o

COREMIDIIO_OBJ=\
	coremidiio.o\
	fatal.o\
	spawn.o

REGTOOL_GENERIC_OBJ-$(OS-Darwin)=\
	fatal.o

REGTOOL_GENERIC_OBJ-$(OS-Linux)=

oscmix.o $(DEVICES): device.h

oscmix: $(OSCMIX_OBJ)
	$(CC) $(LDFLAGS) -o $@ $(OSCMIX_OBJ) -l m

wsdgram: $(WSDGRAM_OBJ)
	$(CC) $(LDFLAGS) -o $@ $(WSDGRAM_OBJ) -l pthread

alsarawio: alsarawio.o
	$(CC) $(LDFLAGS) -o $@ alsarawio.o

alsaseqio.o: alsaseqio.c
	$(CC) $(CPPFLAGS) $(CFLAGS) $(ALSA_CFLAGS) -c -o $@ alsaseqio.c

alsaseqio: alsaseqio.o
	$(CC) $(LDFLAGS) $(ALSA_LDFLAGS) -o $@ alsaseqio.o $(ALSA_LDLIBS) -l pthread

coremidiio.o: coremidiio.c
	$(CC) $(CPPFLAGS) $(CFLAGS) -c -o $@ coremidiio.c

fatal.o: fatal.c
	$(CC) $(CPPFLAGS) $(CFLAGS) -c -o $@ fatal.c

spawn.o: spawn.c
	$(CC) $(CPPFLAGS) $(CFLAGS) -c -o $@ spawn.c

coremidiio: $(COREMIDIIO_OBJ)
	$(CC) $(LDFLAGS) -o $@ $(COREMIDIIO_OBJ) $(COREMIDI_LDLIBS)

tools/regtool.o: tools/regtool.c
	$(CC) $(CPPFLAGS) $(CFLAGS) $(ALSA_CFLAGS) -c -o $@ tools/regtool.c

tools/regtool: tools/regtool.o
	$(CC) $(LDFLAGS) $(ALSA_LDFLAGS) -o $@ tools/regtool.o $(ALSA_LDLIBS)

tools/regtool_generic: tools/regtool_generic.o $(REGTOOL_GENERIC_OBJ-y)
	$(CC) $(LDFLAGS) -o $@ tools/regtool_generic.o $(REGTOOL_GENERIC_LIBS-y)


.PHONY: install
install: $(BIN)
	mkdir -p $(DESTDIR)$(BINDIR)
	cp $(BIN) $(DESTDIR)$(BINDIR)/
	mkdir -p $(DESTDIR)$(MANDIR)/man1
	cp doc/oscmix.1 $(DESTDIR)$(MANDIR)/man1/

.PHONY: clean
clean:
	rm -f oscmix $(OSCMIX_OBJ)\
		wsdgram $(WSDGRAM_OBJ)\
		alsarawio alsarawio.o\
		alsaseqio alsaseqio.o\
		coremidiio coremidiio.o fatal.o spawn.o

	$(MAKE) -C gtk clean
	$(MAKE) -C web clean
