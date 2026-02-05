/**
 * マニュアル生成用テスト: 出品者機能
 * 
 * このテストは出品者向け操作マニュアル用のスクリーンショットを生成します
 */

describe('マニュアル: 出品者機能', () => {
  before(() => {
    cy.task('setTestSuite', '出品者機能');
  });

  it('出品者の基本操作手順', () => {
    // ステップ1: ログイン
    cy.visit('/login');
    cy.captureStep('SEL-01-login-page', '1. ログイン画面を開きます', { wait: 500 });
    
    cy.get('input[type="email"]').type('seller1@example.com');
    cy.get('input[type="password"]').type('password');
    cy.captureStep('SEL-02-login-input', '2. 出品者のメールアドレスとパスワードを入力します', { wait: 500 });
    
    cy.contains('button', 'ログイン').click();
    cy.url().should('include', '/seller');
    cy.captureStep('SEL-03-dashboard', '3. 出品者ダッシュボードが表示されます', { wait: 1000 });
    
    // ステップ2: 出品申請
    cy.visit('/seller/submit');
    cy.captureStep('SEL-04-submit-page', '4. 出品申請画面を開きます', { wait: 1000 });
    
    // 基本情報の入力（ステップ1）
    // オークション選択（存在する場合）
    cy.get('body').then(($body) => {
      if ($body.text().includes('出品するオークション') || $body.text().includes('出品可能なオークションがありません')) {
        if ($body.text().includes('出品可能なオークションがありません')) {
          cy.log('⚠️ 出品可能なオークションがありません。テストをスキップします。');
          cy.captureStep('SEL-05-no-auction', '5. 出品可能なオークションがない場合の表示', { wait: 500 });
          return; // テスト終了
        }
        
        // Material-UI Selectをクリック
        cy.get('.MuiSelect-select').first().click();
        cy.wait(500);
        
        // 最初のオプションを選択
        cy.get('[role="option"]').first().click();
        cy.wait(500);
        cy.captureStep('SEL-05-select-auction', '5. 出品するオークションを選択します', { wait: 500 });
        
        // 品種名入力
        cy.get('input[type="text"]').first().type('紅白メダカ');
        cy.captureStep('SEL-06-input-title', '6. 品種名を入力します（例: 紅白メダカ）', { wait: 500 });
        
        // 数量入力
        cy.get('input[type="number"]').first().clear().type('10');
        cy.captureStep('SEL-07-input-quantity', '7. 数量を入力します（例: 10匹）', { wait: 500 });
        
        // 希望開始価格入力
        cy.get('input[type="number"]').eq(1).clear().type('1000');
        cy.captureStep('SEL-08-input-price', '8. 希望開始価格を入力します（例: 1000円）', { wait: 500 });
        
        // 次へボタンをクリック
        cy.get('button').contains(/次へ/).should('not.be.disabled').click();
        cy.wait(1000);
        cy.captureStep('SEL-09-step2', '9. 個体情報ステップに進みます', { wait: 500 });
        
        // 個体情報の入力（ステップ2）
        cy.get('textarea').first().type('美しい紅白のメダカです。健康状態良好。体長約3cm。');
        cy.captureStep('SEL-10-input-description', '10. 個体情報を入力します', { wait: 500 });
      }
    });
    
    // ステップ3: 出品履歴
    cy.visit('/seller/items');
    cy.captureStep('SEL-08-items-list', '8. 出品履歴一覧を表示します', { wait: 1000 });
    
    cy.get('body').then(($body) => {
      if ($body.find('[href*="/items/"]').length > 0) {
        cy.get('[href*="/items/"]').first().click();
        cy.wait(1000);
        cy.captureStep('SEL-09-item-detail', '9. 出品詳細を確認します', { wait: 1000 });
      }
    });
    
    // ステップ4: 発送管理
    cy.visit('/seller/shipping');
    cy.captureStep('SEL-10-shipping-list', '10. 発送管理画面を表示します', { wait: 1000 });
    
    // ステップ5: 売上・精算
    cy.visit('/seller/sales');
    cy.captureStep('SEL-11-sales-list', '11. 売上・精算一覧を表示します', { wait: 1000 });
    
    // ステップ6: プロフィール
    cy.visit('/seller/profile');
    cy.captureStep('SEL-12-profile', '12. プロフィール画面を表示します', { wait: 1000 });
  });

  after(() => {
    cy.task('generateManual', { outputPath: 'storage/app/manual/出品者マニュアル.md' });
  });
});
