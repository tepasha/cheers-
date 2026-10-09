#!/usr/bin/env bash
# Налаштовує Workload Identity Federation для GitHub Actions (deploy-backend.yml).
# Запуск у Google Cloud Shell (або локально з gcloud під обліковим записом з правами owner):
#   bash setup-gcp-wif.sh                                   # Firebase-проєкт за замовчуванням
#   bash setup-gcp-wif.sh my-staging-id my-production-id    # кілька Firebase-проєктів
# Скрипт ідемпотентний: повторний запуск нічого не ламає.
set -euo pipefail

WIF_PROJECT="cheers-511106"            # проєкт, де лежать пул і сервісний акаунт
POOL="cheers-app"
PROVIDER="github"
REPO="tepasha/cheers-"
SA="cheers-app@${WIF_PROJECT}.iam.gserviceaccount.com"
FIREBASE_PROJECTS=("${@:-gen-lang-client-0429616726}")
ROLES=(roles/firebase.admin roles/iam.serviceAccountUser roles/artifactregistry.admin)

PROJECT_NUMBER="$(gcloud projects describe "$WIF_PROJECT" --format='value(projectNumber)')"
PROVIDER_NAME="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"

echo "==> API для STS і IAM Credentials у ${WIF_PROJECT}"
gcloud services enable sts.googleapis.com iamcredentials.googleapis.com --project="$WIF_PROJECT"

echo "==> OIDC-провайдер ${PROVIDER} у пулі ${POOL}"
if gcloud iam workload-identity-pools providers describe "$PROVIDER" \
    --project="$WIF_PROJECT" --location=global --workload-identity-pool="$POOL" >/dev/null 2>&1; then
  echo "    вже існує, оновлюю умову й мапінг"
  gcloud iam workload-identity-pools providers update-oidc "$PROVIDER" \
    --project="$WIF_PROJECT" --location=global --workload-identity-pool="$POOL" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
    --attribute-condition="assertion.repository=='${REPO}'"
else
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
    --project="$WIF_PROJECT" --location=global --workload-identity-pool="$POOL" \
    --display-name="GitHub Actions" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
    --attribute-condition="assertion.repository=='${REPO}'"
fi

echo "==> Дозвіл workflow з ${REPO} діяти від імені ${SA}"
gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --project="$WIF_PROJECT" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${REPO}" \
  --condition=None >/dev/null

for fp in "${FIREBASE_PROJECTS[@]}"; do
  echo "==> Ролі деплою в Firebase-проєкті ${fp}"
  for role in "${ROLES[@]}"; do
    gcloud projects add-iam-policy-binding "$fp" \
      --member="serviceAccount:${SA}" --role="$role" --condition=None >/dev/null
    echo "    ${role}"
  done
done

cat <<EOF

Готово. У GitHub → Settings → Environments → staging / production задайте:
  GCP_WORKLOAD_IDENTITY_PROVIDER = ${PROVIDER_NAME}
  GCP_SERVICE_ACCOUNT            = ${SA}
EOF
