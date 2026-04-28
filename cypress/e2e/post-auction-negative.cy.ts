/**
 * §10.13 落札後フロー - 異常系・境界値 NEG-01〜12
 *
 * 多くは API レベルの検証で動作可能。staging のシードデータ ID に依存する箇所は .skip。
 */

describe('§10.13 落札後フロー - 異常系・境界値 (NEG)', () => {
  before(() => {
    // TODO: stagingシード（各 NEG ケース用の状態を持つ WonItem）
    cy.log('stagingシード前提: 各状態の WonItem');
  });

  beforeEach(() => {
    cy.clearCookies();
    cy.window().then((win) => win.localStorage.clear());
  });

  it.skip('NEG-01: 配送料計算で存在しない都道府県 → 422', () => {
    // requires staging seed: WonItem 1
    cy.apiAs('participant', {
      method: 'POST',
      url: '/api/participant/auctions/1/calculate-shipping',
      body: { prefecture: '存在しない県' },
    }).its('status').should('eq', 422);
  });

  it.skip('NEG-02: 配送料計算で重量オーバー → 422 (手動見積メッセージ)', () => {
    // requires staging seed: 重量超過の WonItem
    cy.apiAs('participant', {
      method: 'POST',
      url: '/api/participant/auctions/1/calculate-shipping',
    }).then((res) => {
      expect(res.status).to.eq(422);
      // expect(res.body.message).to.contain('手動見積');
    });
  });

  it.skip('NEG-03: confirm-payment を paid 以外に実行 → 409', () => {
    // requires staging seed: pending 状態の WonItem
    cy.apiAs('admin', {
      method: 'POST',
      url: '/api/admin/won-items/1/confirm-payment',
    }).then((res) => {
      expect([409, 422]).to.include(res.status);
    });
  });

  it.skip('NEG-04: ship を confirmed 前に実行 → 409', () => {
    cy.apiAs('admin', {
      method: 'POST',
      url: '/api/admin/won-items/1/ship',
    }).then((res) => {
      expect(res.status).to.eq(409);
    });
  });

  it('NEG-05: 存在しない WonItem ID → 404', () => {
    cy.apiAs('admin', {
      method: 'GET',
      url: '/api/admin/won-items/99999999',
    }).its('status').should('eq', 404);
  });

  it.skip('NEG-06: 他人の WonItem を参照 → 403', () => {
    // requires staging seed: Participant Y の WonItem ID 既知
    cy.apiAs('participant', {
      method: 'GET',
      url: '/api/participant/won-items/99999', // Y の WonItem
    }).then((res) => {
      expect([403, 404]).to.include(res.status);
    });
  });

  it.skip('NEG-07: 領収書を未入金でDL → 404', () => {
    // requires staging seed: 未入金 WonItem
    cy.apiAs('participant', {
      method: 'GET',
      url: '/api/participant/auctions/1/receipt',
    }).its('status').should('eq', 404);
  });

  it.skip('NEG-08: 請求書を送料未計算でDL → 400', () => {
    // requires staging seed: 送料未計算の WonItem
    cy.apiAs('participant', {
      method: 'GET',
      url: '/api/participant/auctions/1/invoice',
    }).its('status').should('eq', 400);
  });

  it.skip('NEG-09: 配送先住所をロック後に更新 → 403/422', () => {
    // requires staging seed: shipping_locked_at セット済み WonItem
    cy.apiAs('participant', {
      method: 'PUT',
      url: '/api/participant/auctions/1/address',
      body: { postal_code: '1500001', prefecture: '東京都', city: '渋谷区', address_line: '神宮前1-1', recipient_name: 'A', phone: '0900' },
    }).then((res) => {
      expect([403, 422]).to.include(res.status);
    });
  });

  it.skip('NEG-10: 落札金額 0 円 → 生成拒否 or 警告表示', () => {
    // requires staging seed: winning_price=0 の WonItem
    cy.apiAs('participant', {
      method: 'GET',
      url: '/api/participant/auctions/1/invoice',
    }).then((res) => {
      // 生成拒否 (4xx) または警告メッセージを含む 200
      expect([200, 400, 422]).to.include(res.status);
    });
  });

  it.skip('NEG-11: 極端に長い商品名/住所（255文字）も省略なく表示', () => {
    // requires custom command implementation: cy.downloadPdf
    // 255文字の文字列を投入し、PDF テキスト抽出で全文一致を検証
  });

  it.skip('NEG-12: 同時発送登録（二重クリック）の冪等性', () => {
    // 2回連続で ship を投げて、2回目は 409 / 通知は1回のみ
    // requires staging environment + MailHog で重複送信なしを検証
    cy.apiAs('seller', { method: 'POST', url: '/api/seller/shipping/1/ship' });
    cy.apiAs('seller', { method: 'POST', url: '/api/seller/shipping/1/ship' })
      .its('status').should('eq', 409);
  });
});
