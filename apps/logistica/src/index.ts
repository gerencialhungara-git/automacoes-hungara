import type { EventoJobLogistica } from "@automacoes/shared";
import { handle } from "hono/aws-lambda";
import { criarApp } from "./app.js";
import { executarJob } from "./executar.js";

const honoHandler = handle(criarApp());

/**
 * A mesma Lambda atende dois tipos de evento: a requisição HTTP do Function URL e o
 * evento que ela mandou para si mesma para fazer o trabalho pesado. O `source`
 * distingue — mesmo padrão do `hub.keepalive` na API do Hub.
 */
export const handler = async (evento: unknown, contexto: unknown) => {
  if ((evento as EventoJobLogistica)?.source === "logistica.job") {
    await executarJob(evento as EventoJobLogistica);
    return { ok: true };
  }
  return honoHandler(evento as never, contexto as never);
};
