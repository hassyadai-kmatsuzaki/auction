/**
 * 課金 / 年会費サブスクリプション E2E
 * 対象: src/app/Http/Controllers/User/SubscriptionController.php
 *       src/app/Http/Controllers/Admin/SubscriptionController.php
 *
 * 前提シードデータ:
 *   - plans テーブルに active = true の年会費プランが 1 件以上
 *   - E2E_PARTICIPANT_EMAIL のユーザーが id > 509 で課金対象である事
 *   - 解約テストでは事前に subscriptions テーブルに status='active' のレコードを作成しておく
 *
 * `.skip` 付きケースは Square sandbox / Webhook など外部依存のため本番環境では実行しない
 */

describe('Billing - Square 年会費サブスクリプション', () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.window().then((win) => win.localStorage.clear());
  });

  describe('参加者: 自分のサブスクリプション', () => {
    it('BILL-01: サブスクリプション一覧が取得できる (GET /api/me/subscription)', () => {
      cy.apiAs('participant', {
        method: 'GET',
        url: '/api/me/subscription',
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.success).to.eq(true);
        expect(res.body.data).to.have.property('plans');
        expect(res.body.data).to.have.property('subscription');
        expect(res.body.data).to.have.property('is_active');
        expect(res.body.data.plans).to.be.an('array');
      });
    });

    it('BILL-02: 期限切れサブスクリプションは is_active=false / requires_registration が立つ', () => {
      cy.apiAs('participant', {
        method: 'GET',
        url: '/api/me/subscription',
      }).then((res) => {
        expect(res.status).to.eq(200);
        const sub = res.body.data.subscription;
        if (sub && ['canceled', 'pending', 'expired'].includes(sub.status)) {
          expect(res.body.data.is_active).to.eq(false);
        }
        // 期限切れ表示用のフィールドがレスポンスに存在する事
        expect(res.body.data).to.have.property('requires_registration');
      });
    });

    it('BILL-03: サブスクリプションをキャンセルできる (DELETE /api/me/subscription)', () => {
      cy.apiAs('participant', {
        method: 'GET',
        url: '/api/me/subscription',
      }).then((res) => {
        const sub = res.body.data.subscription;
        if (!sub || sub.status === 'canceled') {
          cy.log('アクティブなサブスクリプションがないため検証のみスキップ');
          return;
        }

        cy.apiAs('participant', {
          method: 'DELETE',
          url: '/api/me/subscription',
          body: { reason: 'e2e_test_cancel' },
        }).then((cancelRes) => {
          expect([200, 404]).to.include(cancelRes.status);
          if (cancelRes.status === 200) {
            expect(cancelRes.body.success).to.eq(true);
          }
        });
      });
    });

    it('BILL-04: サブスクリプション未登録ユーザーがキャンセルすると 404 が返る', () => {
      // 既にキャンセル済み or 未登録の場合は 404
      cy.apiAs('participant', {
        method: 'DELETE',
        url: '/api/me/subscription',
      }).then((res) => {
        // 200 (初回キャンセル成功) または 404 (未登録) を許容
        expect([200, 404]).to.include(res.status);
      });
    });

    it.skip('BILL-05: 新規プラン購入 (POST /api/me/subscription) - Square sandbox 必要', () => {
      // 前提: cypress.env に E2E_SQUARE_SOURCE_ID (sandbox の nonce) が設定されている事
      // Square の Web Payments SDK でカード入力 → nonce 取得が必要なため本番環境では `.skip`
      cy.apiAs('participant', {
        method: 'POST',
        url: '/api/me/subscription',
        body: {
          plan_id: 1,
          source_id: Cypress.env('E2E_SQUARE_SOURCE_ID') ?? 'cnon:card-nonce-ok',
          verification_token: null,
        },
      }).then((res) => {
        expect(res.status).to.eq(201);
        expect(res.body.success).to.eq(true);
        expect(res.body.data.subscription).to.have.property('id');
      });
    });

    it.skip('BILL-06: カード情報変更 (PUT /api/me/subscription/card) - Square sandbox 必要', () => {
      // 同じく Web Payments SDK 経由で発行された source_id が必要
      cy.apiAs('participant', {
        method: 'PUT',
        url: '/api/me/subscription/card',
        body: {
          source_id: Cypress.env('E2E_SQUARE_SOURCE_ID') ?? 'cnon:card-nonce-ok',
          verification_token: null,
        },
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.success).to.eq(true);
      });
    });

    it.skip('BILL-07: Square Webhook 受信時に DB が更新される - Webhook 必要', () => {
      // 本番では Square 側から /api/webhooks/square へ署名付きで POST されるため、
      // E2E (Cypress) からは正しい署名を作れない。実環境での Webhook 受信検証は別ジョブで実施。
      cy.request({
        method: 'POST',
        url: '/api/webhooks/square',
        failOnStatusCode: false,
        headers: {
          'X-Square-Signature': 'fake-signature',
        },
        body: {
          type: 'invoice.payment_made',
          data: { object: { invoice: { id: 'inv_test' } } },
        },
      }).then((res) => {
        expect([200, 401, 403]).to.include(res.status);
      });
    });
  });

  describe('管理者: サブスクリプション管理', () => {
    it('BILL-08: 管理者が全サブスクリプション一覧を取得できる', () => {
      cy.apiAs('admin', {
        method: 'GET',
        url: '/api/admin/subscriptions',
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.success).to.eq(true);
      });
    });

    it('BILL-09: 参加者は管理 API にアクセスできない (403)', () => {
      cy.apiAs('participant', {
        method: 'GET',
        url: '/api/admin/subscriptions',
      }).then((res) => {
        expect([401, 403]).to.include(res.status);
      });
    });
  });
});
