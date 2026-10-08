import "server-only";

import { type Contexto } from "@/lib/auth/contexto";
import { type EntidadeEvidencia } from "@/lib/evidencias/arquivo";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Evidencia = {
  id: string;
  entidadeId: string;
  tipo: "FOTO" | "DOCUMENTO" | "CONTRATO" | "COMPROVANTE";
  mime: string;
  nome: string | null;
  legenda: string | null;
  perguntaId: string | null;
  enviadaEm: string;
  capturadaEm: string | null;
  status: "ATIVA" | "SUBSTITUIDA" | "REMOVIDA";
};

/** Evidências das entidades (RLS de quem consulta). Só ATIVAS por padrão. */
export async function evidenciasDe(
  contexto: Contexto,
  entidade: EntidadeEvidencia,
  ids: string[],
  incluirHistorico = false,
): Promise<Evidencia[]> {
  if (!ids.length) return [];
  const supabase = await createSupabaseServerClient();
  let consulta = supabase
    .from("evidencias")
    .select(
      "id, entidade_id, tipo, mime_type, nome_original, legenda, pergunta_id, enviada_em, capturada_em, status",
    )
    .eq("empresa_id", contexto.empresa.id)
    .eq("entidade_tipo", entidade)
    .in("entidade_id", ids)
    .order("enviada_em");
  if (!incluirHistorico) consulta = consulta.eq("status", "ATIVA");
  const { data, error } = await consulta;
  if (error) throw new Error("Falha ao listar evidências");
  return (data ?? []).map((e) => ({
    id: e.id,
    entidadeId: e.entidade_id,
    tipo: e.tipo,
    mime: e.mime_type,
    nome: e.nome_original,
    legenda: e.legenda,
    perguntaId: e.pergunta_id,
    enviadaEm: e.enviada_em,
    capturadaEm: e.capturada_em,
    status: e.status,
  }));
}
