#!/usr/bin/env bash
# =============================================================================
# scripts/post-deploy.sh — A-14 (2026-09-08)
#
# コードを配置した後に必ず流す「反映 → 再起動 → 検証」の一本道。
# 8/27 に queue:restart 漏れで worker が旧コードのまま開催朝を迎えた再発防止。
#
# 使い方（本番/ステージング、/var/www/auction で）:
#   sudo -u ec2-user bash scripts/post-deploy.sh [オプション]
#
# オプション:
#   --skip-migrate       migrate を流さない
#   --restart-reverb     Reverb も再起動する（全 WebSocket 接続が切れる。開催中は絶対に使わない）
#   --warm-auction=ID    反映後に media:warm --auction=ID を流す（前日の画像事前生成）
#   --force              live 中のオークションがあっても続行する
#
# 終了コード: 0=すべて OK / 1=前提エラー / 2=検証 NG（worker が古い・外形失敗）
# =============================================================================
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

SKIP_MIGRATE=0; RESTART_REVERB=0; WARM_AUCTION=""; FORCE=0
for arg in "$@"; do
  case "$arg" in
    --skip-migrate)     SKIP_MIGRATE=1 ;;
    --restart-reverb)   RESTART_REVERB=1 ;;
    --warm-auction=*)   WARM_AUCTION="${arg#*=}" ;;
    --force)            FORCE=1 ;;
    *) echo "不明なオプション: $arg" >&2; exit 1 ;;
  esac
done

log()  { printf '\n\033[1;34m== %s\033[0m\n' "$*"; }
ok()   { printf '  \033[1;32mOK\033[0m  %s\n' "$*"; }
ng()   { printf '  \033[1;31mNG\033[0m  %s\n' "$*"; }
FAILS=0

# ---- 前提 -------------------------------------------------------------------
log "前提確認"
if [ "$(id -un)" = "root" ]; then
  echo "root で実行しないでください（storage/logs が root 所有になり worker が全滅します）。sudo -u ec2-user で。" >&2
  exit 1
fi
[ -f artisan ] || { echo "artisan が見つかりません: $APP_DIR" >&2; exit 1; }
ok "user=$(id -un) dir=$APP_DIR"

LIVE_COUNT="$(php artisan tinker --execute='echo App\Models\Auction::where("status","live")->count();' 2>/dev/null | tail -1 | tr -dc '0-9' || echo 0)"
if [ "${LIVE_COUNT:-0}" != "0" ] && [ "$FORCE" != "1" ]; then
  echo "live 中のオークションが ${LIVE_COUNT} 件あります。開催中の反映は禁止です（どうしてもなら --force）。" >&2
  exit 1
fi
ok "live 中のオークション: ${LIVE_COUNT:-0} 件"

# ---- 反映 -------------------------------------------------------------------
if [ "$SKIP_MIGRATE" != "1" ]; then
  log "migrate"
  php artisan migrate --force
fi

log "キャッシュ再生成（config / route / view）"
php artisan config:cache
php artisan route:cache      # 新ルートが 404 になる事故（route:cache 未再生成）の防止
php artisan view:cache

log "php-fpm reload"
sudo systemctl reload php-fpm && ok "php-fpm reloaded"

log "queue:restart（全 worker が現在のジョブを終えてから新コードで起動）"
php artisan queue:restart
if [ "$RESTART_REVERB" = "1" ]; then
  sudo supervisorctl restart auction-reverb && ok "reverb restarted"
fi

# ---- 検証 -------------------------------------------------------------------
log "検証: worker の起動時刻 > 最新ファイルの更新時刻"
sleep 10
LATEST_MTIME="$(find app bootstrap config database routes resources/views -type f -printf '%T@\n' 2>/dev/null | sort -n | tail -1 | cut -d. -f1)"
LATEST_FILE="$(find app bootstrap config database routes resources/views -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)"
echo "  最新ファイル: $(date -d "@${LATEST_MTIME}" '+%F %T') ${LATEST_FILE}"

sudo supervisorctl status | grep -E 'auction-queue' | while read -r name state pidcol pid rest; do
  [ "$state" = "RUNNING" ] || { ng "$name は $state"; continue; }
  pid="${pid%,}"
  started="$(date -d "$(ps -o lstart= -p "$pid")" +%s 2>/dev/null || echo 0)"
  if [ "$started" -gt "$LATEST_MTIME" ]; then
    ok "$name pid=$pid 起動 $(date -d "@$started" '+%T')"
  else
    ng "$name pid=$pid 起動 $(date -d "@$started" '+%T') が最新ファイルより古い（旧コードで稼働中）"
    echo "NG" >> /tmp/post-deploy-fails.$$
  fi
done
if [ -f "/tmp/post-deploy-fails.$$" ]; then FAILS=$((FAILS + $(wc -l < "/tmp/post-deploy-fails.$$"))); rm -f "/tmp/post-deploy-fails.$$"; fi

log "検証: 主要ファイルの md5（チェックリストに転記）"
for f in app/Services/CountdownService.php app/Services/BidService.php app/Actions/Auction/StartAuctionAction.php \
         app/Http/Controllers/Admin/LiveController.php app/Jobs/ProcessAuctionCountdownJob.php \
         app/Services/MediaOptimizer.php app/Support/BroadcastThrottle.php; do
  [ -f "$f" ] && printf '  %s  %s\n' "$(md5sum "$f" | cut -c1-8)" "$f"
done

log "検証: 外形"
if curl -fsS --max-time 5 http://127.0.0.1/api/health >/dev/null 2>&1; then ok "GET /api/health"; else ng "GET /api/health"; FAILS=$((FAILS+1)); fi
if php artisan route:list --path=media 2>/dev/null | grep -q optimized; then ok "route:list に media ルートあり"; else ng "route:list に media ルートが無い"; FAILS=$((FAILS+1)); fi
if php artisan list 2>/dev/null | grep -q 'media:warm'; then ok "media:warm コマンド登録済み"; else ng "media:warm が無い"; FAILS=$((FAILS+1)); fi

# ---- 任意: 画像の事前生成 --------------------------------------------------
if [ -n "$WARM_AUCTION" ]; then
  log "media:warm --auction=${WARM_AUCTION}"
  php artisan media:warm --auction="$WARM_AUCTION" --presets=thumb,small,medium
fi

log "結果"
if [ "$FAILS" = "0" ]; then ok "すべて OK"; exit 0; else ng "NG ${FAILS} 件。上の NG 行を直してから再実行してください"; exit 2; fi
