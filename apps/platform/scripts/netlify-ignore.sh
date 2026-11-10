#!/usr/bin/env bash
# Netlify ignore command for the platform site (see netlify.toml).
# Runs from the repo root. Exit 0 = nothing relevant changed, skip the build;
# exit 1 (or any error) = build.

# First build of a branch or preview, or nothing to compare against: build.
if [ -z "$CACHED_COMMIT_REF" ] || [ "$CACHED_COMMIT_REF" = "$COMMIT_REF" ]; then
  exit 1
fi

# supabase/ is left out on purpose: migrations don't change the build, and
# platform code that needs a schema change also touches apps/platform or
# packages/db (generated types).
git diff --quiet "$CACHED_COMMIT_REF" "$COMMIT_REF" -- \
  apps/platform \
  packages \
  package.json \
  package-lock.json
