import { notFound, redirect } from "next/navigation";

import { exigirContexto } from "@/lib/auth/contexto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/comum";

/**
 * Destino do QR Code da etiqueta: resolve o id para a ficha do bem ou do lote
 * na empresa ativa. Sem sessão o proxy leva ao login (com retorno para cá);
 * ativo de outra empresa ou fora do escopo do usuário → 404 (RLS).
 */
export default async function QrPage({ params }: PageProps<"/q/[id]">) {
  const contexto = await exigirContexto();
  const id = uuidSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const supabase = await createSupabaseServerClient();
  const [{ data: bem }, { data: lote }] = await Promise.all([
    supabase
      .from("bens")
      .select("id")
      .eq("empresa_id", contexto.empresa.id)
      .eq("id", id.data)
      .maybeSingle(),
    supabase
      .from("lotes")
      .select("id")
      .eq("empresa_id", contexto.empresa.id)
      .eq("id", id.data)
      .maybeSingle(),
  ]);
  if (bem) redirect(`/bens/${bem.id}`);
  if (lote) redirect(`/bens/lotes/${lote.id}`);
  notFound();
}
