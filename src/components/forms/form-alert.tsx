import { Alert } from "@/components/ui/alert";
import { type EstadoAcao } from "@/lib/actions/estado";

/** Mensagem geral do resultado de uma Server Action. */
export function FormAlert({ estado }: { estado: EstadoAcao }) {
  if (estado.status === "ocioso" || !estado.mensagem) return null;
  return <Alert tom={estado.status === "erro" ? "perigo" : "sucesso"} titulo={estado.mensagem} />;
}
