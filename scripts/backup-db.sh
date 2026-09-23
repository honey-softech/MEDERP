#!/usr/bin/env bash
# Daily MedERP backup: Postgres custom dump + WhatsApp media archive.
# Run on the EC2 host from anywhere:
#   bash ~/mederp/scripts/backup-db.sh
#
# Optional config file (mode 600), not committed:
#   /etc/mederp/backup.env
#     BACKUP_DIR=/var/backups/mederp
#     BACKUP_RETENTION_DAYS=30
#     BACKUP_S3_URI=s3://your-bucket/mederp
#     BACKUP_PASSPHRASE_FILE=/etc/mederp/backup.pass
set -euo pipefail

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

BACKUP_DIR="${BACKUP_DIR:-/var/backups/mederp}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_TAG="mederp-backup"

log() { echo "[$LOG_TAG] $*"; }

if [ ! -f "$ENV_FILE" ]; then
  log "ERROR: missing $ENV_FILE"
  exit 1
fi

compose() {
  sudo docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

sudo mkdir -p "$BACKUP_DIR"
sudo chmod 700 "$BACKUP_DIR"

DB_FILE="${BACKUP_DIR}/mederp-${STAMP}.dump"
MEDIA_FILE="${BACKUP_DIR}/mederp-media-${STAMP}.tgz"

log "Dumping Postgres to ${DB_FILE}"
compose exec -T db pg_dump -U postgres -d mederp -Fc --no-owner --no-acl | sudo tee "$DB_FILE" >/dev/null
sudo chmod 600 "$DB_FILE"

if ! sudo test -s "$DB_FILE"; then
  log "ERROR: dump is empty"
  exit 1
fi

log "Archiving WhatsApp media (if any)"
if compose exec -T web tar -C /app/.data -czf - whatsapp-media 2>/dev/null | sudo tee "$MEDIA_FILE" >/dev/null; then
  sudo chmod 600 "$MEDIA_FILE"
  if ! sudo test -s "$MEDIA_FILE"; then
    sudo rm -f "$MEDIA_FILE"
    MEDIA_FILE=""
  fi
else
  MEDIA_FILE=""
  log "No WhatsApp media archive (folder empty or missing). Database dump still saved."
fi

encrypt_file() {
  local src="$1"
  if [ -z "${BACKUP_PASSPHRASE_FILE:-}" ]; then
    echo "$src"
    return
  fi
  if [ ! -f "$BACKUP_PASSPHRASE_FILE" ]; then
    log "ERROR: BACKUP_PASSPHRASE_FILE not found: $BACKUP_PASSPHRASE_FILE"
    exit 1
  fi
  local dest="${src}.enc"
  sudo openssl enc -aes-256-cbc -pbkdf2 -salt -in "$src" -out "$dest" -pass "file:${BACKUP_PASSPHRASE_FILE}"
  sudo chmod 600 "$dest"
  sudo rm -f "$src"
  echo "$dest"
}

OUT_DB="$(encrypt_file "$DB_FILE")"
OUT_MEDIA=""
if [ -n "$MEDIA_FILE" ]; then
  OUT_MEDIA="$(encrypt_file "$MEDIA_FILE")"
fi

if [ -n "${BACKUP_S3_URI:-}" ]; then
  if ! command -v aws >/dev/null 2>&1; then
    log "ERROR: BACKUP_S3_URI is set but aws CLI is not installed"
    exit 1
  fi
  log "Uploading to ${BACKUP_S3_URI}"
  aws s3 cp "$OUT_DB" "${BACKUP_S3_URI}/$(basename "$OUT_DB")" --sse AES256
  if [ -n "$OUT_MEDIA" ]; then
    aws s3 cp "$OUT_MEDIA" "${BACKUP_S3_URI}/$(basename "$OUT_MEDIA")" --sse AES256
  fi
fi

log "Removing local backups older than ${RETENTION_DAYS} days"
sudo find "$BACKUP_DIR" -type f \( -name 'mederp-*.dump' -o -name 'mederp-*.dump.enc' -o -name 'mederp-media-*.tgz' -o -name 'mederp-media-*.tgz.enc' \) -mtime "+${RETENTION_DAYS}" -delete

log "Done. Latest database file: ${OUT_DB}"
