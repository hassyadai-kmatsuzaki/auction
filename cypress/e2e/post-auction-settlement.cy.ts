/**
 * §10.12 落札後フロー - 精算ワークフロー SET-01〜04
 */

describe('§10.12 落札後フロー - 精算 (SET)', () => {
  before(() => {
    // TODO: stagingシード:
    //   SellerSettlement (pending/processing/completed/on_hold/cancelled の各状態)
    cy.log('stagingシード前提: 各 status の SellerSettlement');
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.window().then((win) => win.localStorage.clear());
  });

  it.skip('SET-01: 自動生成（落札確定後に SellerSettlement(status=pending) が作成）', () => {
    // requires staging environment + WonItem 確定イベントの発火
    // - Seller × Auction ごとに SellerSettlement が作成
    // - status=pending
    cy.apiAs('admin', { method: 'GET', url: '/api/admin/settlements' }).then((res) => {
      expect(res.status).to.eq(200);
      // expect(res.body.data.some(s => s.status === 'pending')).to.be.true;
    });
  });

  it.skip('SET-02: 再計算 (A-19) で合計・手数料が再計算される', () => {
    cy.apiAs('admin', {
      method: 'POST',
      url: '/api/admin/settlements/1/recalculate',
    }).its('status').should('eq', 200);
    // 商品が増減しても合計・手数料が再計算されること
  });

  it.skip('SET-03: 振込完了 (A-18) → status=completed / paid_at', () => {
    cy.apiAs('admin', {
      method: 'POST',
      url: '/api/admin/settlements/1/mark-paid',
    }).its('status').should('eq', 200);
    // - status=completed / paid_at 更新
    // - 出品者ダッシュボードに反映
    // - 支払通知書PDF再発行で履歴残る
  });

  it.skip('SET-04: 保留・キャンセルの遷移 (on_hold / cancelled)', () => {
    cy.apiAs('admin', {
      method: 'PATCH',
      url: '/api/admin/settlements/1',
      body: { status: 'on_hold' },
    }).its('status').should('eq', 200);

    // キャンセル後は再計算不可（A-19 が 409 を返すこと）
    // cy.apiAs('admin', { method: 'PATCH', url: '/api/admin/settlements/1', body: { status: 'cancelled' }});
    // cy.apiAs('admin', { method: 'POST', url: '/api/admin/settlements/1/recalculate' })
    //   .its('status').should('eq', 409);
  });
});
