"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { z } from "zod";

import { falha, type EstadoAcao } from "@/lib/actions/estado";
import { exigirContexto } from "@/lib/auth/contexto";
import { traduzirErroBanco } from "@/lib/db/erros";
import { logger } from "@/lib/observability/logger";
import { VERSAO_TEMPLATE } from "@/lib/relatorios/pdf/documento";
import { processarFila } from "@/lib/relatorios/processar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/comum";

import { TIPOS_RELATORIO } from "./rotulos";

const pedidoSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("LOCACAO"), alvo: uuidSchema }),
  z.object({ tipo: z.literal("LOCAL"), alvo: uuidSchema }),
  z.object({
    tipo: z.literal("BEM"),
    alvo: uuidSchema.optional(),
    codigoBem: z.string().trim().max(40).optional(),
  }),
  z.object({
    tipo: z.literal("PERIODO"),
    inicio: z.iso.date({ message: "Informe o início" }),
    fim: z.iso.date({ message: "Informe o fim" }),
  }),
]);

/**
 * RN-111: o pedido só enfileira (responde na hora); o PDF é gerado depois da
 * resposta (`after`) e, se o processo cair, pelo worker agendado.
 */
export async function solicitarRelatorio(
  _anterior: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const contexto = await exigirContexto();
  if (!contexto.permissoes.includes("relatorio.gerar"))
    return falha("Você não tem permissão para gerar relatórios.");
  const valores = Object.fromEntries(
    [...formData.entries()].filter((e): e is [string, string] => typeof e[1] === "string"),
  );
  const tipo = z.enum(TIPOS_RELATORIO).safeParse(valores.tipo);
  if (!tipo.success) return falha("Escolha o tipo de relatório.", { valores });
  const bruto = Object.fromEntries(Object.entries(valores).filter(([, v]) => v !== ""));
  const dados = pedidoSchema.safeParse(bruto);
  if (!dados.success)
    return falha("Revise os campos do relatório.", {
      errosCampo: Object.fromEntries(
        dados.error.issues.map((i) => [String(i.path[0] ?? "_"), i.message]),
      ),
      valores,
    });
  const supabase = await createSupabaseServerClient();
  let alvo: string | null = null;
  const d = dados.data;
  if (d.tipo === "PERIODO") alvo = contexto.empresa.id;
  else if (d.tipo === "BEM" && !d.alvo) {
    // Bem pelo código (busca pela RLS de quem pede).
    const { data: bem } = await supabase
      .from("bens")
      .select("id")
      .eq("empresa_id", contexto.empresa.id)
      .ilike("codigo", d.codigoBem ?? "")
      .maybeSingle();
    if (!bem)
      return falha("Bem não encontrado.", {
        errosCampo: { codigoBem: "Código inexistente" },
        valores,
      });
    alvo = bem.id;
  } else alvo = d.alvo ?? null;
  const { data: id, error } = await supabase.rpc("rpc_solicitar_relatorio", {
    p_tipo: d.tipo,
    ...(alvo ? { p_alvo: alvo } : {}),
    ...(d.tipo === "PERIODO" ? { p_inicio: d.inicio, p_fim: d.fim } : {}),
    p_versao_template: VERSAO_TEMPLATE,
  });
  if (error || !id) return falha(traduzirErroBanco(error).mensagem, { valores });
  after(async () => {
    try {
      await processarFila(1);
    } catch (erro) {
      logger.error("relatorio.after.falhou", { modulo: "relatorios", relatorio_id: id, erro });
    }
  });
  redirect(`/relatorios/${id}`);
}
