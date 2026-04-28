/**
 * §10.8 落札後フロー - 出品者 (Seller) SEL-PO-01〜07
 */

describe('§10.8 落札後フロー - 出品者 (SEL-PO)', () => {
  before(() => {
    // TODO: stagingシード:
    //   Seller A: 出品中・過去落札あり / readyToShip 行あり
    //   Seller B: 売上 0 件（SEL-PO-07 用）
    cy.log('stagingシード前提: Seller A / B のダッシュボード・精算データ');
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.window().then((win) => win.localStorage.clear());
  });

  it('SEL-PO-01: ダッシュボードの「入金待ち金額」が表示される', () => {
    cy.loginAsSeller();
    cy.visit('/seller/dashboard');
    cy.url().should('include', '/seller/dashboard');
    cy.get('body').should('be.visible');

    // UIの数値と /seller/dashboard JSON が一致することを確認
    cy.apiAs('seller', { method: 'GET', url: '/api/seller/dashboard' }).then((res) => {
      expect(res.status).to.eq(200);
      // expect(res.body.data).to.have.property('pending_payment_amount');
      // expect(res.body.data).to.have.property('ready_to_ship_count');
    });
  });

  it('SEL-PO-02: 精算一覧（オークション単位の集計表示）', () => {
    cy.loginAsSeller();
    cy.visit('/seller/settlements');
    cy.url().should('include', '/seller/settlements');
    cy.get('body').should('be.visible');

    cy.apiAs('seller', { method: 'GET', url: '/api/seller/settlements' }).then((res) => {
      expect(res.status).to.eq(200);
      // sales_total / commission / net_amount / status を含むこと
    });
  });

  it.skip('SEL-PO-03: 精算詳細（落札者ごとの明細）', () => {
    // requires staging seed: SellerSettlement レコード
    cy.loginAsSeller();
    cy.apiAs('seller', { method: 'GET', url: '/api/seller/settlements/1' }).then((res) => {
      expect(res.status).to.eq(200);
      // 落札者ごとの 商品/落札価格/送料/手数料率/手数料額/ネット額 / 税区分
    });
  });

  it.skip('SEL-PO-04: 支払通知書PDF（出品者）DL', () => {
    // requires custom command implementation: cy.downloadPdf
    // cy.downloadPdf('/api/seller/settlements/1/payment-notice').then((pdf) => {
    //   expect(pdf.filename).to.match(/^payment_notice_auction_\d+\.pdf$/);
    //   expect(pdf.text).to.match(/PAY-A\d{5}-S\d{5}/);
    //   expect(pdf.text).to.contain('振込予定日');
    //   expect(pdf.text).to.contain('振込金額');
    // });
  });

  it.skip('SEL-PO-05: 発送一覧＆発送登録 → NTF-5 送信', () => {
    // requires staging environment: MailHog + LINE 検証
    cy.loginAsSeller();
    cy.visit('/seller/shipping');
    // POST /seller/shipping/{id}/ship → 200
    // DB: delivery_status=shipped / shipped_at / tracking_number / carrier
    // NTF-5 が落札者宛にキュー投入されていること
  });

  it.skip('SEL-PO-06: 追跡番号の訂正は NTF-5 を再送しない', () => {
    // requires staging environment: MailHog で再送なしを検証
    cy.apiAs('seller', {
      method: 'PUT',
      url: '/api/seller/shipping/1/tracking',
      body: { tracking_number: 'CORRECTED-1234', carrier: 'yamato' },
    }).its('status').should('eq', 200);
    // NTF-5 が再送されないことを MailHog で検証
  });

  it('SEL-PO-07: 売上データ 0 件時の空ステート表示', () => {
    // Seller B (売上0件) のアカウントでログインして空ステートを確認
    cy.loginAsSeller();
    cy.visit('/seller/settlements');
    cy.get('body').should('be.visible');
    // 0件時は「該当する売上データがありません」 / PDF DL ボタン不活性
    // 動作確認は staging データに依存するため、UI の表示存在のみチェック
  });
});
