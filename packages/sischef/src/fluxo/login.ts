import type { Page } from "playwright";
import { seletores, urls } from "../seletores.js";

export interface Credenciais {
  usuario: string;
  senha: string;
}

/** Entra no Sischef. Termina quando o menu de Relatórios já está na tela. */
export async function login(page: Page, credenciais: Credenciais): Promise<void> {
  const s = seletores.login;
  await page.goto(urls.base, { waitUntil: "domcontentloaded" });

  await page.getByRole(s.usuario.role, { name: s.usuario.name }).fill(credenciais.usuario);
  await page.getByRole(s.senha.role, { name: s.senha.name }).fill(credenciais.senha);
  await page.getByRole(s.entrar.role, { name: s.entrar.name }).click();

  // O login é um POST com redirect; esperamos a marca de "já estou dentro".
  await page.locator(s.marcaLogado).first().waitFor({ state: "visible", timeout: 45_000 });
}

/** Sonda barata: diz se a sessão atual ainda vale, sem tentar logar de novo. */
export async function sessaoValida(page: Page): Promise<boolean> {
  await page.goto(urls.exportacao, { waitUntil: "domcontentloaded" });
  return page
    .locator(seletores.pedidosDeVenda.dataInicio)
    .first()
    .isVisible({ timeout: 5_000 })
    .catch(() => false);
}
