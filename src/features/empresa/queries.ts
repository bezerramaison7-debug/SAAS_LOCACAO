import "server-only";

import { type Contexto } from "@/lib/auth/contexto";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ConfiguracaoEmpresa = {
  nome: string;
  timezone: string;
  exigeAceite: boolean;
  limiteAtrasoHoras: number;
};

export async function obterConfiguracaoEmpresa(
  contexto: Contexto,
): Promise<ConfiguracaoEmpresa | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("empresas")
    .select("nome, timezone, exige_aceite_movimentacao, limite_atraso_horas")
    .eq("id", contexto.empresa.id)
    .maybeSingle();
  if (!data) return null;
  return {
    nome: data.nome,
    timezone: data.timezone,
    exigeAceite: data.exige_aceite_movimentacao,
    limiteAtrasoHoras: data.limite_atraso_horas,
  };
}

export async function obterTelefone(contexto: Contexto): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("perfis_usuario")
    .select("telefone")
    .eq("user_id", contexto.usuario.id)
    .maybeSingle();
  return data?.telefone ?? "";
}
