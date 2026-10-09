#!/usr/bin/env bash
# Storage API (supabase/storage-api, mesma versão do Supabase CLI) sem Docker.
# A imagem é Alpine: o Node dela (musl) roda pelo carregador musl da própria
# imagem, para que os módulos nativos correspondam (D-51).
#
#   scripts/stack/storage.sh migrar   # cria/atualiza o esquema `storage`
#   scripts/stack/storage.sh servir   # sobe a API em 127.0.0.1:5000
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
DIR="${STACK_DIR:-/var/tmp/saas-stack}"
S="$DIR/storage"
NODE=("$S/lib/ld-musl-x86_64.so.1" --library-path "$S/lib:$S/usr/lib:$S/usr/local/lib" "$S/usr/local/bin/node")

eval "$(node "$RAIZ/scripts/stack/chaves.mjs" | sed 's/^/export STACK_/')"

export DATABASE_URL="postgres://postgres:postgres@127.0.0.1:54322/postgres"
export DB_INSTALL_ROLES=true # cria só os papéis ausentes e concede o esquema storage
export ANON_KEY="$STACK_ANON_KEY" SERVICE_KEY="$STACK_SERVICE_ROLE_KEY"
export AUTH_JWT_SECRET="$STACK_JWT_SECRET" PGRST_JWT_SECRET="$STACK_JWT_SECRET" AUTH_JWT_ALGORITHM=HS256
export STORAGE_BACKEND=file FILE_STORAGE_BACKEND_PATH="$DIR/storage-dados" STORAGE_S3_BUCKET=stub
export TENANT_ID=stub REGION=local GLOBAL_S3_BUCKET=stub IS_MULTITENANT=false
export FILE_SIZE_LIMIT=52428800 UPLOAD_FILE_SIZE_LIMIT=52428800
export ENABLE_IMAGE_TRANSFORMATION=false
export SERVER_HOST=127.0.0.1 SERVER_PORT=5000 PORT=5000
export LOG_LEVEL=warn NODE_ENV=production
mkdir -p "$FILE_STORAGE_BACKEND_PATH"

cd "$S/app"
case "${1:-servir}" in
  migrar) exec "${NODE[@]}" dist/scripts/migrate-call.js ;;
  servir) exec "${NODE[@]}" dist/start/server.js ;;
  *) echo "uso: $0 migrar|servir" >&2; exit 2 ;;
esac
