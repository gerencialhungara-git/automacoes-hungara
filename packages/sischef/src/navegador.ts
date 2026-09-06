import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

export interface Navegador {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  fechar: () => Promise<void>;
}

/**
 * Abre o Chromium. Mesma chamada local e na Lambda: lá o browser vem da imagem
 * do Playwright, achado por PLAYWRIGHT_BROWSERS_PATH.
 */
export async function abrirNavegador(opcoes: { visivel?: boolean } = {}): Promise<Navegador> {
  const browser = await chromium.launch({
    headless: !opcoes.visivel,
    // Obrigatórios na Lambda (sem /dev/shm de tamanho decente, sem sandbox de kernel).
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  const context = await browser.newContext({
    acceptDownloads: true,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1440, height: 900 },
    // O Sischef registra um service worker que atrapalha a automação.
    serviceWorkers: "block",
  });
  context.setDefaultTimeout(30_000);
  const page = await context.newPage();

  return {
    browser,
    context,
    page,
    fechar: async () => {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    },
  };
}
