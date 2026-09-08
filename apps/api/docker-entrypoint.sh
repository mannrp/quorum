#!/bin/sh
set -eu

if [ "$1" = "/usr/local/bin/quorum-api" ]; then
  # Docker creates named-volume roots as root. Prepare the shared socket directory
  # before dropping privileges for the API process.
  install -d -m 0770 -o quorum -g quorum /run/quorum
fi

exec su-exec quorum:quorum "$@"
