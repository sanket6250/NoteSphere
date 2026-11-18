#!/usr/bin/env bash
set -euo pipefail
umask 077

: "${DOCKER_NETWORK:?Set DOCKER_NETWORK to the private storage network}"
: "${STORAGE_ENDPOINT:?Set STORAGE_ENDPOINT, normally http://minio:9000}"
: "${S3_ACCESS_KEY:?Set S3_ACCESS_KEY}"
: "${S3_SECRET_KEY:?Set S3_SECRET_KEY}"
: "${S3_BUCKET:?Set S3_BUCKET}"
: "${BACKUP_DIR:?Set BACKUP_DIR to a protected backup directory}"

if ! docker network inspect "$DOCKER_NETWORK" >/dev/null 2>&1; then
  echo "Docker network not found: $DOCKER_NETWORK" >&2
  exit 1
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_path="$BACKUP_DIR/notesphere-files-${timestamp}"
mkdir -p "$BACKUP_DIR"
mkdir "$backup_path"
mkdir "$backup_path/objects"

docker run --rm --network "$DOCKER_NETWORK" \
  -e AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY" \
  -e AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY" \
  -e AWS_DEFAULT_REGION=us-east-1 \
  -e AWS_EC2_METADATA_DISABLED=true \
  -v "$backup_path:/backup" \
  public.ecr.aws/aws-cli/aws-cli@sha256:33a16c53ea442e918b58df67301ad76a8fb57082c39f7e78753b898c3f3e87c2 \
  --endpoint-url "$STORAGE_ENDPOINT" s3 sync "s3://${S3_BUCKET}" /backup/objects --no-progress

printf 'Object-storage backup created: %s\n' "$backup_path"
