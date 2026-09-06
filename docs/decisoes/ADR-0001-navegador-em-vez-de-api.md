# ADR-0001 — Crawler de navegador, porque não existe API

**Contexto.** O Sischef não publica API para o cliente final. O pedido formal ao
suporte está em `MCPs/sischef/CHECKLIST-DESCOBERTA.md` e segue sem resposta desde
agosto de 2026. A gravação do fluxo (06/09/2026) confirmou que a retaguarda é
JSF/PrimeFaces: cada POST carrega um `javax.faces.ViewState` que muda a cada
resposta, e os ids dos componentes (`j_idt217`) são gerados pelo servidor.

**Decisão.** Automatizar a interface web com Playwright, em vez de reimplementar o
protocolo com `fetch`. Replicar o JSF exigiria raspar o ViewState e os ids de cada
resposta intermediária — possível, mas quebraria a cada mexida na tela deles.

**Consequências.** O projeto carrega um Chromium, o que obriga a Lambda de imagem
(ADR-0002) e custa ~1 min por execução. Em troca, o que roda em produção é o mesmo
caminho que se grava com `npm run gravar`, e consertar um seletor é editar um
arquivo. Isto é um contorno: se o Sischef liberar API, `baixarRelatorio.ts` vira um
`fetch` e todo o resto — contrato, handler, S3, deploy — continua valendo.
