import type { Page } from "playwright";
import { seletores } from "../seletores.js";

export interface ArquivoBruto {
  nome: string;
  conteudo: Buffer;
}

/**
 * Manda gerar e baixa o arquivo.
 *
 * São dois passos no Sischef: "Gerar arquivo" monta o export no servidor e faz
 * aparecer um link; só então o clique no link dispara o download de verdade.
 * A geração pode demorar em períodos longos, daí o timeout separado.
 */
export async function baixar(page: Page, timeoutGerarMs = 180_000): Promise<ArquivoBruto> {
  const s = seletores.pedidosDeVenda;

  await page.getByRole(s.gerar.role, { name: s.gerar.name }).click();

  const link = page.getByRole(s.baixar.role, { name: s.baixar.name });
  await link.waitFor({ state: "visible", timeout: timeoutGerarMs });

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: timeoutGerarMs }),
    link.click(),
  ]);

  const caminho = await download.path();
  if (!caminho) throw new Error("O download não produziu arquivo");

  const { readFile } = await import("node:fs/promises");
  return { nome: download.suggestedFilename(), conteudo: await readFile(caminho) };
}
