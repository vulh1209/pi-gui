#!/bin/sh
set -eu

HOST_EXECUTABLE=${PI_MEMORY_HOST_EXECUTABLE:-}
if [ -z "$HOST_EXECUTABLE" ]; then
  SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
  HOST_EXECUTABLE="$SCRIPT_DIR/../../MacOS/pi-gui"
fi

export ELECTRON_RUN_AS_NODE=1
exec "$HOST_EXECUTABLE" "$@"
