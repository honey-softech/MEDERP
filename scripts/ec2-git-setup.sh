#!/usr/bin/env bash
# One-time: turn the EC2 app folder into a git checkout for GitHub Actions deploys.
# Run on the EC2 box as ubuntu (after copying a GitHub deploy key).
set -euo pipefail

REPO_SSH="${1:-git@github.com:honey-softech/MEDERP.git}"
APP_DIR="${HOME}/mederp"
KEY_PATH="${HOME}/.ssh/mederp_deploy"

if [ ! -f "$KEY_PATH" ]; then
  echo "Missing $KEY_PATH"
  echo "Create a read-only GitHub deploy key, copy the private key here, chmod 600."
  exit 1
fi

chmod 600 "$KEY_PATH"

mkdir -p "${HOME}/.ssh"
touch "${HOME}/.ssh/config"
if ! grep -q "Host github.com-mederp" "${HOME}/.ssh/config" 2>/dev/null; then
  cat >> "${HOME}/.ssh/config" <<EOF

Host github.com-mederp
  HostName github.com
  User git
  IdentityFile ${KEY_PATH}
  IdentitiesOnly yes
EOF
fi
chmod 600 "${HOME}/.ssh/config"

REMOTE_URL="git@github.com-mederp:honey-softech/MEDERP.git"
# Allow override if caller passed a full custom URL
if [[ "$REPO_SSH" == git@github.com-mederp:* ]] || [[ "$REPO_SSH" == git@github.com:* ]]; then
  if [[ "$REPO_SSH" == git@github.com:* ]]; then
    REMOTE_URL="git@github.com-mederp:${REPO_SSH#git@github.com:}"
  else
    REMOTE_URL="$REPO_SSH"
  fi
fi

cd "$APP_DIR"

# Keep production env file
if [ -f apps/web/.env ]; then
  cp apps/web/.env /tmp/mederp.web.env.bak
fi

if [ ! -d .git ]; then
  git init
  git remote add origin "$REMOTE_URL" 2>/dev/null || git remote set-url origin "$REMOTE_URL"
  git fetch origin main
  git checkout -B main origin/main
else
  git remote set-url origin "$REMOTE_URL"
  git fetch origin main
  git checkout -B main origin/main
fi

if [ -f /tmp/mederp.web.env.bak ]; then
  mkdir -p apps/web
  cp /tmp/mederp.web.env.bak apps/web/.env
  rm -f /tmp/mederp.web.env.bak
fi

echo "Git setup OK. Remote:"
git remote -v
git log -1 --oneline
