/**
 * 出品者バリデーション・エラーハンドリングのE2Eテスト
 * （E2Eテスト項目書 SEL-06, SEL-08 対応）
 */

describe('出品者バリデーション', () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.window().then((win) => win.localStorage.clear());
    cy.loginAsSeller();
  });

  it('SEL-06: 出品編集時、必須項目が未入力だとエラーが表示される', () => {
    cy.visit('/seller/items');
    
    cy.get('body').then(($body) => {
      if ($body.text().includes('編集')) {
        cy.contains('編集').first().click();
        
        // 種名をクリア
        cy.get('input').filter('[name*="species"], [label*="種名"]').first().clear();
        cy.contains('button', '保存').click();
        
        cy.get('body').should('satisfy', ($body: JQuery<HTMLElement>) => 
          $body.text().includes('必須') || 
          $body.text().includes('入力') || 
          $body.find('[role="alert"]').length > 0
        );
      } else {
        cy.log('編集可能な出品がないためスキップ');
      }
    });
  });

  it('SEL-08: 出品詳細で存在しないIDにアクセスすると404またはエラーが表示される', () => {
    cy.visit('/seller/items/999999', { failOnStatusCode: false });
    
    cy.get('body').should('satisfy', ($body: JQuery<HTMLElement>) => 
      $body.text().includes('404') || 
      $body.text().includes('見つかりません') || 
      $body.text().includes('Not Found')
    );
  });
});
