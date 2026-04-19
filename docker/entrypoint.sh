#!/bin/sh
set -eu

log() {
  printf '[entrypoint] %s\n' "$1"
}

normalize_database_url() {
  node <<'NODE'
const mariadb = require('mariadb');

const rawUrl = process.env.DATABASE_URL || '';
if (!rawUrl) {
  process.stdout.write('');
  process.exit(0);
}

const systemDatabases = new Set(['mysql', 'information_schema', 'performance_schema', 'sys']);
const defaultDb = (process.env.APP_DATABASE_NAME || process.env.OPENMAIC_DATABASE_NAME || 'openmaic').trim();

if (!defaultDb) {
  console.error('APP_DATABASE_NAME is empty.');
  process.exit(1);
}

if (systemDatabases.has(defaultDb.toLowerCase())) {
  console.error(`APP_DATABASE_NAME must not be a system database: ${defaultDb}`);
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(rawUrl);
} catch {
  console.error('DATABASE_URL is invalid.');
  process.exit(1);
}

const currentDb = parsed.pathname.replace(/^\/+/, '');
const needsRewrite = !currentDb || systemDatabases.has(currentDb.toLowerCase());

if (!needsRewrite) {
  process.stdout.write(rawUrl);
  process.exit(0);
}

const targetDb = defaultDb;

async function main() {
  const connection = await mariadb.createConnection({
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username || 'root'),
    password: decodeURIComponent(parsed.password || ''),
    ssl: parsed.searchParams.get('sslaccept') ? {} : undefined,
  });

  try {
    const safeDbName = targetDb.replace(/`/g, '');
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${safeDbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await connection.end();
  }

  parsed.pathname = `/${targetDb}`;
  process.stdout.write(parsed.toString());
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
NODE
}

resolve_prisma_cli() {
  if [ -x "./node_modules/.bin/prisma" ]; then
    printf '%s' "./node_modules/.bin/prisma"
    return 0
  fi

  if command -v prisma >/dev/null 2>&1; then
    printf '%s' "prisma"
    return 0
  fi

  if command -v npx >/dev/null 2>&1; then
    printf '%s' "npx --yes prisma"
    return 0
  fi

  return 1
}

run_db_init_once() {
  mode="${PRISMA_INIT_MODE:-migrate}"
  prisma_cli="$(resolve_prisma_cli)" || {
    log 'Prisma CLI not found in container.'
    return 1
  }

  normalized_url="$(normalize_database_url)" || {
    log 'Failed to normalize DATABASE_URL for initialization.'
    return 1
  }

  if [ -n "$normalized_url" ] && [ "${DATABASE_URL:-}" != "$normalized_url" ]; then
    export DATABASE_URL="$normalized_url"
    log "DATABASE_URL switched to application database for initialization."
  fi

  case "$mode" in
    migrate)
      sh -c "$prisma_cli migrate deploy"
      ;;
    push)
      sh -c "$prisma_cli db push --skip-generate"
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
