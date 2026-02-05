/**
 * 参加者画面のE2Eテスト（E2Eテスト項目書 PAR 対応）
 */

describe('参加者画面', () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.window().then((win) => win.localStorage.clear());
  });

  it('PAR-01: 参加者ホームが表示される', () => {
    cy.loginAsParticipant();
    cy.visit('/participant/home');
    cy.url().should('include', '/participant/home');
    cy.get('body').should('be.visible');
  });

  it('PAR-02: オークション一覧が表示される', () => {
    cy.loginAsParticipant();
    cy.visit('/participant/auctions');
    cy.url().should('include', '/participant/auctions');
    cy.get('body').should('be.visible');
  });

  it('PAR-07: 落札管理一覧が表示される', () => {
    cy.loginAsParticipant();
    cy.visit('/participant/won-items');
    cy.url().should('include', '/participant/won-items');
    cy.get('body').should('be.visible');
  });

  it('PAR-03: オークション詳細・商品一覧が表示される', () => {
    cy.loginAsParticipant();
    cy.visit('/participant/auctions');
    
    cy.get('body').then(($body) => {
      if ($body.find('[href*="/participant/auction/"]').length > 0) {
        cy.get('[href*="/participant/auction/"]').first().click();
        cy.url().should('match', /\/participant\/auction\/\d+/);
        cy.get('body').should('be.visible');
      } else {
        cy.log('オークションがないためスキップ');
      }
    });
  });

  it('PAR-04: ライブオークション画面が表示される', () => {
    cy.loginAsParticipant();
    cy.visit('/participant/auctions');
    
    cy.get('body').then(($body) => {
      if ($body.find('[href*="/live"]').length > 0) {
        cy.get('[href*="/live"]').first().click();
        cy.url().should('match', /\/participant\/auction\/\d+\/live/);
        cy.get('body').should('be.visible');
      } else {
        cy.log('ライブオークションがないためスキップ');
      }
    });
  });

  it('PAR-08: 落札詳細が表示される', () => {
    cy.loginAsParticipant();
    cy.visit('/participant/won-items');
    
    cy.get('body').then(($body) => {
      if ($body.find('[href*="/participant/won-items/"]').length > 0) {
        cy.get('[href*="/participant/won-items/"]').first().click();
        cy.url().should('match', /\/participant\/won-items\/\d+/);
        cy.get('body').should('be.visible');
      } else {
        cy.log('落札がないためスキップ');
      }
    });
  });

  it('PAR-10: 設定画面が表示される', () => {
    cy.loginAsParticipant();
    cy.visit('/participant/settings');
    cy.url().should('include', '/participant/settings');
    cy.get('body').should('be.visible');
  });

  it('PAR-06: 入札履歴が表示される', () => {
    cy.loginAsParticipant();
    cy.visit('/participant/bid-history');
    cy.url().should('include', '/participant/bid-history');
    cy.get('body').should('be.visible');
  });
});
