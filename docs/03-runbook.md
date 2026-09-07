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
