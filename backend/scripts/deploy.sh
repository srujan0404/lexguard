#!/usr/bin/env bash
set -euo pipefail

PROJECT="$(gcloud config get-value project 2>/dev/null)"
REGION="${REGION:-asia-south1}"
SERVICE="lexguard-api"
RUNTIME_SA_EMAIL="lexguard-runtime@${PROJECT}.iam.gserviceaccount.com"
SECRET_NAME="lexguard-gemini-key"

if [[ -z "${PROJECT}" || "${PROJECT}" == "(unset)" ]]; then
  echo "error: no active gcloud project." >&2
  exit 1
fi

echo "deploying ${SERVICE} to ${REGION} on ${PROJECT}"

cd "$(dirname "$0")/.."  # backend/

gcloud run deploy "${SERVICE}" \
  --source . \
  --region "${REGION}" \
  --project "${PROJECT}" \
  --service-account "${RUNTIME_SA_EMAIL}" \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 2 \
  --concurrency 20 \
  --timeout 60 \
  --port 8080 \
  --set-env-vars "LLM_BACKEND=aistudio,GCP_REGION=${REGION},APP_ENV=prod,GEMINI_MODEL=gemini-flash-latest,GEMINI_MODEL_HEAVY=gemini-flash-latest,ALLOWED_ORIGINS=*,LOG_LEVEL=INFO" \
  --set-secrets "GEMINI_API_KEY=${SECRET_NAME}:latest" \
  --quiet

URL="$(gcloud run services describe "${SERVICE}" \
  --region "${REGION}" --project "${PROJECT}" \
  --format='value(status.url)')"

echo ""
echo "deployed: ${URL}"
echo "health  : ${URL}/health"
echo "docs    : ${URL}/docs"
