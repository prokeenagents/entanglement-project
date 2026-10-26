#!/usr/bin/env bash
#
# redeploy.sh — push a code UPDATE to the already-live service.
#
# The everyday update path: rebuild the image from the Dockerfile and roll out a
# NEW revision. Everything deploy.sh set — env vars, pinned secret versions, the
# service account, scaling and billing, the domain — is kept as it is (gcloud
# carries the current revision's config over when no flag changes it).
#
# Zero-downtime: Cloud Run moves traffic to the new revision only once it is
# serving. The new instance redeems its own Keen certificate; if the r_cert
# webhook lands on the old revision during the switch, the connector redeems a
# fresh code after ~16s (keen.connector.ts tryActivate).
#
# For FIRST-TIME setup, a secret rotation or a DOMAIN change run deploy.sh instead.

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/config.sh"

if [[ ! -f "${SOURCE_DIR}/Dockerfile" ]]; then
    echo "ERROR: no Dockerfile at ${SOURCE_DIR}." >&2
    exit 1
fi

echo "==> redeploying ${SERVICE} from ${SOURCE_DIR} (${PROJECT_SVC}/${REGION}) ..."
gcloud run deploy "${SERVICE}" \
    --source "${SOURCE_DIR}" \
    --project "${PROJECT_SVC}" \
    --region "${REGION}" \
    --quiet

echo "==> done — new revision live at $(site_url)"
