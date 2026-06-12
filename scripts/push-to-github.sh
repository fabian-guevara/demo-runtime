#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPO_NAME="${1:-demo-runtime}"
VISIBILITY="${2:-private}"

if ! command -v gh >/dev/null 2>&1; then
  echo "Install GitHub CLI first: brew install gh"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Not logged into GitHub. Run: gh auth login"
  exit 1
fi

if git diff --quiet && git diff --cached --quiet; then
  echo "Working tree clean."
else
  echo "Commit pending changes before pushing."
  git status -sb
  exit 1
fi

if git remote get-url origin >/dev/null 2>&1; then
  echo "Remote origin already configured."
else
  FLAGS=(--source=. --remote=origin)
  if [[ "$VISIBILITY" == "public" ]]; then
    FLAGS+=(--public)
  else
    FLAGS+=(--private)
  fi
  gh repo create "$REPO_NAME" "${FLAGS[@]}"
fi

git push -u origin main
echo "Done: $(gh repo view --json url -q .url)"
