import type { Metadata } from "next";

import { FormRecuperar } from "@/features/auth/components/form-recuperar";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function RecuperarSenhaPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Recuperar senha</h1>
      <FormRecuperar />
    </div>
  );
}
