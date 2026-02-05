/**
 * マニュアル生成用テスト: 参加者機能
 * 
 * このテストは参加者向け操作マニュアル用のスクリーンショットを生成します
 */

describe('マニュアル: 参加者機能', () => {
  before(() => {
    cy.task('setTestSuite', '参加者機能');
  });

  it('参加者の基本操作手順', () => {
    // ステップ1: ログイン
    cy.visit('/login');
    cy.captureStep('PAR-01-login-page', '1. ログイン画面を開きます', { wait: 500 });
    
    cy.get('input[type="email"]').type('participant1@example.com');
    cy.get('input[type="password"]').type('password');
    cy.captureStep('PAR-02-login-input', '2. 参加者のメールアドレスとパスワードを入力します', { wait: 500 });
    
    cy.contains('button', 'ログイン').click();
    cy.url().should('include', '/participant');
    cy.captureStep('PAR-03-home', '3. 参加者ホーム画面が表示されます', { wait: 1000 });
    
    // ステップ2: オークション一覧
    cy.visit('/participant/auctions');
    cy.captureStep('PAR-04-auctions-list', '4. オークション一覧を表示します', { wait: 1000 });
    
    // ステップ3: オークション詳細
    cy.get('body').then(($body) => {
      if ($body.find('[href*="/auction/"]').length > 0) {
        cy.get('[href*="/auction/"]').first().click();
        cy.wait(1000);
        cy.captureStep('PAR-05-auction-detail', '5. オークション詳細と商品一覧を表示します', { wait: 1000 });
      }
    });
    
    // ステップ4: ライブオークション
    cy.visit('/participant/auctions');
    cy.wait(1000);
    
    cy.get('body').then(($body) => {
      if ($body.find('[href*="/live"]').length > 0) {
        cy.get('[href*="/live"]').first().click();
        cy.wait(1000);
        cy.captureStep('PAR-06-live-auction', '6. ライブオークション画面を表示します', { wait: 1000 });
        
        // 入札画面（存在する場合）
        if ($body.text().includes('入札') || $body.text().includes('現在価格')) {
          cy.captureStep('PAR-07-bid-interface', '7. 入札インターフェースが表示されます', { wait: 1000 });
          
          // 入札金額入力（実際には送信しない）
          cy.get('body').then(($body2) => {
            if ($body2.find('input[type="number"]').length > 0) {
              cy.get('input[type="number"]').first().clear().type('2000');
              cy.captureStep('PAR-08-bid-amount', '8. 入札金額を入力します（例: 2000円）', { wait: 500 });
            }
          });
        }
      }
    });
    
    // ステップ5: 落札管理
    cy.visit('/participant/won-items');
    cy.captureStep('PAR-09-won-items-list', '9. 落札一覧を表示します', { wait: 1000 });
    
    cy.get('body').then(($body) => {
      if ($body.find('[href*="/won-items/"]').length > 0) {
        cy.get('[href*="/won-items/"]').first().click();
        cy.wait(1000);
        cy.captureStep('PAR-10-won-item-detail', '10. 落札詳細を確認します', { wait: 1000 });
      }
    });
    
    // ステップ6: 設定
    cy.visit('/participant/settings');
    cy.captureStep('PAR-11-settings', '11. 設定画面を表示します', { wait: 1000 });
    
    // プロフィール編集
    cy.get('body').then(($body) => {
      if ($body.find('input[name="name"]').length > 0) {
        cy.get('input[name="name"]').clear().type('田中太郎');
        cy.captureStep('PAR-12-edit-profile', '12. プロフィール情報を編集します', { wait: 500 });
      }
    });
  });

  after(() => {
    cy.task('generateManual', { outputPath: 'storage/app/manual/参加者マニュアル.md' });
  });
});
