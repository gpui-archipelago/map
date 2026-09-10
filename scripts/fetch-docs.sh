#!/usr/bin/env sh
# Fetch the published study docs from gpui-corpus into docs/04-user-docs.
#
# The study reader's "read the full doc" links are site-relative
# (`docs/04-user-docs/…`), so the docs are part of the built site: the build
# mirrors this directory into dist/docs. Their source of truth is
# `gpui-corpus/curation/research/`, where the studies are published beside the
# curated data whose evidence fields cite them.
#
# Local development against an existing checkout: GPUI_CORPUS_DIR=/path/to/gpui-corpus
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/docs/04-user-docs"
REPO="https://github.com/gpui-archipelago/gpui-corpus.git"

if [ -n "${GPUI_CORPUS_DIR:-}" ]; then
  SRC="$GPUI_CORPUS_DIR/curation/research"
else
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  git clone --depth 1 "$REPO" "$TMP/gpui-corpus"
  SRC="$TMP/gpui-corpus/curation/research"
fi

if [ ! -d "$SRC" ]; then
  echo "fetch-docs: no research directory at $SRC" >&2
  exit 1
fi

rm -rf "$DEST"
mkdir -p "$DEST"
find "$SRC" -maxdepth 1 -name '*.md' ! -name 'README.md' -exec cp {} "$DEST"/ \;
echo "fetch-docs: $(find "$DEST" -type f | wc -l | tr -d ' ') docs -> $DEST"
