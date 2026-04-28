/// <reference types="cypress" />

/**
 * 管理者としてログインする
 */
Cypress.Commands.add('loginAsAdmin', (email?: string, password?: string) => {
  const e = email ?? Cypress.env('E2E_ADMIN_EMAIL');
  const p = password ?? Cypress.env('E2E_ADMIN_PASSWORD');
  cy.visit('/login');
  cy.get('input[type="email"]').clear().type(e);
  cy.get('input[type="password"]').clear().type(p);
  cy.contains('button', 'ログイン').click();
  // 管理者は /admin にリダイレクトされる
  cy.url().should('include', '/admin');
});

/**
 * 出品者としてログインする
 */
Cypress.Commands.add('loginAsSeller', (email?: string, password?: string) => {
  const e = email ?? Cypress.env('E2E_SELLER_EMAIL');
  const p = password ?? Cypress.env('E2E_SELLER_PASSWORD');
  cy.visit('/login');
  cy.get('input[type="email"]').clear().type(e);
  cy.get('input[type="password"]').clear().type(p);
  cy.contains('button', 'ログイン').click();
  cy.url().should('include', '/seller');
});

/**
 * 参加者としてログインする
 */
Cypress.Commands.add('loginAsParticipant', (email?: string, password?: string) => {
  const e = email ?? Cypress.env('E2E_PARTICIPANT_EMAIL');
  const p = password ?? Cypress.env('E2E_PARTICIPANT_PASSWORD');
  cy.visit('/login');
  cy.get('input[type="email"]').clear().type(e);
  cy.get('input[type="password"]').clear().type(p);
  cy.contains('button', 'ログイン').click();
  cy.url().should('include', '/participant');
});

/**
 * ログアウトする（ヘッダー等のログアウトをクリック）
 */
Cypress.Commands.add('logout', () => {
  cy.contains('ログアウト').click();
  cy.url().should('include', '/login');
});

/**
 * マニュアル用のステップをキャプチャする
 * @param stepName ステップ名（例: '01-login'）
 * @param description 説明文（例: '管理者でログインします'）
 * @param options オプション設定
 */
Cypress.Commands.add('captureStep', (stepName: string, description: string, options?: { wait?: number }) => {
  // オプションの待機時間
  if (options?.wait) {
    cy.wait(options.wait);
  }
  
  // スクリーンショットを撮影
  cy.screenshot(`manual-${stepName}`, {
    capture: 'viewport',
    overwrite: true,
  });
  
  // マニュアル用のメタデータを記録
  cy.url().then((url) => {
    cy.task('logManualStep', {
      step: stepName,
      description: description,
      url: url,
      timestamp: new Date().toISOString(),
    }, { log: false });
  });
});

/**
 * API 経由でログインしてトークンを取得する（UIを介さない）。
 * E2E のセットアップで cy.request 用の Authorization ヘッダ生成に使う。
 */
Cypress.Commands.add('apiToken', (email: string, password: string) => {
  return cy.request('POST', '/api/auth/login', { email, password }).then((res) => {
    expect(res.status).to.eq(200);
    return res.body?.data?.token as string;
  });
});

/**
 * 役割別の API トークンを取得（環境変数から認証情報を引く）
 */
Cypress.Commands.add('apiTokenAs', (role: 'admin' | 'seller' | 'participant') => {
  const map: Record<string, [string, string]> = {
    admin:       [Cypress.env('E2E_ADMIN_EMAIL'),       Cypress.env('E2E_ADMIN_PASSWORD')],
    seller:      [Cypress.env('E2E_SELLER_EMAIL'),      Cypress.env('E2E_SELLER_PASSWORD')],
    participant: [Cypress.env('E2E_PARTICIPANT_EMAIL'), Cypress.env('E2E_PARTICIPANT_PASSWORD')],
  };
  const [e, p] = map[role];
  return cy.apiToken(e, p);
});

/**
 * cy.request の薄いラッパ。Authorization ヘッダを自動付与する。
 * 失敗時にも本文を見るため failOnStatusCode: false を既定にする。
 */
Cypress.Commands.add('apiAs', (role: 'admin' | 'seller' | 'participant', options: Partial<Cypress.RequestOptions>) => {
  return cy.apiTokenAs(role).then((token) => {
    return cy.request({
      failOnStatusCode: false,
      ...options,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers ?? {}),
      },
    });
  });
});

// =============================================================================
// 以下、テスト仕様書 §10.4 に沿った 6 つの追加カスタムコマンド
// =============================================================================

/**
 * 1) cy.apiLoginAs(role)
 *
 * Sanctum API トークン経由の高速ログイン。
 *  - POST /api/auth/login で email/password を送信して Bearer Token を取得
 *  - 取得したトークンを Cypress.env('apiToken') に保存し、後続の cy.request で使い回せるようにする
 *  - 戻り値は取得したトークン文字列
 */
Cypress.Commands.add('apiLoginAs', (role: 'admin' | 'seller' | 'participant') => {
  const map: Record<string, [string, string]> = {
    admin:       [Cypress.env('E2E_ADMIN_EMAIL'),       Cypress.env('E2E_ADMIN_PASSWORD')],
    seller:      [Cypress.env('E2E_SELLER_EMAIL'),      Cypress.env('E2E_SELLER_PASSWORD')],
    participant: [Cypress.env('E2E_PARTICIPANT_EMAIL'), Cypress.env('E2E_PARTICIPANT_PASSWORD')],
  };
  const [email, password] = map[role];

  return cy
    .request({
      method: 'POST',
      url: '/api/auth/login',
      body: { email, password },
      failOnStatusCode: false,
    })
    .then((res) => {
      expect(res.status, `apiLoginAs(${role}) login`).to.eq(200);
      // LoginController の返却フォーマットに合わせて data.token を優先、
      // 互換のため body.token もフォールバックで参照
      const token: string = res.body?.data?.token ?? res.body?.token;
      expect(token, 'auth token').to.be.a('string');
      Cypress.env('apiToken', token);
      return cy.wrap(token);
    });
});

/**
 * 2) cy.seedWonItem(params)
 *
 * staging 限定の /api/test-helpers/seed-won-item を叩いて WonItem を生成する。
 * バックエンド側のガードは EnsureNonProduction ミドルウェアで実装済み。
 */
type SeedWonItemParams = {
  winnerId?: number;
  sellerId?: number;
  paymentStatus?: 'pending' | 'paid' | 'confirmed';
  deliveryStatus?: 'preparing' | 'shipped' | 'completed';
  paymentDeadline?: string; // ISO 8601
  winningPrice?: number;
  quantity?: number;
};

Cypress.Commands.add('seedWonItem', (params: SeedWonItemParams = {}) => {
  const token = Cypress.env('apiToken');
  return cy
    .request({
      method: 'POST',
      url: '/api/test-helpers/seed-won-item',
      failOnStatusCode: false,
      headers: token ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : { Accept: 'application/json' },
      body: {
        winner_id: params.winnerId,
        seller_id: params.sellerId,
        payment_status: params.paymentStatus ?? 'pending',
        delivery_status: params.deliveryStatus ?? 'preparing',
        payment_deadline: params.paymentDeadline,
        winning_price: params.winningPrice,
        quantity: params.quantity,
      },
    })
    .then((res) => {
      expect(res.status, 'seedWonItem').to.be.oneOf([200, 201]);
      return cy.wrap(res.body);
    });
});

/**
 * 3) cy.runSchedule(taskName?)
 *
 * staging 限定の /api/test-helpers/run-schedule を叩いて
 * php artisan schedule:run (または特定の artisan command) を発火する。
 */
Cypress.Commands.add('runSchedule', (taskName?: string) => {
  const token = Cypress.env('apiToken');
  return cy
    .request({
      method: 'POST',
      url: '/api/test-helpers/run-schedule',
      failOnStatusCode: false,
      headers: token ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : { Accept: 'application/json' },
      body: taskName ? { task: taskName } : {},
    })
    .then((res) => {
      expect(res.status, 'runSchedule').to.eq(200);
      return cy.wrap(res.body);
    });
});

/**
 * 4) cy.mailbox(email)
 *
 * MailHog の検索 API のラッパー。指定アドレス宛の受信メール一覧を返す。
 * 戻り値: { items: [{ id, subject, body, receivedAt, raw }], total }
 */
type MailboxItem = {
  id: string;
  subject: string;
  body: string;
  receivedAt: string;
  raw: any;
};

Cypress.Commands.add('mailbox', (email: string) => {
  const baseUrl: string = Cypress.env('MAILHOG_URL') || 'http://localhost:8025';
  const url = `${baseUrl}/api/v2/search?kind=to&query=${encodeURIComponent(email)}`;

  return cy
    .request({
      method: 'GET',
      url,
      failOnStatusCode: false,
    })
    .then((res) => {
      expect(res.status, 'mailbox').to.eq(200);
      const items: MailboxItem[] = (res.body?.items ?? []).map((m: any) => {
        const headers = m?.Content?.Headers ?? {};
        const subject: string = (headers.Subject?.[0] ?? '').toString();
        const body: string = m?.Content?.Body ?? '';
        const receivedAt: string = (headers.Date?.[0] ?? m?.Created ?? '').toString();
        return {
          id: m?.ID,
          subject,
          body,
          receivedAt,
          raw: m,
        };
      });
      return cy.wrap({ items, total: res.body?.total ?? items.length });
    });
});

/**
 * 5) cy.lineSent(userId?)
 *
 * staging 限定の /api/test-helpers/line-sent から LINE 通知の送信履歴を取得する。
 */
Cypress.Commands.add('lineSent', (userId?: number) => {
  const token = Cypress.env('apiToken');
  const qs: Record<string, string | number> = {};
  if (typeof userId === 'number') qs.user_id = userId;

  return cy
    .request({
      method: 'GET',
      url: '/api/test-helpers/line-sent',
      qs,
      failOnStatusCode: false,
      headers: token ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : { Accept: 'application/json' },
    })
    .then((res) => {
      expect(res.status, 'lineSent').to.eq(200);
      return cy.wrap(res.body?.logs ?? []);
    });
});

/**
 * 6) cy.downloadPdf(url)
 *
 * 指定 URL から PDF バイナリを取得し、Node.js 側 (cy.task('pdfParse')) で
 * pdf-parse を使ってテキスト化する。戻り値は contentType / contentDisposition /
 * filename / text / info の構造体。
 */
type DownloadPdfResult = {
  contentType: string;
  contentDisposition: string;
  filename: string | null;
  text: string;
  info: any;
};

Cypress.Commands.add('downloadPdf', (url: string) => {
  const token = Cypress.env('apiToken');

  return cy
    .request({
      method: 'GET',
      url,
      encoding: 'binary',
      failOnStatusCode: false,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    .then((res) => {
      expect(res.status, 'downloadPdf status').to.eq(200);

      const contentType: string = (res.headers['content-type'] as string) ?? '';
      const contentDisposition: string = (res.headers['content-disposition'] as string) ?? '';

      // filename="foo.pdf" / filename*=UTF-8''foo.pdf 双方を雑にパース
      let filename: string | null = null;
      const m1 = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
      const m2 = contentDisposition.match(/filename="?([^";]+)"?/i);
      if (m1) {
        try { filename = decodeURIComponent(m1[1]); } catch { filename = m1[1]; }
      } else if (m2) {
        filename = m2[1];
      }

      // res.body は binary string なので base64 に変換して Node 側へ
      const bodyStr: string = res.body as unknown as string;
      const base64: string = Cypress.Buffer.from(bodyStr, 'binary').toString('base64');

      return cy.task<{ text: string; info: any }>('pdfParse', { base64 }).then((parsed) => {
        const result: DownloadPdfResult = {
          contentType,
          contentDisposition,
          filename,
          text: parsed.text,
          info: parsed.info,
        };
        return cy.wrap(result);
      });
    });
});

declare global {
  namespace Cypress {
    interface Chainable {
      loginAsAdmin(email?: string, password?: string): Chainable<void>;
      loginAsSeller(email?: string, password?: string): Chainable<void>;
      loginAsParticipant(email?: string, password?: string): Chainable<void>;
      logout(): Chainable<void>;
      captureStep(stepName: string, description: string, options?: { wait?: number }): Chainable<void>;
      apiToken(email: string, password: string): Chainable<string>;
      apiTokenAs(role: 'admin' | 'seller' | 'participant'): Chainable<string>;
      apiAs(role: 'admin' | 'seller' | 'participant', options: Partial<Cypress.RequestOptions>): Chainable<Cypress.Response<any>>;

      // §10.4 で定義された 6 種のヘルパー
      apiLoginAs(role: 'admin' | 'seller' | 'participant'): Chainable<string>;
      seedWonItem(params?: {
        winnerId?: number;
        sellerId?: number;
        paymentStatus?: 'pending' | 'paid' | 'confirmed';
        deliveryStatus?: 'preparing' | 'shipped' | 'completed';
        paymentDeadline?: string;
        winningPrice?: number;
        quantity?: number;
      }): Chainable<any>;
      runSchedule(taskName?: string): Chainable<any>;
      mailbox(email: string): Chainable<{
        items: Array<{ id: string; subject: string; body: string; receivedAt: string; raw: any }>;
        total: number;
      }>;
      lineSent(userId?: number): Chainable<Array<{
        id: number;
        user_id: number | null;
        notification_type: string | null;
        line_user_id: string | null;
        message_payload: any;
        status: string | null;
        error_message: string | null;
        sent_at: string | null;
        created_at: string | null;
      }>>;
      downloadPdf(url: string): Chainable<{
        contentType: string;
        contentDisposition: string;
        filename: string | null;
        text: string;
        info: any;
      }>;
    }
  }
}

export {};
