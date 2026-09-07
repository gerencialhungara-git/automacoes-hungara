import type { Linha } from "@automacoes/shared";
import { PRODUTOS_EXCLUIDOS, type Config } from "./config.js";

/** Maiúsculas sem acento, como o `sem_acento_upper` do Python. */
export function semAcentoMaiusculo(valor: unknown): string {
  return String(valor ?? "")
    .trim()
    .normalize("NFKD")
    // U+0300-U+036F é o bloco de marcas de combinação: o NFKD acima separa o
    // acento da letra e isto remove o acento. Escapado de propósito: marca de
    // combinação literal no código-fonte é invisível no diff e some ao copiar.
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

/**
 * IDs dos pedidos marcados como retirada (a loja busca na fábrica).
 *
 * Calculado na planilha **crua**, antes de qualquer filtro, e de propósito: a
 * observação se repete em toda linha do pedido, inclusive nas de composição, que são
 * descartadas depois. Rodando aqui, o resultado não depende de qual linha sobreviveu.
 *
 * O predicado é frouxo por necessidade — as observações reais variam muito
 * ("Retirada", "RETIRADA para 19/6", "Retirada dia 22/06."), então basta a observação
 * conter RETIRADA depois de tirar acento e subir para maiúscula.
 */
export function pedidosDeRetirada(linhas: Linha[]): Map<number, string> {
  const achados = new Map<number, string>();
  for (const linha of linhas) {
    const id = linha["ID Pedido"];
    if (typeof id !== "number") continue;
    const obs = linha["Observação do pedido"];
    if (!semAcentoMaiusculo(obs).includes("RETIRADA")) continue;
    // A primeira observação vence, como no Python (`setdefault`).
    if (!achados.has(id)) achados.set(id, String(obs).trim());
  }
  return achados;
}

export interface Filtragem {
  linhas: Linha[];
  retiradas: Map<number, string>;
}

/**
 * A cadeia de filtros, na mesma ordem do gerar_logistica.py. A ordem importa: o
 * `ids_excluidos` só é aplicado depois, sobre o SKU já convertido.
 */
export function filtrar(brutas: Linha[], config: Config): Filtragem {
  const retiradas = pedidosDeRetirada(brutas);
  const gruposFora = new Set(config.grupos_excluidos);
  const idsFora = new Set(config.ids_excluidos.map(Number));
  const produtosFora = new Set<string>(PRODUTOS_EXCLUIDOS);

  const linhas = brutas.filter((l) => {
    const idPedido = l["ID Pedido"];
    if (typeof idPedido === "number" && retiradas.has(idPedido)) return false;

    // Igualdade exata e acentuada: "SIM" descarta a linha de composição (o item
    // explodido), e o que sobra é a caixa vendável. Nulo e "NÃO" sobrevivem.
    if (l["COMPOSICAO"] === "SIM") return false;

    if (typeof l["Grupo"] === "string" && gruposFora.has(l["Grupo"])) return false;
    if (typeof l["Produto"] === "string" && produtosFora.has(l["Produto"])) return false;

    const sku = l["ID Produto"];
    if (typeof sku === "number" && idsFora.has(sku)) return false;

    return true;
  });

  return { linhas, retiradas };
}
