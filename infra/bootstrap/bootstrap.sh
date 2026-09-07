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

# A chave de API só é gerada quando pedida (`--nova-chave`). Este script é
# idempotente e vai ser rodado de novo a cada mudança no bootstrap; gerar chave
# a cada vez faria parecer que a chave anterior deixou de valer.
if [[ "${1:-}" == "--nova-chave" ]]; then
  CHAVE=$(openssl rand -base64 48 | tr -d '\n=' | tr '+/' '-_')
  HASH=$(printf '%s' "$CHAVE" | shasum -a 256 | cut -d' ' -f1)
  cat <<CHAVEFIM

==================== CHAVE NOVA ====================
  CRAWLER_API_KEYS_SHA256 = $HASH        (secret no GitHub)
  CRAWLER_API_KEY         = $CHAVE       (gerenciador de senhas; não vai para a AWS)

  Para rodar sem parar nada: deixe CRAWLER_API_KEYS_SHA256 com o hash antigo E o
  novo, separados por vírgula; faça o deploy; troque quem chama; só então remova
  o antigo e faça o deploy de novo.
CHAVEFIM
else
  echo
  echo "Chave de API: mantida. A que já está em CRAWLER_API_KEYS_SHA256 continua valendo."
  echo "Para gerar outra: $0 --nova-chave"
fi

cat <<FIM

==================== COLE NO GITHUB (Settings → Secrets and variables → Actions) ====================
Secrets:
  AWS_ROLE_ARN            = $ROLE_ARN
  SISCHEF_USUARIO         = (o mesmo usuário do sistema.sischef.com)
  SISCHEF_SENHA           = (a senha dele)
  CRAWLER_API_KEYS_SHA256 = (só muda se você rodar com --nova-chave)
Variables:
  REPORTS_BUCKET          = $BUCKET

ECR da imagem: $ECR
  (confira que bate com image_repositories em infra/samconfig.toml)
FIM
