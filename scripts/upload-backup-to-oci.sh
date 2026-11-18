#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || ! -d "$1" ]]; then
  echo "Usage: $0 <backup-directory>" >&2
  exit 2
fi

: "${OCI_NAMESPACE:?Set OCI_NAMESPACE for the tenancy}"
: "${OCI_REGION:?Set OCI_REGION, for example ap-mumbai-1}"
: "${OCI_BACKUP_BUCKET:?Create and set an OCI Object Storage bucket first}"
: "${OCI_ACCESS_KEY_ID:?Set the OCI S3-compatible customer secret key ID}"
: "${OCI_SECRET_ACCESS_KEY:?Set the matching OCI S3-compatible secret}"

backup_dir="$(cd "$1" && pwd)"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)-$$"
endpoint="https://${OCI_NAMESPACE}.compat.objectstorage.${OCI_REGION}.oraclecloud.com"

existing_objects="$(docker run --rm \
  -e AWS_ACCESS_KEY_ID="$OCI_ACCESS_KEY_ID" \
  -e AWS_SECRET_ACCESS_KEY="$OCI_SECRET_ACCESS_KEY" \
  -e AWS_DEFAULT_REGION="$OCI_REGION" \
  -e AWS_EC2_METADATA_DISABLED=true \
  public.ecr.aws/aws-cli/aws-cli@sha256:33a16c53ea442e918b58df67301ad76a8fb57082c39f7e78753b898c3f3e87c2 \
  --endpoint-url "$endpoint" s3api list-objects-v2 \
  --bucket "$OCI_BACKUP_BUCKET" --prefix "notesphere/${timestamp}/" --max-keys 1 \
  --query 'length(Contents || `[]`)' --output text)"
if [[ "$existing_objects" != 0 ]]; then
  echo "The target backup prefix already contains objects; refusing to overwrite it." >&2
  exit 1
fi

docker run --rm \
  -e AWS_ACCESS_KEY_ID="$OCI_ACCESS_KEY_ID" \
  -e AWS_SECRET_ACCESS_KEY="$OCI_SECRET_ACCESS_KEY" \
  -e AWS_DEFAULT_REGION="$OCI_REGION" \
  -e AWS_EC2_METADATA_DISABLED=true \
  -v "$backup_dir:/backup:ro" \
  public.ecr.aws/aws-cli/aws-cli@sha256:33a16c53ea442e918b58df67301ad76a8fb57082c39f7e78753b898c3f3e87c2 \
  --endpoint-url "$endpoint" s3 sync /backup "s3://${OCI_BACKUP_BUCKET}/notesphere/${timestamp}" --no-progress

printf 'Off-site backup uploaded under notesphere/%s in bucket %s.\n' "$timestamp" "$OCI_BACKUP_BUCKET"
