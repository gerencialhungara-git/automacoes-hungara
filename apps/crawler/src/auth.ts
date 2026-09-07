import { chaveValida as conferir } from "@automacoes/shared";
import { env } from "./env.js";

/**
 * Confere a chave de API do crawler. A lógica vive em `@automacoes/shared` para haver
 * UMA implementação da comparação de credencial no monorepo — duas divergiriam.
 */
export function chaveValida(enviada: string | undefined): boolean {
  return conferir(enviada, env().API_KEYS_SHA256);
}
