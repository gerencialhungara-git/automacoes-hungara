import type { Locator, Page } from "playwright";
import { seletores } from "../seletores.js";
import { isoParaBr } from "../datas.js";

/**
 * Preenche início e fim digitando no campo, em vez de clicar no calendário.
 *
 * A gravação clicou nos dias porque foi assim que o percurso foi feito na mão,
 * mas o que vai no POST é o <input> (`data1_input` = "06/09/2026"). Digitar é o
 * que permite qualquer intervalo sem navegar mês a mês.
 */
export async function preencherPeriodo(page: Page, inicio: string, fim: string): Promise<void> {
  const s = seletores.pedidosDeVenda;
  await digitarData(page, page.locator(s.dataInicio).first(), isoParaBr(inicio));
  await digitarData(page, page.locator(s.dataFim).first(), isoParaBr(fim));
}

/**
 * O campo é um PrimeFaces Calendar (jQuery UI por baixo), e ele é chato:
 *  - `Escape` NÃO fecha o calendário, ele CANCELA e devolve o campo ao valor
 *    anterior — foi o que apagava a data aqui;
 *  - `fill()` sozinho às vezes não convence o widget, que reescreve o campo no
 *    blur a partir do estado interno dele.
 * Então: digita de verdade, sai com Tab (que confirma), e só se ainda assim o
 * campo estiver vazio força o valor por JS. O que vai no POST é o value do
 * input, então o caminho forçado também é válido.
 */
async function digitarData(page: Page, campo: Locator, valorBr: string): Promise<void> {
  await campo.click();
  await campo.fill("");
  await campo.pressSequentially(valorBr, { delay: 30 });
  await campo.press("Tab");

  if ((await campo.inputValue()) !== valorBr) {
    await campo.evaluate((el, valor) => {
      const input = el as HTMLInputElement;
      input.value = valor;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, valorBr);
  }

  const gravado = await campo.inputValue();
  if (gravado !== valorBr) {
    throw new Error(`O campo de data não aceitou "${valorBr}" (ficou "${gravado}")`);
  }
}
