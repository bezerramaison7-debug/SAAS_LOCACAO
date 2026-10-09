import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { type ReactNode } from "react";

import { type TomEstado } from "./badge";
import { cn } from "./cn";

const estilos: Record<Exclude<TomEstado, "neutro">, { classe: string; Icone: typeof Info }> = {
  info: { classe: "border-info bg-info-suave", Icone: Info },
  sucesso: { classe: "border-sucesso bg-sucesso-suave", Icone: CheckCircle2 },
  alerta: { classe: "border-alerta bg-alerta-suave", Icone: AlertTriangle },
  perigo: { classe: "border-perigo bg-perigo-suave", Icone: XCircle },
};

type AlertProps = {
  tom?: Exclude<TomEstado, "neutro">;
  titulo: string;
  children?: ReactNode;
  className?: string;
};

/** Mensagem contextual. Erros usam role="alert" (anunciados imediatamente). */
export function Alert({ tom = "info", titulo, children, className }: AlertProps) {
  const { classe, Icone } = estilos[tom];
  return (
    <div
      role={tom === "perigo" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-md border-l-4 p-4 text-texto", classe, className)}
    >
      <Icone aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="space-y-1">
        <p className="font-semibold">{titulo}</p>
        {children ? <div className="text-texto-suave">{children}</div> : null}
      </div>
    </div>
  );
}
