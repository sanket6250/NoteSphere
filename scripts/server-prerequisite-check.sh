#!/usr/bin/env bash
set -euo pipefail

failures=0

if [[ -r /etc/os-release ]]; then
  # shellcheck disable=SC1091
  source /etc/os-release
  if [[ "${ID:-}" == ubuntu ]]; then
    printf 'Ubuntu: %s (%s)\n' "${PRETTY_NAME:-unknown}" "${VERSION_CODENAME:-unknown}"
  else
    printf 'FAIL: expected Ubuntu LTS; detected %s\n' "${PRETTY_NAME:-unknown}"
    failures=$((failures + 1))
  fi
else
  printf 'FAIL: cannot identify the operating system\n'
  failures=$((failures + 1))
fi

architecture="$(uname -m)"
printf 'Architecture: %s\n' "$architecture"
case "$architecture" in
  aarch64|arm64|x86_64|amd64) ;;
  *)
    printf 'FAIL: Coolify deployment requires a supported 64-bit architecture\n'
    failures=$((failures + 1))
    ;;
esac

cores="$(nproc)"
memory_kib="$(awk '/MemTotal:/ { print $2 }' /proc/meminfo)"
memory_gib="$(awk -v kib="$memory_kib" 'BEGIN { printf "%.1f", kib / 1048576 }')"
disk_kib="$(df -Pk / | awk 'NR == 2 { print $4 }')"
disk_gib="$(awk -v kib="$disk_kib" 'BEGIN { printf "%.1f", kib / 1048576 }')"
printf 'CPU cores: %s\nMemory: %s GiB\nFree root disk: %s GiB\n' "$cores" "$memory_gib" "$disk_gib"

if (( cores < 2 )); then
  printf 'FAIL: Coolify documents a minimum of 2 CPU cores\n'
  failures=$((failures + 1))
fi
if (( memory_kib < 2097152 )); then
  printf 'FAIL: Coolify documents a minimum of 2 GiB RAM\n'
  failures=$((failures + 1))
elif (( memory_kib < 9437184 )); then
  printf 'WARN: 9 GiB or more is recommended for Coolify plus NoteSphere builds and services\n'
fi
if (( disk_kib < 10485760 )); then
  printf 'FAIL: less than 10 GiB of free root disk space; Coolify requires at least 10 GiB\n'
  failures=$((failures + 1))
elif (( disk_kib < 30720000 )); then
  printf 'WARN: keep at least 30 GiB free for images, logs, database, files, and backups\n'
fi

if command -v docker >/dev/null 2>&1; then
  docker --version
  docker compose version
else
  printf 'WARN: Docker Engine is not installed yet\n'
fi

if (( failures > 0 )); then
  printf 'Prerequisite check failed (%s issue(s)). No system changes were made.\n' "$failures" >&2
  exit 1
fi

printf 'Prerequisite check passed. Review all WARN lines before installation.\n'
