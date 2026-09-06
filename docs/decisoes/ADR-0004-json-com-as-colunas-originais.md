# ADR-0004 — O JSON mantém os nomes originais das colunas do Sischef

**Contexto.** O consumidor do relatório já existe e é anterior a este projeto:
`ANALISES/Logística Diária/gerar_logistica.py`, que hoje lê a planilha baixada à mão
e procura as colunas por nome (`ID Pedido`, `ID Produto`, `Qtde`, `COMPOSICAO`…).

**Decisão.** Devolver as 26 colunas com os nomes exatos do export, convertendo apenas
os tipos: número em pt-BR (`"8,00"`) vira número, data (`"31/08/2026 15:17:05"`) vira
ISO, vazio vira `null`. Nada de renomear para camelCase nem de filtrar colunas.

**Consequências.** O JSON é substituto direto da planilha para quem já consome, sem
de-para. O parser valida o layout e **falha alto** se faltar coluna obrigatória ou se
uma coluna-chave vier vazia em mais de 5% das linhas — a saída daqui vira ordem de
produção do dia seguinte, e devolver dado errado calado é pior que quebrar.
