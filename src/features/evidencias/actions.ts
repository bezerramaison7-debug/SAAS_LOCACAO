"use server";

import { revalidatePath } from "next/cache";

import { falha, sucesso, type EstadoAcao } from "@/lib/actions/estado";
import { exigirContexto } from "@/lib/auth/contexto";
import { traduzirErroBanco } from "@/lib/db/erros";
import { justificativaSchema, uuidSchema } from "@/lib/validation/comum";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Remoção lógica (RN-95): o registro e o arquivo continuam, com motivo e auditoria. */
export async function removerEvidencia(formData: FormData): Promise<EstadoAcao> {
  const contexto = await exigirContexto();
  if (!contexto.permissoes.includes("evidencia.substituir_remover")) {
    return falha("Você não tem permissão para remover evidências.");
  }
  const id = uuidSchema.safeParse(formData.get("id"));
  const motivo = justificativaSchema.safeParse(formData.get("motivo") ?? "");
  if (!id.success) return falha("Evidência inválida.");
  if (!motivo.success) return falha(motivo.error.issues[0]?.message ?? "Informe o motivo.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_remover_evidencia", {
    p_evidencia: id.data,
    p_motivo: motivo.data,
  });
  if (error) return falha(traduzirErroBanco(error).mensagem);
  const caminho = formData.get("caminho");
  if (typeof caminho === "string" && caminho.startsWith("/")) revalidatePath(caminho);
  return sucesso("Evidência removida.");
}
