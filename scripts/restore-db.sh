#!/usr/bin/env bash
# Restore a MedERP Postgres dump created by backup-db.sh.
# This REPLACES the live database. Stop and think before running.
#
#   CONFIRM_RESTORE=yes bash ~/mederp/scripts/restore-db.sh /var/backups/mederp/mederp-YYYYMMDD.dump
#
# Encrypted dumps (.enc) need BACKUP_PASSPHRASE_FILE (same file used at backup time).
set -euo pipefail

if [ "${CONFIRM_RESTORE:-}" != "yes" ]; then
  echo "Refusing to restore. Re-run with CONFIRM_RESTORE=yes and the dump path."
  exit 1
fi

DUMP="${1:-}"
if [ -z "$DUMP" ] || [ ! -f "$DUMP" ]; then
  echo "Usage: CONFIRM_RESTORE=yes bash scripts/restore-db.sh /path/to/mederp-....dump[.enc]"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/apps/web/.env"
COMPOSE_FILE="${ROOT}/docker-compose.prod.yml"
CONFIG_FILE="${BACKUP_CONFIG:-/etc/mederp/backup.env}"

if [ -f "$CONFIG_FILE" ]; then
  # shellcheck disable=SC1090
  set -a
  . "$CONFIG_FILE"
  set +a
fi

compose() {
  sudo docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

WORK="$DUMP"
CLEANUP=""
if [[ "$DUMP" == *.enc ]]; then
  if [ -z "${BACKUP_PASSPHRASE_FILE:-}" ] || [ ! -f "$BACKUP_PASSPHRASE_FILE" ]; then
    echo "Encrypted dump requires BACKUP_PASSPHRASE_FILE."
    exit 1
  fi
  WORK="$(mktemp /tmp/mederp-restore.XXXXXX.dump)"
  CLEANUP="$WORK"
  sudo openssl enc -d -aes-256-cbc -pbkdf2 -in "$DUMP" -out "$WORK" -pass "file:${BACKUP_PASSPHRASE_FILE}"
fi

echo "Restoring ${DUMP} into database mederp. App writes during restore will be lost."
compose stop web
compose exec -T db pg_restore -U postgres -d mederp --clean --if-exists --no-owner --no-acl < "$WORK" || {
  status=$?
  # pg_restore exits 1 on harmless warnings (e.g. dropping missing objects).
  if [ "$status" -gt 1 ]; then
    echo "pg_restore failed with status ${status}"
    compose start web
    [ -n "$CLEANUP" ] && rm -f "$CLEANUP"
    exit "$status"
  fi
}
[ -n "$CLEANUP" ] && rm -f "$CLEANUP"
compose start web
echo "Restore finished. Check https://mederp.co.in/api/health"
