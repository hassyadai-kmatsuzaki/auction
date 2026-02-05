#!/usr/bin/env sh
#
# Cypress を公式 Docker イメージで実行するスクリプト
# Alpine 等で Cypress バイナリが動かない場合に使用してください。
#
# 使い方（リポジトリルート = docker-compose.yml があるディレクトリで）:
#   ./src/scripts/cypress-docker-run.sh
# または src ディレクトリから:
#   ./scripts/cypress-docker-run.sh
#
# 事前にアプリを起動しておくこと（例: docker-compose up -d）
# アプリのURLは環境変数 CYPRESS_BASE_URL で変更可能（未設定時は http://host.docker.internal:8430）
# 参加者テスト: デフォルトは participant1@example.com（DemoDataSeeder 用）。DatabaseSeeder のみの場合は E2E_PARTICIPANT_EMAIL=participant@example.com を指定

set -e

# スクリプトの場所からプロジェクトルート（cypress.config.ts があるディレクトリ）を決める
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "${SCRIPT_DIR}/../cypress.config.ts" ]; then
  PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
else
  # リポジトリルートから実行された場合
  PROJECT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
  if [ ! -f "${PROJECT_DIR}/src/cypress.config.ts" ]; then
    echo "Error: cypress.config.ts not found. Run from repo root or src." >&2
    exit 1
  fi
  PROJECT_DIR="${PROJECT_DIR}/src"
fi

CYPRESS_IMAGE="${CYPRESS_DOCKER_IMAGE:-cypress/included:15.10.0}"
BASE_URL="${CYPRESS_BASE_URL:-http://host.docker.internal:8430}"

echo "Project dir: ${PROJECT_DIR}"
echo "Cypress image: ${CYPRESS_IMAGE}"
echo "CYPRESS_BASE_URL: ${BASE_URL}"
echo ""

# Linux では host.docker.internal を有効にする
EXTRA_ARGS=""
if [ "$(uname)" = "Linux" ]; then
  EXTRA_ARGS="--add-host=host.docker.internal:host-gateway"
fi

docker run -it --rm \
  -v "${PROJECT_DIR}:/e2e" -w /e2e \
  -e CYPRESS_BASE_URL="${BASE_URL}" \
  -e E2E_ADMIN_EMAIL="${E2E_ADMIN_EMAIL:-admin@example.com}" \
  -e E2E_ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD:-password}" \
  -e E2E_SELLER_EMAIL="${E2E_SELLER_EMAIL:-seller1@example.com}" \
  -e E2E_SELLER_PASSWORD="${E2E_SELLER_PASSWORD:-password}" \
  -e E2E_PARTICIPANT_EMAIL="${E2E_PARTICIPANT_EMAIL:-participant1@example.com}" \
  -e E2E_PARTICIPANT_PASSWORD="${E2E_PARTICIPANT_PASSWORD:-password}" \
  ${EXTRA_ARGS} \
  "${CYPRESS_IMAGE}"
