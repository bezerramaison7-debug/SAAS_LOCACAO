# Guia de implantação (Vercel + Supabase)

> Fase 9 — F9.5. Vale para **HOMOLOGAÇÃO** e **PRODUÇÃO**. DEV é a stack local (`README.md`).
> Regra de ouro: cada ambiente tem **seu** projeto Supabase (banco, buckets, chaves) e **seus** segredos. Nada é reaproveitado entre ambientes (D-18).

## 1. Pré-requisitos

- Conta Vercel (plano Pro se o agendador do worker for o Vercel Cron — ver §5) e conta Supabase.
- Supabase CLI ≥ 2.x na máquina de operação (`npx supabase --version`).
- Node.js 22 (`.nvmrc`).
- Domínio próprio com HTTPS (ex.: `https://locacoes.suaempresa.com.br`).
- SMTP próprio para os e-mails de convite e recuperação (o SMTP padrão do Supabase tem limite baixo — R-15).

## 2. Supabase (uma vez por ambiente)

1. Crie o projeto (região próxima dos usuários; ex.: São Paulo). Anote `Project URL`, a chave **publishable/anon** e a **service_role** (Settings → API).
2. Aplique as migrations — **sem seed**:

   ```bash
   npx supabase link --project-ref <ref-do-projeto>
   npx supabase db push            # aplica supabase/migrations/* em ordem; NÃO roda o seed
   ```

   Nunca use `supabase db reset --linked` nem `--include-seed` fora de DEV.

3. Marque o banco de produção (o seed recusa rodar nele — teste em `tests/integration/saldo-seed.test.ts`):

   ```sql
   alter database postgres set app.ambiente = 'producao';
   ```

   Em homologação, `'homologacao'` apenas identifica o ambiente: o bloqueio do seed vale só para `producao`, então a proteção ali é não executá-lo (`db push` não o roda). Use dados criados pela interface.

4. Storage: os buckets privados `evidencias`, `contratos`, `comprovantes` e `relatorios` e as policies são criados pelas migrations. Confira em Storage que todos estão **privados** (nenhum público).
5. Auth (Authentication → Settings/URL Configuration):
   - **Site URL** = URL da aplicação (`NEXT_PUBLIC_APP_URL`).
   - **Redirect URLs**: somente `https://<dominio>/auth/confirm`.
   - Cadastro público **desligado** (acesso só por convite do ADMIN) — espelha `enable_signup = false` do `config.toml`.
   - Senha mínima 10 caracteres com maiúsculas, minúsculas e dígitos (igual ao local).
   - Templates de e-mail: copie `supabase/templates/convite.html` (Invite) e `supabase/templates/recuperacao.html` (Reset password), com os assuntos do `config.toml` (D-38).
   - SMTP próprio configurado (Authentication → SMTP).
6. Backups: ative backups diários e, em produção, **PITR** (ver `docs/backup.md`).
7. Primeiro administrador: crie o usuário em Authentication → Users ("Invite") e associe-o à empresa pelo SQL abaixo (uma única vez; depois todos os convites são feitos pela tela **Configurações → Usuários**):

   ```sql
   insert into public.empresas (nome, timezone) values ('Nome da empresa', 'America/Sao_Paulo') returning id;
   insert into public.perfis_usuario (user_id, nome) values ('<id-do-usuario-auth>', 'Nome do administrador');
   insert into public.usuarios_empresa (empresa_id, user_id, papel, ativo)
   values ('<id-da-empresa>', '<id-do-usuario-auth>', 'ADMIN', true);
   ```

   Rode no SQL Editor (papel `postgres`); a operação fica na auditoria.

## 3. Vercel

1. Importe o repositório; framework **Next.js**; comando de build padrão (`next build`); Node 22.
2. Crie um projeto (ou ambiente) por ambiente. _Preview deployments_ apontam para **homologação**, nunca para produção.
3. Variáveis de ambiente (Settings → Environment Variables), por ambiente:

| Variável                               | Valor                                                                 | Tipo                             |
| -------------------------------------- | --------------------------------------------------------------------- | -------------------------------- |
| `NEXT_PUBLIC_APP_URL`                  | `https://<dominio>`                                                   | pública                          |
| `NEXT_PUBLIC_SUPABASE_URL`             | `https://<ref>.supabase.co` (obrigatoriamente HTTPS — D-52)           | pública                          |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | chave publishable/anon do projeto                                     | pública                          |
| `SUPABASE_SERVICE_ROLE_KEY`            | service_role do projeto                                               | **secreta** (marque _Sensitive_) |
| `REPORT_SIGNING_SECRET`                | 32+ caracteres aleatórios (`openssl rand -base64 48`), um por amb.    | **secreta**                      |
| `CRON_SECRET`                          | **o mesmo valor** de `REPORT_SIGNING_SECRET` (só se usar Vercel Cron) | **secreta**                      |
| `SENTRY_DSN`                           | opcional                                                              | secreta                          |

Sem as públicas o build falha; sem qualquer obrigatória o servidor recusa requisições e registra quais faltam.

4. Domínio: aponte o domínio próprio e confirme HTTPS (o HSTS é enviado em produção).
5. Depois do deploy: `GET https://<dominio>/api/health?profundo=1` deve responder `200` (`503` se o Supabase estiver inacessível).

## 4. Ordem de uma nova versão

1. CI verde (formatação, lint, tipos, unit, integração, RLS, build, varredura de segredos, E2E). A matriz completa de navegadores roda todo dia e sob demanda (`workflow_dispatch`).
2. `npx supabase db push` em **homologação** → deploy em homologação → teste de aceite.
3. `npx supabase db push` em **produção** (migrations são aditivas e compatíveis com a versão anterior da aplicação) → promover o deploy.
4. Se a migration falhar no meio, ela é transacional (nada aplicado); corrija e reaplique. Para desfazer uma versão da aplicação, promova o deploy anterior na Vercel (as migrations continuam válidas para ele).

## 5. Agendador do worker de relatórios (obrigatório)

O pedido de relatório já dispara o processamento com `after()`, mas um agendador garante retentativas e o watchdog (D-72, D-76). Ele deve chamar **a cada minuto**:

```
POST https://<dominio>/api/reports/process
Authorization: Bearer <REPORT_SIGNING_SECRET>
```

Opções (escolha uma):

- **Vercel Cron** (plano Pro; o Hobby só permite execução diária): crie `vercel.json` com
  `{"crons":[{"path":"/api/reports/process","schedule":"* * * * *"}]}` e defina `CRON_SECRET` igual a `REPORT_SIGNING_SECRET` — a Vercel envia `GET` com `Authorization: Bearer <CRON_SECRET>`, e a rota aceita `GET` e `POST`.
- **Supabase** (`pg_cron` + `pg_net`, sem depender da Vercel):

  ```sql
  select cron.schedule('relatorios-worker', '* * * * *', $$
    select net.http_post(
      url := 'https://<dominio>/api/reports/process',
      headers := jsonb_build_object('Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'report_signing_secret'))
    ) $$);
  ```

  Guarde o segredo no Vault (`select vault.create_secret('<segredo>', 'report_signing_secret');`), nunca no texto do job.

- Qualquer cron HTTP externo com o mesmo cabeçalho.

Teste: sem cabeçalho a rota responde `401`; com o segredo, `200` e `{"concluidos":…,"falhas":0}`. A rota tem `maxDuration = 300` s.

## 6. Checklist final de produção

- [ ] Projeto Supabase exclusivo; banco marcado `app.ambiente = 'producao'`; seed nunca executado.
- [ ] Buckets privados; nenhuma URL pública.
- [ ] Cadastro público desligado; redirect URLs restritas ao domínio; SMTP próprio; templates aplicados.
- [ ] `SUPABASE_SERVICE_ROLE_KEY`, `REPORT_SIGNING_SECRET` (e `CRON_SECRET`) apenas como variáveis secretas do servidor.
- [ ] Agendador do worker ativo e testado.
- [ ] Backups diários + PITR ativos; simulado de restauração feito (`docs/backup.md`).
- [ ] `/api/health?profundo=1` = 200; login, convite e recuperação de senha testados com e-mail real.
- [ ] Revisão de segurança vigente (`docs/seguranca.md`).
