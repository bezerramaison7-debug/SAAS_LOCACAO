#!/usr/bin/env bash
# Stack Supabase local SEM Docker (D-36, D-51): Postgres + GoTrue + PostgREST +
# Storage API + Mailpit + gateway, com as MESMAS versões fixadas pelo Supabase CLI.
#
#   scripts/stack/stack.sh iniciar   # baixa imagens (1ª vez), recria banco e sobe tudo
#   scripts/stack/stack.sh parar
#   scripts/stack/stack.sh status
#
# Portas: API 54321 · Postgres 54322 · Mailpit web 54324 / SMTP 54325
# Com Docker disponível, prefira `npx supabase start`.
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
DIR="${STACK_DIR:-/var/tmp/saas-stack}"
LOGS="$DIR/logs"
APP_URL="${NEXT_PUBLIC_APP_URL:-http://127.0.0.1:3100}"

GOTRUE_IMG="supabase/gotrue:v2.197.0"
POSTGREST_IMG="postgrest/postgrest:v16.4"
MAILPIT_IMG="axllent/mailpit:v1.31.3"
STORAGE_IMG="supabase/storage-api:v1.79.36"

eval "$(node "$RAIZ/scripts/stack/chaves.mjs" | sed 's/^/export STACK_/')"

baixar() {
  [ -x "$DIR/gotrue/usr/local/bin/auth" ] || python3 -I "$RAIZ/scripts/stack/extrair-imagem.py" "$GOTRUE_IMG" "$DIR/gotrue"
  [ -x "$DIR/postgrest/bin/postgrest" ] || python3 -I "$RAIZ/scripts/stack/extrair-imagem.py" "$POSTGREST_IMG" "$DIR/postgrest"
  [ -x "$DIR/mailpit/mailpit" ] || python3 -I "$RAIZ/scripts/stack/extrair-imagem.py" "$MAILPIT_IMG" "$DIR/mailpit"
  [ -f "$DIR/storage/app/dist/start/server.js" ] || python3 -I "$RAIZ/scripts/stack/extrair-imagem.py" "$STORAGE_IMG" "$DIR/storage"
}

ambiente_gotrue() {
  export GOTRUE_DB_DRIVER=postgres
  export DATABASE_URL="postgres://supabase_auth_admin:postgres@127.0.0.1:54322/postgres"
  export GOTRUE_DB_MIGRATIONS_PATH="$DIR/gotrue/usr/local/etc/auth/migrations"
  export GOTRUE_API_HOST=127.0.0.1 PORT=9999
  export API_EXTERNAL_URL="http://127.0.0.1:54321/auth/v1"
  export GOTRUE_SITE_URL="$APP_URL"
  export GOTRUE_URI_ALLOW_LIST="$APP_URL/**,http://localhost:3000/**,http://127.0.0.1:3000/**"
  export GOTRUE_DISABLE_SIGNUP=true
  export GOTRUE_JWT_SECRET="$STACK_JWT_SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated
  export GOTRUE_JWT_ADMIN_ROLES=service_role GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated
  export GOTRUE_JWT_ISSUER="http://127.0.0.1:54321/auth/v1"
  export GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_MAILER_AUTOCONFIRM=true
  export GOTRUE_SMTP_HOST=127.0.0.1 GOTRUE_SMTP_PORT=54325 GOTRUE_SMTP_ADMIN_EMAIL=nao-responda@demo.rastreio.test
  export GOTRUE_SMTP_SENDER_NAME="Rastreio de Locações (DEV)" GOTRUE_SMTP_MAX_FREQUENCY=1s
  export GOTRUE_MAILER_URLPATHS_RECOVERY=/auth/v1/verify GOTRUE_MAILER_URLPATHS_INVITE=/auth/v1/verify
  export GOTRUE_PASSWORD_MIN_LENGTH=10 GOTRUE_PASSWORD_REQUIRED_CHARACTERS="abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789"
  export GOTRUE_RATE_LIMIT_EMAIL_SENT=1000 GOTRUE_RATE_LIMIT_VERIFY=1000 GOTRUE_RATE_LIMIT_TOKEN_REFRESH=1000
  export GOTRUE_RATE_LIMIT_SIGN_IN_SIGN_UPS=1000 GOTRUE_LOG_LEVEL=warn
  export GOTRUE_MAILER_TEMPLATES_INVITE="http://127.0.0.1:54321/__templates/convite.html"
  export GOTRUE_MAILER_TEMPLATES_RECOVERY="http://127.0.0.1:54321/__templates/recuperacao.html"
  export GOTRUE_MAILER_SUBJECTS_INVITE="Convite: Rastreio de Locações"
  export GOTRUE_MAILER_SUBJECTS_RECOVERY="Redefinição de senha: Rastreio de Locações"
}

esperar() { # url nome
  for _ in $(seq 1 60); do curl -fsS -o /dev/null "$1" 2>/dev/null && return 0; sleep 0.5; done
  echo "✗ $2 não respondeu em $1 (veja $LOGS)" >&2; return 1
}

iniciar_processo() { # nome comando...
  local nome="$1"; shift
  nohup "$@" >"$LOGS/$nome.log" 2>&1 &
  echo $! >"$DIR/$nome.pid"
}

parar() {
  for nome in gateway storage postgrest gotrue mailpit; do
    if [ -f "$DIR/$nome.pid" ]; then kill "$(cat "$DIR/$nome.pid")" 2>/dev/null || true; rm -f "$DIR/$nome.pid"; fi
  done
}

case "${1:-iniciar}" in
  iniciar)
    mkdir -p "$LOGS"
    baixar
    parar
    "$RAIZ/scripts/db/local-pg.sh" start
    ambiente_gotrue
    STACK=1 "$RAIZ/scripts/db/reset-local.sh"
    iniciar_processo mailpit "$DIR/mailpit/mailpit" --listen 127.0.0.1:54324 --smtp 127.0.0.1:54325
    iniciar_processo gotrue "$DIR/gotrue/usr/local/bin/auth" serve
    PGRST_DB_URI="postgres://authenticator:postgres@127.0.0.1:54322/postgres" \
    PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$STACK_JWT_SECRET" \
    PGRST_SERVER_HOST=127.0.0.1 PGRST_SERVER_PORT=54330 PGRST_DB_EXTRA_SEARCH_PATH=public,extensions \
      iniciar_processo postgrest "$DIR/postgrest/bin/postgrest"
    rm -rf "$DIR/storage-dados" # arquivos acompanham o banco recriado
    iniciar_processo storage "$RAIZ/scripts/stack/storage.sh" servir
    iniciar_processo gateway node "$RAIZ/scripts/stack/gateway.mjs"
    esperar http://127.0.0.1:54324/livez mailpit
    esperar http://127.0.0.1:9999/health gotrue
    esperar "http://127.0.0.1:54321/rest/v1/?apikey=$STACK_ANON_KEY" postgrest
    esperar http://127.0.0.1:5000/status storage
    echo "Stack local pronta: API http://127.0.0.1:54321 · e-mails http://127.0.0.1:54324"
    ;;
  parar) parar; echo "Stack parada (Postgres continua: npm run db:local:stop)." ;;
  status)
    for nome in mailpit gotrue postgrest storage gateway; do
      if [ -f "$DIR/$nome.pid" ] && kill -0 "$(cat "$DIR/$nome.pid")" 2>/dev/null; then echo "✓ $nome"; else echo "✗ $nome"; fi
    done ;;
  migrar-auth) ambiente_gotrue; "$DIR/gotrue/usr/local/bin/auth" migrate ;;
  *) echo "uso: $0 iniciar|parar|status" >&2; exit 2 ;;
esac
