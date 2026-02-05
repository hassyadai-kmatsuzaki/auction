/**
 * 共通・法的ページのE2Eテスト（E2Eテスト項目書 COM 対応）
 */

describe('法的ページ', () => {
  it('COM-01: プライバシーポリシーが表示される', () => {
    cy.visit('/legal/privacy');
    cy.url().should('include', '/legal/privacy');
    cy.get('body').should('be.visible');
  });

  it('COM-02: 利用規約が表示される', () => {
    cy.visit('/legal/terms');
    cy.url().should('include', '/legal/terms');
    cy.get('body').should('be.visible');
  });

  it('COM-03: 特定商取引法に基づく表記が表示される', () => {
    cy.visit('/legal/tokushoho');
    cy.url().should('include', '/legal/tokushoho');
    cy.get('body').should('be.visible');
  });
});

describe('ルートリダイレクト', () => {
  it('COM-04: 未認証で / にアクセスするとログインにリダイレクトされる', () => {
    cy.clearCookies();
    cy.window().then((win) => win.localStorage.clear());
    cy.visit('/');
    cy.url().should('include', '/login');
  });
});
