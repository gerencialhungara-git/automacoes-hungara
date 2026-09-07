import bruto from "../config/franquias.json" with { type: "json" };

export interface Franquia {
  nome: string;
  idPdvLoja: string;
  apelido: string;
}

export interface Cadastro {
  /** ID da loja no PDV → apelido. É a chave do join com o relatório do Sischef. */
  apelidoPorId: Map<number, string>;
  /** Quantas linhas foram descartadas por não ter ID ou apelido. */
  descartadas: number;
}

/**
 * Fonte do cadastro mestre. Hoje é o JSON gerado do export do Yungas; quando a API
 * do Yungas existir, é aqui que se troca — o resto do código não sabe a diferença.
 */
export interface FonteCadastro {
  franquias(): Franquia[];
}

export const fonteJson: FonteCadastro = {
  franquias: () => (bruto as { franquias: Franquia[] }).franquias,
};

/**
 * Aplica os mesmos filtros do gerar_logistica.py, na mesma ordem.
 *
 * ⚠️ O filtro de inativas é `startsWith("[INATIVA]")` **literal**, e hoje ele não
 * exclui ninguém: as 84 lojas inativas do cadastro começam com `z[INATIVA]` (o `z` é
 * truque de ordenação). Portar fiel foi decisão de negócio — trocar por "contém
 * INATIVA" faria uma loja recém-desativada com pedido pendente desaparecer da
 * planilha de picking sem aviso. Ver ADR-0006.
 */
export function carregarCadastro(fonte: FonteCadastro = fonteJson): Cadastro {
  const todas = fonte.franquias();
  const ativas = todas.filter((f) => !f.nome.startsWith("[INATIVA]"));
  const usaveis = ativas.filter((f) => f.idPdvLoja !== "" && f.apelido !== "");

  const apelidoPorId = new Map<number, string>();
  for (const f of usaveis) {
    // O cadastro guarda o ID como texto e o Sischef manda número. Normalizar os dois
    // lados é obrigatório: comparar texto com número não casa NADA, e o resultado é
    // uma planilha vazia com todas as lojas classificadas como órfãs.
    const id = Number(f.idPdvLoja);
    if (!Number.isFinite(id)) continue;
    apelidoPorId.set(id, f.apelido);
  }

  return { apelidoPorId, descartadas: ativas.length - usaveis.length };
}

/** Quantas linhas do cadastro têm "INATIVA" no nome mas passam pelo filtro literal. */
export function inativasQuePassam(fonte: FonteCadastro = fonteJson): number {
  return fonte
    .franquias()
    .filter(
      (f) =>
        f.nome.toUpperCase().includes("INATIVA") &&
        !f.nome.startsWith("[INATIVA]") &&
        f.idPdvLoja !== "" &&
        f.apelido !== "",
    ).length;
}
