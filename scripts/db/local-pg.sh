#!/usr/bin/env bash
# Postgres 16 local para ambientes SEM Docker (D-19). Imita a porta e as
# credenciais do Supabase CLI (127.0.0.1:54322, postgres/postgres).
#
#   scripts/db/local-pg.sh start   # inicializa (se preciso) e sobe
#   scripts/db/local-pg.sh stop
#   scripts/db/local-pg.sh status
#
# Com Docker disponível, prefira `supabase start` (fidelidade total).
set -euo pipefail

PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PGDATA_DIR="${LOCAL_PGDATA:-/var/tmp/saas-locacao-pg}"
PORTA="${LOCAL_PGPORT:-54322}"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then RUN_AS=(runuser -u postgres --); fi

case "${1:-start}" in
  start)
    if [ ! -s "$PGDATA_DIR/PG_VERSION" ]; then
      mkdir -p "$PGDATA_DIR"
      [ "$(id -u)" = "0" ] && chown postgres:postgres "$PGDATA_DIR"
      PWFILE="$(mktemp)"; echo "postgres" > "$PWFILE"; chmod 644 "$PWFILE"
      "${RUN_AS[@]}" "$PGBIN/initdb" -D "$PGDATA_DIR" -U postgres --pwfile="$PWFILE" \
        --auth=scram-sha-256 --encoding=UTF8 --locale=C.UTF-8 >/dev/null
      rm -f "$PWFILE"
    fi
    if "${RUN_AS[@]}" "$PGBIN/pg_ctl" -D "$PGDATA_DIR" status >/dev/null 2>&1; then
      echo "Postgres local já está rodando na porta $PORTA."
    else
      "${RUN_AS[@]}" "$PGBIN/pg_ctl" -D "$PGDATA_DIR" -l "$PGDATA_DIR/server.log" -w \
        -o "-p $PORTA -k /tmp -c listen_addresses=127.0.0.1 -c timezone=UTC" start >/dev/null
      echo "Postgres local iniciado em 127.0.0.1:$PORTA (postgres/postgres)."
    fi
    ;;
  stop)
    "${RUN_AS[@]}" "$PGBIN/pg_ctl" -D "$PGDATA_DIR" -w stop >/dev/null && echo "Parado."
    ;;
  status)
    "${RUN_AS[@]}" "$PGBIN/pg_ctl" -D "$PGDATA_DIR" status
    ;;
  *)
    echo "uso: $0 start|stop|status" >&2; exit 2
    ;;
esac
