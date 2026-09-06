# ADR-0003 — Lambda de imagem, x86_64, com a imagem oficial do Playwright

**Contexto.** Chromium não cabe confortavelmente no limite de 250 MB do pacote zip.
As alternativas em zip (`@sparticuz/chromium`) entregam um Chromium avulso, que não é
o build que o Playwright fixa e testa — e essa divergência é a origem mais comum de
"funcionava ontem". Além disso o binário arm64 deles não vem no pacote npm, o que
obrigaria a hospedar um artefato fora do repositório.

**Decisão.** `PackageType: Image`, a partir de `mcr.microsoft.com/playwright:v1.63.0-noble`,
com o cliente de runtime da AWS (`aws-lambda-ric`) compilado num estágio separado.
Arquitetura **x86_64**, contrariando o arm64 do Hub.

**Consequências.** O limite vira 10 GB e a versão do browser fica presa no
`Dockerfile` — o `ci.yml` recusa o build se a tag da imagem e a lib divergirem. O
x86_64 é porque os runners do GitHub são amd64: arm64 exigiria emulação QEMU (build
de 15+ min) ou runner ARM, que em repositório privado depende do plano da
organização. Custa ~20% a mais de execução, sobre uma conta de centavos. O ECR passa
a guardar uma imagem de ~1 GB por deploy, contido por lifecycle de 3 imagens.
