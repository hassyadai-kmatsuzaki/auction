/**
 * フロー E2E #3: サブスクリプション無効ユーザーの入札ブロック
 *
 * 検証スコープ:
 *   - allows_bid=false / 無契約 / 期限切れ のユーザーが入札 API を叩くと 402 を返す
 *   - 入金確認/送料計算など admin 配下のサブスク無関係エンドポイントは admin で 200
 *   - ログインせず（401）／一般ユーザーで admin（403）の境界
 *
 * 注: 環境にすでに用意された participant がアクティブサブスクを持っているかは
 * 環境次第なので、検証は API 401/402/403 の境界に集中する。
 */

describe('フロー#3: サブスクリプションゲート', () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.window().then((win) => win.localStorage.clear());
  });

  it('FLOW3-01: 未ログインの入札APIは401を返す', () => {
    cy.request({
      method: 'POST',
      url: '/api/participant/bids',
      body: { item_id: 1, is_active: true },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(401);
    });
  });

  it('FLOW3-02: 出品者は participant ロールの入札APIで403を返される', () => {
    cy.apiAs('seller', {
      method: 'POST',
      url: '/api/participant/bids',
      body: { item_id: 1, is_active: true },
    }).then((res) => {
      expect(res.status).to.eq(403);
    });
  });

  it('FLOW3-03: サブスク無効ユーザーは入札時に402で課金誘導される', () => {
    // E2E 環境の participant が「allows_bid=false」または無契約の前提
    // サブスク有効ユーザーで通っているなら 200 になるためスキップする
    cy.apiAs('participant', {
      method: 'GET',
      url: '/api/me/subscription',
    }).then((subRes) => {
      const sub = subRes.body?.data?.subscription;
      const allowsBid = sub?.plan?.allows_bid ?? false;
      const isActive = sub?.status === 'active';

      cy.apiAs('participant', {
        method: 'POST',
        url: '/api/participant/bids',
        body: { item_id: 1, is_active: true },
      }).then((res) => {
        if (!isActive || !allowsBid) {
          expect(res.status, 'サブスク無効/落札権なしユーザーは 402').to.eq(402);
          // 課金誘導用のエラーコードが含まれる
          const code = res.body?.code ?? '';
          expect(code).to.match(/SUBSCRIPTION_REQUIRED|PLAN_CAPABILITY_MISSING/);
        } else {
          // すでに有効なサブスク + allows_bid なので入札試行は item_id 不存在で 400 / 422 等になる
          expect(res.status, 'allows_bid OKならサブスクゲートは通過する').to.not.eq(402);
        }
      });
    });
  });

  it('FLOW3-04: 指値設定もサブスクゲート対象', () => {
    cy.apiAs('participant', {
      method: 'POST',
      url: '/api/participant/bid-limits',
      body: { item_id: 1, limit_price: 1000 },
    }).then((res) => {
      // 401/402/422 のいずれか（サブスクなし→402, アイテムなし→422）
      expect(res.status).to.be.oneOf([402, 422]);
    });
  });

  it('FLOW3-05: 一般ユーザーは admin API に 403', () => {
    cy.apiAs('participant', {
      method: 'GET',
      url: '/api/admin/auctions',
    }).then((res) => {
      expect(res.status).to.eq(403);
    });
  });

  it('FLOW3-06: admin はサブスク非依存で admin API を叩ける', () => {
    cy.apiAs('admin', {
      method: 'GET',
      url: '/api/admin/auctions',
    }).then((res) => {
      expect(res.status).to.eq(200);
    });
  });

  it('FLOW3-07: ヘルパAPI: 自分のサブスク状態が取得できる', () => {
    cy.apiAs('participant', {
      method: 'GET',
      url: '/api/me/subscription',
    }).then((res) => {
      expect(res.status).to.eq(200);
      // status または subscription:null を含む構造化レスポンス
      expect(res.body).to.have.property('success', true);
    });
  });
});
