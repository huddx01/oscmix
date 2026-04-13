#ifndef SPAWN_H
#define SPAWN_H

enum {
	READ = 1,
	WRITE = 2,
};

/* ctrlfd: if >= 0, dup2'd to fd 8 in the exec'd child so the child can
 * receive control signals; closed on the fork-continued (coremidiio) side. */
void spawn(const char *path, char *const argv[], int mode, int fd[2], int ctrlfd);

#endif
