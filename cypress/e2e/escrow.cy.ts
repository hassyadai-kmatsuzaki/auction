/**
 * エスクロー操作 E2E (管理者向け)
 * 対象: src/app/Http/Controllers/Admin/EscrowController.php
 *       src/app/Services/EscrowService.php
 *
 * 前提シードデータ:
 *   - escrow_transactions テーブルに少なくとも以下が用意されている事
 *     - status='awaiting_payment' のレコード (入金確認テスト用)
 *     - status='payment_held'    のレコード (リリース / 返金 / 紛争テスト用)
 *   - won_items / users (buyer / seller) は EscrowService の整合性チェックを満たす事
 *
 * ステータス遷移:
 *   awaiting_payment -> payment_held -> released_to_seller
 *                                    -> refunded
 *                                    -> disputed -> refunded
 */

describe('Escrow Operations', () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.window().then((win) => win.localStorage.clear());
  });

  /** ステータス指定で最初の 1 件を取得するヘルパー */
  const findEscrowByStatus = (status: string) =>
    cy
      .apiAs('admin', {
        method: 'GET',
        url: `/api/admin/escrow?status=${status}`,
      })
      .then((res) => {
        expect(res.status).to.eq(200);
        const list = res.body?.data?.data ?? [];
        return list[0] ?? null;
      });

  describe('一覧 / フィルタ', () => {
    it('ESC-01: エスクロー一覧が取得できる (GET /api/admin/escrow)', () => {
      cy.apiAs('admin', {
        method: 'GET',
        url: '/api/admin/escrow',
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.success).to.eq(true);
        expect(res.body.data).to.have.property('data');
        expect(res.body.data).to.have.property('total');
      });
    });

    it('ESC-02: status フィルタで絞り込みができる', () => {
      cy.apiAs('admin', {
        method: 'GET',
        url: '/api/admin/escrow?status=payment_held',
      }).then((res) => {
        expect(res.status).to.eq(200);
        const list = res.body.data.data ?? [];
        list.forEach((row: any) => {
          expect(row.status).to.eq('payment_held');
        });
      });
    });

    it('ESC-03: 参加者は管理 API にアクセス不可 (401/403)', () => {
      cy.apiAs('participant', {
        method: 'GET',
        url: '/api/admin/escrow',
      }).then((res) => {
        expect([401, 403]).to.include(res.status);
      });
    });
  });

  describe('入金確認 (awaiting_payment -> payment_held)', () => {
    it('ESC-04: awaiting_payment のエスクロー入金を確認できる', () => {
      findEscrowByStatus('awaiting_payment').then((row: any) => {
        if (!row) {
          cy.log('awaiting_payment のエスクローがないためスキップ');
          return;
        }
        cy.apiAs('admin', {
          method: 'POST',
          url: `/api/admin/escrow/${row.id}/confirm-payment`,
        }).then((res) => {
          expect(res.status).to.eq(200);
          expect(res.body.success).to.eq(true);
          expect(res.body.message).to.contain('入金');
        });
      });
    });
  });

  describe('リリース (payment_held -> released_to_seller)', () => {
    it('ESC-05: payment_held のエスクローを出品者にリリースできる', () => {
      findEscrowByStatus('payment_held').then((row: any) => {
        if (!row) {
          cy.log('payment_held のエスクローがないためスキップ');
          return;
        }
        cy.apiAs('admin', {
          method: 'POST',
          url: `/api/admin/escrow/${row.id}/release`,
        }).then((res) => {
          expect(res.status).to.eq(200);
          expect(res.body.success).to.eq(true);
        });
      });
    });

    it('ESC-06: 不正な状態遷移 (awaiting_payment から release) は拒否される', () => {
      findEscrowByStatus('awaiting_payment').then((row: any) => {
        if (!row) {
          cy.log('awaiting_payment のエスクローがないためスキップ');
          return;
        }
        cy.apiAs('admin', {
          method: 'POST',
          url: `/api/admin/escrow/${row.id}/release`,
        }).then((res) => {
          // EscrowService::releaseToSeller は RuntimeException を投げる
          // Laravel の既定では 500 になるが 409 / 422 を返す実装も許容
          expect([409, 422, 500]).to.include(res.status);
        });
      });
    });
  });

  describe('返金', () => {
    it('ESC-07: payment_held のエスクローを返金理由付きで返金できる', () => {
      findEscrowByStatus('payment_held').then((row: any) => {
        if (!row) {
          cy.log('payment_held のエスクローがないためスキップ');
          return;
        }
        cy.apiAs('admin', {
          method: 'POST',
          url: `/api/admin/escrow/${row.id}/refund`,
          body: { reason: 'E2E: 商品状態不良のため返金' },
        }).then((res) => {
          expect(res.status).to.eq(200);
          expect(res.body.success).to.eq(true);
        });
      });
    });

    it('ESC-08: 返金理由が未入力だとバリデーションエラー (422)', () => {
      findEscrowByStatus('payment_held').then((row: any) => {
        if (!row) {
          cy.log('payment_held のエスクローがないためスキップ');
          return;
        }
        cy.apiAs('admin', {
          method: 'POST',
          url: `/api/admin/escrow/${row.id}/refund`,
          body: {},
        }).then((res) => {
          expect(res.status).to.eq(422);
        });
      });
    });
  });

  describe('紛争 (dispute)', () => {
    it('ESC-09: payment_held のエスクローに紛争を記録できる', () => {
      findEscrowByStatus('payment_held').then((row: any) => {
        if (!row) {
          cy.log('payment_held のエスクローがないためスキップ');
          return;
        }
        cy.apiAs('admin', {
          method: 'POST',
          url: `/api/admin/escrow/${row.id}/dispute`,
          body: { reason: 'E2E: 受取拒否のため紛争処理' },
        }).then((res) => {
          expect(res.status).to.eq(200);
          expect(res.body.success).to.eq(true);
          expect(res.body.message).to.contain('紛争');
        });
      });
    });

    it('ESC-10: 紛争理由 500 文字超はバリデーションエラー (422)', () => {
      findEscrowByStatus('payment_held').then((row: any) => {
        if (!row) {
          cy.log('payment_held のエスクローがないためスキップ');
          return;
        }
        cy.apiAs('admin', {
          method: 'POST',
          url: `/api/admin/escrow/${row.id}/dispute`,
          body: { reason: 'a'.repeat(501) },
        }).then((res) => {
          expect(res.status).to.eq(422);
        });
      });
    });
  });

  describe('存在しないエスクロー', () => {
    it('ESC-11: 存在しない ID への入金確認は 404', () => {
      cy.apiAs('admin', {
        method: 'POST',
        url: '/api/admin/escrow/9999999/confirm-payment',
      }).then((res) => {
        expect(res.status).to.eq(404);
      });
    });
  });
});
