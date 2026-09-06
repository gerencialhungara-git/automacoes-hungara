import { read, utils } from "@e965/xlsx";
import { brParaIso, brParaNumero } from "../datas.js";

export type Linha = Record<string, string | number | null>;

/**
 * Colunas do "Pedidos de venda" que não são texto.
 * O Sischef exporta número como texto pt-BR ("8,00") e data como "dd/MM/aaaa HH:mm:ss";
 * quem consome (a rotina de Logística) espera número e data de verdade.
 */
const NUMERICAS = new Set(["Qtde", "Unitario", "Desconto", "Total"]);
const INTEIRAS = new Set([
  "ID Pedido", "ID Produto", "ID Pessoa", "ID Garçom", "ID Caixa", "Num pessoas", "Cod. Barras",
]);
const DATAS = new Set(["Data pedido", "Data lancamento item"]);

/**
 * Lê o arquivo baixado. O Sischef alterna entre .xls (BIFF antigo) e .xlsx sem
 * avisar, então a decisão é pelo conteúdo, não pela extensão — e a biblioteca
 * (SheetJS) lê os dois do mesmo jeito.
 */
export function parsearPedidosDeVenda(conteudo: Buffer): Linha[] {
  const wb = read(conteudo, { type: "buffer", cellDates: false, raw: true });
  const nomeAba = wb.SheetNames[0];
  if (!nomeAba) throw new Error("A planilha não tem nenhuma aba");
  const aba = wb.Sheets[nomeAba];
  if (!aba) throw new Error(`Aba "${nomeAba}" não encontrada`);

  // `raw: true` é obrigatório: no .xls os IDs são célula NUMÉRICA, e a formatação
  // do SheetJS os devolveria como "159,351,578" (separador de milhar americano),
  // que o parser pt-BR leria errado. Com raw, número vem número e só o texto
  // (Qtde, Total, datas) precisa de conversão.
  const cru = utils.sheet_to_json<Record<string, unknown>>(aba, { defval: "", raw: true });

  return cru.map((linha) => {
    const saida: Linha = {};
    for (const [coluna, valor] of Object.entries(linha)) {
      const nome = coluna.trim();
      if (INTEIRAS.has(nome)) {
        const n = brParaNumero(valor);
        saida[nome] = n === null ? null : Math.trunc(n);
      } else if (NUMERICAS.has(nome)) {
        saida[nome] = brParaNumero(valor);
      } else if (DATAS.has(nome)) {
        const s = String(valor ?? "").trim();
        saida[nome] = s === "" ? null : brParaIso(s);
      } else {
        const s = String(valor ?? "").trim();
        saida[nome] = s === "" ? null : s;
      }
    }
    return saida;
  });
}

/** Colunas que a rotina de Logística (`gerar_logistica.py`) exige. */
const OBRIGATORIAS = [
  "ID Pedido", "ID Produto", "Produto", "ID Pessoa", "Grupo", "COMPOSICAO", "Qtde",
];

/** Colunas que nunca podem vir vazias — se vierem, foi erro de leitura, não dado. */
const NAO_PODEM_SER_NULAS = ["ID Pedido", "ID Produto", "ID Pessoa", "Qtde"];

/**
 * Confere se o layout ainda é o esperado. Devolver dado errado calado é pior do
 * que falhar: a saída daqui vira ordem de produção do dia seguinte.
 */
export function validarLayout(linhas: Linha[]): void {
  if (linhas.length === 0) throw new Error("RELATORIO_VAZIO: o período não devolveu nenhuma linha");
  const primeira = linhas[0]!;
  const faltando = OBRIGATORIAS.filter((c) => !(c in primeira));
  if (faltando.length > 0) {
    throw new Error(
      `LAYOUT_MUDOU: faltam as colunas [${faltando.join(", ")}]. ` +
        `Vieram: [${Object.keys(primeira).join(", ")}]`,
    );
  }

  // Coluna presente mas toda nula = a conversão de tipo quebrou (já aconteceu com
  // os IDs do .xls). Falhar alto aqui evita mandar ordem de produção furada.
  for (const coluna of NAO_PODEM_SER_NULAS) {
    const nulas = linhas.filter((l) => l[coluna] === null).length;
    if (nulas > linhas.length * 0.05) {
      throw new Error(
        `LEITURA_SUSPEITA: "${coluna}" veio vazia em ${nulas}/${linhas.length} linhas`,
      );
    }
  }
}
