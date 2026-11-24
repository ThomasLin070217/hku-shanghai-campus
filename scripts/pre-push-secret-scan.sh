#!/usr/bin/env bash
# Pre-push secret scan for HKU Shanghai at War.
#
# Run before the owner pushes the tag. It looks for credential shapes, not the
# words "sk-" or "Bearer" in prose, so documentation can mention them safely.
#
#   scripts/pre-push-secret-scan.sh
#
# Exit 1 on any hit. No key is ever printed in full; matches are masked.
set -uo pipefail

cd "$(dirname "$0")/.." || exit 2

patterns=(
  # The lookbehind is load-bearing: without it, our own screenshot names
  # ("task-E-fix2-…") match, because "ta|sk-E-f|ix2" contains the shape.
  '(^|[^A-Za-z0-9_])sk-[A-Za-z0-9_-]{20,}'
  'ntn_[A-Za-z0-9]{20,}'
  'ghp_[A-Za-z0-9]{20,}'
  'github_pat_[A-Za-z0-9_]{20,}'
  'Bearer [A-Za-z0-9._-]{20,}'
  'xi-api-key["'"'"']?[[:space:]]*[:=][[:space:]]*["'"'"']?[A-Za-z0-9_-]{20,}'
)

mask() {
  # Keep the first 4 characters of the secret-looking token, hide the rest.
  sed -E 's/(sk-|ntn_|ghp_|github_pat_|Bearer )([A-Za-z0-9_-]{4})[A-Za-z0-9._-]+/\1\2…/g'
}

hits=0

echo "== tracked files =="
for pattern in "${patterns[@]}"; do
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    # Test fixtures use obvious placeholders; they are not credentials.
    case "$line" in
      *"Bearer test"*|*"Bearer fake"*|*"Bearer dummy"*|*"Bearer example"*|*"Bearer placeholder"*|*"sk-test"*|*"sk-fake"*|*"sk-example"*) continue ;;
    esac
    hits=$((hits + 1))
    printf '%s\n' "$line" | mask
  # No path is excluded. An earlier version skipped docs/ and *.md on the
  # theory that prose can mention "sk-" safely — but a key pasted into a
  # markdown file is exactly the leak this exists to catch, and the pattern
  # already requires 20+ credential characters, so prose cannot trip it.
  done < <(git grep -nEI "$pattern" -- . 2>/dev/null || true)
done

if [ -d dist ]; then
  echo "== dist/ =="
  for pattern in "${patterns[@]}"; do
    while IFS= read -r line; do
      [ -z "$line" ] && continue
      hits=$((hits + 1))
      printf '%s\n' "$line" | mask
    done < <(grep -RInE "$pattern" dist 2>/dev/null || true)
  done
fi

echo "== .env files in the tree =="
while IFS= read -r file; do
  [ -z "$file" ] && continue
  hits=$((hits + 1))
  echo "unexpected env file: $file"
done < <(find . -name '.env' -o -name '.env.local' -o -name '.env.*.local' | grep -v node_modules || true)

if [ "$hits" -eq 0 ]; then
  echo "clean: no credential shapes found"
  exit 0
fi

echo "FAIL: $hits potential secret(s). Rotate the key, remove it from the tree, and re-run."
exit 1
