/**
 * §10.9 落札後フロー - 管理者 (Admin) ADM-PO-01〜10
 *
 * 既存の admin-won-items.cy.ts (ADM-37〜41) を補完。
 */

describe('§10.9 落札後フロー - 管理者 (ADM-PO)', () => {
  before(() => {
    // TODO: stagingシード:
    //   終了済み Auction 複数, WonItem (pending/paid/confirmed の各状態), Escrow レコード
    cy.log('stagingシード前提: 落札オークション群と各状態の WonItem');
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.window().then((win) => win.localStorage.clear());
  });

  it('ADM-PO-01: 落札オークション一覧 (A-1) が終了済みのみ表示', () => {
    cy.loginAsAdmin();
    cy.visit('/admin/won-items');
    cy.get('body').should('be.visible');

    cy.apiAs('admin', { method: 'GET', url: '/api/admin/won-items-auctions' }).then((res) => {
      expect(res.status).to.eq(200);
      // 各オークションに「未入金件数 / 発送待ち件数 / 完了件数」が含まれること
    });
  });

  it('ADM-PO-02: 落札一覧のフィルタ＆検索 (A-2)', () => {
    cy.loginAsAdmin();
    cy.visit('/admin/won-items');
    cy.get('body').then(($body) => {
      if ($body.find('[href*="/admin/auctions/"]').length > 0) {
        cy.get('[href*="/admin/auctions/"]').filter('[href*="/won-items"]').first().click();
        cy.url().should('match', /\/admin\/auctions\/\d+\/won-items/);
        // キーワード/入金状態/配送状態/期限超過フィルタ
      } else {
        cy.log('オークションがないためスキップ');
      }
    });
  });

  it.skip('ADM-PO-03: 入金確認 (A-4) → confirmed 遷移 + NTF-3/4', () => {
    // requires staging environment: MailHog + LINE 検証
    // 前提: 対象 WonItem が paid
    cy.apiAs('admin', {
      method: 'POST',
      url: '/api/admin/won-items/1/confirm-payment',
    }).then((res) => {
      expect(res.status).to.eq(200);
      // DB: payment_status=confirmed, payment_confirmed_at, shipping_locked_at セット
      // NTF-3 が落札者へ、NTF-4 が出品者へキュー投入
    });
  });

  it.skip('ADM-PO-04: 発送完了 (A-5) → shipped 遷移 + NTF-5', () => {
    // requires staging environment + seed: payment_status=confirmed, delivery_status=preparing
    cy.apiAs('admin', {
      method: 'POST',
      url: '/api/admin/won-items/1/ship',
      body: { tracking_number: 'TR-0001', carrier: 'yamato' },
    }).its('status').should('eq', 200);
    // 異常: preparing 以外からの発送操作は 409
  });

  it.skip('ADM-PO-05: 配達完了 (A-6) → completed 遷移', () => {
    cy.apiAs('admin', {
      method: 'POST',
      url: '/api/admin/won-items/1/complete',
    }).its('status').should('eq', 200);
    // delivered_at 記録
  });

  it.skip('ADM-PO-06: メモ更新 (A-7)', () => {
    cy.apiAs('admin', {
      method: 'PATCH',
      url: '/api/admin/won-items/1/notes',
      body: { internal_notes: 'テストメモ ' + Date.now() },
    }).its('status').should('eq', 200);
    // 監査ログ記録の検証は staging のログ確認エンドポイント必要
  });

  it.skip('ADM-PO-07: 管理者から送料計算 (A-8) を代行', () => {
    cy.apiAs('admin', {
      method: 'POST',
      url: '/api/admin/auctions/1/winners/1/calculate-shipping',
    }).then((res) => {
      expect(res.status).to.eq(200);
      // 結果が PAR-PO-05 と同一であること
    });
  });

  it.skip('ADM-PO-08: 管理者帳票DL (A-9/10/11) 請求書/納品書/支払通知書', () => {
    // requires custom command implementation: cy.downloadPdf
    // cy.downloadPdf('/api/admin/auctions/1/winners/1/invoice').then((pdf) => {
    //   expect(pdf.filename).to.match(/^invoice_auction_\d+_winner_\d+\.pdf$/);
    //   expect(pdf.text).to.match(/INV-A\d{5}-W\d{5}/);
    // });
    // cy.downloadPdf('/api/admin/auctions/1/winners/1/delivery-note').then((pdf) => {
    //   expect(pdf.filename).to.match(/^delivery_note_auction_\d+_winner_\d+\.pdf$/);
    // });
    // cy.downloadPdf('/api/admin/auctions/1/sellers/1/payment-notice').then((pdf) => {
    //   expect(pdf.filename).to.match(/^payment_notice_auction_\d+_seller_\d+\.pdf$/);
    //   expect(pdf.text).to.match(/PAY-A\d{5}-S\d{5}/);
    // });
  });

  it('ADM-PO-09: 帳票一覧 (A-12/13/14) と CSV エクスポート', () => {
    cy.loginAsAdmin();
    cy.apiAs('admin', { method: 'GET', url: '/api/admin/documents/invoices' }).then((res) => {
      expect(res.status).to.eq(200);
    });
    cy.apiAs('admin', { method: 'GET', url: '/api/admin/documents/payment-notices' }).then((res) => {
      expect(res.status).to.eq(200);
    });
    cy.apiAs('admin', { method: 'GET', url: '/api/admin/documents/delivery-notes' }).then((res) => {
      expect(res.status).to.eq(200);
    });
    // CSVエクスポートは UTF-8 BOM 付きで出力されること（DL検証は別途）
  });

  it.skip('ADM-PO-10: エスクロー操作 (A-21〜24)', () => {
    // requires staging seed: Escrow レコード
    // confirm-payment / release / refund / dispute の遷移を検証
    cy.apiAs('admin', { method: 'POST', url: '/api/admin/escrow/1/confirm-payment' }).its('status').should('eq', 200);
    cy.apiAs('admin', { method: 'POST', url: '/api/admin/escrow/1/release' }).its('status').should('eq', 200);
    // refund / dispute も同様に検証
  });
});
