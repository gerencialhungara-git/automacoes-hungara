// Grava o caminho que o crawler vai percorrer no Sischef.
// Abre um Chrome de verdade; você clica o percurso uma vez; o Playwright salva
// os seletores exatos (fluxo.js), toda a rede (fluxo.har) e a sessão (sessao.json).
import { spawn } from "node:child_process";
import { mkdirSync, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

const URL_SISCHEF = process.env.SISCHEF_URL ?? process.argv[2] ?? "https://sistema.sischef.com/";
const PASTA = resolve(process.cwd(), "gravacoes");

const ARQUIVOS = {
  fluxo: resolve(PASTA, "fluxo.js"),
  har: resolve(PASTA, "fluxo.har"),
  sessao: resolve(PASTA, "sessao.json"),
};

mkdirSync(PASTA, { recursive: true });

console.log(`
┌───────────────────────────────────────────────────────────────────────┐
│  GRAVAÇÃO DO CAMINHO NO SISCHEF                                       │
└───────────────────────────────────────────────────────────────────────┘

Vai abrir um Chrome em ${URL_SISCHEF}
e uma janelinha do Playwright Inspector mostrando o código sendo gerado.

Faça o percurso UMA vez, sem pressa e sem atalhos:

   1. Entre com seu usuário e senha
   2. Navegue pelo menu até a tela PEDIDOS DE VENDA
   3. Preencha a data de início e a data de fim
   4. Clique em gerar/consultar e ESPERE a listagem carregar
   5. Baixe/exporte o arquivo (aceite o download)
   6. FECHE a janela do Chrome — é o fechar que salva os arquivos

Dicas:
   • Clique de verdade em cada campo (não use Tab): o gravador registra cliques.
   • Se errar o caminho, feche tudo e rode "npm run gravar" de novo.
   • O download em si pode não aparecer no fluxo.js — o fluxo.har registra.

⚠  A gravação guarda a SENHA que você digitar e um cookie de sessão válido.
   A pasta gravacoes/ já está no .gitignore e não vai para o GitHub.
`);

const args = [
  "playwright",
  "codegen",
  "--target", "javascript",
  "--output", ARQUIVOS.fluxo,
  "--save-storage", ARQUIVOS.sessao,
  "--save-har", ARQUIVOS.har,
  URL_SISCHEF,
];

const proc = spawn("npx", args, { stdio: "inherit", shell: false });

proc.on("close", (code) => {
  console.log("\n────────────────────────────────────────────────────────────\n");

  if (code !== 0) {
    console.error(`O gravador saiu com código ${code}. Nada foi salvo? Confira acima.`);
    process.exit(code ?? 1);
  }

  let faltou = false;
  for (const [nome, caminho] of Object.entries(ARQUIVOS)) {
    if (existsSync(caminho)) {
      const kb = (statSync(caminho).size / 1024).toFixed(1);
      console.log(`  ✓ ${nome.padEnd(7)} ${caminho}  (${kb} KB)`);
    } else {
      console.log(`  ✗ ${nome.padEnd(7)} não foi criado`);
      faltou = true;
    }
  }

  console.log(
    faltou
      ? "\nAlgum arquivo não saiu. Costuma ser porque a janela foi fechada cedo demais.\nRode 'npm run gravar' de novo e feche o Chrome só no fim do percurso."
      : "\nPronto. Me avise que a gravação está em packages/sischef/gravacoes/ —\ndali eu tiro os seletores e escrevo o crawler.",
  );
});
