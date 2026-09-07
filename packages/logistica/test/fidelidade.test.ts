import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parsearPedidosDeVenda } from "@automacoes/sischef";
import { gerarLogistica } from "../src/gerarLogistica.js";

/**
 * O teste que diz se o porte está correto.
 *
 * Compara a planilha gerada pelo TypeScript com a que o `gerar_logistica.py` produziu
 * de verdade, célula por célula, incluindo as fórmulas.
 *
 * Só entram os dias gerados com a config ATUAL — de 14/08 em diante, quando as 4 linhas
 * de catupiry entraram e os 2 SKUs de Peito de Peru saíram. Comparar dias anteriores
 * daria diferença estrutural legítima, não erro de porte.
 *
 * Os arquivos são dados de cliente e NÃO ficam no repositório: os testes se pulam
 * sozinhos onde a pasta não existe (CI incluído).
 */
const PASTA =
  process.env.LOGISTICA_DIR ??
  "/Users/matheuserthal/Desktop/hungara/HUNGARA LANCHES - CLAUDE - NANDO/ANALISES/Logística Diária";

const DIAS = ["20260814", "20260817", "20260826", "20260827", "20260831"];

/** macOS guarda nome de arquivo em NFD, então "logística" não casa direto. */
const arquivos = () =>
  existsSync(PASTA) ? readdirSync(PASTA).map((f) => ({ bruto: f, nfc: f.normalize("NFC") })) : [];

function entrada(dia: string): string | undefined {
  const ddmmyyyy = `${dia.slice(6, 8)}${dia.slice(4, 6)}${dia.slice(0, 4)}`;
  for (const nome of [`pedidos_de_venda_${dia}.xlsx`, `pedidos_de_venda_${ddmmyyyy}.xlsx`]) {
    const achado = arquivos().find((f) => f.nfc === nome);
    if (achado) return join(PASTA, achado.bruto);
  }
  return undefined;
}

function referencia(dia: string): string | undefined {
  const achado = arquivos().find((f) => f.nfc === `logística-${dia}.xlsx`);
  return achado ? join(PASTA, achado.bruto) : undefined;
}

/** Uma representação comparável de cada célula: fórmula ou valor, mais a geometria. */
async function ler(fonte: Buffer | string) {
  const wb = new ExcelJS.Workbook();
  if (typeof fonte === "string") await wb.xlsx.readFile(fonte);
  else await wb.xlsx.load(fonte as unknown as ArrayBuffer);
  const ws = wb.worksheets[0]!;

  const celulas = new Map<string, string>();
  ws.eachRow({ includeEmpty: true }, (row, r) => {
    row.eachCell({ includeEmpty: true }, (cell, c) => {
      const v = cell.value;
      let texto: string;
      if (v === null || v === undefined) texto = "";
      else if (typeof v === "object" && "formula" in v) texto = `=${(v as { formula: string }).formula}`;
      else if (typeof v === "object" && "richText" in v)
        texto = (v as { richText: { text: string }[] }).richText.map((p) => p.text).join("");
      else texto = String(v);
      if (texto !== "") celulas.set(`${r},${c}`, texto);
    });
  });

  return { nome: ws.name, linhas: ws.rowCount, colunas: ws.columnCount, celulas };
}

const iso = (dia: string) => `${dia.slice(0, 4)}-${dia.slice(4, 6)}-${dia.slice(6, 8)}`;

describe.each(DIAS)("dia %s", (dia) => {
  const caminhoEntrada = entrada(dia);
  const caminhoReferencia = referencia(dia);
  const temTudo = caminhoEntrada !== undefined && caminhoReferencia !== undefined;

  it.skipIf(!temTudo)("reproduz a planilha do Python célula por célula", async () => {
    const linhas = parsearPedidosDeVenda(readFileSync(caminhoEntrada!));
    const r = await gerarLogistica({ linhas, inicio: iso(dia), fim: iso(dia) });

    const nossa = await ler(r.arquivo.conteudo);
    const python = await ler(caminhoReferencia!);

    expect(nossa.nome).toBe(python.nome);
    expect({ linhas: nossa.linhas, colunas: nossa.colunas }).toEqual({
      linhas: python.linhas,
      colunas: python.colunas,
    });

    // Diferença por diferença, para o relatório de falha dizer QUAL célula divergiu.
    const chaves = [...new Set([...nossa.celulas.keys(), ...python.celulas.keys()])].sort();
    const diffs = chaves
      .filter((k) => nossa.celulas.get(k) !== python.celulas.get(k))
      .map((k) => ({
        celula: k,
        python: python.celulas.get(k) ?? "(vazia)",
        nossa: nossa.celulas.get(k) ?? "(vazia)",
      }));
    expect(diffs).toEqual([]);
  });
});
