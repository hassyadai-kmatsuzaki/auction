#!/usr/bin/env bash
#
# マニュアル用の画像をpublicディレクトリにコピー
#
# 使い方:
#   ./scripts/manual/copy-images-to-public.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
SCREENSHOTS_DIR="${PROJECT_ROOT}/cypress/screenshots"
PUBLIC_MANUAL_DIR="${PROJECT_ROOT}/public/manual"

echo "=========================================="
echo "マニュアル画像をpublicディレクトリにコピー"
echo "=========================================="
echo ""

# 出力ディレクトリを作成
mkdir -p "${PUBLIC_MANUAL_DIR}/images"

# スクリーンショットをコピー
count=0
for dir in "${SCREENSHOTS_DIR}"/*-manual.cy.ts; do
  if [ -d "$dir" ]; then
    dirname=$(basename "$dir")
    echo "📸 コピー中: ${dirname}"
    
    for img in "$dir"/manual-*.png; do
      if [ -f "$img" ]; then
        filename=$(basename "$img")
        cp "$img" "${PUBLIC_MANUAL_DIR}/images/${filename}"
        ((count++))
      fi
    done
  fi
done

echo ""
echo "✅ コピー完了: ${count}枚"
echo "📂 出力先: ${PUBLIC_MANUAL_DIR}/images/"
echo ""

# 動画もコピー（オプション）
VIDEO_DIR="${PROJECT_ROOT}/cypress/videos"
if [ -d "$VIDEO_DIR" ]; then
  mkdir -p "${PUBLIC_MANUAL_DIR}/videos"
  
  video_count=0
  for video in "${VIDEO_DIR}"/*-manual.cy.ts.mp4; do
    if [ -f "$video" ]; then
      filename=$(basename "$video")
      cp "$video" "${PUBLIC_MANUAL_DIR}/videos/${filename}"
      ((video_count++))
    fi
  done
  
  if [ $video_count -gt 0 ]; then
    echo "🎬 動画コピー完了: ${video_count}個"
    echo "📂 出力先: ${PUBLIC_MANUAL_DIR}/videos/"
    echo ""
  fi
fi

echo "=========================================="
echo "完了"
echo "=========================================="
echo ""
echo "📝 次のステップ:"
echo "  1. マニュアルの画像パスを更新"
echo "  2. ブラウザでマニュアルを確認"
echo ""
