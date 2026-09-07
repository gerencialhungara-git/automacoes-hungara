import { z } from "zod";

const DataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use o formato AAAA-MM-DD");

export const PedidoLogistica = z
  .object({ inicio: DataIso, fim: DataIso })
  .refine((p) => p.inicio <= p.fim, {
    message: "a data de início não pode ser depois da data de fim",
    path: ["inicio"],
  });
export type PedidoLogistica = z.infer<typeof PedidoLogistica>;

export const STATUS_JOB = ["na_fila", "executando", "concluido", "erro"] as const;
export type StatusJob = (typeof STATUS_JOB)[number];

/**
 * Etapas na ordem em que acontecem. A tela mostra isso enquanto espera, para o usuário
 * ver que algo está andando em vez de encarar um spinner cego por um minuto.
 */
export const ETAPAS = ["baixando-relatorio", "processando", "gerando-planilha"] as const;
export type Etapa = (typeof ETAPAS)[number];

export const AvisoJob = z.object({
  codigo: z.enum(["ORFAOS", "RETIRADAS", "SEM_LINHAS"]),
  mensagem: z.string(),
});
export type AvisoJob = z.infer<typeof AvisoJob>;

export const Job = z.object({
  jobId: z.string(),
  status: z.enum(STATUS_JOB),
  etapa: z.enum(ETAPAS).nullable(),
  inicio: DataIso,
  fim: DataIso,
  criadoEm: z.string(),
  atualizadoEm: z.string(),
  /** Linhas do relatório que sobraram depois dos filtros. */
  linhas: z.number().int().nullable(),
  colunas: z.number().int().nullable(),
  avisos: z.array(AvisoJob),
  arquivo: z
    .object({
      nome: z.string(),
      chave: z.string(),
      bytes: z.number().int(),
      /** URL temporária; **não** é guardada no job, é assinada a cada leitura. */
      url: z.string().url().optional(),
      expiraEmSegundos: z.number().int().optional(),
    })
    .nullable(),
  erro: z.object({ codigo: z.string(), mensagem: z.string() }).nullable(),
  duracaoMs: z.number().int().nullable(),
});
export type Job = z.infer<typeof Job>;

/** O evento que a Lambda manda para si mesma para trabalhar fora da requisição HTTP. */
export interface EventoJobLogistica {
  source: "logistica.job";
  jobId: string;
  inicio: string;
  fim: string;
}
