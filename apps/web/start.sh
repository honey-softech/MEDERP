#!/bin/sh
set -e

echo "Starting MedERP"
echo "PORT=${PORT:-3000}"
echo "NODE_ENV=${NODE_ENV}"
echo "DATABASE_URL set: $([ -n \"$DATABASE_URL\" ] && echo yes || echo no)"

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is missing on this service."
  echo "Link Postgres → Variables → add DATABASE_URL reference on MEDERP."
  exit 1
fi

echo "Running prisma migrate deploy..."
npx prisma migrate deploy
echo "Migrations done. Starting server..."
exec npm run start
