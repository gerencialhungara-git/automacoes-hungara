import type { Linha } from "@automacoes/shared";
import { agregar, type Orfao } from "./agregar.js";
import { carregarCadastro, type FonteCadastro } from "./cadastro.js";
import { carregarConfig, type Config } from "./config.js";
import { filtrar } from "./filtros.js";
import { escreverPlanilha } from "./planilha.js";

export interface Aviso {
  codigo: "ORFAOS" | "RETIRADAS" | "SEM_LINHAS";
  mensagem: string;
}

export interface Resultado {
  arquivo: { nome: string; conteudo: Buffer; bytes: number };
  /** Linhas do relatório que sobraram depois dos filtros. */
  linhasUsadas: number;
  colunas: number;
  avisos: Aviso[];
  orfaos: Orfao[];
}

export interface Pedido {
  linhas: Linha[];
  inicio: string;
  fim: string;
  config?: Config;
  fonteCadastro?: FonteCadastro;
}

/** `logistica-AAAAMMDD.xlsx`, ou com o intervalo quando não é um dia só. */
export function nomeArquivo(inicio: string, fim: string): string {
  const compacta = (iso: string) => iso.replace(/-/g, "");
  return inicio === fim
    ? `logistica-${compacta(inicio)}.xlsx`
    : `logistica-${compacta(inicio)}-a-${compacta(fim)}.xlsx`;
}

/**
 * A rotina inteira: filtra, junta com o cadastro, agrega e escreve a planilha.
 *
 * Porte determinístico de `gerar_logistica.py`. A saída tem de ser idêntica à do
 * Python para os mesmos dados — é o que os testes de nível 1 verificam, célula por
 * célula, contra os arquivos históricos.
 */
export async function gerarLogistica(pedido: Pedido): Promise<Resultado> {
  const config = pedido.config ?? carregarConfig();
  const cadastro = carregarCadastro(pedido.fonteCadastro);

  const { linhas, retiradas } = filtrar(pedido.linhas, config);
  const agregado = agregar(linhas, config, cadastro);
  const conteudo = await escreverPlanilha(agregado, config, pedido.inicio, pedido.fim);

  const avisos: Aviso[] = [];
  if (agregado.orfaos.length > 0) {
    const nomes = agregado.orfaos
      .map((o) => o.pessoa ?? `ID ${o.idPessoa}`)
      .join(", ");
    avisos.push({
      codigo: "ORFAOS",
      mensagem:
        `${agregado.orfaos.length} cliente(s) com pedido no período estão fora do cadastro de ` +
        `franquias e foram descartados: ${nomes}. Se algum deveria entrar na produção, ` +
        `preencha ID-PDV-LOJA e Apelido no Yungas.`,
    });
  }
  if (retiradas.size > 0) {
    avisos.push({
      codigo: "RETIRADAS",
      mensagem:
        `${retiradas.size} pedido(s) marcados como retirada foram descartados — a loja busca ` +
        `na fábrica, então não entram na programação de entrega.`,
    });
  }
  if (agregado.colunas.length === 0) {
    avisos.push({
      codigo: "SEM_LINHAS",
      mensagem:
        "Nenhum pedido sobrou depois dos filtros. A planilha saiu com a lista de produtos e " +
        "nenhuma coluna de loja — confira o período antes de suspeitar do relatório.",
    });
  }
  // Lojas do cadastro sem ID ou sem apelido vão para o log, não para a tela: o número
  // é o mesmo toda execução, e aviso que nunca muda ensina a ignorar aviso — inclusive
  // o de órfão, que é o único que pede ação naquele dia.
  if (cadastro.descartadas > 0) {
    console.log(
      JSON.stringify({
        evento: "cadastro_incompleto",
        lojas: cadastro.descartadas,
        detalhe: "sem ID-PDV-LOJA ou sem Apelido no Yungas; nunca viram coluna",
      }),
    );
  }

  return {
    arquivo: {
      nome: nomeArquivo(pedido.inicio, pedido.fim),
      conteudo,
      bytes: conteudo.byteLength,
    },
    linhasUsadas: linhas.length,
    colunas: agregado.colunas.length,
    avisos,
    orfaos: agregado.orfaos,
  };
}
