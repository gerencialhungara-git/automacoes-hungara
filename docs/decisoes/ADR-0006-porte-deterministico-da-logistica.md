# ADR-0006 — Porte determinístico da Logística, fiel até nos defeitos

**Contexto.** A Programação de Produção era gerada por `gerar_logistica.py` (575 linhas,
pandas + openpyxl) na máquina de uma pessoa, a partir de uma planilha baixada à mão. A saída
é ordem de picking da expedição e ordem de produção do dia seguinte: um número errado custa
caro, e a rotina precisava ser reproduzível — sem LLM em ponto nenhum.

**Decisão.** Porte para TypeScript em `packages/logistica`, com a saída verificada **célula
por célula** contra as planilhas que o Python realmente produziu, nos cinco dias históricos
gerados com a config atual. Onde o Python tem comportamento discutível, o porte é **fiel**,
não corrigido:

- o filtro de lojas inativas é `startsWith("[INATIVA]")` literal, e hoje **não exclui
  ninguém** — as 84 inativas do cadastro começam com `z[INATIVA]`, um truque de ordenação.
  Trocar por "contém INATIVA" faria uma loja recém-desativada com pedido pendente sumir da
  planilha de picking, em silêncio;
- clientes fora do cadastro de franquias continuam sendo descartados, mas agora o aviso
  sobe para a tela em vez de morrer no terminal;
- a ordenação é por code point, não por locale, porque é o que o Python faz.

**Consequências.** A planilha nova é indistinguível da antiga para quem usa. O porte tem
testes com dentes: sabotar o fator de conversão derruba os cinco dias apontando a célula. Mas
o corpus histórico **não cobre tudo** — trocar a ordenação por `localeCompare` passava por
todos, porque nenhum dos 70 apelidos tem acento. Daí `test/regras.test.ts`, com casos
sintéticos para as regras que o histórico não alcança. O Python continua existindo e é a
fonte de verdade: se alguém mexer nele sem mexer aqui, os dois divergem calados — vale
decidir qual aposenta qual.
