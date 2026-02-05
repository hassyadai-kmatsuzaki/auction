#!/usr/bin/env bash
#
# E2Eテストの動画をGIFに変換
# 
# 前提条件: FFmpegがインストールされていること
#   brew install ffmpeg
#
# 使い方:
#   ./scripts/manual/convert-videos-to-gifs.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
VIDEOS_DIR="${PROJECT_ROOT}/cypress/videos"
OUTPUT_DIR="${PROJECT_ROOT}/public/manual/gifs"

# FFmpegの確認
if ! command -v ffmpeg &> /dev/null; then
  echo "❌ エラー: FFmpegがインストールされていません"
  echo ""
  echo "インストール方法:"
  echo "  brew install ffmpeg"
  echo ""
  exit 1
fi

# 出力ディレクトリの作成
mkdir -p "${OUTPUT_DIR}"

echo "=========================================="
echo "動画 → GIF 変換"
echo "=========================================="
echo "入力: ${VIDEOS_DIR}"
echo "出力: ${OUTPUT_DIR}"
echo ""

# 変換設定
FPS=10              # フレームレート（10fps = 滑らか）
WIDTH=800           # 幅（ピクセル）
DURATION=10         # 最初の10秒のみ変換

# 動画ファイルを検索して変換
count=0
for video in "${VIDEOS_DIR}"/*.mp4; do
  if [ -f "$video" ]; then
    filename=$(basename "$video" .mp4)
    output="${OUTPUT_DIR}/${filename}.gif"
    
    echo "変換中: ${filename}.mp4 → ${filename}.gif"
    
    # FFmpegで変換
    ffmpeg -i "$video" \
      -vf "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" \
      -t ${DURATION} \
      -y \
      "$output" \
      2>&1 | grep -v "frame=" || true
    
    if [ -f "$output" ]; then
      size=$(du -h "$output" | cut -f1)
      echo "✅ 完了: ${filename}.gif (${size})"
      ((count++))
    else
      echo "❌ 失敗: ${filename}.gif"
    fi
    
    echo ""
  fi
done

echo "=========================================="
echo "変換完了"
echo "=========================================="
echo "変換数: ${count}個"
echo "出力先: ${OUTPUT_DIR}"
echo ""
echo "📝 次のステップ:"
echo "  1. GIFファイルを確認: ls -lh ${OUTPUT_DIR}"
echo "  2. マニュアルに埋め込み: ![説明](gifs/xxx.gif)"
echo ""
