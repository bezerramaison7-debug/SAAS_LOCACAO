-- =============================================================================
-- 001 — Fundação: extensões, esquema privado, tipos (enums), transições.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Esquema NÃO exposto pelo PostgREST (D-30): funções de segurança, triggers,
-- sequências de código, tabelas internas. `authenticated` só recebe EXECUTE
-- nas funções usadas por policies.
create schema if not exists privado;
revoke all on schema privado from public;
grant usage on schema privado to authenticated, service_role;

-- Funções criadas daqui em diante não são executáveis por PUBLIC (padrão
-- GLOBAL: privilégios "in schema" só podem acrescentar, não revogar).
-- A migration 009 revoga explicitamente o que já existir.
alter default privileges revoke execute on functions from public;

-- --------------------------------------------------------------- enums -------
create type public.papel_usuario as enum (
  'ADMIN', 'COMPRAS', 'OPERACAO', 'RESPONSAVEL_LOCAL', 'FINANCEIRO', 'GESTOR', 'AUDITOR'
);
create type public.modo_controle as enum ('INDIVIDUAL', 'LOTE');
create type public.tipo_local as enum ('OBRA', 'ALMOXARIFADO', 'ESCRITORIO', 'OUTRO');
create type public.status_checklist as enum ('RASCUNHO', 'PUBLICADO', 'ARQUIVADO');
create type public.tipo_resposta as enum (
  'SIM_NAO', 'CONFORME_NAO_CONFORME', 'OPCAO_UNICA', 'TEXTO', 'NUMERO'
);
create type public.status_locacao as enum (
  'RASCUNHO', 'ATIVA', 'EM_DEVOLUCAO', 'ENCERRADA_OPERACIONALMENTE', 'CANCELADA'
);
create type public.status_financeiro as enum (
  'NAO_INICIADO', 'EM_COBRANCA', 'ENCERRAMENTO_PENDENTE', 'ENCERRADO'
);
create type public.sistema_externo as enum ('SECTRA', 'OUTRO');
create type public.tipo_referencia as enum (
  'PEDIDO', 'REQUISICAO', 'SOLICITACAO', 'CONTRATO', 'NOTA_FISCAL', 'OUTRO'
);
create type public.periodicidade as enum ('DIARIA', 'SEMANAL', 'QUINZENAL', 'MENSAL');
create type public.status_bem as enum (
  'AGUARDANDO_RECEBIMENTO', 'DISPONIVEL', 'EM_USO', 'EM_TRANSFERENCIA', 'EM_MANUTENCAO',
  'DEVOLUCAO_SOLICITADA', 'DEVOLVIDO', 'EXTRAVIADO', 'SUBSTITUIDO', 'BAIXADO', 'CANCELADO'
);
create type public.status_lote as enum ('ATIVO', 'ENCERRADO', 'CANCELADO');
create type public.status_recebimento as enum (
  'RASCUNHO', 'AGUARDANDO_AUTORIZACAO', 'CONFIRMADO', 'CANCELADO'
);
create type public.condicao_item as enum ('NOVO', 'BOM', 'REGULAR', 'AVARIADO');
create type public.tipo_vistoria as enum ('ENTRADA', 'PERIODICA', 'SAIDA', 'OCORRENCIA');
create type public.status_vistoria as enum ('RASCUNHO', 'CONCLUIDA', 'CANCELADA');
create type public.status_movimentacao as enum (
  'PENDENTE_ACEITE', 'CONFIRMADA', 'RECUSADA', 'CANCELADA'
);
create type public.tipo_ocorrencia as enum (
  'AVARIA', 'DEFEITO', 'EXTRAVIO', 'TROCA', 'DIVERGENCIA_QUANTIDADE',
  'DIVERGENCIA_DOCUMENTAL', 'OUTRO'
);
create type public.prioridade as enum ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');
create type public.status_ocorrencia as enum ('ABERTA', 'EM_TRATAMENTO', 'RESOLVIDA', 'CANCELADA');
create type public.resultado_ocorrencia as enum (
  'ENCONTRADO', 'INDENIZADO', 'REPARADO', 'SUBSTITUIDO', 'OUTRO'
);
create type public.status_devolucao as enum (
  'RASCUNHO', 'SOLICITADA', 'AGENDADA', 'RETIRADA_CONFIRMADA', 'CONFERIDA', 'CANCELADA'
);
create type public.status_cobranca as enum ('PENDENTE', 'CONFERIDA', 'DIVERGENTE', 'RESOLVIDA');
create type public.tipo_evidencia as enum ('FOTO', 'DOCUMENTO', 'COMPROVANTE', 'CONTRATO');
create type public.status_evidencia as enum ('ATIVA', 'SUBSTITUIDA', 'REMOVIDA');
create type public.entidade_evidencia as enum (
  'LOCACAO', 'RECEBIMENTO', 'ITEM_RECEBIMENTO', 'BEM', 'LOTE', 'VISTORIA',
  'RESPOSTA_VISTORIA', 'MOVIMENTACAO', 'OCORRENCIA', 'DEVOLUCAO', 'COBRANCA'
);
create type public.tipo_relatorio as enum ('LOCACAO', 'BEM', 'LOCAL', 'PERIODO');
create type public.status_relatorio as enum ('PENDENTE', 'PROCESSANDO', 'CONCLUIDO', 'ERRO');

-- ------------------------------------------------- máquinas de estado --------
-- Tabela única de transições permitidas (docs/business-rules.md §4).
-- Espelhada em TypeScript (src/features/*/rules/maquina-estado.ts); um teste de
-- paridade garante que as duas são idênticas.
create table privado.transicoes (
  maquina text not null,
  de text not null,
  para text not null,
  primary key (maquina, de, para),
  check (de <> para)
);

insert into privado.transicoes (maquina, de, para) values
  -- Locação
  ('locacao', 'RASCUNHO', 'ATIVA'),
  ('locacao', 'RASCUNHO', 'CANCELADA'),
  ('locacao', 'ATIVA', 'CANCELADA'),
  ('locacao', 'ATIVA', 'EM_DEVOLUCAO'),
  ('locacao', 'EM_DEVOLUCAO', 'ATIVA'),
  ('locacao', 'EM_DEVOLUCAO', 'ENCERRADA_OPERACIONALMENTE'),
  -- Financeiro da locação
  ('financeiro', 'NAO_INICIADO', 'EM_COBRANCA'),
  ('financeiro', 'NAO_INICIADO', 'ENCERRAMENTO_PENDENTE'),
  ('financeiro', 'EM_COBRANCA', 'ENCERRAMENTO_PENDENTE'),
  ('financeiro', 'ENCERRAMENTO_PENDENTE', 'EM_COBRANCA'),
  ('financeiro', 'ENCERRAMENTO_PENDENTE', 'ENCERRADO'),
  -- Bem
  ('bem', 'AGUARDANDO_RECEBIMENTO', 'DISPONIVEL'),
  ('bem', 'AGUARDANDO_RECEBIMENTO', 'CANCELADO'),
  ('bem', 'DISPONIVEL', 'EM_USO'),
  ('bem', 'DISPONIVEL', 'DEVOLUCAO_SOLICITADA'),
  ('bem', 'DISPONIVEL', 'EM_MANUTENCAO'),
  ('bem', 'DISPONIVEL', 'EXTRAVIADO'),
  ('bem', 'DISPONIVEL', 'SUBSTITUIDO'),
  ('bem', 'DISPONIVEL', 'CANCELADO'),
  ('bem', 'EM_USO', 'EM_TRANSFERENCIA'),
  ('bem', 'EM_USO', 'DEVOLUCAO_SOLICITADA'),
  ('bem', 'EM_USO', 'EM_MANUTENCAO'),
  ('bem', 'EM_USO', 'EXTRAVIADO'),
  ('bem', 'EM_USO', 'SUBSTITUIDO'),
  ('bem', 'EM_USO', 'CANCELADO'),
  ('bem', 'EM_TRANSFERENCIA', 'EM_USO'),
  ('bem', 'EM_TRANSFERENCIA', 'EXTRAVIADO'),
  ('bem', 'EM_MANUTENCAO', 'EM_USO'),
  ('bem', 'EM_MANUTENCAO', 'DISPONIVEL'),
  ('bem', 'EM_MANUTENCAO', 'EXTRAVIADO'),
  ('bem', 'EM_MANUTENCAO', 'SUBSTITUIDO'),
  ('bem', 'DEVOLUCAO_SOLICITADA', 'DEVOLVIDO'),
  ('bem', 'DEVOLUCAO_SOLICITADA', 'EM_USO'),
  ('bem', 'DEVOLUCAO_SOLICITADA', 'DISPONIVEL'),
  ('bem', 'DEVOLUCAO_SOLICITADA', 'EXTRAVIADO'),
  ('bem', 'EXTRAVIADO', 'DISPONIVEL'),
  ('bem', 'EXTRAVIADO', 'EM_USO'),
  ('bem', 'EXTRAVIADO', 'EM_MANUTENCAO'),
  ('bem', 'EXTRAVIADO', 'DEVOLUCAO_SOLICITADA'),
  ('bem', 'EXTRAVIADO', 'BAIXADO'),
  -- Lote
  ('lote', 'ATIVO', 'ENCERRADO'),
  ('lote', 'ATIVO', 'CANCELADO'),
  ('lote', 'ENCERRADO', 'ATIVO'),
  -- Recebimento
  ('recebimento', 'RASCUNHO', 'CONFIRMADO'),
  ('recebimento', 'RASCUNHO', 'AGUARDANDO_AUTORIZACAO'),
  ('recebimento', 'RASCUNHO', 'CANCELADO'),
  ('recebimento', 'AGUARDANDO_AUTORIZACAO', 'CONFIRMADO'),
  ('recebimento', 'AGUARDANDO_AUTORIZACAO', 'RASCUNHO'),
  ('recebimento', 'AGUARDANDO_AUTORIZACAO', 'CANCELADO'),
  ('recebimento', 'CONFIRMADO', 'CANCELADO'),
  -- Vistoria
  ('vistoria', 'RASCUNHO', 'CONCLUIDA'),
  ('vistoria', 'RASCUNHO', 'CANCELADA'),
  -- Movimentação
  ('movimentacao', 'PENDENTE_ACEITE', 'CONFIRMADA'),
  ('movimentacao', 'PENDENTE_ACEITE', 'RECUSADA'),
  ('movimentacao', 'PENDENTE_ACEITE', 'CANCELADA'),
  -- Ocorrência
  ('ocorrencia', 'ABERTA', 'EM_TRATAMENTO'),
  ('ocorrencia', 'ABERTA', 'RESOLVIDA'),
  ('ocorrencia', 'ABERTA', 'CANCELADA'),
  ('ocorrencia', 'EM_TRATAMENTO', 'RESOLVIDA'),
  ('ocorrencia', 'EM_TRATAMENTO', 'CANCELADA'),
  ('ocorrencia', 'RESOLVIDA', 'ABERTA'),
  -- Devolução
  ('devolucao', 'RASCUNHO', 'SOLICITADA'),
  ('devolucao', 'RASCUNHO', 'CANCELADA'),
  ('devolucao', 'SOLICITADA', 'AGENDADA'),
  ('devolucao', 'SOLICITADA', 'CANCELADA'),
  ('devolucao', 'AGENDADA', 'RETIRADA_CONFIRMADA'),
  ('devolucao', 'AGENDADA', 'CANCELADA'),
  ('devolucao', 'RETIRADA_CONFIRMADA', 'CONFERIDA'),
  -- Cobrança
  ('cobranca', 'PENDENTE', 'CONFERIDA'),
  ('cobranca', 'PENDENTE', 'DIVERGENTE'),
  ('cobranca', 'CONFERIDA', 'DIVERGENTE'),
  ('cobranca', 'DIVERGENTE', 'RESOLVIDA'),
  -- Relatório
  ('relatorio', 'PENDENTE', 'PROCESSANDO'),
  ('relatorio', 'PROCESSANDO', 'CONCLUIDO'),
  ('relatorio', 'PROCESSANDO', 'ERRO'),
  ('relatorio', 'ERRO', 'PENDENTE'),
  -- Modelo de checklist
  ('checklist', 'RASCUNHO', 'PUBLICADO'),
  ('checklist', 'PUBLICADO', 'ARQUIVADO');

create function privado.transicao_permitida(p_maquina text, p_de text, p_para text)
returns boolean
language sql stable
set search_path = ''
as $$
  select p_de = p_para
      or exists (
        select 1 from privado.transicoes t
        where t.maquina = p_maquina and t.de = p_de and t.para = p_para
      )
$$;
