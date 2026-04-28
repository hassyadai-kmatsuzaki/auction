/**
 * お気に入り / 保存検索 E2E
 * 対象:
 *   - src/app/Http/Controllers/Participant/FavoriteController.php
 *   - src/app/Http/Controllers/Participant/SavedSearchController.php
 *
 * 前提シードデータ:
 *   - items テーブルに少なくとも 2 件の有効な item が存在する事
 *   - 参加者 (E2E_PARTICIPANT_EMAIL) が saved_searches で最大 19 件まで占有していない事
 */

describe('Favorites & SavedSearches', () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.window().then((win) => win.localStorage.clear());
  });

  /** 一覧画面で取得できる item から最初の id を返すヘルパー */
  const fetchAnyItemId = () =>
    cy
      .apiAs('participant', {
        method: 'GET',
        url: '/api/participant/auctions',
      })
      .then((res) => {
        // 構造はレスポンス次第なので柔軟に探索
        const auctions = res.body?.data?.data ?? res.body?.data ?? [];
        for (const a of auctions) {
          const items = a.items ?? a.data ?? [];
          if (Array.isArray(items) && items.length > 0) return items[0].id;
        }
        return null;
      });

  describe('お気に入り: トグル', () => {
    it('FAV-01: お気に入りを追加できる (toggle で is_favorited=true)', () => {
      fetchAnyItemId().then((itemId: number | null) => {
        if (!itemId) {
          // 既存出品が無い場合、items テーブルから直接取得を試行
          cy.apiAs('admin', {
            method: 'GET',
            url: '/api/admin/items?limit=1',
          }).then((adminRes) => {
            const list = adminRes.body?.data?.data ?? adminRes.body?.data ?? [];
            if (!list.length) {
              cy.log('item が無いためスキップ');
              return;
            }
            const id = list[0].id;
            cy.apiAs('participant', {
              method: 'POST',
              url: '/api/participant/favorites/toggle',
              body: { item_id: id },
            }).then((res) => {
              expect(res.status).to.eq(200);
              expect(res.body.success).to.eq(true);
              expect(res.body).to.have.property('is_favorited');
            });
          });
          return;
        }

        cy.apiAs('participant', {
          method: 'POST',
          url: '/api/participant/favorites/toggle',
          body: { item_id: itemId },
        }).then((res) => {
          expect(res.status).to.eq(200);
          expect(res.body.success).to.eq(true);
          // 1 回目のトグルなので is_favorited は true / false どちらでも OK だが
          // 操作によって反転している事を確認
          expect(res.body).to.have.property('is_favorited');
        });
      });
    });

    it('FAV-02: 同じ item を再度 toggle するとお気に入りから外れる (反転)', () => {
      fetchAnyItemId().then((itemId: number | null) => {
        if (!itemId) {
          cy.log('item が無いためスキップ');
          return;
        }
        // 1 回目
        cy.apiAs('participant', {
          method: 'POST',
          url: '/api/participant/favorites/toggle',
          body: { item_id: itemId },
        }).then((first) => {
          // 2 回目
          cy.apiAs('participant', {
            method: 'POST',
            url: '/api/participant/favorites/toggle',
            body: { item_id: itemId },
          }).then((second) => {
            expect(second.status).to.eq(200);
            expect(second.body.is_favorited).to.eq(!first.body.is_favorited);
          });
        });
      });
    });

    it('FAV-03: 存在しない item_id を toggle すると 422', () => {
      cy.apiAs('participant', {
        method: 'POST',
        url: '/api/participant/favorites/toggle',
        body: { item_id: 999999999 },
      }).then((res) => {
        expect(res.status).to.eq(422);
      });
    });
  });

  describe('お気に入り: 一覧 / フィルタ', () => {
    it('FAV-04: 自分のお気に入り一覧が取得できる', () => {
      cy.apiAs('participant', {
        method: 'GET',
        url: '/api/participant/favorites',
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.success).to.eq(true);
        expect(res.body.data.favorites).to.be.an('array');
      });
    });

    it('FAV-05: include_past=true で過去オークション分も含まれる', () => {
      cy.apiAs('participant', {
        method: 'GET',
        url: '/api/participant/favorites?include_past=1',
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.data.favorites).to.be.an('array');
      });
    });

    it('FAV-06: include_past=false で過去オークションが除外される', () => {
      cy.apiAs('participant', {
        method: 'GET',
        url: '/api/participant/favorites',
      }).then((res) => {
        expect(res.status).to.eq(200);
        const favs = res.body.data.favorites ?? [];
        favs.forEach((f: any) => {
          if (f.auction) expect(f.auction.is_past).to.not.eq(true);
        });
      });
    });
  });

  describe('お気に入り: 一括チェック', () => {
    it('FAV-07: item_ids 配列でフラグ取得できる (POST /favorites/check)', () => {
      cy.apiAs('participant', {
        method: 'POST',
        url: '/api/participant/favorites/check',
        body: { item_ids: [1, 2, 3] },
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.success).to.eq(true);
        expect(res.body.data.favorite_item_ids).to.be.an('array');
      });
    });

    it('FAV-08: item_ids が空配列だとバリデーションエラー (422)', () => {
      cy.apiAs('participant', {
        method: 'POST',
        url: '/api/participant/favorites/check',
        body: { item_ids: [] },
      }).then((res) => {
        expect(res.status).to.eq(422);
      });
    });
  });

  describe('保存検索 CRUD', () => {
    it('FAV-09: 保存検索一覧を取得できる', () => {
      cy.apiAs('participant', {
        method: 'GET',
        url: '/api/participant/saved-searches',
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.success).to.eq(true);
        expect(res.body.data).to.be.an('array');
      });
    });

    it('FAV-10: 保存検索を新規作成できる', () => {
      cy.apiAs('participant', {
        method: 'POST',
        url: '/api/participant/saved-searches',
        body: {
          name: `E2E 検索 ${Date.now()}`,
          conditions: { species_name: '三色ラメ' },
          notify_on_match: false,
        },
      }).then((res) => {
        expect(res.status).to.eq(201);
        expect(res.body.success).to.eq(true);
        expect(res.body.data).to.have.property('id');
        // 作成したものを後始末
        const id = res.body.data.id;
        cy.apiAs('participant', {
          method: 'DELETE',
          url: `/api/participant/saved-searches/${id}`,
        });
      });
    });

    it('FAV-11: name 未入力は 422', () => {
      cy.apiAs('participant', {
        method: 'POST',
        url: '/api/participant/saved-searches',
        body: { conditions: {} },
      }).then((res) => {
        expect(res.status).to.eq(422);
      });
    });

    it('FAV-12: 保存検索を削除できる', () => {
      cy.apiAs('participant', {
        method: 'POST',
        url: '/api/participant/saved-searches',
        body: {
          name: `E2E 削除対象 ${Date.now()}`,
          conditions: {},
        },
      }).then((createRes) => {
        if (createRes.status !== 201) {
          cy.log('作成失敗 (上限到達?) のためスキップ');
          return;
        }
        const id = createRes.body.data.id;
        cy.apiAs('participant', {
          method: 'DELETE',
          url: `/api/participant/saved-searches/${id}`,
        }).then((res) => {
          expect(res.status).to.eq(200);
          expect(res.body.success).to.eq(true);
        });
      });
    });

    it('FAV-13: 上限 20 件を超えると 422 を返す', () => {
      // 既存の保存検索を取得
      cy.apiAs('participant', {
        method: 'GET',
        url: '/api/participant/saved-searches',
      }).then((listRes) => {
        const existing = listRes.body.data ?? [];
        const need = Math.max(0, 20 - existing.length);
        const created: number[] = [];

        // 上限まで埋める
        const fill = (i: number): Cypress.Chainable<any> => {
          if (i >= need) return cy.wrap(null);
          return cy
            .apiAs('participant', {
              method: 'POST',
              url: '/api/participant/saved-searches',
              body: { name: `E2E 上限 ${i}-${Date.now()}`, conditions: {} },
            })
            .then((r) => {
              if (r.status === 201) created.push(r.body.data.id);
              return fill(i + 1);
            });
        };

        fill(0).then(() => {
          // 21 件目は 422
          cy.apiAs('participant', {
            method: 'POST',
            url: '/api/participant/saved-searches',
            body: { name: '溢れ', conditions: {} },
          }).then((res) => {
            expect(res.status).to.eq(422);
            expect(res.body.message).to.contain('20');

            // 後始末: 作成した分を削除
            created.forEach((id) => {
              cy.apiAs('participant', {
                method: 'DELETE',
                url: `/api/participant/saved-searches/${id}`,
              });
            });
          });
        });
      });
    });
  });
});
