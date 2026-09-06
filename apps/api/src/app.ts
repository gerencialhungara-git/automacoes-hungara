import { Hono } from "hono";
import { PedidoRelatorio } from "@crawler/shared";
import { baixarRelatorio } from "@crawler/sischef";
import { chaveValida } from "./auth.js";
import { env } from "./env.js";
import { guardar, urlTemporaria, validadeUrlSegundos } from "./s3.js";

/** Acima disso o JSON não cabe na resposta do Function URL (limite de 6 MB). */
const LIMITE_JSON_BYTES = 4 * 1024 * 1024;

export function criarApp() {
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true, version: env().APP_VERSION }));

  app.post("/", async (c) => {
    // A chave é conferida antes de qualquer outra coisa: pedido sem chave custa
    // ~1 ms e nunca chega a abrir navegador.
    if (!chaveValida(c.req.header("x-api-key"))) {
      return c.json({ error: { code: "API_KEY_INVALIDA", message: "Chave de API inválida" } }, 401);
    }

    const corpo = await c.req.json().catch(() => ({}));
    const pedido = PedidoRelatorio.safeParse(corpo);
    if (!pedido.success) {
      return c.json(
        {
          error: {
            code: "PEDIDO_INVALIDO",
            message: "Período inválido",
            issues: pedido.error.issues,
          },
        },
        400,
      );
    }

    const { inicio, fim } = pedido.data;
    const resultado = await baixarRelatorio({
      inicio,
      fim,
      credenciais: { usuario: env().SISCHEF_USUARIO, senha: env().SISCHEF_SENHA },
      aoAndar: (etapa) => console.log(JSON.stringify({ etapa, inicio, fim })),
    });

    const prefixo = `relatorios/pedidos-de-venda/${inicio}_a_${fim}/${Date.now()}`;
    const chaveArquivo = `${prefixo}/${resultado.arquivo.nome}`;
    await guardar(chaveArquivo, resultado.arquivo.conteudo, "application/vnd.ms-excel");

    const json = JSON.stringify(resultado.linhas);
    const grandeDemais = Buffer.byteLength(json) > LIMITE_JSON_BYTES;
    let dadosUrl: string | undefined;
    if (grandeDemais) {
      const chaveJson = `${prefixo}/dados.json`;
      await guardar(chaveJson, json, "application/json");
      dadosUrl = await urlTemporaria(chaveJson);
    }

    return c.json({
      relatorio: "pedidos-de-venda",
      inicio,
      fim,
      linhas: resultado.linhas.length,
      // Períodos longos passam do limite da resposta e viram um arquivo no S3.
      dados: grandeDemais ? null : resultado.linhas,
      dadosUrl,
      arquivo: {
        chave: chaveArquivo,
        url: await urlTemporaria(chaveArquivo),
        expiraEmSegundos: validadeUrlSegundos,
        formato: resultado.arquivo.nome.split(".").pop() ?? "xls",
        bytes: resultado.arquivo.bytes,
      },
      duracaoMs: resultado.duracaoMs,
    });
  });

  app.onError((erro, c) => {
    console.error("erro_nao_tratado", erro);
    return c.json(
      { error: { code: "FALHA_NO_CRAWLER", message: erro.message } },
      500,
    );
  });

  return app;
}
