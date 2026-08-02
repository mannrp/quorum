#!/bin/sh
set -eu

# Docker creates named-volume roots as root. Prepare the shared socket directory
# once, then drop privileges before the API process starts.
install -d -m 0770 -o quorum -g quorum /run/quorum
exec su-exec quorum:quorum /usr/local/bin/quorum-api
