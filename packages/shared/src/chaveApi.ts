import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Confere a chave de API de uma rotina.
 *
 * A configuração da Lambda guarda apenas o **SHA-256** das chaves aceitas: quem
 * conseguir ler as variáveis de ambiente (console da AWS, `lambda:GetFunctionConfiguration`)
 * não consegue chamar a API com o que leu.
 *
 * Aceitar várias chaves ao mesmo tempo é o que permite rodar a chave nova antes de
 * aposentar a velha, sem janela de indisponibilidade.
 *
 * `timingSafeEqual` em vez de `===` para a comparação não vazar, pelo tempo de
 * resposta, quantos bytes iniciais o atacante acertou.
 *
 * @param enviada  valor do header `x-api-key`
 * @param hashesCsv SHA-256 em hexadecimal, separados por vírgula
 */
export function chaveValida(enviada: string | undefined, hashesCsv: string): boolean {
  if (enviada === undefined || enviada === "") return false;
  const hash = createHash("sha256").update(enviada).digest();
  return hashesCsv
    .split(",")
    .map((h) => Buffer.from(h.trim(), "hex"))
    .some((aceito) => aceito.length === hash.length && timingSafeEqual(aceito, hash));
}
