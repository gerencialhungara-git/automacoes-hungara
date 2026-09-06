# crawler-sischef

Baixa o relatório **Pedidos de venda** do Sischef sozinho, para a rotina diária de
Logística. Recebe uma data de início e uma de fim, faz o login, percorre a plataforma,
baixa o arquivo e devolve os dados em JSON mais o arquivo original no S3.

Roda como uma Lambda na conta da Hungara (`622703417827`, `sa-east-1`), atrás de um
endpoint HTTP autenticado, para outros sistemas poderem chamar.

> **Por que existe um navegador dentro de uma Lambda.** Porque o Sischef não publica
> API. O pedido formal está em `../MCPs/sischef/CHECKLIST-DESCOBERTA.md`, sem resposta
> desde agosto de 2026. Se um dia a API sair, este projeto encolhe para um `fetch` —
> ver "degradação" abaixo. Isto aqui é um contorno, não o destino.

## Estado

Roda ponta a ponta **localmente**, validado em 06/09/2026 (1607 linhas em 5 dias).
Falta publicar na AWS: ver [docs/02-infra-e-deploy.md](docs/02-infra-e-deploy.md).

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
| `npm run gravar` | grava o caminho no Sischef (fase 0) |
| `npm run baixar` | baixa um relatório local, sem AWS (fase 1) |
| `npm run typecheck` | `tsc --noEmit` em todos os workspaces |
| `npm test` | testes offline (parser e fluxo contra o HAR gravado) |

## Estrutura

```
packages/shared    contratos zod do pedido e da resposta
packages/sischef   o crawler: seletores, fluxo, parsers, gravador e CLI
apps/api           a Lambda: confere a chave, chama o crawler, sobe no S3
infra              bootstrap CloudFormation + template do SAM
docs               como funciona, infra, runbook e ADRs
```

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
