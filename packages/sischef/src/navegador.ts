import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

export interface Navegador {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  fechar: () => Promise<void>;
}

/**
 * Argumentos do Chromium para rodar dentro da Lambda.
 *
 * `--no-sandbox` sozinho NÃO basta: o processo "zygote" do Chromium tenta criar
 * user namespaces antes, e a Lambda não permite (CLONE_NEWUSER). O sintoma é
 * `FATAL sandbox/linux/services/credentials.cc: Operation not permitted`, seguido
 * de SEGV e de um "Assertion error" no Playwright, que parece erro de código e
 * não é. `--no-zygote` é o que resolve.
 *
 * Localmente esses argumentos são inofensivos, então usamos os mesmos nos dois
 * lugares — o objetivo do projeto é que o que roda na nuvem seja o que se testa
 * na máquina.
 */
const ARGS_PADRAO = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--no-zygote",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-software-rasterizer",
];

/**
 * Abre o Chromium. Mesma chamada local e na Lambda: lá o browser vem da imagem
 * do Playwright, achado por PLAYWRIGHT_BROWSERS_PATH.
 *
 * `CHROMIUM_ARGS` (separado por vírgula) acrescenta argumentos sem reconstruir a
 * imagem — vale ouro quando é preciso testar uma flag direto na Lambda, onde um
 * ciclo de deploy custa minutos.
 */
export async function abrirNavegador(opcoes: { visivel?: boolean } = {}): Promise<Navegador> {
  const extras = (process.env.CHROMIUM_ARGS ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  const browser = await chromium.launch({
    headless: !opcoes.visivel,
    args: [...ARGS_PADRAO, ...extras],
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
