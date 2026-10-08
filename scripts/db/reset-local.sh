#!/usr/bin/env bash
# Recria o banco local SEM Docker (D-19/D-36): camada de compatibilidade
# Supabase + esquema auth + migrations em ordem + seed de demonstração.
# Equivalente a `supabase db reset`.
#
#   scripts/db/reset-local.sh            # auth via shim (testes de banco)
#   STACK=1 scripts/db/reset-local.sh    # auth via migrations do GoTrue (stack.sh)
#   SEM_SEED=1 scripts/db/reset-local.sh # sem seed
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
HOST="${LOCAL_PGHOST:-127.0.0.1}"
PORTA="${LOCAL_PGPORT:-54322}"
export PGPASSWORD="${LOCAL_PGPASSWORD:-postgres}"

if [ "$HOST" != "127.0.0.1" ] && [ "$HOST" != "localhost" ]; then
  echo "Recusado: reset-local só opera em banco local (host=$HOST)." >&2
  exit 1
fi

PSQL=(psql -h "$HOST" -p "$PORTA" -U postgres -v ON_ERROR_STOP=1 -q -X)

"${PSQL[@]}" -d template1 -c "drop database if exists postgres with (force)" -c "create database postgres"
"${PSQL[@]}" -d postgres -f "$RAIZ/supabase/tests/bootstrap-base.sql" >/dev/null
if [ "${STACK:-0}" = "1" ]; then
  echo "→ auth (migrations do GoTrue)"
  "${STACK_DIR:-/var/tmp/saas-stack}/gotrue/usr/local/bin/auth" migrate >/dev/null
else
  "${PSQL[@]}" -d postgres -f "$RAIZ/supabase/tests/bootstrap-auth-shim.sql" >/dev/null
fi

for arquivo in "$RAIZ"/supabase/migrations/*.sql; do
  echo "→ $(basename "$arquivo")"
  "${PSQL[@]}" -d postgres -1 -f "$arquivo" >/dev/null
done

if [ "${SEM_SEED:-0}" != "1" ]; then
  echo "→ seed.sql"
  "${PSQL[@]}" -d postgres -1 -f "$RAIZ/supabase/seed.sql" >/dev/null
fi
echo "Banco local recriado."
