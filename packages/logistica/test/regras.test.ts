import type { Linha } from "@automacoes/shared";
import { describe, expect, it } from "vitest";
import { agregar, chave } from "../src/agregar.js";
import { carregarCadastro, inativasQuePassam, type FonteCadastro } from "../src/cadastro.js";
import { carregarConfig, montarDePara, type Config } from "../src/config.js";
import { filtrar, pedidosDeRetirada, semAcentoMaiusculo } from "../src/filtros.js";
import { diaDaSemana, letraColuna, ordemDasLinhas, tituloPlanilha } from "../src/planilha.js";

/**
 * As regras que os arquivos históricos NÃO exercitam.
 *
 * Descobri isso sabotando o código de propósito: trocar a ordenação por code point
 * por `localeCompare` deixava os 5 dias de fidelidade passando, porque nenhum dos 70
 * apelidos de loja tem acento e o único dia com "Outros" tem uma linha só. Um teste
 * que não sabe falhar não protege nada — daí estes casos sintéticos.
 */

const config = carregarConfig();

const cadastroFalso = (lojas: { id: string; apelido: string; nome?: string }[]): FonteCadastro => ({
  franquias: () =>
    lojas.map((l) => ({ nome: l.nome ?? l.apelido, idPdvLoja: l.id, apelido: l.apelido })),
});

const linha = (over: Partial<Linha> = {}): Linha => ({
  "ID Pedido": 1,
  "Data pedido": "2026-08-31T10:00:00",
  "ID Produto": 3098612, // Comum
  Produto: "CX. ITALIANO QUEIJO PRESUNTO",
  "ID Pessoa": 100,
  Pessoa: "LOJA TESTE",
  Grupo: "ITALIANOS CLASSICOS",
  COMPOSICAO: "NÃO",
  Qtde: 1,
  "Observação do pedido": null,
  ...over,
});

describe("ordenação por code point, não por locale", () => {
  const cad = cadastroFalso([
    { id: "1", apelido: "ÁGUAS" },
    { id: "2", apelido: "ZONA SUL" },
  ]);

  it("coloca apelido acentuado DEPOIS de Z, como o Python", () => {
    const linhas = [
      linha({ "ID Pessoa": 1 }),
      linha({ "ID Pessoa": 2, "ID Pedido": 2 }),
    ];
    const r = agregar(linhas, config, carregarCadastro(cad));
    // localeCompare devolveria ["ÁGUAS", "ZONA SUL"] — ordem de dicionário.
    expect(r.colunas).toEqual(["ZONA SUL", "ÁGUAS"]);
  });

  it("ordena os rótulos de Outros do mesmo jeito", () => {
    const linhas = [
      linha({ "ID Pessoa": 1, "ID Produto": 999901, Produto: "ÁGUA MINERAL" }),
      linha({ "ID Pessoa": 1, "ID Produto": 999902, Produto: "ZZ BRINDE", "ID Pedido": 2 }),
    ];
    const r = agregar(linhas, config, carregarCadastro(cad));
    expect(r.outros).toEqual(["ZZ BRINDE", "ÁGUA MINERAL"]);
  });
});

describe("produtos excluídos por texto exato", () => {
  const cad = cadastroFalso([{ id: "100", apelido: "LOJA" }]);

  it('descarta "ROYALTIES 5% " COM o espaço no fim', () => {
    const linhas = [linha({ "ID Produto": 999903, Produto: "ROYALTIES 5% " })];
    expect(filtrar(linhas, config).linhas).toHaveLength(0);
  });

  it('NÃO descarta "ROYALTIES 5%" sem o espaço — igualdade é exata', () => {
    const linhas = [linha({ "ID Produto": 999903, Produto: "ROYALTIES 5%" })];
    expect(filtrar(linhas, config).linhas).toHaveLength(1);
  });

  it("descarta o grupo DESCARTÁVEIS com o acento", () => {
    expect(filtrar([linha({ Grupo: "DESCARTÁVEIS" })], config).linhas).toHaveLength(0);
    expect(filtrar([linha({ Grupo: "DESCARTAVEIS" })], config).linhas).toHaveLength(1);
  });

  it("descarta os SKUs de Peito de Peru (ids_excluidos)", () => {
    expect(filtrar([linha({ "ID Produto": 3689061 })], config).linhas).toHaveLength(0);
    expect(filtrar([linha({ "ID Produto": 3689058 })], config).linhas).toHaveLength(0);
  });

  it("mantém COMPOSICAO nula ou NÃO e descarta SIM", () => {
    expect(filtrar([linha({ COMPOSICAO: "SIM" })], config).linhas).toHaveLength(0);
    expect(filtrar([linha({ COMPOSICAO: "NÃO" })], config).linhas).toHaveLength(1);
    expect(filtrar([linha({ COMPOSICAO: null })], config).linhas).toHaveLength(1);
  });
});

describe("retirada", () => {
  it("reconhece as variações reais de observação", () => {
    for (const obs of [
      "Retirada",
      "RETIRADA para 19/6",
      "Retirada dia 22/06",
      "retirada 18/06.",
      "Retirada 31/08",
    ]) {
      expect(pedidosDeRetirada([linha({ "Observação do pedido": obs })]).size).toBe(1);
    }
  });

  it("ignora observação que não fala de retirada", () => {
    expect(pedidosDeRetirada([linha({ "Observação do pedido": "Bonificação" })]).size).toBe(0);
    expect(pedidosDeRetirada([linha({ "Observação do pedido": null })]).size).toBe(0);
  });

  it("descarta o pedido INTEIRO, inclusive as linhas sem observação", () => {
    // A observação vem repetida nas linhas do pedido, mas nem sempre em todas.
    const linhas = [
      linha({ "ID Pedido": 7, "Observação do pedido": "Retirada 31/08" }),
      linha({ "ID Pedido": 7, "Observação do pedido": null, "ID Produto": 3098610 }),
      linha({ "ID Pedido": 8, "Observação do pedido": null }),
    ];
    const r = filtrar(linhas, config);
    expect(r.linhas.map((l) => l["ID Pedido"])).toEqual([8]);
  });

  it("é calculada na planilha crua, antes do filtro de composição", () => {
    // Se a observação só existir na linha de composição (que é descartada), o pedido
    // ainda tem de ser reconhecido como retirada.
    const linhas = [
      linha({ "ID Pedido": 9, COMPOSICAO: "SIM", "Observação do pedido": "Retirada" }),
      linha({ "ID Pedido": 9, COMPOSICAO: "NÃO", "Observação do pedido": null }),
    ];
    expect(filtrar(linhas, config).linhas).toHaveLength(0);
  });

  it("tira acento e sobe para maiúscula", () => {
    expect(semAcentoMaiusculo("Retirada às 9h")).toBe("RETIRADA AS 9H");
    expect(semAcentoMaiusculo(null)).toBe("");
  });
});

describe("fator de conversão", () => {
  it("meia caixa de doce vale 6 kits", () => {
    const dePara = montarDePara(config);
    expect(dePara.fator.get(3662971)).toBe(6); // Chocolate kt, meia caixa
    expect(dePara.rotulo.get(3662971)).toBe("Chocolate kt");
    expect(dePara.fator.get(3098859)).toBe(1); // caixa cheia da mesma linha
  });

  it("aplica o fator ANTES de agregar, para célula e total concordarem", () => {
    const cad = cadastroFalso([{ id: "100", apelido: "LOJA" }]);
    const linhas = [linha({ "ID Produto": 3662971, Qtde: 2 })];
    const r = agregar(linhas, config, carregarCadastro(cad));
    expect(r.quantidade.get(chave("Chocolate kt", "LOJA"))).toBe(12);
  });

  it("as meias caixas salgadas são linha própria, sem fator", () => {
    const dePara = montarDePara(config);
    expect(dePara.rotulo.get(3639825)).toBe("X Bacon c/18");
    expect(dePara.fator.get(3639825)).toBe(1);
  });
});

describe("config", () => {
  it("recusa rótulo repetido", () => {
    const ruim = structuredClone(config) as Config;
    ruim.blocos[0]!.produtos[1]!.rotulo = ruim.blocos[0]!.produtos[0]!.rotulo;
    expect(() => montarDePara(ruim)).toThrow(/CONFIG_INVALIDA: rótulo/);
  });

  it("recusa o mesmo SKU em duas linhas", () => {
    const ruim = structuredClone(config) as Config;
    ruim.blocos[0]!.produtos[1]!.ids = [...ruim.blocos[0]!.produtos[0]!.ids];
    expect(() => montarDePara(ruim)).toThrow(/CONFIG_INVALIDA: SKU/);
  });

  it("tem as 4 linhas de catupiry logo abaixo do sabor base", () => {
    const rotulos = config.blocos[0]!.produtos.map((p) => p.rotulo);
    for (const [base, cat] of [
      ["Comum", "Comum c/Catupiry"],
      ["Frango", "Frango c/Catupiry"],
      ["Costela", "Costela c/Catupiry"],
      ["Carne Seca", "Carne Seca c/Catupiry"],
    ]) {
      expect(rotulos.indexOf(cat!)).toBe(rotulos.indexOf(base!) + 1);
    }
  });
});

describe("cadastro", () => {
  it("o filtro de inativas é startsWith literal e hoje não exclui ninguém", () => {
    // Portado fiel de propósito (ADR-0006). Este teste existe para o dia em que
    // alguém trocar por "contém INATIVA" e precisar saber que mudou de comportamento.
    expect(inativasQuePassam()).toBeGreaterThan(0);
    const cad = carregarCadastro(
      cadastroFalso([
        { id: "1", apelido: "A", nome: "z[INATIVA] LOJA VELHA" },
        { id: "2", apelido: "B", nome: "[INATIVA] LOJA VELHA" },
      ]),
    );
    expect([...cad.apelidoPorId.values()]).toEqual(["A"]);
  });

  it("junta ID em texto do cadastro com ID numérico do Sischef", () => {
    const cad = carregarCadastro(cadastroFalso([{ id: "7155979", apelido: "PATIO" }]));
    const r = agregar([linha({ "ID Pessoa": 7155979 })], config, cad);
    expect(r.colunas).toEqual(["PATIO"]);
    expect(r.orfaos).toEqual([]);
  });

  it("reporta como órfão quem não está no cadastro", () => {
    const cad = carregarCadastro(cadastroFalso([{ id: "1", apelido: "A" }]));
    const r = agregar([linha({ "ID Pessoa": 999, Pessoa: "MIXMARKET LTDA" })], config, cad);
    expect(r.colunas).toEqual([]);
    expect(r.orfaos).toEqual([{ idPessoa: 999, pessoa: "MIXMARKET LTDA" }]);
  });
});

describe("layout", () => {
  it("emite toda linha de produto mesmo sem pedido", () => {
    const linhas = ordemDasLinhas(config, []);
    const produtos = config.blocos.reduce((n, b) => n + b.produtos.length, 0);
    expect(linhas.filter((l) => l.tipo === "produto")).toHaveLength(produtos);
    expect(linhas.filter((l) => l.tipo === "subtotal").map((l) => l.rotulo)).toEqual([
      "Total Cx Italiano",
      "Total Cx Pizzanos",
      "Total Junior",
    ]);
  });

  it("acrescenta o bloco Outros só quando existe", () => {
    const com = ordemDasLinhas(config, ["ALGO"]);
    expect(com.at(-1)).toEqual({ tipo: "subtotal", rotulo: "Total Outros" });
    expect(com.at(-2)).toEqual({ tipo: "produto", rotulo: "ALGO" });
  });

  it("acerta o dia da semana sem escorregar de fuso", () => {
    // new Date("2026-08-31").getDay() em São Paulo devolveria domingo.
    expect(diaDaSemana("2026-08-31")).toBe("segunda-feira");
    expect(diaDaSemana("2026-09-06")).toBe("domingo");
  });

  it("titula um dia como o modelo e um intervalo de forma explícita", () => {
    expect(tituloPlanilha("2026-08-31", "2026-08-31")).toBe(
      "Pedidos dia 31/08/2026 - segunda-feira",
    );
    expect(tituloPlanilha("2026-09-01", "2026-09-05")).toBe("Pedidos de 01/09/2026 a 05/09/2026");
  });

  it("converte índice de coluna em letra", () => {
    expect([1, 22, 26, 27].map(letraColuna)).toEqual(["A", "V", "Z", "AA"]);
  });
});
