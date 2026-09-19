#!/usr/bin/env bash
# Dry-run merge of your current branch against every teammate branch.
# Touches nothing: no checkout, no index changes, no commits.
# Usage: scripts/check-conflicts.sh            (checks all remote branches)
#        scripts/check-conflicts.sh origin/main (checks one)
set -u
git fetch --all --prune --quiet
me=$(git rev-parse --abbrev-ref HEAD)
targets=${*:-$(git for-each-ref --format='%(refname:short)' refs/remotes/origin | grep -vE "^origin(/HEAD|/$me)?$")}
status=0
for target in $targets; do
  if files=$(git merge-tree --write-tree --name-only --no-messages HEAD "$target" 2>/dev/null); then
    echo "clean     $target"
  else
    status=1
    echo "CONFLICT  $target"
    echo "$files" | tail -n +2 | sed 's/^/            /'
  fi
done
exit $status
