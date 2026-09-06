import { abrirNavegador } from "./navegador.js";
import { login, type Credenciais } from "./fluxo/login.js";
import { abrirRelatorio } from "./fluxo/abrirRelatorio.js";
import { preencherPeriodo } from "./fluxo/preencherPeriodo.js";
import { baixar } from "./fluxo/baixar.js";
import { parsearPedidosDeVenda, validarLayout, type Linha } from "./parsers/index.js";

export interface Pedido {
  inicio: string;
  fim: string;
  credenciais: Credenciais;
  visivel?: boolean;
  /** Chamado a cada etapa; serve para log local e para o status na Lambda. */
  aoAndar?: (etapa: string) => void;
}

export interface Resultado {
  arquivo: { nome: string; conteudo: Buffer; bytes: number };
  linhas: Linha[];
  duracaoMs: number;
}

/**
 * O crawler inteiro: entra, acha a tela, preenche o período, baixa e parseia.
 * É isto que a Lambda chama — e o `npm run baixar` também, sem AWS nenhuma.
 */
export async function baixarRelatorio(pedido: Pedido): Promise<Resultado> {
  const comecou = Date.now();
  const andar = pedido.aoAndar ?? (() => {});
  const nav = await abrirNavegador({ visivel: pedido.visivel });

  try {
    andar("login");
    await login(nav.page, pedido.credenciais);

    andar("abrir-relatorio");
    await abrirRelatorio(nav.page);

    andar("preencher-periodo");
    await preencherPeriodo(nav.page, pedido.inicio, pedido.fim);

    andar("baixar");
    const arquivo = await baixar(nav.page);

    andar("parsear");
    const linhas = parsearPedidosDeVenda(arquivo.conteudo);
    validarLayout(linhas);

    return {
      arquivo: { ...arquivo, bytes: arquivo.conteudo.byteLength },
      linhas,
      duracaoMs: Date.now() - comecou,
    };
  } catch (erro) {
    // Um screenshot vale mais que o stack trace: mostra em que tela parou.
    await nav.page
      .screenshot({ path: `saida/falha-${Date.now()}.png`, fullPage: true })
      .catch(() => {});
    throw erro;
  } finally {
    await nav.fechar();
  }
}
