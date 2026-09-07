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
  --stack-name automacoes-hungara-bootstrap \
  --template-file "$(dirname "$0")/github-oidc.yaml" \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset

saida() {
  aws cloudformation describe-stacks --stack-name automacoes-hungara-bootstrap \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

ROLE_ARN=$(saida DeployRoleArn)
BUCKET=$(saida ReportsBucketName)
ECR=$(saida ImageRepositoryUri)

# Chave de API por rotina, gerada só quando pedida:
#   ./bootstrap.sh --nova-chave crawler
#   ./bootstrap.sh --nova-chave logistica
# Este script é idempotente e vai ser rodado de novo a cada mudança no bootstrap;
# gerar chave a cada vez faria parecer que a anterior deixou de valer.
if [[ "${1:-}" == "--nova-chave" ]]; then
  ROTINA="${2:-}"
  case "$ROTINA" in
    crawler)   SECRET_HASH="CRAWLER_API_KEYS_SHA256";   SECRET_CHAVE="CRAWLER_API_KEY" ;;
    logistica) SECRET_HASH="LOGISTICA_API_KEYS_SHA256"; SECRET_CHAVE="LOGISTICA_API_KEY" ;;
    *) echo "Uso: $0 --nova-chave <crawler|logistica>" >&2; exit 1 ;;
  esac
  CHAVE=$(openssl rand -base64 48 | tr -d '\n=' | tr '+/' '-_')
  HASH=$(printf '%s' "$CHAVE" | shasum -a 256 | cut -d' ' -f1)
  cat <<CHAVEFIM

==================== CHAVE NOVA DA ROTINA "$ROTINA" ====================
  $SECRET_HASH = $HASH
      secret no repo automacoes-hungara (é o que a Lambda confere)
  $SECRET_CHAVE = $CHAVE
      gerenciador de senhas + secret de quem CHAMA a rotina
      (a do crawler também vai no automacoes-hungara, porque a Logística o chama;
       a da logistica vai no hub-hungara, porque o Hub chama a Logística)

  Rotação sem parar nada: deixe $SECRET_HASH com o hash antigo E o novo,
  separados por vírgula; faça o deploy; troque quem chama; só então remova o antigo.
CHAVEFIM
else
  echo
  echo "Chaves de API: mantidas. As que já estão nos secrets continuam valendo."
  echo "Para gerar outra: $0 --nova-chave <crawler|logistica>"
fi

cat <<FIM

==================== COLE NO GITHUB (Settings → Secrets and variables → Actions) ====================
Secrets:
  AWS_ROLE_ARN               = $ROLE_ARN
  SISCHEF_USUARIO            = (o mesmo usuário do sistema.sischef.com)
  SISCHEF_SENHA              = (a senha dele)
  CRAWLER_API_KEYS_SHA256    = (a chave que o crawler aceita; --nova-chave crawler)
  CRAWLER_API_KEY            = (a mesma em texto: a Logística chama o crawler)
  LOGISTICA_API_KEYS_SHA256  = (a chave que a Logística aceita; --nova-chave logistica)
Variables:
  REPORTS_BUCKET             = $BUCKET
  CRAWLER_URL                = (Function URL do crawler, com barra no fim)

ECR da imagem: $ECR
  (confira que bate com image_repositories em infra/crawler/samconfig.toml)
FIM
