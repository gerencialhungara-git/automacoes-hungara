# Infra e deploy

## Contas

| | |
|---|---|
| Conta AWS | `622703417827` (Hungara) — perfil local `hungara`, **nunca** o `default` |
| Região | `sa-east-1` |
| GitHub | org `gerencialhungara-git`, repo `automacoes-hungara` |
| Stacks | `automacoes-hungara-bootstrap` (uma vez) + uma por rotina: `automacoes-hungara-crawler`, `automacoes-hungara-logistica` |

## Bootstrap (roda uma vez)

```bash
AWS_PROFILE=hungara ./infra/bootstrap/bootstrap.sh
```

Cria a role de deploy (OIDC), o repositório ECR, o bucket de dados, o bucket de artefatos
do SAM, o budget e o **tópico SNS de alertas** — um só para todas as rotinas, para a
inscrição de e-mail ser feita uma vez e sobreviver a qualquer redeploy:

```bash
AWS_PROFILE=hungara aws sns subscribe --region sa-east-1 \
  --topic-arn arn:aws:sns:sa-east-1:622703417827:automacoes-hungara-alertas \
  --protocol email --notification-endpoint gerencial.hungara@gmail.com
```

Ao final o script imprime o que colar no GitHub. A chave de API só é gerada com
`--nova-chave`; sem a flag ele avisa que a atual continua valendo.

> O provedor OIDC do GitHub **já existe** nesta conta — foi criado pelo bootstrap do
> `hub-hungara`. Uma conta só pode ter um por URL, então este template aponta para o
> existente em vez de criar outro.

## Segredos e variáveis

| Nome | Onde | O que é |
|---|---|---|
| `AWS_ROLE_ARN` | Secret | role assumida por OIDC, sai do bootstrap |
| `SISCHEF_USUARIO` / `SISCHEF_SENHA` | Secret | credenciais do sistema.sischef.com |
| `CRAWLER_API_KEYS_SHA256` | Secret | SHA-256 das chaves aceitas, separados por vírgula |
| `REPORTS_BUCKET` | Variable | bucket dos relatórios |

Os valores chegam na Lambda como variáveis de ambiente, via parâmetros `NoEcho` do
CloudFormation — mesma convenção do Hub. **Ressalva honesta:** `NoEcho` esconde o
valor de `describe-stacks`, mas quem tiver `lambda:GetFunctionConfiguration` lê a
variável. A credencial do Sischef é de outra espécie (é do fornecedor e dá acesso à
retaguarda da rede); migrar para SSM `SecureString` é ~10 linhas e vale fazer.

## Pipeline

`ci.yml` em todo PR: typecheck, testes, conferência de que a versão do Playwright bate nos
três lugares, `sam validate` e `docker build` sem push.

**Um workflow de deploy por rotina**, com filtro de path — `deploy-crawler.yml` só dispara
quando `apps/crawler`, `packages/sischef`, `packages/shared` ou `infra/crawler` mudam. É o
que evita reconstruir a imagem de 3,7 GB do Chromium para editar um JSON da Logística.

Cada um assume a role por OIDC, faz `sam build` e `sam deploy` na sua stack, e termina com
um `curl` no `/health`.

## Rotação da chave de API

Sem indisponibilidade, quatro passos: gere a nova; deixe `CRAWLER_API_KEYS_SHA256`
com os dois hashes separados por vírgula e faça o deploy; troque quem chama; remova o
hash antigo e faça o deploy de novo.

## Custo

Menos de US$ 0,50/mês para ~50 execuções: a Lambda cabe no free tier e quase tudo é o
armazenamento da imagem no ECR. O budget está em US$ 5. A única coisa capaz de mudar
essa ordem de grandeza é precisar de IP fixo (VPC + NAT Gateway, ~US$ 35/mês).
