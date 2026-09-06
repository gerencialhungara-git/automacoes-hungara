#!/usr/bin/env bash
# Roda UMA vez, na máquina do responsável, com o perfil AWS da Hungara.
# Cria: role de deploy (OIDC), repositório ECR, bucket dos relatórios,
# bucket de artefatos do SAM e budget. Depois imprime o que colar no GitHub.
set -euo pipefail
export AWS_PROFILE="${AWS_PROFILE:-hungara}"
export AWS_DEFAULT_REGION=sa-east-1
CONTA_ESPERADA=622703417827

CONTA=$(aws sts get-caller-identity --query Account --output text)
if [[ "$CONTA" != "$CONTA_ESPERADA" ]]; then
  echo "ERRO: perfil '$AWS_PROFILE' aponta para a conta $CONTA, esperado $CONTA_ESPERADA (Hungara). Abortando." >&2
  exit 1
fi
echo "Conta OK: $CONTA (perfil $AWS_PROFILE)"

echo "→ Role de deploy + ECR + buckets + budget"
aws cloudformation deploy \
  --stack-name crawler-sischef-bootstrap \
  --template-file "$(dirname "$0")/github-oidc.yaml" \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset

saida() {
  aws cloudformation describe-stacks --stack-name crawler-sischef-bootstrap \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

ROLE_ARN=$(saida DeployRoleArn)
BUCKET=$(saida ReportsBucketName)
ECR=$(saida ImageRepositoryUri)

# A chave de API é gerada aqui e NUNCA é guardada na AWS: o que vai para a
# Lambda é só o SHA-256. Guarde a chave em si no gerenciador de senhas.
CHAVE=$(openssl rand -base64 48 | tr -d '\n=' | tr '+/' '-_')
HASH=$(printf '%s' "$CHAVE" | shasum -a 256 | cut -d' ' -f1)

cat <<FIM

==================== COLE NO GITHUB (Settings → Secrets and variables → Actions) ====================
Secrets:
  AWS_ROLE_ARN            = $ROLE_ARN
  SISCHEF_USUARIO         = (o mesmo usuário do sistema.sischef.com)
  SISCHEF_SENHA           = (a senha dele)
  CRAWLER_API_KEYS_SHA256 = $HASH
Variables:
  REPORTS_BUCKET          = $BUCKET

==================== GUARDE NO GERENCIADOR DE SENHAS (não vai para a AWS) ====================
  CRAWLER_API_KEY         = $CHAVE

  É com ela que se chama o endpoint:
    curl -X POST "\$URL" -H "x-api-key: $CHAVE" \\
         -H 'content-type: application/json' \\
         -d '{"inicio":"2026-09-01","fim":"2026-09-05"}'

  Rotação sem parar nada: gere a nova, deixe CRAWLER_API_KEYS_SHA256 com os dois
  hashes separados por vírgula, faça o deploy, troque quem chama, e só então
  remova o hash antigo.

ECR da imagem: $ECR
  (confira que bate com image_repositories em infra/samconfig.toml)
FIM
