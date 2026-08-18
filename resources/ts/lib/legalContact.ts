/**
 * 法務ページ（プライバシーポリシー・利用規約・特定商取引法に基づく表記）に載せる
 * 事務局の連絡先。
 *
 * 補助金提出用スクリーンショットの撮影環境（ローカル: localhost / 127.0.0.1）でのみ
 * 実際の運営拠点（メダカ屋サバンナ）の情報を表示し、本番・ステージングなど他のホスト
 * では常に銀座の住所と「ご請求があった場合、遅滞なく開示いたします。」を返す。
 * ビルド成果物ではなく実行時のホスト名で判定しているので、ローカルで `npm run build`
 * した資産をそのままデプロイしても本番画面に撮影用の情報が出ることはない。
 */
const ON_REQUEST = 'ご請求があった場合、遅滞なく開示いたします。';

const OFFICE_CONTACT = {
  postalCode: '〒104-0061',
  street: '東京都中央区銀座1-12-4 N&E BLD.7階',
  operator: ON_REQUEST,
  tel: ON_REQUEST,
  email: ON_REQUEST,
} as const;

/** 撮影用（ローカルのみ） */
const SCREENSHOT_CONTACT = {
  postalCode: '〒350-0143',
  street: '埼玉県比企郡川島町出丸中郷１４０５',
  operator: '小野田一紀',
  tel: '080-9674-0333',
  email: 'kazuki0620.savanna@gmail.com',
} as const;

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', '::1'];

const isScreenshotEnv = typeof window !== 'undefined' && LOCAL_HOSTS.includes(window.location.hostname);

export const LEGAL_CONTACT = isScreenshotEnv ? SCREENSHOT_CONTACT : OFFICE_CONTACT;
