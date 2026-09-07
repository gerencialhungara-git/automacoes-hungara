# Runbook

O alarme `automacoes-hungara-crawler-errors` avisa no tópico SNS `automacoes-hungara-alertas`.
Os logs ficam em `/aws/lambda/automacoes-hungara-crawler`; cada etapa é uma linha
(`{"etapa":"login",...}`), então o log diz em que passo parou.

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Parou em `login` | senha trocada, ou o Sischef pediu verificação | entre à mão no site; se pediu confirmação de dispositivo, resolva e atualize o secret |
| Parou em `abrir-relatorio` | mexeram no menu ou renomearam o relatório | `npm run gravar` e atualize `seletores.ts` |
| `O campo de data não aceitou` | trocaram o componente de calendário | `npm run gravar`, veja o novo id em `fluxo.har`, ajuste `seletores.ts` |
| Parou em `baixar` (timeout) | período longo demais, ou Sischef lento | tente um intervalo menor; o passo já espera 3 min |
| `LAYOUT_MUDOU` | tiraram ou renomearam coluna do export | compare com `docs/01-como-funciona.md`; ajuste `OBRIGATORIAS` no parser |
| `LEITURA_SUSPEITA` | coluna existe mas veio vazia — conversão de tipo quebrou | é o caso dos IDs do `.xls`; veja o teste de regressão em `test/parser.test.ts` |
| `RELATORIO_VAZIO` | não houve pedido no período | confira o intervalo antes de suspeitar do crawler |
| 401 na chamada | chave errada ou rotação pela metade | confira `CRAWLER_API_KEYS_SHA256`; durante a rotação os dois hashes precisam estar lá |
| `Assertion error` do playwright-core, ~15 s | o Chromium morreu ao subir; veja o log com `DEBUG=pw:browser*` | quase sempre é flag faltando na Lambda — dá para testar sem redeploy pondo `CHROMIUM_ARGS` na configuração da função |
| Timeout da Lambda (10 min) | Sischef muito lento ou travou numa tela | veja o log para a última etapa; rode local com `--ver` no mesmo período |

**Reproduzir na sua máquina** é quase sempre o caminho mais rápido:

```bash
npm run baixar -- --inicio AAAA-MM-DD --fim AAAA-MM-DD --ver
```

Falhou? Há um screenshot em `packages/sischef/saida/falha-*.png` mostrando a tela
exata onde parou. Foi ele que resolveu os dois primeiros bugs deste projeto.

## Logística Diária

A rotina roda como job assíncrono: `POST /` devolve um `jobId` na hora e o trabalho
acontece numa invocação separada da mesma Lambda. O estado fica em
`s3://automacoes-hungara-dados-622703417827/logistica/jobs/<jobId>.json` — abrir esse
JSON é o jeito mais rápido de saber em que etapa parou.

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Job parado em `baixando-relatorio` | o crawler está frio ou o Sischef caiu | veja o runbook do crawler acima; a etapa mais lenta é normal levar ~45 s |
| `o crawler devolveu 401` | `CRAWLER_API_KEY` na Logística não bate com o hash no crawler | conferir os dois secrets; durante rotação os dois hashes têm de estar em `CRAWLER_API_KEYS_SHA256` |
| `LAYOUT_MUDOU` ou `LEITURA_SUSPEITA` | o export do Sischef mudou de colunas | ver `01-como-funciona.md`; é o parser do crawler reclamando, não a Logística |
| `CONFIG_INVALIDA: rótulo` / `SKU` | alguém editou `ordenacao-config.json` e duplicou linha ou SKU | o erro diz qual; corrigir o JSON e fazer deploy |
| Aviso de órfão numa loja que deveria produzir | falta `ID-PDV-LOJA` ou `Apelido` no Yungas | preencher no Yungas, rodar `npm run atualizar-cadastro` e fazer deploy |
| Colunas em ordem diferente do esperado | `ordem_lojas` da config está desatualizada | cosmético; atualizar a lista em `ordenacao-config.json` |
| Planilha com os totais em branco no Excel | `fullCalcOnLoad` não foi escrito | não deveria acontecer — os subtotais são fórmulas sem valor em cache; abrir chamado |
| Módulo do Hub diz "não está configurado neste ambiente" | faltam `LOGISTICA_URL`/`LOGISTICA_API_KEY` na API do Hub | são opcionais de propósito, para não derrubar o portal; preencher os secrets do `hub-hungara` |

**Reproduzir sem a nuvem** é o caminho mais curto para investigar cálculo: o pacote
`packages/logistica` roda offline, e `npm test` compara a saída com as planilhas que o
Python gerou de verdade, célula por célula.
