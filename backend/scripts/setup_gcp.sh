#!/usr/bin/env bash
set -euo pipefail

PROJECT="${1:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-asia-south1}"
RUNTIME_SA="lexguard-runtime"
SECRET_NAME="lexguard-gemini-key"

if [[ -z "${PROJECT}" || "${PROJECT}" == "(unset)" ]]; then
  echo "error: no active gcloud project. Pass as arg or run 'gcloud config set project <id>'." >&2
  exit 1
fi

RUNTIME_SA_EMAIL="${RUNTIME_SA}@${PROJECT}.iam.gserviceaccount.com"

echo "project=${PROJECT}  region=${REGION}"

echo "==> Enabling APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  --project "${PROJECT}"

echo "==> Ensuring runtime service account exists..."
if ! gcloud iam service-accounts describe "${RUNTIME_SA_EMAIL}" --project "${PROJECT}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${RUNTIME_SA}" \
    --display-name="LexGuard Cloud Run runtime" \
    --project "${PROJECT}"
else
  echo "  (already exists)"
fi

echo "==> Granting IAM roles to runtime SA..."
for ROLE in \
  roles/secretmanager.secretAccessor \
  roles/logging.logWriter \
  roles/monitoring.metricWriter; do
  gcloud projects add-iam-policy-binding "${PROJECT}" \
    --member="serviceAccount:${RUNTIME_SA_EMAIL}" \
    --role="${ROLE}" \
    --condition=None \
    --quiet >/dev/null
  echo "  + ${ROLE}"
done

echo "==> Pushing GEMINI_API_KEY into Secret Manager..."
ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env"
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "error: ${ENV_FILE} not found." >&2
  exit 1
fi

KEY="$(grep -E '^GEMINI_API_KEY=' "${ENV_FILE}" | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'" )"
if [[ -z "${KEY}" ]]; then
  echo "error: GEMINI_API_KEY is empty in ${ENV_FILE}." >&2
  exit 1
fi

if gcloud secrets describe "${SECRET_NAME}" --project "${PROJECT}" >/dev/null 2>&1; then
  printf '%s' "${KEY}" | gcloud secrets versions add "${SECRET_NAME}" \
    --data-file=- --project "${PROJECT}" >/dev/null
  echo "  (added new version)"
else
  printf '%s' "${KEY}" | gcloud secrets create "${SECRET_NAME}" \
    --replication-policy="automatic" --data-file=- --project "${PROJECT}" >/dev/null
  echo "  (created)"
fi

echo ""
echo "setup complete"
echo "  runtime SA : ${RUNTIME_SA_EMAIL}"
echo "  secret     : projects/${PROJECT}/secrets/${SECRET_NAME}"
echo ""
echo "next:  ./scripts/deploy.sh"
