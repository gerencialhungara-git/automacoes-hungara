import bruta from "../config/ordenacao-config.json" with { type: "json" };

export interface Produto {
  /** O que aparece na coluna A da planilha. */
  rotulo: string;
  /** SKUs que somam nesta linha. `[sku, fator]` quando a unidade do ERP difere da linha. */
  ids: (number | [number, number])[];
  /** Descrição no ERP; só documentação, não é usada no match. */
  erp?: string;
}

export interface Bloco {
  nome_bloco: string;
  subtotal_label: string;
  produtos: Produto[];
}

export interface Config {
  blocos: Bloco[];
  ordem_lojas: { apelido: string; nome_curto: string }[];
  grupos_excluidos: string[];
  ids_excluidos: number[];
  coluna_rotulo: string;
  colunas_extras: string[];
}

/**
 * Produtos que saem do relatório independente de grupo. Ficam no código, e não na
 * config, porque é assim no gerar_logistica.py.
 *
 * ATENÇÃO ao segundo: "ROYALTIES 5% " tem **espaço no fim**, verbatim no export do
 * Sischef. A comparação é de igualdade exata — um `trim()` aqui deixaria a linha passar.
 */
export const PRODUTOS_EXCLUIDOS = [
  "ROYALTIES 3% APP DE DELIVERY- SEM TX ENTREGA",
  "ROYALTIES 5% ",
  "VERBA DE MARKETING 1,5%",
] as const;

export interface DeParaSku {
  /** SKU → rótulo da linha onde ele soma. */
  rotulo: Map<number, string>;
  /** SKU → fator de conversão (1 quando não declarado). */
  fator: Map<number, number>;
}

/**
 * Monta o de-para SKU → linha e **recusa a config** em dois casos que produziriam
 * planilha errada sem alterar o TOTAL GERAL — ou seja, que nenhuma validação por
 * total detectaria:
 *  - rótulo repetido: a mesma quantidade seria escrita em duas linhas;
 *  - SKU declarado em duas linhas: uma delas ficaria zerada para sempre.
 */
export function montarDePara(config: Config): DeParaSku {
  const rotulo = new Map<number, string>();
  const fator = new Map<number, number>();
  const rotulosVistos = new Set<string>();

  for (const bloco of config.blocos) {
    for (const produto of bloco.produtos) {
      const nome = (produto as unknown as Record<string, string>)[config.coluna_rotulo];
      if (!nome) {
        throw new Error(
          `Produto sem "${config.coluna_rotulo}" no bloco ${bloco.nome_bloco}: ${JSON.stringify(produto)}`,
        );
      }
      if (rotulosVistos.has(nome)) {
        throw new Error(`CONFIG_INVALIDA: rótulo "${nome}" aparece em duas linhas`);
      }
      rotulosVistos.add(nome);

      for (const entrada of produto.ids) {
        const [sku, f] = Array.isArray(entrada) ? [Number(entrada[0]), Number(entrada[1])] : [Number(entrada), 1];
        if (rotulo.has(sku)) {
          throw new Error(
            `CONFIG_INVALIDA: SKU ${sku} está em "${rotulo.get(sku)}" e em "${nome}"`,
          );
        }
        rotulo.set(sku, nome);
        fator.set(sku, f);
      }
    }
  }

  return { rotulo, fator };
}

export function carregarConfig(): Config {
  return bruta as unknown as Config;
}
