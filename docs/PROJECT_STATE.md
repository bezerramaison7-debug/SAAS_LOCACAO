# Estado atual do projeto

## Fase atual

**Fase 3 — Autenticação e usuários: CONCLUÍDA, aguardando autorização para a Fase 4 (Cadastros e locações).**

## Última tarefa concluída

Login/logout/recuperação de senha com Supabase Auth real (SSR, cookies HttpOnly), contexto de empresa derivado do banco, autorização no servidor, administração de usuários (convite, papel, ativação), auditoria de autenticação, navegação por perfil e suíte E2E completa contra uma stack Supabase local sem Docker.

## Funcionalidades concluídas

**Fases 1–2:** fundação (Next.js 16.4, TS strict, design system, CI) e banco (schema multiempresa, RLS, storage privado, seed, 235 testes de RLS).

**Fase 3:**

- `/login` (erros específicos sem enumerar contas, `next` seguro), logout, `/recuperar-senha` (resposta neutra), `/recuperar-senha/redefinir`, `/auth/confirm` (token_hash — D-38).
- Proxy: sem sessão → `/login?next=…`; APIs privadas → 401. Redirecionamentos pela URL canônica (D-39).
- `getEstadoAcesso`/`exigirContexto`: usuário verificado + associações ativas do banco; cookie de empresa é só preferência; `/selecionar-empresa` e `/sem-acesso`.
- `exigirPermissao`/`exigirPermissaoPagina` (404 — D-37); menu filtrado por permissão.
- Administração de usuários (`/configuracoes/usuarios`): convite por e-mail, vínculo de conta existente, alteração de papel, desativação/reativação com motivo; proteção do último ADMIN e de autodesativação; tudo auditado.
- `/configuracoes`: perfil próprio; empresa (nome, fuso, aceite de movimentação, limite de atraso) para ADMIN.
- Auditoria de autenticação pseudonimizada (D-40).
- Migration 011: `rpc_listar_usuarios_empresa`, `rpc_vincular_usuario`, `rpc_alterar_papel`, `rpc_definir_usuario_ativo`, `registrar_evento_autenticacao`.
- Stack local sem Docker (D-36): GoTrue v2.197.0, PostgREST v16.4, Mailpit v1.31.3 extraídos das imagens oficiais + gateway.
- Modelos de e-mail de convite e recuperação em português.

## Funcionalidades parciais

- Telas de módulos ainda exibem "disponível a partir da Fase N" (D-28).
- Storage API não está na stack local sem Docker (necessária na Fase 5; extrair `supabase/storage-api`).

## Próximas tarefas

Fase 4 — cadastros (fornecedores, locais, centros de custo, categorias, checklists), locação em etapas, referências Sectra, itens individuais/lote, ativação/cancelamento (funções de domínio), lista com busca/filtros/paginação e detalhe.

## Bugs conhecidos

Nenhum.

## Decisões tomadas

D-01 a D-40 em `docs/decisions.md`. Novas: D-36 (stack local sem Docker), D-37 (404 por falta de permissão), D-38 (token_hash, recuperação sem PKCE), D-39 (URL canônica), D-40 (auditoria de autenticação).

## Migrations aplicadas

`20261008120000` … `20261008120900` (Fase 2) + `20261008121000_usuarios_autenticacao` (Fase 3).

## Variáveis/configurações necessárias

- `.env.local` local: chaves de DEMONSTRAÇÃO (`node scripts/stack/chaves.mjs` ou `npx supabase status -o env`), `NEXT_PUBLIC_APP_URL=http://127.0.0.1:3100`.
- Supabase (homologação/produção): cadastro público desativado, SMTP próprio, modelos de e-mail de `supabase/templates/`, Site URL = URL da aplicação, redirect `…/auth/confirm`, limites de taxa padrão (os de `config.toml` são só para DEV/CI).
- Produção: `alter database postgres set app.ambiente = 'producao'`.

## Arquivos importantes

- `src/lib/auth/*`, `src/lib/audit/*`, `src/lib/db/erros.ts`, `src/lib/actions/estado.ts`, `src/lib/supabase/anon.ts`.
- `src/features/{auth,usuarios,empresa}/`.
- `src/app/(auth)/*`, `src/app/auth/confirm/route.ts`, `src/app/{sem-acesso,selecionar-empresa}/`, `src/app/(app)/configuracoes/**`.
- `supabase/migrations/20261008121000_usuarios_autenticacao.sql`, `supabase/templates/*`.
- `scripts/stack/*`, `supabase/tests/bootstrap-{base,auth-shim}.sql`.
- `tests/e2e/{auth.setup,autenticacao,perfis,usuarios-admin,isolamento}.spec.ts`, `tests/e2e/support/*`.

## Testes atualmente passando

- Unit: 175 (19 arquivos).
- Integração: 74 (5 arquivos).
- RLS: 235 (4 arquivos).
- E2E (Chromium 375/768/1280, Auth real): 200 passando, 9 pulados por aplicabilidade (fluxos de e-mail só no desktop; teclado fora do celular etc.).

## Testes atualmente falhando

Nenhum.

## Dívidas técnicas

- `npm audit` (dev): as mesmas 5 vulnerabilidades altas da cadeia `eslint-config-next`; produção: 0.
- O CI (`supabase start`) ainda não foi executado no GitHub (nenhum PR aberto).
- Páginas sem permissão retornam HTTP 200 com conteúdo de 404 por causa do streaming (D-37).

## Ambiente de desenvolvimento observado

- Sem daemon Docker; Docker Hub e `proxy.golang.org` acessíveis; GitHub bloqueado pelo proxy.
- Stack local: `npm run stack:iniciar` (Postgres 54322, API 54321, Mailpit 54324).

## Próximo passo recomendado

Aguardar autorização explícita para iniciar a **Fase 4 — Cadastros e locações**.
