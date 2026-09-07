# ADR-0005 — Monorepo de rotinas, uma stack por rotina

**Contexto.** O repositório nasceu como `crawler-sischef`, para uma coisa só: baixar um
relatório do Sischef. Ao chegar a segunda rotina — transformar esse relatório na Programação
de Produção da Logística — ficou claro que existem outras três do mesmo formato (rotina
determinística sobre dado de fornecedor) hoje espalhadas como scripts Python na máquina de
alguém: Logística Diária, Royalties Mensais e o pipeline do Dashboard TV. Colocar a Logística
dentro do crawler faria toda mudança de produto ou de loja reconstruir uma imagem de 3,7 GB.

**Decisão.** O repositório passa a ser `automacoes-hungara`, com um pacote por domínio
(`packages/sischef`, `packages/logistica`) e **uma Lambda e uma stack por rotina**
(`automacoes-hungara-crawler`, de imagem; `automacoes-hungara-logistica`, zip), cada uma com
seu workflow filtrado por path. Os recursos da AWS foram renomeados junto, enquanto o custo
era de copiar 2,2 MB de S3 — o repositório tinha um dia de vida e nada externo o consumia.
O bucket de dados, o ECR, a role de deploy e o tópico de alertas ficam no bootstrap,
compartilhados.

**Consequências.** Mexer na Logística não toca no Chromium: o deploy dela é um zip de
segundos. Uma rotina nova é um pacote, um `apps/`, uma stack e um workflow — sem repositório
novo, sem bootstrap novo, sem terceiro pipeline. O preço é um monorepo que cresce e exige
disciplina de filtro de path: um workflow sem filtro reconstrói tudo. E há um tópico de
alertas único, o que é bom para não perder inscrição e ruim se um dia as rotinas precisarem
de destinatários diferentes.
