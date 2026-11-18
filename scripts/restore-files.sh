#!/usr/bin/env bash
set -euo pipefail

: "${DOCKER_NETWORK:?Set DOCKER_NETWORK to the private storage network}"
: "${STORAGE_ENDPOINT:?Set STORAGE_ENDPOINT, normally http://minio:9000}"
: "${S3_ACCESS_KEY:?Set S3_ACCESS_KEY}"
: "${S3_SECRET_KEY:?Set S3_SECRET_KEY}"
: "${RESTORE_DIR:?Set RESTORE_DIR to a notesphere-files-* backup directory}"
: "${RESTORE_BUCKET:?Set RESTORE_BUCKET to an empty, different bucket name}"

if [[ ! -d "$RESTORE_DIR/objects" ]]; then
  echo "Backup directory does not contain an objects subdirectory: $RESTORE_DIR" >&2
  exit 1
fi
if [[ -n "${S3_BUCKET:-}" && "$RESTORE_BUCKET" == "$S3_BUCKET" ]]; then
  echo "RESTORE_BUCKET must differ from the current S3_BUCKET." >&2
  exit 1
fi
if ! docker network inspect "$DOCKER_NETWORK" >/dev/null 2>&1; then
  echo "Docker network not found: $DOCKER_NETWORK" >&2
  exit 1
fi

aws_storage() {
  docker run --rm --network "$DOCKER_NETWORK" \
    -e AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY" \
    -e AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY" \
    -e AWS_DEFAULT_REGION=us-east-1 \
    -e AWS_EC2_METADATA_DISABLED=true \
    -v "$RESTORE_DIR/objects:/backup/objects:ro" \
    public.ecr.aws/aws-cli/aws-cli@sha256:33a16c53ea442e918b58df67301ad76a8fb57082c39f7e78753b898c3f3e87c2 \
    --endpoint-url "$STORAGE_ENDPOINT" "$@"
}

aws_storage s3api create-bucket --bucket "$RESTORE_BUCKET"
object_count="$(aws_storage s3api list-objects-v2 --bucket "$RESTORE_BUCKET" --max-keys 1 \
  --query 'length(Contents || `[]`)' --output text)"
if [[ "$object_count" != 0 ]]; then
  echo "Target bucket is not empty; restore is refused to avoid overwriting objects." >&2
  exit 1
fi

aws_storage s3 sync /backup/objects "s3://${RESTORE_BUCKET}" --no-progress
printf 'Restored objects into empty bucket %s. The source bucket was not changed.\n' "$RESTORE_BUCKET"
echo "Verify the restored bucket, then update S3_BUCKET in Coolify and redeploy when ready."
