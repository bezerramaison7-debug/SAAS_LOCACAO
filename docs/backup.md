# Backup e restauração

> Fase 9 — F9.4. Procedimento **testado** em 09/10/2026 (ver §4).

## 1. O que precisa de backup

| Parte    | Onde                                                                     | Observação                                                                      |
| -------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Banco    | Postgres do Supabase: esquemas `public`, `privado`, `auth`               | Dados, auditoria, usuários; `privado` guarda sequências e limites de taxa       |
| Arquivos | Storage: buckets `evidencias`, `contratos`, `comprovantes`, `relatorios` | O banco guarda só o `storage_path` e o **SHA-256** de cada arquivo (D-49/D-75)  |
| Segredos | Vercel / cofre da empresa                                                | `REPORT_SIGNING_SECRET` é necessário para conferir o HMAC de relatórios antigos |

Não há estado em disco na aplicação (Vercel é sem estado): reimplantar o mesmo commit recria o servidor.

## 2. Rotina em produção

1. **Banco:** backups diários do Supabase **e PITR** (recuperação a qualquer instante dentro da janela do plano). PITR é o mecanismo principal; o backup diário é a segunda linha.
2. **Arquivos:** o backup do Supabase **não inclui os objetos do Storage**. Rode diariamente, numa máquina de operação (não na Vercel), com credenciais do ambiente:

   ```bash
   node --env-file=.env.producao scripts/backup/storage.mjs baixar /caminho/seguro/AAAA-MM-DD
   ```

   O comando baixa todos os objetos dos quatro buckets e grava `manifest.json` (bucket, caminho, bytes, SHA-256, tipo). Guarde o diretório em armazenamento com versionamento e criptografia, fora do provedor principal. O arquivo `.env.producao` contém a service role: fica só na máquina de operação, nunca no repositório (`/backups` e `.env*` estão no `.gitignore`).

3. **Dump lógico semanal** (independente do fornecedor):

   ```bash
   pg_dump --format=custom --no-comments --file=banco.dump "$BACKUP_DATABASE_URL"
   ```

   `BACKUP_DATABASE_URL` = string de conexão direta do projeto (Settings → Database), com usuário de leitura quando possível.

4. **Segredos:** registre os segredos de cada ambiente no cofre da empresa. Trocar o `REPORT_SIGNING_SECRET` invalida a conferência do HMAC dos relatórios antigos; guarde o valor anterior.

## 3. Restauração

Restaure **sempre num destino novo** e confira antes de apontar a aplicação para ele. Nunca restaure por cima do banco de origem.

### 3.1 Banco

- **Incidente recente:** PITR no painel do Supabase (Database → Backups → Point in time) para o instante anterior ao problema.
- **A partir do dump lógico:** crie um projeto/banco novo, aplique o dump:

  ```bash
  pg_restore --no-owner --exit-on-error --dbname="$URL_DESTINO" banco.dump
  ```

  Depois confira com o passo 4 do simulado (contagem e checksum por tabela).

### 3.2 Arquivos

```bash
node --env-file=.env.destino scripts/backup/storage.mjs enviar /caminho/seguro/AAAA-MM-DD
```

Antes de enviar, cada arquivo é recalculado e comparado com o manifesto (arquivo alterado no backup interrompe a restauração). Objetos que já existem no destino não são sobrescritos (`upsert: false`).

### 3.3 Conferência final

```bash
BACKUP_DATABASE_URL="$URL_DESTINO" node --env-file=.env.destino scripts/backup/storage.mjs verificar /caminho/seguro/AAAA-MM-DD
```

Recalcula o SHA-256 de todos os arquivos do backup e confere cada evidência e cada relatório concluído do banco restaurado contra o hash gravado (`evidencias.hash_arquivo`, `relatorios.hash_arquivo`). Qualquer ausência ou divergência falha com a lista dos caminhos.

## 4. Simulado (testado)

`npm run backup:testar` (`scripts/backup/testar.sh`) executa o ciclo completo contra um banco de origem (padrão: o local; `BACKUP_DATABASE_URL` para homologação) sem tocar nele:

1. `pg_dump` em formato custom;
2. backup do Storage com manifesto SHA-256;
3. `pg_restore` num banco **temporário** novo (`restauracao_<timestamp>`, removido ao final);
4. comparação origem × restaurado de **todas** as tabelas de `public`, `privado` e `auth` (contagem e MD5 do conteúdo ordenado);
5. conferência dos arquivos contra os hashes do banco **restaurado**.

Resultado em 09/10/2026 (stack local após a suíte E2E):

```
Storage: 8 arquivo(s) salvos em backups/20261009T183833Z/storage
   59 tabelas idênticas (contagem e checksum)
Storage verificado: 8 arquivo(s) íntegros; 8 registro(s) do banco conferem com o backup (SHA-256)
Backup e restauração verificados
```

Provas adicionais feitas no mesmo dia:

- **Adulteração detectada:** um byte acrescentado a um PDF do backup → `verificar` falha com `arquivo alterado no backup: relatorios/…` (código de saída 1).
- **Restauração de arquivo:** um objeto removido do Storage → `enviar` restaurou 1 arquivo (7 já existiam) e o download devolveu o mesmo SHA-256 do manifesto.

Recomendação: repetir o simulado contra **homologação** a cada trimestre e após mudanças de esquema, registrando a data e o resultado aqui.

## 5. Objetivos

| Métrica | Alvo                                                                                            |
| ------- | ----------------------------------------------------------------------------------------------- |
| RPO     | Banco: minutos (PITR). Arquivos: 24 h (backup diário do Storage)                                |
| RTO     | 4 h para restaurar banco + arquivos num projeto novo e reapontar a aplicação (variáveis Vercel) |
