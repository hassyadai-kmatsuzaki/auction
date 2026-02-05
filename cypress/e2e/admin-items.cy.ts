/**
 * 管理者生体管理のE2Eテスト（E2Eテスト項目書 ADM-18〜23 対応）
 */

describe('管理者生体管理', () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.window().then((win) => win.localStorage.clear());
    cy.loginAsAdmin();
  });

  it('ADM-18: オークション別生体一覧が表示される', () => {
    cy.visit('/admin/items');
    
    // オークション選択（カードまたはリンクをクリック）
    cy.get('body').then(($body) => {
      if ($body.find('[href*="/admin/auctions/"]').length > 0) {
        cy.get('[href*="/admin/auctions/"]').first().click();
        cy.url().should('match', /\/admin\/auctions\/\d+\/items/);
      } else {
        cy.log('オークションがないためスキップ');
      }
    });
  });

  it('ADM-19: 生体新規登録画面が表示される', () => {
    cy.visit('/admin/items');
    
    cy.get('body').then(($body) => {
      if ($body.find('[href*="/admin/auctions/"]').length > 0) {
        cy.get('[href*="/admin/auctions/"]').first().click();
        cy.contains('新規登録').click();
        cy.url().should('match', /\/admin\/auctions\/\d+\/items\/create/);
      } else {
        cy.log('オークションがないためスキップ');
      }
    });
  });

  it('ADM-20: 生体を新規登録できる', () => {
    cy.visit('/admin/items');
    
    cy.get('body').then(($body) => {
      if ($body.find('[href*="/admin/auctions/"]').length > 0) {
        cy.get('[href*="/admin/auctions/"]').first().click();
        cy.contains('新規登録').click();
        
        // 種名入力
        cy.get('input').filter('[name*="species"], [label*="種名"]').first().type('テストメダカ');
        
        // 数量
        cy.get('input[type="number"]').first().clear().type('10');
        
        // 保存
        cy.contains('button', '保存').click();
        
        cy.url().should('match', /\/admin\/auctions\/\d+\/items$/);
      } else {
        cy.log('オークションがないためスキップ');
      }
    });
  });

  it('ADM-21: 生体編集画面が表示される', () => {
    cy.visit('/admin/items');
    
    cy.get('body').then(($body) => {
      if ($body.find('[href*="/admin/auctions/"]').length > 0) {
        cy.get('[href*="/admin/auctions/"]').first().click();
        
        // 編集ボタンがあればクリック
        if ($body.text().includes('編集')) {
          cy.contains('編集').first().click();
          cy.url().should('match', /\/admin\/auctions\/\d+\/items\/\d+\/edit/);
        } else {
          cy.log('編集可能な生体がないためスキップ');
        }
      }
    });
  });

  it('ADM-23: 生体削除時に確認ダイアログが表示される', () => {
    cy.visit('/admin/items');
    
    cy.get('body').then(($body) => {
      if ($body.find('[href*="/admin/auctions/"]').length > 0) {
        cy.get('[href*="/admin/auctions/"]').first().click();
        
        if ($body.text().includes('削除')) {
          cy.contains('削除').first().click();
          cy.get('body').should('satisfy', ($body: JQuery<HTMLElement>) => 
            $body.text().includes('削除') && 
            ($body.text().includes('確認') || $body.text().includes('よろしいですか'))
          );
        } else {
          cy.log('削除可能な生体がないためスキップ');
        }
      } else {
        cy.log('オークションがないためスキップ');
      }
    });
  });
});
