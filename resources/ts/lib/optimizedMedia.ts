/**
 * 画像最適化ユーティリティ
 *
 * 50MBの元画像をサーバー側でリサイズ＋WebP変換して配信する。
 * ブラウザキャッシュも活用して同一URLは再リクエストしない。
 */

type Preset = 'thumb' | 'small' | 'medium' | 'large';

/**
 * mediaId ベースの最適化画像URLを生成
 */
export function optimizedMediaUrl(mediaId: number, preset: Preset = 'medium'): string {
  return `/api/media/${mediaId}/optimized?preset=${preset}`;
}

/**
 * URLパスベースの最適化画像URLを生成（thumbnail_path用）
 *
 * - 元画像URLを受け取り、サーバー側で最適化した画像のURLを返す
 * - noimage.png や動画URLはそのまま返す
 */
export function optimizedImageUrl(
  originalUrl: string | undefined | null,
  preset: Preset = 'medium',
): string {
  if (!originalUrl) return '/img/noimage.png';
  if (originalUrl.includes('noimage.png')) return originalUrl;
  if (originalUrl.startsWith('/img/')) return originalUrl;
  if (/\.(mp4|mov|webm)$/i.test(originalUrl)) return originalUrl;

  return `/api/media/optimized-by-path?path=${encodeURIComponent(originalUrl)}&preset=${preset}`;
}

/**
 * 次の商品画像をプリフェッチする
 * link rel="prefetch" を使ってブラウザにヒントを与える
 */
export function prefetchImage(url: string): void {
  if (!url || url.includes('noimage.png')) return;

  const existing = document.querySelector(`link[href="${CSS.escape(url)}"]`);
  if (existing) return;

  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.as = 'image';
  link.href = url;
  document.head.appendChild(link);

  // 古いprefetchリンクを掃除（最大10個保持）
  const prefetchLinks = document.querySelectorAll('link[rel="prefetch"][as="image"]');
  if (prefetchLinks.length > 10) {
    prefetchLinks[0].remove();
  }
}

/**
 * 複数画像を一括プリフェッチ
 */
export function prefetchImages(urls: string[]): void {
  urls.forEach(prefetchImage);
}
