/**
 * LINE 連携 / 通知 E2E
 * 対象:
 *   - src/app/Http/Controllers/Auth/LineAuthController.php
 *   - src/app/Http/Controllers/Participant/LineSettingsController.php
 *
 * 前提シードデータ:
 *   - 参加者ユーザー (E2E_PARTICIPANT_EMAIL) が存在する事
 *   - LINE 連携テスト送信は line_accounts に is_active=true のレコードが必要
 *   - .env に LINE_CHANNEL_ID / LINE_CHANNEL_SECRET / LINE_REDIRECT_URI が設定済みである事
 */

describe('LINE Integration', () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.window().then((win) => win.localStorage.clear());
  });

  describe('連携 OAuth リダイレクト', () => {
    it('LINE-01: LINE Login へのリダイレクト URL が生成される', () => {
      cy.apiAs('participant', {
        method: 'GET',
        url: '/api/line/settings/redirect',
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.success).to.eq(true);
        expect(res.body.data).to.have.property('url');
        // LINE の access.line.me ドメインに飛ぶ URL である事
        expect(res.body.data.url).to.match(/access\.line\.me|line\.me/);
        expect(res.body.data.url).to.contain('state=');
      });
    });

    it('LINE-02: 未認証で redirect を呼ぶと 401', () => {
      cy.request({
        method: 'GET',
        url: '/api/line/settings/redirect',
        failOnStatusCode: false,
        headers: { Accept: 'application/json' },
      }).then((res) => {
        expect([401, 403]).to.include(res.status);
      });
    });

    it.skip('LINE-03: コールバック (GET /api/auth/line/callback) - 実環境必要', () => {
      // 本物の LINE 認可コードはブラウザ経由でしか取得できないため、
      // E2E (Cypress) からは直接呼び出せない。本番では実機で別途検証。
      cy.request({
        method: 'GET',
        url: '/api/auth/line/callback?code=invalid&state=invalid',
        failOnStatusCode: false,
      }).then((res) => {
        expect([200, 302, 400]).to.include(res.status);
      });
    });
  });

  describe('連携状態 / 解除', () => {
    it('LINE-04: 連携状態 API が取得できる (GET /api/line/settings/status)', () => {
      cy.apiAs('participant', {
        method: 'GET',
        url: '/api/line/settings/status',
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.success).to.eq(true);
        expect(res.body.data).to.have.property('linked');
        expect(res.body.data).to.have.property('is_active');
      });
    });

    it('LINE-05: 連携解除 API が呼べる (DELETE /api/line/settings/unlink)', () => {
      cy.apiAs('participant', {
        method: 'DELETE',
        url: '/api/line/settings/unlink',
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.success).to.eq(true);
        expect(res.body.message).to.contain('解除');
      });
    });

    it('LINE-06: 解除後は status.is_active=false になる', () => {
      cy.apiAs('participant', {
        method: 'DELETE',
        url: '/api/line/settings/unlink',
      }).then(() => {
        cy.apiAs('participant', {
          method: 'GET',
          url: '/api/line/settings/status',
        }).then((res) => {
          expect(res.status).to.eq(200);
          expect(res.body.data.is_active).to.eq(false);
        });
      });
    });
  });

  describe('通知設定', () => {
    it('LINE-07: 通知設定一覧が取得できる', () => {
      cy.apiAs('participant', {
        method: 'GET',
        url: '/api/line/settings/notifications',
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.success).to.eq(true);
        expect(res.body.data.notifications).to.be.an('array');
        // 主要な通知種別が含まれている事
        const types = res.body.data.notifications.map((n: any) => n.type);
        expect(types).to.include('won_item');
        expect(types).to.include('payment_reminder');
      });
    });

    it('LINE-08: 通知設定を一括更新できる', () => {
      cy.apiAs('participant', {
        method: 'PUT',
        url: '/api/line/settings/notifications',
        body: {
          settings: [
            { type: 'won_item', is_enabled: true },
            { type: 'payment_reminder', is_enabled: false },
          ],
        },
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.success).to.eq(true);
      });
    });

    it('LINE-09: 不正な通知種別は 422', () => {
      cy.apiAs('participant', {
        method: 'PUT',
        url: '/api/line/settings/notifications',
        body: {
          settings: [{ type: 'unknown_type_xxx', is_enabled: true }],
        },
      }).then((res) => {
        expect(res.status).to.eq(422);
      });
    });

    it('LINE-10: 連携していない状態でテスト送信すると 400', () => {
      // 事前に必ず unlink して LINE 連携無し状態にする
      cy.apiAs('participant', {
        method: 'DELETE',
        url: '/api/line/settings/unlink',
      }).then(() => {
        cy.apiAs('participant', {
          method: 'POST',
          url: '/api/line/settings/test',
          body: { type: 'won_item' },
        }).then((res) => {
          expect([400, 422]).to.include(res.status);
        });
      });
    });

    it.skip('LINE-11: テスト送信が成功する (要 LINE Bot / line_accounts is_active=true)', () => {
      // 本番 LINE Messaging API を実際に叩いて push する。
      // sandbox が無いため CI では skip。実機検証で確認する。
      cy.apiAs('participant', {
        method: 'POST',
        url: '/api/line/settings/test',
        body: { type: 'won_item' },
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.success).to.eq(true);
      });
    });
  });
});
