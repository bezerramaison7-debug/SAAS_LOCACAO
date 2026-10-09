#!/usr/bin/env bash
# Simulado de backup + restauração (F9.4), executável localmente ou contra
# homologação (nunca restaura por cima do banco de origem):
#   1. pg_dump (formato custom) do banco de origem;
#   2. backup dos arquivos do Storage com manifest SHA-256;
#   3. restauração do dump num banco NOVO e temporário;
#   4. comparação de contagem e checksum de todas as tabelas (origem × restaurado);
#   5. conferência dos arquivos contra os hashes gravados no banco restaurado.
# Uso: BACKUP_DATABASE_URL=... scripts/backup/testar.sh [diretório]
set -euo pipefail
cd "$(dirname "$0")/../.."
ORIGEM="${BACKUP_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
DESTINO="${1:-backups/$(date -u +%Y%m%dT%H%M%SZ)}"
TEMP_DB="restauracao_$(date +%s)"
ENV_ARGS=()
[ -f .env.local ] && ENV_ARGS=(--env-file=.env.local)
mkdir -p "$DESTINO"

echo "1/5 Dump do banco → $DESTINO/banco.dump"
pg_dump --format=custom --no-comments --file="$DESTINO/banco.dump" "$ORIGEM"

echo "2/5 Arquivos do Storage → $DESTINO/storage"
node "${ENV_ARGS[@]}" scripts/backup/storage.mjs baixar "$DESTINO/storage"

URL_TEMP="${ORIGEM%/*}/$TEMP_DB"
trap 'psql -q "$ORIGEM" -c "drop database if exists $TEMP_DB" >/dev/null 2>&1 || true' EXIT
echo "3/5 Restauração em banco temporário ($TEMP_DB)"
psql -q "$ORIGEM" -c "create database $TEMP_DB"
# Extensões/roles já existem no cluster; avisos de objetos do Supabase são esperados.
pg_restore --no-owner --exit-on-error --dbname="$URL_TEMP" "$DESTINO/banco.dump" 2>"$DESTINO/restore.log" \
  || { echo "Falha na restauração:"; tail -20 "$DESTINO/restore.log"; exit 1; }

echo "4/5 Comparação origem × restaurado (todas as tabelas de public, privado e auth)"
CONSULTA="select n.nspname||'.'||c.relname, (xpath('/row/c/text()', query_to_xml(format(
  'select count(*) as c from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text::bigint,
  (xpath('/row/h/text()', query_to_xml(format(
  'select md5(coalesce(string_agg(t::text, ''|'' order by t::text), '''')) as h from %I.%I t',
  n.nspname, c.relname), false, true, '')))[1]::text
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r' and n.nspname in ('public', 'privado', 'auth') order by 1"
psql -tA "$ORIGEM" -c "$CONSULTA" > "$DESTINO/origem.txt"
psql -tA "$URL_TEMP" -c "$CONSULTA" > "$DESTINO/restaurado.txt"
if ! diff -u "$DESTINO/origem.txt" "$DESTINO/restaurado.txt"; then
  echo "DIVERGÊNCIA entre origem e restauração"; exit 1
fi
echo "   $(wc -l < "$DESTINO/origem.txt") tabelas idênticas (contagem e checksum)"

echo "5/5 Arquivos do backup × hashes do banco restaurado"
BACKUP_DATABASE_URL="$URL_TEMP" node "${ENV_ARGS[@]}" scripts/backup/storage.mjs verificar "$DESTINO/storage"
echo "Backup e restauração verificados: $DESTINO"
