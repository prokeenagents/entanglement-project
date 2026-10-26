#!/usr/bin/env bash
#
# secrets.sh — push the secret VALUES from the local env file into Secret Manager.
#
# Run it once before the first deploy, and again whenever a secret is rotated
# (then run deploy.sh, which pins the newest versions onto a new revision).
# Idempotent: a secret whose newest version already holds the same value gets no
# new version. Values are never printed.
#
# Secrets are single-region (REGION) — billed for one location, data stays in the EU.
# After a rotation is live, destroy the old version — every ENABLED or DISABLED
# version counts against the 6 free active versions per billing account:
#   gcloud secrets versions destroy <N> --secret <name> --project "${PROJECT_SVC}"

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/config.sh"

if [[ ! -f "${ENV_FILE}" ]]; then
    echo "ERROR: no env file at ${ENV_FILE} (set ENV_FILE=/path/to/file)." >&2
    exit 1
fi

echo "==> project : ${PROJECT_SVC} (secrets in ${REGION})"
echo "==> source  : ${ENV_FILE}"
echo

gcloud services enable secretmanager.googleapis.com --project "${PROJECT_SVC}"

# Push one secret's value: create the secret if missing, add a version only when
# the value changed.
push_secret() {
    local var="$1" name="$2" value="$3" current

    if ! gcloud secrets describe "${name}" --project "${PROJECT_SVC}" >/dev/null 2>&1; then
        gcloud secrets create "${name}" --project "${PROJECT_SVC}" \
            --replication-policy=user-managed --locations="${REGION}" >/dev/null
        echo "    created secret ${name}"
    fi

    current="$(gcloud secrets versions access latest --secret "${name}" --project "${PROJECT_SVC}" 2>/dev/null || true)"

    if [[ "${current}" == "${value}" ]]; then
        echo "    ${var} → ${name}: unchanged"
        return
    fi

    printf '%s' "${value}" | gcloud secrets versions add "${name}" --project "${PROJECT_SVC}" --data-file=- >/dev/null
    echo "    ${var} → ${name}: new version added"
}

# Check every required value BEFORE touching Secret Manager — a half-pushed set
# helps nobody.
for PAIR in "${SECRETS[@]}"; do
    VAR="${PAIR%%:*}"

    if [[ -z "$(env_value "${VAR}")" ]]; then
        echo "ERROR: ${VAR} is empty or missing in ${ENV_FILE}." >&2
        exit 1
    fi
done

for PAIR in "${SECRETS[@]}"; do
    VAR="${PAIR%%:*}"
    push_secret "${VAR}" "${PAIR#*:}" "$(env_value "${VAR}")"
done

for PAIR in "${OPTIONAL_SECRETS[@]}"; do
    VAR="${PAIR%%:*}"
    VALUE="$(env_value "${VAR}")"

    if [[ -z "${VALUE}" ]]; then
        echo "    ${VAR}: empty in ${ENV_FILE} — skipped (optional)"
        continue
    fi

    push_secret "${VAR}" "${PAIR#*:}" "${VALUE}"
done

echo
echo "==> done. Run cli/deploy.sh to roll the newest versions onto the service."
