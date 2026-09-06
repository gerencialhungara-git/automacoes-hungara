// CLI local: baixa o "Pedidos de venda" sem AWS nenhuma.
//   npm run baixar -- --inicio 2026-09-01 --fim 2026-09-05
//   npm run baixar -- 2026-09-01 2026-09-05        (posicional, sempre funciona)
//   npm run baixar -- --ver                        (mostra o navegador)
// Sem argumento nenhum: hoje.
import { mkdir, writeFile } from "node:fs/promises";
import { baixarRelatorio } from "../src/baixarRelatorio.js";

const argv = process.argv.slice(2);

function arg(nome: string): string | undefined {
  const comIgual = argv.find((a) => a.startsWith(`--${nome}=`));
  if (comIgual) return comIgual.slice(nome.length + 3);
  const i = argv.indexOf(`--${nome}`);
  return i === -1 ? undefined : argv[i + 1];
}

// O npm engole `--inicio`/`--fim` ao repassar entre workspaces e deixa só os
// valores soltos, então as datas posicionais são o caminho que sempre chega.
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const posicionais = argv.filter((a) => DATA.test(a));

const hoje = new Date().toISOString().slice(0, 10);
const inicio = arg("inicio") ?? posicionais[0] ?? hoje;
const fim = arg("fim") ?? posicionais[1] ?? inicio;
const visivel = argv.includes("--ver");

if (!DATA.test(inicio) || !DATA.test(fim)) {
  console.error(`Datas devem ser AAAA-MM-DD (recebi inicio="${inicio}" fim="${fim}")`);
  process.exit(1);
}
if (inicio > fim) {
  console.error(`A data de início (${inicio}) é depois da de fim (${fim})`);
  process.exit(1);
}

const usuario = process.env.SISCHEF_USUARIO;
const senha = process.env.SISCHEF_SENHA;
if (!usuario || !senha) {
  console.error(
    "Faltam credenciais. Copie packages/sischef/.env.example para .env e preencha\n" +
      "SISCHEF_USUARIO e SISCHEF_SENHA.",
  );
  process.exit(1);
}

await mkdir("saida", { recursive: true });
console.log(`Período ${inicio} a ${fim}${visivel ? " (navegador visível)" : ""}`);

try {
  const r = await baixarRelatorio({
    inicio,
    fim,
    credenciais: { usuario, senha },
    visivel,
    aoAndar: (etapa) => console.log(`  → ${etapa}`),
  });

  const base = `saida/pedidos_de_venda_${inicio}_a_${fim}`;
  const extensao = r.arquivo.nome.split(".").pop() ?? "xls";
  await writeFile(`${base}.${extensao}`, r.arquivo.conteudo);
  await writeFile(`${base}.json`, JSON.stringify(r.linhas, null, 2));

  console.log(
    `\nPronto em ${(r.duracaoMs / 1000).toFixed(1)}s — ${r.linhas.length} linhas\n` +
      `  ${base}.${extensao}  (${(r.arquivo.bytes / 1024).toFixed(1)} KB, original do Sischef)\n` +
      `  ${base}.json`,
  );
} catch (erro) {
  console.error(`\nFalhou: ${erro instanceof Error ? erro.message : String(erro)}`);
  console.error("Se houver screenshot da falha, ele está em saida/falha-*.png");
  process.exit(1);
}
