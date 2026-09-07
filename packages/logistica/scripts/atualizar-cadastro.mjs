// Gera config/franquias.json a partir do export do Yungas.
//   npm run atualizar-cadastro -w @automacoes/logistica -- "<caminho>/Franquias-Yungas.xlsx"
//
// Por que existe: o Yungas não tem API (ver ../../MCPs/yungas/CHECKLIST-DESCOBERTA.md),
// então o cadastro mestre da rede é um export manual. Este script transforma a planilha
// num JSON versionado, para o diff mostrar quando uma loja entra ou sai.
//
// O JSON guarda TODAS as linhas, sem filtrar: a filtragem (inativas, sem ID, sem apelido)
// acontece em src/cadastro.ts, para ser idêntica à do gerar_logistica.py e auditável.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { read, utils } from "@e965/xlsx";

const AQUI = dirname(fileURLToPath(import.meta.url));
const SAIDA = resolve(AQUI, "../config/franquias.json");

const origem = process.argv[2];
if (!origem) {
  console.error(
    'Uso: npm run atualizar-cadastro -w @automacoes/logistica -- "<caminho>/Franquias-Yungas.xlsx"',
  );
  process.exit(1);
}

const COL_NOME = "Nome";
const COL_ID = "ID-PDV-LOJA | 1238";
const COL_APELIDO = "Apelido | 1617";

const wb = read(readFileSync(origem), { type: "buffer", raw: true });
if (!wb.SheetNames.includes("Franquias")) {
  console.error(`A planilha não tem a aba "Franquias" (tem: ${wb.SheetNames.join(", ")})`);
  process.exit(1);
}
const linhas = utils.sheet_to_json(wb.Sheets["Franquias"], { defval: "", raw: true });

for (const col of [COL_NOME, COL_ID, COL_APELIDO]) {
  if (linhas.length > 0 && !(col in linhas[0])) {
    console.error(`Coluna "${col}" não existe na aba Franquias. O export do Yungas mudou?`);
    process.exit(1);
  }
}

const texto = (v) => (v === null || v === undefined ? "" : String(v).trim());
const franquias = linhas.map((l) => ({
  nome: texto(l[COL_NOME]),
  idPdvLoja: texto(l[COL_ID]),
  apelido: texto(l[COL_APELIDO]),
}));

// Chave duplicada faz o join multiplicar linhas e dobrar quantidade em silêncio.
const usaveis = franquias.filter((f) => f.idPdvLoja !== "" && f.apelido !== "");
for (const [campo, rotulo] of [["idPdvLoja", "ID-PDV-LOJA"], ["apelido", "Apelido"]]) {
  const vistos = new Map();
  for (const f of usaveis) vistos.set(f[campo], (vistos.get(f[campo]) ?? 0) + 1);
  const dups = [...vistos].filter(([, n]) => n > 1);
  if (dups.length > 0) {
    console.error(`${rotulo} duplicado no cadastro: ${dups.map(([v, n]) => `${v} (${n}x)`).join(", ")}`);
    console.error("Isso dobraria a quantidade dessas lojas na planilha. Corrija no Yungas.");
    process.exit(1);
  }
}

writeFileSync(
  SAIDA,
  JSON.stringify(
    {
      _doc:
        "Gerado por scripts/atualizar-cadastro.mjs a partir do export do Yungas. " +
        "Não editar à mão. Guarda todas as linhas; quem filtra é src/cadastro.ts.",
      _origem: origem.split("/").pop(),
      _geradoEm: new Date().toISOString().slice(0, 10),
      franquias,
    },
    null,
    2,
  ) + "\n",
);

const inativas = franquias.filter((f) => f.nome.toUpperCase().includes("INATIVA")).length;
console.log(
  `${SAIDA}\n  ${franquias.length} linhas · ${usaveis.length} com ID e apelido · ${inativas} com "INATIVA" no nome`,
);
