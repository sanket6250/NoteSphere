#!/bin/sh
set -eu

: "${APP_DB_USER:?APP_DB_USER must be configured}"
: "${APP_DB_PASSWORD:?APP_DB_PASSWORD must be configured}"
if [ "$APP_DB_USER" = "$POSTGRES_USER" ]; then
  echo "APP_DB_USER must differ from the PostgreSQL bootstrap administrator." >&2
  exit 1
fi

psql \
  --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" \
  --set=ON_ERROR_STOP=1 \
  --set=database="$POSTGRES_DB" \
  --set=app_user="$APP_DB_USER" \
  --set=app_password="$APP_DB_PASSWORD" <<'SQL'
CREATE ROLE :"app_user" LOGIN PASSWORD :'app_password';
GRANT CONNECT ON DATABASE :"database" TO :"app_user";
ALTER SCHEMA public OWNER TO :"app_user";
GRANT ALL ON SCHEMA public TO :"app_user";
SQL
