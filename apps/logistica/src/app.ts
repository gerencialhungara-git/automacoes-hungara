import { randomUUID } from "node:crypto";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { chaveValida, PedidoLogistica, type EventoJobLogistica, type Job } from "@automacoes/shared";
import { Hono } from "hono";
import { env } from "./env.js";
import { carregar, jobNovo, salvar } from "./job.js";
import { urlTemporaria, VALIDADE_URL_S } from "./s3.js";

const lambda = new LambdaClient({});

const naoAutorizado = { error: { code: "API_KEY_INVALIDA", message: "Chave de API inválida" } };

export function criarApp() {
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true, version: env().APP_VERSION }));

  // A chave é conferida antes de qualquer outra coisa: pedido sem chave custa ~1 ms.
  app.use("/jobs/*", async (c, next) => {
    if (!chaveValida(c.req.header("x-api-key"), env().API_KEYS_SHA256)) {
      return c.json(naoAutorizado, 401);
    }
    await next();
  });

  app.post("/", async (c) => {
    if (!chaveValida(c.req.header("x-api-key"), env().API_KEYS_SHA256)) {
      return c.json(naoAutorizado, 401);
    }

    const corpo = await c.req.json().catch(() => ({}));
    const pedido = PedidoLogistica.safeParse(corpo);
    if (!pedido.success) {
      return c.json(
        { error: { code: "PEDIDO_INVALIDO", message: "Período inválido", issues: pedido.error.issues } },
        400,
      );
    }

    const { inicio, fim } = pedido.data;
    const job = jobNovo(randomUUID(), inicio, fim);
    await salvar(job);

    // Invoca a si mesma de forma assíncrona e responde na hora. O crawl leva ~45 s
    // frio, e quem chama (o Hub) está atrás de um API Gateway com teto de 30 s —
    // então esperar aqui não é opção.
    const evento: EventoJobLogistica = { source: "logistica.job", jobId: job.jobId, inicio, fim };
    await lambda.send(
      new InvokeCommand({
        FunctionName: env().AWS_LAMBDA_FUNCTION_NAME,
        InvocationType: "Event",
        Payload: Buffer.from(JSON.stringify(evento)),
      }),
    );

    return c.json({ job: semUrl(job), consultarEm: `/jobs/${job.jobId}` }, 202);
  });

  app.get("/jobs/:jobId", async (c) => {
    const job = await carregar(c.req.param("jobId"));
    if (job === undefined) {
      return c.json({ error: { code: "JOB_NAO_ENCONTRADO", message: "Job não existe" } }, 404);
    }
    if (job.status === "concluido" && job.arquivo !== null) {
      return c.json({
        job: {
          ...job,
          arquivo: {
            ...job.arquivo,
            url: await urlTemporaria(job.arquivo.chave, job.arquivo.nome),
            expiraEmSegundos: VALIDADE_URL_S,
          },
        },
      });
    }
    return c.json({ job });
  });

  app.onError((erro, c) => {
    console.error("erro_nao_tratado", erro);
    return c.json({ error: { code: "FALHA_NA_ROTINA", message: erro.message } }, 500);
  });

  return app;
}

/** O job recém-criado não tem arquivo, então não há URL para assinar. */
const semUrl = (job: Job) => job;
