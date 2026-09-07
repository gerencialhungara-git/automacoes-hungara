import { z } from "zod";

/** Data no formato ISO curto, do jeito que o usuário digita: 2026-09-01. */
const DataIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "use o formato AAAA-MM-DD");

/**
 * O que se pede ao crawler. `relatorio` é o apelido interno da tela do Sischef.
 * Hoje só existe um: "pedidos-de-venda", que alimenta a rotina diária de Logística.
 * Outras telas entram como novos valores, cada uma com seu fluxo.
 */
export const PedidoRelatorio = z
  .object({
    inicio: DataIso,
    fim: DataIso,
    relatorio: z.string().min(1).default("pedidos-de-venda"),
  })
  .refine((p) => p.inicio <= p.fim, {
    message: "a data de início não pode ser depois da data de fim",
    path: ["inicio"],
  });

export type PedidoRelatorio = z.infer<typeof PedidoRelatorio>;

export const ArquivoBaixado = z.object({
  /** Caminho dentro do bucket, ex.: relatorios/2026-09-06/vendas.xlsx */
  chave: z.string(),
  /** URL temporária (15 min) para baixar o arquivo original. */
  url: z.string().url(),
  formato: z.string(),
  bytes: z.number().int().nonnegative(),
});

export type ArquivoBaixado = z.infer<typeof ArquivoBaixado>;

export const RespostaRelatorio = z.object({
  relatorio: z.string(),
  inicio: DataIso,
  fim: DataIso,
  /** Linhas já parseadas. `null` quando o JSON é grande demais para a resposta. */
  dados: z.array(z.record(z.string(), z.unknown())).nullable(),
  /** Preenchido no lugar de `dados` quando o JSON passa do limite da resposta. */
  dadosUrl: z.string().url().optional(),
  arquivo: ArquivoBaixado,
  duracaoMs: z.number().int().nonnegative(),
});

export type RespostaRelatorio = z.infer<typeof RespostaRelatorio>;

/**
 * Uma linha do relatório "Pedidos de venda" já parseada: número é número, data é ISO,
 * vazio é null. As chaves são os nomes originais das 26 colunas do Sischef (ver
 * ADR-0004) — quem consome espera `ID Pedido`, `Qtde`, `COMPOSICAO` e companhia.
 *
 * Vive aqui, e não no pacote do crawler, porque é contrato entre rotinas: a Logística
 * consome isto sem precisar saber que existe um navegador do outro lado.
 */
export type Linha = Record<string, string | number | null>;
