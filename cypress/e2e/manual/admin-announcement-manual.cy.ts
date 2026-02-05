/**
 * マニュアル生成用テスト: 管理者 - お知らせ管理
 * 
 * このテストは操作マニュアル用のスクリーンショットを生成します
 */

describe('マニュアル: 管理者 - お知らせ管理', () => {
  before(() => {
    cy.task('setTestSuite', 'お知らせ管理');
  });

  it('お知らせの作成から削除までの完全な手順', () => {
    // ステップ1: ログイン
    cy.visit('/login');
    cy.captureStep('ADM-01-login-page', '1. ログイン画面を開きます', { wait: 500 });
    
    cy.get('input[type="email"]').type('admin@example.com');
    cy.get('input[type="password"]').type('password');
    cy.captureStep('ADM-02-login-input', '2. 管理者のメールアドレスとパスワードを入力します', { wait: 500 });
    
    cy.contains('button', 'ログイン').click();
    cy.url().should('include', '/admin');
    cy.captureStep('ADM-03-dashboard', '3. 管理者ダッシュボードが表示されます', { wait: 1000 });
    
    // ステップ2: お知らせ管理へ移動
    cy.contains('お知らせ管理').click();
    cy.url().should('include', '/admin/announcements');
    cy.captureStep('ADM-04-announcements-list', '4. お知らせ一覧が表示されます', { wait: 1000 });
    
    // ステップ3: 新規作成
    cy.contains('button', '新規作成').click();
    cy.url().should('include', '/admin/announcements/create');
    cy.captureStep('ADM-05-create-form', '5. お知らせ作成画面が表示されます', { wait: 1000 });
    
    // ステップ4: 情報入力
    cy.get('input[type="text"]').first().type('重要なお知らせ');
    cy.captureStep('ADM-06-input-title', '6. タイトルを入力します（例: 重要なお知らせ）', { wait: 500 });
    
    cy.get('textarea').first().type('本日のオークションは予定通り開催されます。\n参加者の皆様のご参加をお待ちしております。');
    cy.captureStep('ADM-07-input-content', '7. 内容を入力します', { wait: 500 });
    
    // 優先度選択（存在する場合）
    cy.get('body').then(($body) => {
      if ($body.find('select').length > 0) {
        cy.get('select').first().select('high');
        cy.captureStep('ADM-08-select-priority', '8. 優先度を選択します（例: 高）', { wait: 500 });
      }
    });
    
    // ステップ5: 保存
    cy.get('button').contains(/保存|作成/).click();
    cy.wait(2000);
    cy.captureStep('ADM-09-submit', '9. 保存ボタンをクリックしてお知らせを作成します', { wait: 1000 });
    
    // ステップ6: 一覧に戻る
    cy.url().then((url) => {
      if (url.includes('/admin/announcements') && !url.includes('/create')) {
        cy.captureStep('ADM-10-list-after-create', '10. お知らせ一覧に戻り、作成されたお知らせが表示されます', { wait: 1000 });
      } else {
        cy.visit('/admin/announcements');
        cy.wait(1000);
        cy.captureStep('ADM-10-list-after-create', '10. お知らせ一覧に戻り、作成されたお知らせが表示されます', { wait: 1000 });
      }
    });
    
    // ステップ7: 編集
    cy.get('body').then(($body) => {
      const editButtons = $body.find('button, a').filter((i, el) => {
        const text = Cypress.$(el).text();
        return /編集/.test(text);
      });
      
      if (editButtons.length > 0) {
        cy.wrap(editButtons.first()).click();
        cy.wait(1000);
        cy.captureStep('ADM-11-edit-form', '11. 編集ボタンをクリックして編集画面を開きます', { wait: 1000 });
        
        // 編集内容を変更
        cy.get('input[type="text"]').first().clear().type('更新されたお知らせ');
        cy.captureStep('ADM-12-edit-title', '12. タイトルを変更します', { wait: 500 });
        
        cy.get('button').contains(/保存|更新/).click();
        cy.wait(2000);
        cy.captureStep('ADM-13-edit-submit', '13. 保存ボタンをクリックして変更を保存します', { wait: 1000 });
      }
    });
    
    // ステップ8: 削除
    cy.visit('/admin/announcements');
    cy.wait(1000);
    
    cy.get('body').then(($body) => {
      const deleteButtons = $body.find('button').filter((i, el) => {
        const text = Cypress.$(el).text();
        return /削除/.test(text);
      });
      
      if (deleteButtons.length > 0) {
        cy.captureStep('ADM-14-before-delete', '14. 削除ボタンをクリックします', { wait: 500 });
        
        cy.wrap(deleteButtons.first()).click();
        cy.wait(500);
        cy.captureStep('ADM-15-delete-confirm', '15. 削除確認ダイアログが表示されます', { wait: 500 });
        
        // 確認ダイアログのOKをクリック
        cy.get('button').contains(/はい|OK|削除/).click();
        cy.wait(1000);
        cy.captureStep('ADM-16-after-delete', '16. お知らせが削除されました', { wait: 1000 });
      }
    });
  });

  after(() => {
    // マニュアル生成
    cy.task('generateManual', { outputPath: 'storage/app/manual/お知らせ管理マニュアル.md' });
  });
});
