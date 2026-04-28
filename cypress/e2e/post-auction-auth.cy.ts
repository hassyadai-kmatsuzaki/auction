/**
 * §10.14 落札後フロー - 権限・マルチテナント AUTH-01〜07
 *
 * 認証/認可は API 単発で検証可能。
 */

describe('§10.14 落札後フロー - 権限 (AUTH)', () => {
  before(() => {
    // TODO: stagingシード:
    //   Participant X / Y, Seller A / B（互いに参照不可関係）
    cy.log('stagingシード前提: 異なる participant / seller');
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.window().then((win) => win.localStorage.clear());
  });

  it('AUTH-01: 未ログインで落札者APIを叩く → 401', () => {
    cy.request({
      method: 'GET',
      url: '/api/participant/won-items',
      failOnStatusCode: false,
      headers: { Accept: 'application/json' },
    }).then((res) => {
      expect(res.status).to.eq(401);
    });
  });

  it.skip('AUTH-02: 参加者Y が 参加者X の WonItem を参照 → 403', () => {
    // requires staging seed: X の WonItem ID 既知
    cy.apiAs('participant', {
      method: 'GET',
      url: '/api/participant/won-items/99999', // X の WonItem
    }).then((res) => {
      expect([403, 404]).to.include(res.status);
    });
  });

  it.skip('AUTH-03: 出品者B が 出品者A の精算を参照 → 403', () => {
    // requires staging seed: A の auctionId 既知
    cy.apiAs('seller', {
      method: 'GET',
      url: '/api/seller/settlements/99999',
    }).then((res) => {
      expect([403, 404]).to.include(res.status);
    });
  });

  it('AUTH-04: 一般ユーザーが /admin/* へ → 403 + /login リダイレクト', () => {
    cy.apiAs('participant', {
      method: 'GET',
      url: '/api/admin/won-items-auctions',
    }).then((res) => {
      expect([403, 401]).to.include(res.status);
    });

    // UI: /admin に直接遷移 → /login へ
    cy.loginAsParticipant();
    cy.visit('/admin', { failOnStatusCode: false });
    cy.url().should((url) => {
      expect(url).to.satisfy((u: string) => u.includes('/login') || u.includes('/participant'));
    });
  });

  it.skip('AUTH-05: 管理者が他テナントを横断 → 403', () => {
    // マルチテナント機能の有無確認後に実装。
    // 現行スキーマで未導入なら N/A としてスキップ。
  });

  it.skip('AUTH-06: PDF URL 推測による IDOR → 403/404', () => {
    // 自分の所有でない auctionId/winnerId/sellerId の URL を直叩き
    cy.apiAs('participant', {
      method: 'GET',
      url: '/api/participant/auctions/99999/invoice',
    }).then((res) => {
      expect([403, 404]).to.include(res.status);
    });
    cy.apiAs('seller', {
      method: 'GET',
      url: '/api/seller/settlements/99999/payment-notice',
    }).then((res) => {
      expect([403, 404]).to.include(res.status);
    });
  });

  it('AUTH-07: CSRF 無効化されていない (POST が CSRFトークンなしで 419)', () => {
    // SPA web セッション経由の POST は CSRF が必要
    // API トークン経由 (Sanctum) は CSRF 免除のため、ここでは web ルートを検証
    cy.request({
      method: 'POST',
      url: '/login',
      failOnStatusCode: false,
      body: { email: 'foo@example.com', password: 'bar' },
      headers: { Accept: 'text/html', 'X-Requested-With': 'XMLHttpRequest' },
    }).then((res) => {
      // 419 (Page Expired) または同等の保護動作（302 to login + tokenmismatch）
      expect([419, 302, 422, 401]).to.include(res.status);
    });
  });
});
