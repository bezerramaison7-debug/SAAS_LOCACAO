import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { FormCobranca } from "@/features/cobrancas/components/form-cobranca";
import { exigirPermissaoPagina } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/comum";

export const metadata: Metadata = { title: "Registrar cobrança" };

export default async function NovaCobrancaPage({ searchParams }: PageProps<"/cobrancas/nova">) {
  const contexto = await exigirContexto();
  exigirPermissaoPagina(contexto, "cobranca.gerenciar");
  const bruto = (await searchParams).locacao;
  const inicial = uuidSchema.safeParse(Array.isArray(bruto) ? bruto[0] : bruto);
  const supabase = await createSupabaseServerClient();
  // Locações com vigência e sem encerramento financeiro (o banco revalida — RN-61).
  const { data } = await supabase
    .from("locacoes")
    .select("id, codigo, fornecedores(razao_social, nome_fantasia)")
    .eq("empresa_id", contexto.empresa.id)
    .in("status", ["ATIVA", "EM_DEVOLUCAO", "ENCERRADA_OPERACIONALMENTE"])
    .neq("status_financeiro", "ENCERRADO")
    .order("codigo", { ascending: false })
    .limit(500);
  const locacoes = (data ?? []).map((l) => ({
    id: l.id,
    rotulo: `${l.codigo}${l.fornecedores ? ` — ${l.fornecedores.nome_fantasia ?? l.fornecedores.razao_social}` : ""}`,
  }));
  return (
    <>
      <PageHeader
        titulo="Registrar cobrança"
        descricao="Lance o documento de cobrança do fornecedor. A conferência é um passo separado."
      />
      <FormCobranca
        locacoes={locacoes}
        locacaoInicial={
          inicial.success && locacoes.some((l) => l.id === inicial.data) ? inicial.data : null
        }
      />
    </>
  );
}
