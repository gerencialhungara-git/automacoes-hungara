import type { Job, StatusJob, Etapa, AvisoJob } from "@automacoes/shared";
import { chaveJob, guardarJson, lerJson } from "./s3.js";

export function jobNovo(jobId: string, inicio: string, fim: string): Job {
  const agora = new Date().toISOString();
  return {
    jobId,
    status: "na_fila",
    etapa: null,
    inicio,
    fim,
    criadoEm: agora,
    atualizadoEm: agora,
    linhas: null,
    colunas: null,
    avisos: [],
    arquivo: null,
    erro: null,
    duracaoMs: null,
  };
}

export const salvar = (job: Job) => guardarJson(chaveJob(job.jobId), job);
export const carregar = (jobId: string) => lerJson<Job>(chaveJob(jobId));

export async function marcar(
  job: Job,
  mudanca: Partial<Pick<Job, "status" | "etapa" | "linhas" | "colunas" | "avisos" | "arquivo" | "erro" | "duracaoMs">>,
): Promise<Job> {
  const atualizado: Job = { ...job, ...mudanca, atualizadoEm: new Date().toISOString() };
  await salvar(atualizado);
  return atualizado;
}

export type { Job, StatusJob, Etapa, AvisoJob };
