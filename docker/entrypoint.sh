#!/bin/sh
set -eu

log() {
  printf '[entrypoint] %s\n' "$1"
}

run_db_init_once() {
  mode="${PRISMA_INIT_MODE:-migrate}"

  case "$mode" in
    migrate)
      pnpm prisma migrate deploy
      ;;
    push)
      pnpm prisma db push --skip-generate
      ;;
    none)
      log 'Skipping database initialization (PRISMA_INIT_MODE=none).'
      ;;
    *)
      log "Unknown PRISMA_INIT_MODE=$mode. Expected: migrate, push, none."
      return 1
      ;;
  esac
}

if [ "${AUTO_DB_INIT:-true}" = "true" ]; then
  max_retries="${DB_INIT_MAX_RETRIES:-30}"
  retry_delay="${DB_INIT_RETRY_DELAY_SECONDS:-2}"
  attempt=1

  while [ "$attempt" -le "$max_retries" ]; do
    if run_db_init_once; then
      log 'Database initialization finished.'
      break
    fi

    if [ "$attempt" -ge "$max_retries" ]; then
      log 'Database initialization failed after max retries.'
      exit 1
    fi

    log "Database not ready yet. Retry $attempt/$max_retries in ${retry_delay}s..."
    attempt=$((attempt + 1))
    sleep "$retry_delay"
  done
else
  log 'AUTO_DB_INIT=false, skipping database initialization.'
fi

exec node server.js
