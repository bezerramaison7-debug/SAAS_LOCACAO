"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function ErroModulo({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-4">
      <Alert tom="perigo" titulo="Não foi possível carregar esta tela">
        Tente novamente. Se o problema persistir, informe ao suporte o código
        {error.digest ? <strong> {error.digest}</strong> : " exibido no registro de erros"}.
      </Alert>
      <Button variante="primaria" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  );
}
