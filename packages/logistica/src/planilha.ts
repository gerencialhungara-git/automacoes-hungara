import ExcelJS from "exceljs";
import type { Agregado } from "./agregar.js";
import { chave } from "./agregar.js";
import type { Config } from "./config.js";

/** Indexado por `getUTCDay()`: 0 = domingo. */
const DIAS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
] as const;

/**
 * Dia da semana em português a partir de uma data ISO.
 *
 * Usa UTC de propósito: `new Date("2026-08-31")` é meia-noite UTC, e `getDay()` em
 * São Paulo (UTC-3) devolveria o dia ANTERIOR. O título da planilha sairia errado.
 */
export function diaDaSemana(iso: string): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(ano!, mes! - 1, dia!));
  return DIAS[d.getUTCDay()]!;
}

export function tituloPlanilha(inicio: string, fim: string): string {
  const br = (iso: string) => iso.split("-").reverse().join("/");
  return inicio === fim
    ? `Pedidos dia ${br(inicio)} - ${diaDaSemana(inicio)}`
    : `Pedidos de ${br(inicio)} a ${br(fim)}`;
}

/** 1 -> "A", 26 -> "Z", 27 -> "AA". */
export function letraColuna(n: number): string {
  let s = "";
  while (n > 0) {
    const resto = (n - 1) % 26;
    s = String.fromCharCode(65 + resto) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const PRETO = "FF000000";
const BRANCO = "FFFFFFFF";
const AMARELO = "FFFFFF00";
const VERDE = "FF92D050";
const CREME = "FFFFF2CC";
const CINZA = "FFE7E6E6";

const borda: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: PRETO } },
  left: { style: "thin", color: { argb: PRETO } },
  bottom: { style: "thin", color: { argb: PRETO } },
  right: { style: "thin", color: { argb: PRETO } },
};
const preenche = (argb: string): ExcelJS.Fill => ({
  type: "pattern",
  pattern: "solid",
  fgColor: { argb },
});

type Linha = { tipo: "produto" | "subtotal"; rotulo: string };

/**
 * Monta a ordem das linhas: cada bloco na ordem da config, com seu subtotal ao fim,
 * e o bloco "Outros" só se algum SKU não mapeado sobreviveu aos filtros.
 *
 * Toda linha de produto é emitida **mesmo sem pedido** — a lista é fixa porque a
 * planilha também é ordem de produção, e pode haver produção sem pedido.
 */
export function ordemDasLinhas(config: Config, outros: string[]): Linha[] {
  const linhas: Linha[] = [];
  for (const bloco of config.blocos) {
    for (const produto of bloco.produtos) {
      const rotulo = (produto as unknown as Record<string, string>)[config.coluna_rotulo]!;
      linhas.push({ tipo: "produto", rotulo });
    }
    linhas.push({ tipo: "subtotal", rotulo: bloco.subtotal_label });
  }
  if (outros.length > 0) {
    for (const rotulo of outros) linhas.push({ tipo: "produto", rotulo });
    // O rótulo é fixo no código, não vem da config — igual ao Python.
    linhas.push({ tipo: "subtotal", rotulo: "Total Outros" });
  }
  return linhas;
}

export async function escreverPlanilha(
  agregado: Agregado,
  config: Config,
  inicio: string,
  fim: string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  // Os subtotais são fórmulas sem valor em cache. Sem isto, o Excel abre a planilha
  // com as linhas de total em branco até alguém editar uma célula.
  wb.calcProperties.fullCalcOnLoad = true;
  const ws = wb.addWorksheet("Produção");

  const colunas = agregado.colunas;
  const nCol = colunas.length;
  const primeiraLoja = 2;
  const ultimaLoja = 1 + nCol;
  const colTotal = ultimaLoja + 1;
  const extras = config.colunas_extras;
  const ultimaCol = colTotal + extras.length;

  const L = (n: number) => letraColuna(n);
  // Sem nenhuma loja no período, um intervalo B..A sai invertido. O Python emite
  // `=SUM(B3:A3)` nesse caso; aqui a gente não escreve fórmula nenhuma.
  const temLojas = nCol > 0;

  // --- linha 1: título
  ws.mergeCells(1, 1, 1, ultimaCol);
  const titulo = ws.getCell(1, 1);
  titulo.value = tituloPlanilha(inicio, fim);
  titulo.font = { name: "Arial", size: 14, bold: true, color: { argb: BRANCO } };
  titulo.fill = preenche(PRETO);
  titulo.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 28;

  // --- linha 2: cabeçalho
  const fonteCabecalho = { name: "Arial", size: 10, bold: true, color: { argb: BRANCO } };
  const cabecalhos = [
    "Produto",
    ...colunas.map((c) => agregado.cabecalho.get(c) ?? c),
    "TOTAL",
    ...extras,
  ];
  cabecalhos.forEach((texto, i) => {
    const c = ws.getCell(2, i + 1);
    c.value = texto;
    c.font = fonteCabecalho;
    c.fill = preenche(PRETO);
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = borda;
  });
  const maxLinhasCabecalho = Math.max(
    1,
    ...colunas.map((c) => (agregado.cabecalho.get(c) ?? c).split("\n").length),
  );
  ws.getRow(2).height = Math.max(32, 16 * maxLinhasCabecalho);

  // --- dados
  const fonte = { name: "Arial", size: 10 };
  const fonteNegrito = { name: "Arial", size: 10, bold: true };
  const centro: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle" };
  const esquerda: Partial<ExcelJS.Alignment> = {
    horizontal: "left",
    vertical: "middle",
    wrapText: true,
  };

  const linhas = ordemDasLinhas(config, agregado.outros);
  let inicioBloco = 3;
  const linhasSubtotal: number[] = [];
  let atual = 3;

  for (const linha of linhas) {
    const rotulo = ws.getCell(atual, 1);
    rotulo.value = linha.rotulo;
    rotulo.alignment = esquerda;
    rotulo.border = borda;

    if (linha.tipo === "produto") {
      rotulo.font = fonte;
      colunas.forEach((coluna, i) => {
        const c = ws.getCell(atual, primeiraLoja + i);
        const valor = agregado.quantidade.get(chave(linha.rotulo, coluna)) ?? 0;
        // Zero vira célula VAZIA, com estilo mas sem valor. Escrever "0" na planilha
        // de picking polui a leitura e não é o que o modelo faz.
        if (valor !== 0) c.value = valor;
        c.font = fonte;
        c.alignment = centro;
        c.border = borda;
      });
      const total = ws.getCell(atual, colTotal);
      if (temLojas) {
        total.value = { formula: `SUM(${L(primeiraLoja)}${atual}:${L(ultimaLoja)}${atual})` };
      }
      total.font = fonteNegrito;
      total.alignment = centro;
      total.border = borda;
      total.fill = preenche(CREME);
      extras.forEach((_, i) => {
        const c = ws.getCell(atual, colTotal + 1 + i);
        c.fill = preenche(CINZA);
        c.border = borda;
      });
    } else {
      const fim = atual - 1;
      rotulo.font = fonteNegrito;
      rotulo.fill = preenche(AMARELO);
      colunas.forEach((_, i) => {
        const col = L(primeiraLoja + i);
        const c = ws.getCell(atual, primeiraLoja + i);
        if (fim >= inicioBloco) c.value = { formula: `SUM(${col}${inicioBloco}:${col}${fim})` };
        c.font = fonteNegrito;
        c.alignment = centro;
        c.border = borda;
        c.fill = preenche(AMARELO);
      });
      const total = ws.getCell(atual, colTotal);
      if (temLojas) {
        total.value = { formula: `SUM(${L(primeiraLoja)}${atual}:${L(ultimaLoja)}${atual})` };
      }
      total.font = fonteNegrito;
      total.alignment = centro;
      total.border = borda;
      total.fill = preenche(AMARELO);
      extras.forEach((_, i) => {
        const c = ws.getCell(atual, colTotal + 1 + i);
        c.fill = preenche(AMARELO);
        c.border = borda;
      });
      linhasSubtotal.push(atual);
      inicioBloco = atual + 1;
    }
    atual += 1;
  }

  // --- TOTAL GERAL: soma dos subtotais, com cadeia de "+" e não SUM, como no modelo
  const tg = atual;
  const rotuloTg = ws.getCell(tg, 1);
  rotuloTg.value = "TOTAL GERAL";
  rotuloTg.font = fonteNegrito;
  rotuloTg.alignment = esquerda;
  rotuloTg.border = borda;
  rotuloTg.fill = preenche(VERDE);
  colunas.forEach((_, i) => {
    const col = L(primeiraLoja + i);
    const c = ws.getCell(tg, primeiraLoja + i);
    if (linhasSubtotal.length > 0) {
      c.value = { formula: linhasSubtotal.map((r) => `${col}${r}`).join("+") };
    }
    c.font = fonteNegrito;
    c.alignment = centro;
    c.border = borda;
    c.fill = preenche(VERDE);
  });
  const totalTg = ws.getCell(tg, colTotal);
  if (temLojas) {
    totalTg.value = { formula: `SUM(${L(primeiraLoja)}${tg}:${L(ultimaLoja)}${tg})` };
  }
  totalTg.font = fonteNegrito;
  totalTg.alignment = centro;
  totalTg.border = borda;
  totalTg.fill = preenche(VERDE);
  extras.forEach((_, i) => {
    const c = ws.getCell(tg, colTotal + 1 + i);
    c.fill = preenche(VERDE);
    c.border = borda;
  });

  // --- larguras e painel congelado
  ws.getColumn(1).width = 26;
  for (let i = 0; i < nCol; i += 1) ws.getColumn(primeiraLoja + i).width = 10;
  ws.getColumn(colTotal).width = 9;
  extras.forEach((_, i) => {
    ws.getColumn(colTotal + 1 + i).width = 11;
  });
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 2 }];

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
