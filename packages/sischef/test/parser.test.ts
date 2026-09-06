import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parsearPedidosDeVenda, validarLayout } from "../src/parsers/index.js";
import { brParaIso, brParaNumero, isoParaBr } from "../src/datas.js";

/**
 * Os arquivos reais NÃO ficam no repositório: são dados de cliente (nome de loja,
 * CEP, faturamento). Os testes que dependem deles rodam na máquina de quem tem a
 * pasta da Logística e são pulados em qualquer outro lugar, inclusive no CI.
 */
const PASTA =
  process.env.PEDIDOS_DIR ??
  "/Users/matheuserthal/Desktop/hungara/HUNGARA LANCHES - CLAUDE - NANDO/ANALISES/Logística Diária";

const AMOSTRAS = [
  { arquivo: "pedidos_de_venda_26082026.xls", formato: "xls (BIFF)" },
  { arquivo: "pedidos_de_venda_31082026.xlsx", formato: "xlsx" },
];

describe("conversões pt-BR", () => {
  it("converte data ISO para o formato do Sischef", () => {
    expect(isoParaBr("2026-09-01")).toBe("01/09/2026");
  });

  it("converte data e data-hora do Sischef para ISO", () => {
    expect(brParaIso("31/08/2026")).toBe("2026-08-31");
    expect(brParaIso("31/08/2026 15:17:05")).toBe("2026-08-31T15:17:05");
  });

  it("lê número em pt-BR e recusa o que não dá para ler", () => {
    expect(brParaNumero("8,00")).toBe(8);
    expect(brParaNumero("1.234,56")).toBe(1234.56);
    expect(brParaNumero(245.75)).toBe(245.75);
    expect(brParaNumero("")).toBeNull();
    expect(brParaNumero("-")).toBeNull();
    // Separador de milhar americano é ambíguo: melhor null do que número errado.
    expect(brParaNumero("159,351,578")).toBeNull();
  });
});

describe.each(AMOSTRAS)("Pedidos de venda em $formato", ({ arquivo }) => {
  const caminho = `${PASTA}/${arquivo}`;
  const temArquivo = existsSync(caminho);

  it.skipIf(!temArquivo)("lê o arquivo com o layout esperado", () => {
    const linhas = parsearPedidosDeVenda(readFileSync(caminho));
    expect(() => validarLayout(linhas)).not.toThrow();
    expect(linhas.length).toBeGreaterThan(0);
    expect(Object.keys(linhas[0]!)).toHaveLength(26);
  });

  it.skipIf(!temArquivo)("devolve ID como número, não como texto formatado", () => {
    // Regressão: no .xls o SheetJS formatava o ID como "159,351,578" e o parser
    // pt-BR devolvia null. Os IDs precisam ser inteiros nos dois formatos.
    const linhas = parsearPedidosDeVenda(readFileSync(caminho));
    for (const coluna of ["ID Pedido", "ID Produto", "ID Pessoa"]) {
      const valores = linhas.map((l) => l[coluna]);
      expect(valores.every((v) => typeof v === "number" && Number.isInteger(v))).toBe(true);
    }
  });

  it.skipIf(!temArquivo)("converte quantidade e data", () => {
    const linhas = parsearPedidosDeVenda(readFileSync(caminho));
    expect(linhas.every((l) => typeof l["Qtde"] === "number")).toBe(true);
    expect(String(linhas[0]!["Data pedido"])).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });
});

describe("guardas do layout", () => {
  it("recusa relatório vazio", () => {
    expect(() => validarLayout([])).toThrow(/RELATORIO_VAZIO/);
  });

  it("recusa planilha sem as colunas que a Logística usa", () => {
    expect(() => validarLayout([{ Produto: "X" }])).toThrow(/LAYOUT_MUDOU/);
  });

  it("recusa coluna que existe mas veio toda vazia", () => {
    const linha = {
      "ID Pedido": null, "ID Produto": 1, "Produto": "X",
      "ID Pessoa": 1, "Grupo": "G", "COMPOSICAO": "NAO", "Qtde": 1,
    };
    expect(() => validarLayout([linha, linha])).toThrow(/LEITURA_SUSPEITA/);
  });
});
