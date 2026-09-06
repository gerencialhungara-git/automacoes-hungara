# A imagem oficial do Playwright traz o Chromium E todas as libs de sistema dele.
# A tag DEVE ser a mesma versão do "playwright" no runtime-package.json: é isso
# que garante que o browser da Lambda é o mesmo que gravou o fluxo.
FROM mcr.microsoft.com/playwright:v1.63.0-noble AS base

# ---- dependências -----------------------------------------------------------
# O aws-lambda-ric (o processo que conversa com o runtime da Lambda) é nativo e
# precisa de compilador. Compilamos aqui e copiamos só o resultado, para o
# toolchain não ir junto na imagem final.
FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends \
      g++ make cmake unzip libcurl4-openssl-dev autoconf automake libtool python3 \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /deps
COPY apps/api/runtime-package.json ./package.json
# O browser já está na imagem; baixar de novo seria 500 MB à toa.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install --no-audit --no-fund --omit=dev

# ---- imagem final -----------------------------------------------------------
FROM base
ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    HOME=/tmp \
    TMPDIR=/tmp
# HOME=/tmp é obrigatório: o Chromium escreve o profile no $HOME e /var/task é
# somente leitura na Lambda.
WORKDIR /var/task
COPY --from=deps /deps/node_modules ./node_modules
COPY --from=deps /deps/package.json ./package.json
# dist/ é o bundle do esbuild (apps/api/scripts/build.mjs), gerado antes do build.
COPY apps/api/dist/ ./

ENTRYPOINT ["/var/task/node_modules/.bin/aws-lambda-ric"]
CMD ["index.handler"]
