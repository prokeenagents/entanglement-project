#!/usr/bin/env bash
#
# config.sh — the ONE place for the Cloud Run settings, sourced by secrets.sh,
# deploy.sh and redeploy.sh so the three can never drift apart.
#
# Values only — no secrets live here. Secret VALUES come from the local env file
# (ENV_FILE) and are pushed into Secret Manager by secrets.sh.

# Fill in YOUR Google Cloud ids before the first run — the scripts refuse to start
# while a value is still a <placeholder>.
PROJECT_SVC="<your-gcp-project>"         # where Cloud Run, the image and the secrets live
# The Cloud DNS zone for a custom domain (its project + managed-zone name). Cloud Run
# maps only domains the deploying account has verified in Search Console (see
# DEPLOYING.md). Used only when DOMAIN is set.
PROJECT_DNS="<your-dns-project>"
DNS_ZONE="<your-dns-zone>"
# europe-west4 is the closest region to BG that supports Cloud Run domain
# mappings (europe-west3 and europe-central2 do not).
REGION="europe-west4"
# The site's own service — never the name of another site's service: deploy.sh would
# replace that site's revision, and the secrets and the runtime account are named
# after it too.
SERVICE="entanglement-demo"
# The custom domain — the site's origin (KEEN_ORIGIN), which the Keen api_key must
# allow-list. EMPTY = serve on Cloud Run's own URL (site_url below) and skip the
# mapping + DNS steps. Changing it changes the origin: run deploy.sh, not
# redeploy.sh, and move the Keen api_key's origin + webhook URL with it.
DOMAIN=""
AR_REPO="cloud-run-source-deploy"        # Artifact Registry repo for source builds
RUN_SA_NAME="${SERVICE}-run"             # the service's own identity (reads its secrets, nothing else)
RUN_SA="${RUN_SA_NAME}@${PROJECT_SVC}.iam.gserviceaccount.com"

if [[ "${PROJECT_SVC}" == \<* ]]; then
    echo "cli/config.sh: set PROJECT_SVC (your Google Cloud project) first" >&2
    exit 1
fi

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"  # repo root (cli/'s parent)
ENV_FILE="${ENV_FILE:-${SOURCE_DIR}/.env}"                      # local only — never committed, never in the image

# Real secrets → Secret Manager, one secret each ("ENV_VAR:secret-name").
SECRETS=(
    "KEEN_CLIENT_SECRET:${SERVICE}-keen-client-secret"
    "KEEN_API_KEY_SECRET:${SERVICE}-keen-api-key-secret"
    # The secret path segment of the webhook URL (<site>/api/keen-webhook/<value>).
    # The site refuses to boot without it. Generate: openssl rand -hex 32
    "KEEN_WEBHOOK_SECRET:${SERVICE}-keen-webhook-secret"
)
# Secrets the site runs without — skipped while empty. Without the ElevenLabs key
# the dictation route answers 503 "not configured"; everything else works.
OPTIONAL_SECRETS=(
    "ELEVENLABS_API_KEY:${SERVICE}-elevenlabs-api-key"
)

# Plain env vars — addresses and identifiers, useless without the secrets above.
# Read from ENV_FILE at deploy time, so they stay out of the repo too. KEEN_ORIGIN
# is NOT read from there: it is wherever the site is deployed (site_url), so
# deploy.sh sets it — the local file's value is for local runs.
PLAIN_VARS=(KEEN_HOST KEEN_WS KEEN_CLIENT_ID KEEN_API_KEY_ID)
OPTIONAL_PLAIN_VARS=(ELEVENLABS_STT_MODEL)

# The value of KEY in ENV_FILE ('' when absent). Strips CR (Windows line endings)
# and one pair of surrounding quotes. Never `source` the file — it is data.
env_value() {
    local line
    line="$(grep -E "^${1}=" "${ENV_FILE}" | tail -n 1 || true)"
    line="${line#*=}"
    line="${line%$'\r'}"
    if [[ "${line}" == \"*\" || "${line}" == \'*\' ]]; then
        line="${line:1:${#line}-2}"
    fi
    printf '%s' "${line}"
}

# The site's public origin — what KEEN_ORIGIN must be and what the Keen api_key
# allow-lists. The custom domain once set; until then Cloud Run's deterministic
# URL (https://<service>-<project number>.<region>.run.app), known before the
# first deploy. The service also answers on a legacy *.a.run.app URL — don't use
# it: the relay drops a browser WebSocket from any origin but this one.
site_url() {
    if [[ -n "${DOMAIN}" ]]; then
        printf 'https://%s' "${DOMAIN}"
        return
    fi

    local number
    number="$(gcloud projects describe "${PROJECT_SVC}" --format='value(projectNumber)')"

    if [[ -z "${number}" ]]; then
        echo "ERROR: cannot read the project number of ${PROJECT_SVC} (gcloud auth login?)." >&2
        return 1
    fi

    printf 'https://%s-%s.%s.run.app' "${SERVICE}" "${number}" "${REGION}"
}
