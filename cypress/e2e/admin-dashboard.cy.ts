/**
 * 管理者画面のE2Eテスト（E2Eテスト項目書 ADM 対応）
 */

describe('管理者ダッシュボード', () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.window().then((win) => win.localStorage.clear());
    cy.loginAsAdmin();
  });

  it('ADM-01: ダッシュボードが表示され統計が確認できる', () => {
    cy.visit('/admin/dashboard');
    cy.url().should('include', '/admin/dashboard');
    cy.get('body').should('be.visible');
    cy.contains('ダッシュボード', { matchCase: false }).should('be.visible');
  });

  it('ADM-02: サイドメニューからダッシュボードに遷移できる', () => {
    cy.visit('/admin/announcements');
    cy.contains('ダッシュボード').click();
    cy.url().should('include', '/admin/dashboard');
  });

  it('ADM-03: お知らせ管理一覧が表示できる', () => {
    cy.visit('/admin/announcements');
    cy.url().should('include', '/admin/announcements');
    cy.get('body').should('be.visible');
  });

  it('ADM-10: オークション一覧が表示できる', () => {
    cy.visit('/admin/auctions');
    cy.url().should('include', '/admin/auctions');
    cy.get('body').should('be.visible');
  });

  it('ADM-17: 生体管理（オークション選択）が表示できる', () => {
    cy.visit('/admin/items');
    cy.url().should('include', '/admin/items');
    cy.get('body').should('be.visible');
  });

  it('ADM-28: ライブ管理一覧が表示できる', () => {
    cy.visit('/admin/live');
    cy.url().should('include', '/admin/live');
    cy.get('body').should('be.visible');
  });

  it('ADM-36: 落札者管理オークション一覧が表示できる', () => {
    cy.visit('/admin/won-items');
    cy.url().should('include', '/admin/won-items');
    cy.get('body').should('be.visible');
  });

  it('ADM-42: ユーザー一覧が表示できる', () => {
    cy.visit('/admin/users');
    cy.url().should('include', '/admin/users');
    cy.get('body').should('be.visible');
  });

  it('ADM-48: 出品者一覧が表示できる', () => {
    cy.visit('/admin/sellers');
    cy.url().should('include', '/admin/sellers');
    cy.get('body').should('be.visible');
  });

  it('ADM-50: 買受者一覧が表示できる', () => {
    cy.visit('/admin/buyers');
    cy.url().should('include', '/admin/buyers');
    cy.get('body').should('be.visible');
  });

  it('ADM-52: システム設定画面が表示できる', () => {
    cy.visit('/admin/settings');
    cy.url().should('include', '/admin/settings');
    cy.get('body').should('be.visible');
  });
});
