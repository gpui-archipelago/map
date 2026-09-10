#!/usr/bin/env sh
# Fetch the fork-map data bundle from map-data into web/forkmap/data.
#
# The viewer does not version its data: this repo holds the source, `map-data`
# holds the exported `gocar.forkmap.*` family (produced by the published
# `cargo-gocar` from the gpui-corpus measured dataset). Run it before
# `bun test` / `bun run build`; the Pages workflow runs it too.
#
# Local development against an existing checkout: MAP_DATA_DIR=/path/to/map-data
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/web/forkmap/data"
REPO="https://github.com/gpui-archipelago/map-data.git"

if [ -n "${MAP_DATA_DIR:-}" ]; then
  SRC="$MAP_DATA_DIR/data"
else
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  git clone --depth 1 "$REPO" "$TMP/map-data"
  SRC="$TMP/map-data/data"
fi

if [ ! -d "$SRC" ]; then
  echo "fetch-data: no data directory at $SRC" >&2
  exit 1
fi

rm -rf "$DEST"
mkdir -p "$DEST"
cp -a "$SRC"/. "$DEST"/
echo "fetch-data: $(find "$DEST" -type f | wc -l | tr -d ' ') files -> $DEST"
