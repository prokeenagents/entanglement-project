#!/usr/bin/env bash
#
# deploy.sh — full, idempotent deploy of the site to Cloud Run: APIs, Artifact
# Registry, the service account and its secret access, build + deploy with the
# complete runtime config, then — once DOMAIN is set — the custom domain + DNS record.
#
# Run cli/secrets.sh first. Re-run deploy.sh after a secret rotation, a DOMAIN change
# or any change to the env values / runtime settings below; for a plain code update
# use redeploy.sh (it keeps everything set here).
#
# The Cloud Run SERVICE, image and secrets live in PROJECT_SVC; the DNS record in
# PROJECT_DNS (zone DNS_ZONE) — both set in cli/config.sh.
#
# Runtime shape — and why:
#   • AT MOST ONE instance (--max-instances 1). The Keen connector keeps its token,
#     certificate and caches in process memory, and the webhook → long-poll event
#     bus is in memory too: a second instance would get webhooks meant for the
#     first and never push them to its own browsers.
#   • Scale to zero, request-based billing (--min-instances 0 --cpu-throttling): we
#     pay only while a request is open. A VISIBLE tab always holds one (the
#     /api/events long poll), so the instance runs — with CPU — exactly while someone
#     has the site in front of them; hidden tabs pause their poll (events.tsx).
#   • Cold start: the first visitor after an idle spell is held by the proxy until
#     the connector has booted (utils/demo.ts, ≤10s); --cpu-boost shortens it.
#   • --concurrency 1000. Every visible tab holds one long poll for up to 25s; the
#     default 80 would cap the site at ~80 open tabs on one instance.
#   • Public via --no-invoker-iam-check, NOT --allow-unauthenticated: the org policy
#     iam.allowedPolicyMemberDomains refuses an allUsers binding (the deploy only
#     warns and the site answers 403). The docs site is public the same way.
#
# Prereqs: gcloud authenticated (gcloud auth login) with rights in BOTH projects.

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/config.sh"

# ---- preflight --------------------------------------------------------------
if [[ ! -f "${SOURCE_DIR}/Dockerfile" ]]; then
    echo "ERROR: no Dockerfile at ${SOURCE_DIR}." >&2
    exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
    echo "ERROR: no env file at ${ENV_FILE} (set ENV_FILE=/path/to/file)." >&2
    exit 1
fi

SITE_URL="$(site_url)"

echo "==> service project : ${PROJECT_SVC}"
echo "==> region          : ${REGION}"
echo "==> service         : ${SERVICE} (runs as ${RUN_SA})"
echo "==> site (origin)   : ${SITE_URL}"
if [[ -n "${DOMAIN}" ]]; then
    echo "==> dns project     : ${PROJECT_DNS} (zone ${DNS_ZONE})"
fi
echo "==> source          : ${SOURCE_DIR}"
echo "==> env file        : ${ENV_FILE}"
echo

# ---- 1) enable APIs + grant Cloud Build permission (idempotent) ------------
echo "==> [1/6] enabling APIs on ${PROJECT_SVC} ..."
gcloud services enable \
    run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com \
    --project "${PROJECT_SVC}"

# `gcloud run deploy --source` builds via Cloud Build as the Compute Engine default
# service account; without the builder role the first source deploy fails with a
# 403 storage.objects.get on run-sources-*. Re-binding the same role is a no-op.
PROJECT_NUM="$(gcloud projects describe "${PROJECT_SVC}" --format='value(projectNumber)')"
CB_SA="${PROJECT_NUM}-compute@developer.gserviceaccount.com"
gcloud projects add-iam-policy-binding "${PROJECT_SVC}" \
    --member="serviceAccount:${CB_SA}" \
    --role="roles/cloudbuild.builds.builder" \
    --condition=None >/dev/null

# ---- 2) Artifact Registry repo in the deploy region (idempotent) -----------
echo "==> [2/6] ensuring Artifact Registry repo '${AR_REPO}' in ${REGION} ..."
gcloud artifacts repositories describe "${AR_REPO}" \
    --location "${REGION}" --project "${PROJECT_SVC}" >/dev/null 2>&1 \
    || gcloud artifacts repositories create "${AR_REPO}" \
        --repository-format=docker --location "${REGION}" \
        --description="Cloud Run source deploys" --project "${PROJECT_SVC}"

# ---- 3) the service's own identity + read access to ITS secrets only -------
echo "==> [3/6] service account ${RUN_SA} + secret access ..."
gcloud iam service-accounts describe "${RUN_SA}" --project "${PROJECT_SVC}" >/dev/null 2>&1 \
    || gcloud iam service-accounts create "${RUN_SA_NAME}" \
        --display-name="${SERVICE} (Cloud Run runtime)" --project "${PROJECT_SVC}"

# The newest ENABLED version of a secret ('' when it has none). Pinned — never
# `latest`, so every instance of a revision runs with the same value, and a rotation
# is an explicit deploy.
newest_version() {
    gcloud secrets versions list "$1" --project "${PROJECT_SVC}" \
        --filter='state=ENABLED' --sort-by='~createTime' --limit=1 --format='value(name)' 2>/dev/null || true
}

SECRET_FLAGS=()

# Grant the runtime SA read access to ONE secret (on the secret, not the project)
# and pin its version onto the revision.
mount_secret() {
    local var="$1" name="$2" version="$3"

    gcloud secrets add-iam-policy-binding "${name}" --project "${PROJECT_SVC}" \
        --member="serviceAccount:${RUN_SA}" --role="roles/secretmanager.secretAccessor" \
        --condition=None >/dev/null

    SECRET_FLAGS+=("${var}=${name}:${version##*/}")
    echo "    ${var} ← ${name}:${version##*/}"
}

for PAIR in "${SECRETS[@]}"; do
    VERSION="$(newest_version "${PAIR#*:}")"

    if [[ -z "${VERSION}" ]]; then
        echo "ERROR: secret ${PAIR#*:} has no enabled version — run cli/secrets.sh first." >&2
        exit 1
    fi

    mount_secret "${PAIR%%:*}" "${PAIR#*:}" "${VERSION}"
done

for PAIR in "${OPTIONAL_SECRETS[@]}"; do
    VERSION="$(newest_version "${PAIR#*:}")"

    if [[ -z "${VERSION}" ]]; then
        echo "    ${PAIR%%:*}: no secret ${PAIR#*:} yet — deployed without it (optional)"
        continue
    fi

    mount_secret "${PAIR%%:*}" "${PAIR#*:}" "${VERSION}"
done

# ---- 4) build (from the Dockerfile) + deploy with the full runtime config --
echo "==> [4/6] building + deploying ${SERVICE} from ${SOURCE_DIR} ..."

ENV_VARS_FILE="$(mktemp)"
trap 'rm -f "${ENV_VARS_FILE}"' EXIT

printf 'KEEN_ORIGIN: "%s"\n' "${SITE_URL}" >> "${ENV_VARS_FILE}"
# Cloud Run appends exactly the client IP to X-Forwarded-For (measured), so the rate
# limiter's default TRUSTED_PROXY_HOPS=1 is right. Put a load balancer in front → 2.

for VAR in "${PLAIN_VARS[@]}"; do
    VALUE="$(env_value "${VAR}")"
    if [[ -z "${VALUE}" ]]; then
        echo "ERROR: ${VAR} is empty or missing in ${ENV_FILE}." >&2
        exit 1
    fi
    printf '%s: "%s"\n' "${VAR}" "${VALUE}" >> "${ENV_VARS_FILE}"
done

for VAR in "${OPTIONAL_PLAIN_VARS[@]}"; do
    VALUE="$(env_value "${VAR}")"
    if [[ -n "${VALUE}" ]]; then
        printf '%s: "%s"\n' "${VAR}" "${VALUE}" >> "${ENV_VARS_FILE}"
    fi
done

gcloud run deploy "${SERVICE}" \
    --source "${SOURCE_DIR}" \
    --project "${PROJECT_SVC}" \
    --region "${REGION}" \
    --service-account "${RUN_SA}" \
    --env-vars-file "${ENV_VARS_FILE}" \
    --set-secrets "$(IFS=,; echo "${SECRET_FLAGS[*]}")" \
    --min-instances 0 \
    --max-instances 1 \
    --cpu-throttling \
    --cpu-boost \
    --cpu 1 \
    --memory 512Mi \
    --concurrency 1000 \
    --timeout 300 \
    --no-invoker-iam-check \
    --port 8080 \
    --quiet

if [[ -z "${DOMAIN}" ]]; then
    echo "==> [5/6] [6/6] no custom domain (DOMAIN is empty in config.sh) — skipped."
else
    # ---- 5) map the custom domain (idempotent) -----------------------------
    echo "==> [5/6] mapping ${DOMAIN} -> ${SERVICE} ..."
    gcloud beta run domain-mappings describe --domain "${DOMAIN}" \
        --region "${REGION}" --project "${PROJECT_SVC}" >/dev/null 2>&1 \
        || gcloud beta run domain-mappings create \
            --service "${SERVICE}" --domain "${DOMAIN}" \
            --region "${REGION}" --project "${PROJECT_SVC}"
    # If this fails asking to VERIFY ownership: verify the parent domain once for the
    # deploying account (gcloud domains verify <domain> → Search Console prints a TXT
    # value), add it to the zone and re-run:
    #   gcloud dns record-sets create <domain>. --zone "${DNS_ZONE}" \
    #     --project "${PROJECT_DNS}" --type TXT --ttl 300 --rrdatas '"<VALUE>"'

    # ---- 6) publish the DNS record in the DNS project (idempotent) ---------
    echo "==> [6/6] wiring DNS for ${DOMAIN} in ${PROJECT_DNS}/${DNS_ZONE} ..."
    REC_TYPE="$(gcloud beta run domain-mappings describe --domain "${DOMAIN}" \
        --region "${REGION}" --project "${PROJECT_SVC}" \
        --format='value(status.resourceRecords[0].type)')"
    REC_DATA="$(gcloud beta run domain-mappings describe --domain "${DOMAIN}" \
        --region "${REGION}" --project "${PROJECT_SVC}" \
        --format='value(status.resourceRecords[0].rrdata)')"

    if [[ -z "${REC_TYPE}" || -z "${REC_DATA}" ]]; then
        echo "    Cloud Run has not published resource records yet — re-run in a moment" >&2
        echo "    (the mapping needs a few seconds after creation)." >&2
        exit 0
    fi
    echo "    Cloud Run wants: ${REC_TYPE} ${DOMAIN}. -> ${REC_DATA}"

    if gcloud dns record-sets describe "${DOMAIN}." --zone "${DNS_ZONE}" \
        --project "${PROJECT_DNS}" --type "${REC_TYPE}" >/dev/null 2>&1; then
        echo "    a ${REC_TYPE} record for ${DOMAIN}. already exists — left untouched."
    else
        gcloud dns record-sets create "${DOMAIN}." \
            --zone "${DNS_ZONE}" --project "${PROJECT_DNS}" \
            --type "${REC_TYPE}" --ttl 300 --rrdatas "${REC_DATA}"
        echo "    created ${REC_TYPE} ${DOMAIN}. -> ${REC_DATA}"
    fi
fi

echo
echo "==> done."
echo "    site      : ${SITE_URL}"
if [[ -n "${DOMAIN}" ]]; then
    echo "                (Google issues the managed TLS cert for the domain automatically —"
    echo "                allow ~15-60 min for it to go green)."
fi
echo "    Keen side : the api_key's webhook URL must be ${SITE_URL}/api/keen-webhook/<KEEN_WEBHOOK_SECRET>"
echo "                (the value from ${ENV_FILE}; Keen does not sign webhooks, the secret path does the job)"
echo "                and its origin allow-list must contain ${SITE_URL}."
