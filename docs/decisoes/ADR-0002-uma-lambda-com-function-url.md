# ADR-0002 — Uma Lambda só, com Function URL síncrono e chave de API própria

**Contexto.** O crawl leva mais de 30 s, que é o teto fixo de integração do API
Gateway HTTP API — o mesmo que o Hub usa. Esse teto empurraria o desenho para duas
funções, job assíncrono, armazenamento de estado e polling. O uso real é de 30 a 50
execuções por mês, servidor-a-servidor.

**Decisão.** Uma única Lambda exposta por **Lambda Function URL**, que não tem o teto
de 30 s (vai até o timeout da função). Autenticação por chave própria no header
`x-api-key`, conferida com `timingSafeEqual` na primeira linha do handler; a
configuração guarda apenas o SHA-256 das chaves aceitas, nunca a chave.

**Consequências.** Somem a segunda função, o API Gateway, o certificado ACM, o
domínio próprio, o estado de job e o polling. O preço é o chamador esperar ~1 min, o
que é aceitável entre servidores mas desaconselha chamar direto do navegador — o
backend do Hub é quem deve chamar. Aceitar várias chaves ao mesmo tempo permite
rotação sem indisponibilidade. `AuthType: AWS_IAM` seria mais seguro e fica como
evolução: exige credencial AWS em quem chama.
