#!/usr/bin/env bash
set -euo pipefail

generated_dir="${1:-}"
deploy_branch="${TIMEWEB_DEPLOY_BRANCH:-timeweb-deploy}"
remote="${TIMEWEB_DEPLOY_REMOTE:-origin}"
release_commit="${SPECSPACE_RELEASE_COMMIT:-$(git rev-parse HEAD 2>/dev/null || echo unknown)}"

if [[ -z "$generated_dir" ]]; then
  echo "Usage: scripts/publish-timeweb-deploy-branch.sh GENERATED_DIR" >&2
  exit 2
fi

if [[ ! -d "$generated_dir" ]]; then
  echo "Generated deploy directory does not exist: $generated_dir" >&2
  exit 2
fi

repo_root="$(git rev-parse --show-toplevel)"
generated_dir="$(cd "$generated_dir" && pwd -P)"
worktree="$(mktemp -d "${TMPDIR:-/tmp}/specspace-timeweb-publish.XXXXXX")"

cleanup() {
  cd "$repo_root"
  git worktree remove --force "$worktree" >/dev/null 2>&1 || true
  rm -rf "$worktree"
}
trap cleanup EXIT

git fetch --quiet "$remote" "$deploy_branch" || true

if git show-ref --verify --quiet "refs/remotes/$remote/$deploy_branch"; then
  git worktree add --quiet --detach "$worktree" "$remote/$deploy_branch"
else
  git worktree add --quiet --detach "$worktree"
  (
    cd "$worktree"
    git checkout --quiet --orphan "publish-${deploy_branch}"
  )
fi

find "$worktree" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R "$generated_dir"/. "$worktree"/

"$repo_root/scripts/validate-timeweb-deploy-tree.sh" "$worktree"

(
  cd "$worktree"
  git add -A
  if git diff --cached --quiet; then
    echo "Timeweb deploy branch already matches generated manifest."
    exit 0
  fi

  git commit --quiet -m "Publish Timeweb deploy manifest for ${release_commit}"
  git push "$remote" "HEAD:$deploy_branch"
)

echo "Published $deploy_branch from generated manifest."
