import type { Page } from "playwright";
import { seletores, urls } from "../seletores.js";

/**
 * Chega na tela "Pedidos de venda".
 *
 * A URL de exportação já abre na aba "Excel", mas os relatórios ficam num
 * acordeão com os grupos FECHADOS (Outros, Gestão, Financeiros, Fiscais,
 * Vendas, …). Enquanto "Vendas" não for expandido, o link "Pedidos de venda"
 * nem existe no DOM — daí o clique no grupo antes do clique no relatório.
 */
export async function abrirRelatorio(page: Page): Promise<void> {
  const s = seletores.pedidosDeVenda;

  await page.goto(urls.exportacao, { waitUntil: "domcontentloaded" });

  const grupo = page.getByRole(s.grupoVendas.role, { name: s.grupoVendas.name, exact: true }).first();
  const abriuDireto = await grupo
    .waitFor({ state: "visible", timeout: 15_000 })
    .then(() => true)
    .catch(() => false);

  if (!abriuDireto) {
    // A URL direta não montou a aba Excel: refaz o caminho pelo menu lateral.
    await page.locator(s.menuRelatorios).click();
    await page.getByRole(s.submenuExcel.role, { name: s.submenuExcel.name }).click();
    await grupo.waitFor({ state: "visible", timeout: 20_000 });
  }

  await grupo.click();

  const relatorio = page.getByRole(s.relatorio.role, { name: s.relatorio.name, exact: true });
  await relatorio.waitFor({ state: "visible", timeout: 20_000 });
  await relatorio.click();

  // O clique dispara um POST parcial do JSF que monta o formulário de datas.
  await page.locator(s.dataInicio).first().waitFor({ state: "visible", timeout: 30_000 });
}
