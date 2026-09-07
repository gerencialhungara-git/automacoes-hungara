# automacoes-hungara

Rotinas automatizadas da Húngara: cada uma pega dado de um sistema de fornecedor e
entrega um artefato pronto, sem ninguém no meio. Rodam como Lambdas na conta da Hungara
(`622703417827`, `sa-east-1`), atrás de endpoints HTTP autenticados.

| Rotina | O que faz | Estado |
|---|---|---|
| **crawler** (`apps/crawler`) | baixa o relatório *Pedidos de venda* do Sischef de um período e devolve JSON + o arquivo original no S3 | no ar |
| **logistica** (`apps/logistica`) | transforma esse relatório na *Programação de Produção* (matriz Produto × Loja) e devolve o `.xlsx` | no ar |

Candidatas a entrar depois, hoje scripts Python na máquina de alguém: Royalties Mensais e
o pipeline do Dashboard TV.

> **Por que existe um navegador dentro de uma Lambda.** Porque o Sischef não publica API.
> O pedido formal está em `../MCPs/sischef/CHECKLIST-DESCOBERTA.md`, sem resposta desde
> agosto de 2026. Se um dia a API sair, o crawler encolhe para um `fetch` — ver
> "degradação" abaixo. Isto é um contorno, não o destino.
>
> O nome do repositório e o nome dos recursos na AWS são o mesmo (`automacoes-hungara-*`).
> Uma stack por rotina: `automacoes-hungara-crawler`, `automacoes-hungara-logistica`.

## Rodar local em 5 minutos

```bash
nvm use              # Node 22
npm install
npm run gravar       # abre um Chrome; você percorre o caminho uma vez
```

O `npm run gravar` mostra o checklist do percurso na tela e, ao fechar o Chrome, salva
três arquivos em `packages/sischef/gravacoes/`:

| Arquivo | Para quê |
|---|---|
| `fluxo.js` | os seletores exatos de cada campo e botão, na ordem certa |
| `fluxo.har` | toda a rede — revela se existe uma API por trás e o formato do arquivo |
| `sessao.json` | cookies/localStorage, mostra como a sessão é mantida |

> ⚠️ **`gravacoes/` nunca vai para o Git.** O `fluxo.js` grava a senha digitada em texto
> puro e o `sessao.json` é um cookie de sessão válido. A pasta está na primeira linha do
> `.gitignore`. Da gravação só sobem os *seletores*, transplantados para
> `packages/sischef/src/seletores.ts`; a senha vem de variável de ambiente.

Depois da fase 1:

```bash
npm run baixar -- --inicio 2026-09-01 --fim 2026-09-05
```

## Comandos

| Comando | O que faz |
|---|---|
| `npm run gravar` | grava o caminho no Sischef |
| `npm run baixar` | baixa um relatório local, sem AWS |
| `npm run atualizar-cadastro -w @automacoes/logistica -- <Franquias-Yungas.xlsx>` | regera o cadastro de lojas |
| `npm run typecheck` | `tsc --noEmit` em todos os workspaces |
| `npm test` | testes offline (parser e fluxo contra o HAR gravado) |

## Estrutura

```
packages/shared     contratos zod compartilhados
packages/sischef    o crawler: seletores, fluxo, parsers, gravador e CLI
packages/logistica  o porte determinístico da Programação de Produção
apps/crawler        Lambda de imagem (Chromium): confere a chave, roda o crawler, sobe no S3
apps/logistica      Lambda zip: orquestra crawler + processamento e gera a planilha
infra/bootstrap     buckets, ECR, role de deploy, budget e o tópico de alertas
infra/<rotina>      template.yaml + samconfig.toml, uma stack por rotina
docs                como funciona, infra, runbook e ADRs
```

Cada rotina tem seu próprio workflow com filtro de path: mexer na Logística **não**
reconstrói a imagem de 3,7 GB do Chromium.

## O endpoint

```
POST <function-url>          header: x-api-key
{ "inicio": "2026-09-01", "fim": "2026-09-05" }

→ { relatorio, inicio, fim, linhas, dados: [...],
    arquivo: { chave, url, expiraEmSegundos, formato, bytes }, duracaoMs }
```

Períodos longos passam do limite de 6 MB da resposta: aí `dados` vem `null` e o JSON
vai junto para o S3, em `dadosUrl`. Na prática isso só acontece acima de ~4 meses.

## Degradação: se aparecer uma API

Se o `fluxo.har` mostrar um JSON/REST por trás do relatório, `baixarRelatorio.ts` vira um
`fetch` autenticado e o navegador some. Contrato, handler, S3 e deploy ficam idênticos, e
a Lambda deixa de ser imagem de container para virar zip arm64, igual à do Hub. É por isso
que a gravação vem antes de qualquer decisão de infra.

> A conta da Hungara é `622703417827`. Todo comando AWS aqui leva `--profile hungara` —
> o perfil `default` desta máquina é de outro cliente.
