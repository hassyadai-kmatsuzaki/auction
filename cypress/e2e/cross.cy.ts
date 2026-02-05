/**
 * 権限・エラー系のE2Eテスト（E2Eテスト項目書 CROSS 対応）
 */

describe('権限チェック', () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.window().then((win) => win.localStorage.clear());
  });

  it('CROSS-01: 参加者で管理者URLにアクセスすると拒否またはリダイレクトされる', () => {
    // 参加者アカウントでログイン（participant のみのロールであること。DemoDataSeeder の場合は E2E_PARTICIPANT_EMAIL=participant1@example.com を推奨）
    cy.loginAsParticipant();
    cy.visit('/admin/dashboard');
    cy.url().should('match', /\/login|\/participant/);
  });

  it('CROSS-02: 出品者で管理者URLにアクセスすると拒否またはリダイレクトされる', () => {
    cy.loginAsSeller();
    cy.visit('/admin/dashboard');
    cy.url().should('match', /\/login|\/seller/);
  });

  it('CROSS-03: 参加者が出品者画面にアクセスできない', () => {
    cy.loginAsParticipant();
    cy.visit('/seller/items', { failOnStatusCode: false });
    cy.url().should('not.include', '/seller');
  });

  it('CROSS-04: 参加者が管理者画面にアクセスできない', () => {
    cy.loginAsParticipant();
    cy.visit('/admin/dashboard', { failOnStatusCode: false });
    cy.url().should('not.include', '/admin');
  });

  it('CROSS-05: 出品者が管理者画面にアクセスできない', () => {
    cy.loginAsSeller();
    cy.visit('/admin/dashboard', { failOnStatusCode: false });
    cy.url().should('not.include', '/admin');
  });
});
