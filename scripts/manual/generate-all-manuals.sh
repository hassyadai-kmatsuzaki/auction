#!/usr/bin/env bash
#
# 全てのマニュアルを生成
#
# 使い方:
#   ./scripts/manual/generate-all-manuals.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "=========================================="
echo "マニュアル自動生成"
echo "=========================================="
echo ""

# ステップ1: マニュアル生成用のE2Eテストを実行
echo "📸 ステップ1: マニュアル生成用テストを実行"
echo "所要時間: 約3分"
echo ""

cd "${PROJECT_ROOT}"

# Dockerでマニュアル生成用テストを実行
docker run --rm -i \
  --add-host=host.docker.internal:host-gateway \
  -v "$(pwd):/e2e" \
  -w /e2e \
  -e CYPRESS_BASE_URL="${CYPRESS_BASE_URL:-http://host.docker.internal:8430}" \
  -e E2E_ADMIN_EMAIL="${E2E_ADMIN_EMAIL:-admin@example.com}" \
  -e E2E_ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD:-password}" \
  -e E2E_SELLER_EMAIL="${E2E_SELLER_EMAIL:-seller1@example.com}" \
  -e E2E_SELLER_PASSWORD="${E2E_SELLER_PASSWORD:-password}" \
  -e E2E_PARTICIPANT_EMAIL="${E2E_PARTICIPANT_EMAIL:-participant1@example.com}" \
  -e E2E_PARTICIPANT_PASSWORD="${E2E_PARTICIPANT_PASSWORD:-password}" \
  cypress/included:15.10.0 \
  --spec "cypress/e2e/manual/**/*.cy.ts"

echo ""
echo "✅ テスト完了"
echo ""

# ステップ2: 基本マニュアルを生成
echo "📝 ステップ2: 基本マニュアルを生成"
node scripts/manual/generate-manual.cjs
echo ""

# ステップ3: 画像をpublicディレクトリにコピー
echo "📸 ステップ3: 画像をpublicディレクトリにコピー"
./scripts/manual/copy-images-to-public.sh
echo ""

# ステップ4: 画像パスを更新
echo "🔧 ステップ4: マニュアルの画像パスを更新"
node scripts/manual/update-manual-paths.cjs
echo ""

# ステップ5: GIF変換（オプション）
echo "🎬 ステップ5: 動画をGIFに変換（オプション）"
echo ""

if command -v ffmpeg &> /dev/null; then
  echo "FFmpegが見つかりました。GIF変換を実行します..."
  ./scripts/manual/convert-videos-to-gifs.sh
else
  echo "⚠️  FFmpegがインストールされていません"
  echo "GIF変換をスキップします"
  echo ""
  echo "インストール方法:"
  echo "  brew install ffmpeg"
  echo ""
fi

echo "=========================================="
echo "マニュアル生成完了"
echo "=========================================="
echo ""
echo "📚 生成されたマニュアル:"
echo "  - storage/app/manual/操作マニュアル.md"
echo "  - storage/app/manual/お知らせ管理マニュアル.md"
echo "  - storage/app/manual/出品者マニュアル.md"
echo "  - storage/app/manual/参加者マニュアル.md"
echo ""
echo "📹 動画:"
echo "  - cypress/videos/*.mp4"
echo ""
echo "📸 スクリーンショット:"
echo "  - public/manual/images/*.png"
echo ""

if command -v ffmpeg &> /dev/null; then
  echo "🎬 GIF:"
  echo "  - public/manual/gifs/*.gif"
  echo ""
fi

echo "🎉 マニュアルの確認:"
echo "  ブラウザで http://localhost:8430/admin/manual を開いてください"
echo ""
