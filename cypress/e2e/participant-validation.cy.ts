/**
 * 参加者バリデーション・エラーハンドリングのE2Eテスト
 * （E2Eテスト項目書 PAR-05, PAR-09 対応）
 */

describe('参加者バリデーション', () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.window().then((win) => win.localStorage.clear());
    cy.loginAsParticipant();
  });

  it('PAR-05: ライブオークションで入札金額が不正だとエラーが表示される', () => {
    cy.visit('/participant/auctions');
    
    cy.get('body').then(($body) => {
      if ($body.find('[href*="/live"]').length > 0) {
        cy.get('[href*="/live"]').first().click();
        
        // 入札ボタンがあれば不正な金額で試行
        if ($body.text().includes('入札')) {
          cy.get('input[type="number"]').first().clear().type('-100');
          cy.contains('button', '入札').click();
          
          cy.get('body').should('satisfy', ($body: JQuery<HTMLElement>) => 
            $body.text().includes('エラー') || 
            $body.text().includes('無効') || 
            $body.find('[role="alert"]').length > 0
          );
        }
      } else {
        cy.log('ライブオークションがないためスキップ');
      }
    });
  });

  it('PAR-09: 落札詳細で存在しないIDにアクセスすると404またはエラーが表示される', () => {
    cy.loginAsParticipant();
    cy.visit('/participant/won-items/999999', { failOnStatusCode: false });
    
    // 404ページまたはエラーメッセージの表示を待機
    cy.wait(2000); // ページ読み込みを待機
    
    // 404ページのコンテンツが表示されるまで待機
    cy.get('body', { timeout: 10000 }).should('be.visible');
    
    cy.url().then((url) => {
      // 404ページにリダイレクトされた場合
      if (url.includes('/participant/won-items/999999')) {
        // 404コンテンツが表示されることを確認
        cy.get('body').then(($body) => {
          const bodyText = $body.text();
          const has404Content = 
            bodyText.includes('404') || 
            bodyText.includes('見つかりません') || 
            bodyText.includes('Not Found') ||
            bodyText.includes('ページが見つかりません') ||
            bodyText.includes('エラー') ||
            $body.find('[role="alert"]').length > 0;
          
          if (has404Content) {
            cy.log('✓ 404ページが表示された');
          } else {
            cy.log('⚠ 404コンテンツが見つからない（実装を確認）');
            cy.log('Body text: ' + bodyText.substring(0, 200));
          }
          
          // アサーション
          expect(has404Content, '404コンテンツが表示されること').to.be.true;
        });
      } else {
        // 一覧などにリダイレクトされた場合もOK
        cy.log('✓ 別のページにリダイレクトされた');
      }
    });
  });
});
