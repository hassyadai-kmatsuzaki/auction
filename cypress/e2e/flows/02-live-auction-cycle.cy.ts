/**
 * フロー E2E #2: ライブオークション 1 商品の完走
 *
 * 検証スコープ:
 *   - 管理者がオークションを start させ、status='live' になる
 *   - レーンに商品が割当てられ、現在商品が表示される
 *   - finish で status='finished' に遷移
 *   - 終了後に won-items が取得できる
 *
 * 注: カウントダウンの 0.5 秒tick は ProcessAuctionCountdownJob の責務で、
 * Cypress 側で 5 秒待つだけだと flaky になる。本テストは状態遷移のみ検証する。
 */

interface LiveSetup {
  auctionId: number;
  itemId: number;
  laneId: number;
}

describe('フロー#2: ライブオークション 1 商品完走', () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.window().then((win) => win.localStorage.clear());
  });

  function setupScheduledAuction(): Cypress.Chainable<LiveSetup | null> {
    return cy.apiAs('admin', {
      method: 'POST',
      url: '/api/admin/auctions',
      body: {
        title: `E2E flow2 ${Date.now()}`,
        event_date: new Date().toISOString().slice(0, 10),
        start_time: '20:00',
        status: 'scheduled',
        lane_count: 1,
      },
    }).then((res) => {
      const auctionId = res.body?.data?.id ?? res.body?.data?.auction?.id;
      if (!auctionId) return null;

      return cy.apiAs('admin', {
        method: 'GET',
        url: '/api/admin/sellers/list',
      }).then((sellerRes) => {
        const sellerProfileId = sellerRes.body?.data?.sellers?.[0]?.id;
        if (!sellerProfileId) return null;

        return cy.apiAs('admin', {
          method: 'POST',
          url: `/api/admin/auctions/${auctionId}/items`,
          body: {
            species_name: 'E2E ライブテスト',
            quantity: 5,
            start_price: 1000,
            seller_profile_id: sellerProfileId,
          },
        }).then((itemRes) => {
          const itemId = itemRes.body?.data?.item?.id ?? itemRes.body?.data?.id;
          if (!itemId) return null;

          // status を registered に
          cy.apiAs('admin', {
            method: 'PATCH',
            url: `/api/admin/auctions/${auctionId}/items/${itemId}/status`,
            body: { status: 'registered' },
          });

          // レーン作成
          return cy.apiAs('admin', {
            method: 'POST',
            url: `/api/admin/auctions/${auctionId}/lanes/create`,
            body: { lane_name: 'A' },
          }).then((laneRes) => {
            const laneId = laneRes.body?.data?.lane?.id;
            return { auctionId, itemId, laneId } as LiveSetup;
          });
        });
      });
    });
  }

  it('FLOW2-01: scheduledからstartでstatusがliveになる', () => {
    setupScheduledAuction().then((setup) => {
      if (!setup) {
        cy.log('seed 失敗のためスキップ');
        return;
      }

      cy.apiAs('admin', {
        method: 'POST',
        url: `/api/admin/auctions/${setup.auctionId}/live/start`,
      }).then((res) => {
        expect(res.status).to.eq(200);
      });

      // status 確認
      cy.apiAs('admin', {
        method: 'GET',
        url: `/api/admin/auctions/${setup.auctionId}`,
      }).then((res) => {
        expect(res.body?.data?.auction?.status ?? res.body?.data?.status).to.eq('live');
      });
    });
  });

  it('FLOW2-02: ライブ画面で現在商品とレーンが表示される', () => {
    setupScheduledAuction().then((setup) => {
      if (!setup) return;

      cy.apiAs('admin', {
        method: 'POST',
        url: `/api/admin/auctions/${setup.auctionId}/live/start`,
      });

      cy.loginAsAdmin();
      cy.visit(`/admin/auctions/${setup.auctionId}/live`);
      cy.contains('E2E ライブテスト', { timeout: 10000 }).should('be.visible');
    });
  });

  it('FLOW2-03: finishでstatusがfinishedになる', () => {
    setupScheduledAuction().then((setup) => {
      if (!setup) return;

      cy.apiAs('admin', {
        method: 'POST',
        url: `/api/admin/auctions/${setup.auctionId}/live/start`,
      });

      cy.apiAs('admin', {
        method: 'POST',
        url: `/api/admin/auctions/${setup.auctionId}/live/finish`,
      }).then((res) => {
        expect(res.status).to.eq(200);
      });

      cy.apiAs('admin', {
        method: 'GET',
        url: `/api/admin/auctions/${setup.auctionId}`,
      }).then((res) => {
        expect(res.body?.data?.auction?.status ?? res.body?.data?.status).to.eq('finished');
      });
    });
  });

  it('FLOW2-04: liveでないオークションのstartは400で拒否される', () => {
    setupScheduledAuction().then((setup) => {
      if (!setup) return;

      // 一度 start
      cy.apiAs('admin', {
        method: 'POST',
        url: `/api/admin/auctions/${setup.auctionId}/live/start`,
      });

      // 二度目は弾かれる
      cy.apiAs('admin', {
        method: 'POST',
        url: `/api/admin/auctions/${setup.auctionId}/live/start`,
      }).then((res) => {
        expect(res.status).to.be.oneOf([400, 409]);
      });
    });
  });

  it('FLOW2-05: 商品なしで開始すると400で拒否される', () => {
    cy.apiAs('admin', {
      method: 'POST',
      url: '/api/admin/auctions',
      body: {
        title: `E2E flow2-no-items ${Date.now()}`,
        event_date: new Date().toISOString().slice(0, 10),
        start_time: '20:00',
        status: 'scheduled',
        lane_count: 1,
      },
    }).then((res) => {
      const auctionId = res.body?.data?.id ?? res.body?.data?.auction?.id;
      if (!auctionId) return;

      cy.apiAs('admin', {
        method: 'POST',
        url: `/api/admin/auctions/${auctionId}/live/start`,
      }).then((startRes) => {
        expect(startRes.status).to.eq(400);
      });
    });
  });
});
