import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "./env.js";

/**
 * Guardamos só o SHA-256 das chaves na configuração da Lambda: quem conseguir
 * ler as variáveis de ambiente (console da AWS, `lambda:GetFunctionConfiguration`)
 * não consegue chamar a API com o que leu.
 *
 * Aceitar várias chaves ao mesmo tempo é o que permite rodar a chave nova antes
 * de aposentar a velha, sem janela de indisponibilidade.
 */
export function chaveValida(enviada: string | undefined): boolean {
  if (!enviada) return false;
  const hash = createHash("sha256").update(enviada).digest();
  return env()
    .API_KEYS_SHA256.split(",")
    .map((h) => Buffer.from(h.trim(), "hex"))
    .some((aceito) => aceito.length === hash.length && timingSafeEqual(aceito, hash));
}
