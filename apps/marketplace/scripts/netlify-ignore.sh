#!/usr/bin/env bash
# Netlify ignore command for the marketplace site (see netlify.toml).
# Runs from the repo root. Exit 0 = nothing relevant changed, skip the build;
# exit 1 (or any error) = build.

# First build of a branch or preview, or nothing to compare against: build.
if [ -z "$CACHED_COMMIT_REF" ] || [ "$CACHED_COMMIT_REF" = "$COMMIT_REF" ]; then
  exit 1
fi

# supabase/ is left out on purpose: migrations don't change the marketplace
# build, and marketplace code that needs a schema change also touches
# apps/marketplace or packages/db (generated types).
git diff --quiet "$CACHED_COMMIT_REF" "$COMMIT_REF" -- \
  apps/marketplace \
  packages \
  package.json \
  package-lock.json
