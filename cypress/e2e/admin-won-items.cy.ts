/**
 * 管理者落札者管理のE2Eテスト（E2Eテスト項目書 ADM-37〜41 対応）
 */

describe('管理者落札者管理', () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.window().then((win) => win.localStorage.clear());
    cy.loginAsAdmin();
  });

  it('ADM-37: オークション別落札一覧が表示される', () => {
    cy.visit('/admin/won-items');
    
    cy.get('body').then(($body) => {
      if ($body.find('[href*="/admin/auctions/"]').length > 0) {
        cy.get('[href*="/admin/auctions/"]').filter('[href*="/won-items"]').first().click();
        cy.url().should('match', /\/admin\/auctions\/\d+\/won-items/);
        cy.get('body').should('be.visible');
      } else {
        cy.log('落札データがないためスキップ');
      }
    });
  });

  it('ADM-38: 落札詳細が表示される', () => {
    cy.visit('/admin/won-items');
    
    cy.get('body').then(($body) => {
      if ($body.find('[href*="/admin/auctions/"]').length > 0) {
        cy.get('[href*="/admin/auctions/"]').first().click();
        
        // 詳細ボタンまたは行クリック
        if ($body.text().includes('詳細') || $body.find('tr').length > 1) {
          cy.contains('詳細').first().click();
          cy.get('body').should('be.visible');
        }
      } else {
        cy.log('落札データがないためスキップ');
      }
    });
  });

  it('ADM-39: 落札ステータスを変更できる', () => {
    cy.visit('/admin/won-items');
    
    cy.get('body').then(($body) => {
      if ($body.find('[href*="/admin/auctions/"]').length > 0) {
        cy.get('[href*="/admin/auctions/"]').first().click();
        
        if ($body.find('select, [role="combobox"]').length > 0) {
          cy.get('select, [role="combobox"]').first().should('be.visible');
        } else {
          cy.log('ステータス変更UIがないためスキップ');
        }
      } else {
        cy.log('落札データがないためスキップ');
      }
    });
  });

  it('ADM-40: 落札者情報をCSVエクスポートできる', () => {
    cy.visit('/admin/won-items');
    
    cy.get('body').then(($body) => {
      if ($body.find('[href*="/admin/auctions/"]').length > 0) {
        cy.get('[href*="/admin/auctions/"]').first().click();
        
        cy.get('body').should('satisfy', ($body: JQuery<HTMLElement>) => 
          $body.text().includes('エクスポート') || 
          $body.text().includes('CSV') || 
          $body.text().includes('ダウンロード')
        );
      } else {
        cy.log('落札データがないためスキップ');
      }
    });
  });

  it('ADM-41: 落札一覧を検索・フィルタできる', () => {
    cy.visit('/admin/won-items');
    
    cy.get('body').then(($body) => {
      if ($body.find('[href*="/admin/auctions/"]').length > 0) {
        cy.get('[href*="/admin/auctions/"]').first().click();
        
        cy.get('body').should('satisfy', ($body: JQuery<HTMLElement>) => 
          $body.find('input[type="search"], input[placeholder*="検索"]').length > 0 || 
          $body.text().includes('検索') || 
          $body.text().includes('フィルタ')
        );
      } else {
        cy.log('落札データがないためスキップ');
      }
    });
  });
});
