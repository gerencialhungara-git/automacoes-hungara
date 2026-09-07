import { gerarLogistica } from "@automacoes/logistica";
import type { EventoJobLogistica } from "@automacoes/shared";
import { baixarRelatorio } from "./crawler.js";
import { carregar, marcar } from "./job.js";
import { chavePlanilha, guardarPlanilha } from "./s3.js";

/**
 * O trabalho de verdade, rodando na invocação assíncrona — fora de qualquer conexão
 * HTTP, então pode levar o tempo que precisar.
 *
 * Cada etapa é gravada no job antes de começar, para a tela do Hub mostrar onde está
 * em vez de um spinner cego por um minuto.
 */
export async function executarJob(evento: EventoJobLogistica): Promise<void> {
  const comecou = Date.now();
  let job = await carregar(evento.jobId);
  if (job === undefined) {
    console.error(JSON.stringify({ evento: "job_inexistente", jobId: evento.jobId }));
    return;
  }

  try {
    job = await marcar(job, { status: "executando", etapa: "baixando-relatorio" });
    const linhas = await baixarRelatorio(evento.inicio, evento.fim);

    job = await marcar(job, { etapa: "processando" });
    const r = await gerarLogistica({ linhas, inicio: evento.inicio, fim: evento.fim });

    job = await marcar(job, { etapa: "gerando-planilha" });
    const chave = chavePlanilha(evento.jobId, r.arquivo.nome);
    await guardarPlanilha(chave, r.arquivo.conteudo);

    await marcar(job, {
      status: "concluido",
      etapa: null,
      linhas: r.linhasUsadas,
      colunas: r.colunas,
      avisos: r.avisos,
      arquivo: { nome: r.arquivo.nome, chave, bytes: r.arquivo.bytes },
      duracaoMs: Date.now() - comecou,
    });
    console.log(
      JSON.stringify({
        evento: "job_concluido",
        jobId: evento.jobId,
        linhas: r.linhasUsadas,
        colunas: r.colunas,
        avisos: r.avisos.length,
        duracaoMs: Date.now() - comecou,
      }),
    );
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    console.error(JSON.stringify({ evento: "job_falhou", jobId: evento.jobId, mensagem }));
    // A falha vai para o job, não só para o log: quem está na tela precisa saber.
    await marcar(job, {
      status: "erro",
      etapa: null,
      erro: { codigo: "FALHA_NA_ROTINA", mensagem },
      duracaoMs: Date.now() - comecou,
    });
  }
}
