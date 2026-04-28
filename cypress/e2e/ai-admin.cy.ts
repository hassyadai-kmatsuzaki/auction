/**
 * AI 管理画面 E2E
 * 対象: src/app/Http/Controllers/Admin/AIController.php
 *
 * 前提シードデータ:
 *   - 管理者ユーザー (E2E_ADMIN_EMAIL) が存在する事
 *   - ai_image_analyses / ai_price_predictions / ai_fraud_alerts / ai_recommendations
 *     の各テーブルが存在し、空でも 200 で集計が返る事
 *   - 画像解析 / レコメンド生成は OpenAI API キー (services.openai.api_key) が必要なため
 *     未設定環境では 503 になる事を許容する
 *
 * 観点:
 *   - 認可確認 (admin のみ 200, それ以外は 401/403)
 *   - GET 系エンドポイントが 200 で返る事
 *   - POST 系の重い AI 推論はモックできないため `.skip` または status 緩和で対応
 */

describe('AI Admin Dashboard', () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.window().then((win) => win.localStorage.clear());
  });

  describe('AI ダッシュボード / 集計', () => {
    it('AI-01: ダッシュボード集計が取得できる (GET /api/admin/ai/dashboard)', () => {
      cy.apiAs('admin', {
        method: 'GET',
        url: '/api/admin/ai/dashboard',
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.success).to.eq(true);
        expect(res.body.data).to.have.property('image_analyses');
        expect(res.body.data).to.have.property('price_predictions');
        expect(res.body.data).to.have.property('fraud_alerts');
        expect(res.body.data.fraud_alerts).to.have.property('open');
        expect(res.body.data).to.have.property('recommendations_generated');
      });
    });

    it('AI-02: 参加者はダッシュボードにアクセス不可 (401/403)', () => {
      cy.apiAs('participant', {
        method: 'GET',
        url: '/api/admin/ai/dashboard',
      }).then((res) => {
        expect([401, 403]).to.include(res.status);
      });
    });

    it('AI-03: 出品者もダッシュボードにアクセス不可 (401/403)', () => {
      cy.apiAs('seller', {
        method: 'GET',
        url: '/api/admin/ai/dashboard',
      }).then((res) => {
        expect([401, 403]).to.include(res.status);
      });
    });
  });

  describe('画像認識結果一覧', () => {
    it('AI-04: 画像認識結果が取得できる (GET /api/admin/ai/image-analysis/{itemId}/results)', () => {
      // item_id=1 で結果が空でも 200 が返る (controller は first() で nullable)
      cy.apiAs('admin', {
        method: 'GET',
        url: '/api/admin/ai/image-analysis/1/results',
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.success).to.eq(true);
        // 結果がある場合は object、無い場合は null
        expect(res.body).to.have.property('data');
      });
    });

    it.skip('AI-05: 画像解析を実行する (OpenAI API 必要 / 高コスト)', () => {
      // OpenAI API キー必要 + 時間がかかるため skip
      cy.apiAs('admin', {
        method: 'POST',
        url: '/api/admin/ai/image-analysis/1',
      }).then((res) => {
        expect([200, 422, 502, 503]).to.include(res.status);
      });
    });
  });

  describe('価格予測一覧', () => {
    it('AI-06: 市場トレンドが取得できる (GET /api/admin/ai/market-trends)', () => {
      cy.apiAs('admin', {
        method: 'GET',
        url: '/api/admin/ai/market-trends',
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.success).to.eq(true);
        expect(res.body).to.have.property('data');
      });
    });

    it('AI-07: 参加者は market-trends にアクセス不可', () => {
      cy.apiAs('participant', {
        method: 'GET',
        url: '/api/admin/ai/market-trends',
      }).then((res) => {
        expect([401, 403]).to.include(res.status);
      });
    });
  });

  describe('不正検知アラート一覧', () => {
    it('AI-08: 不正検知アラート一覧が取得できる (GET /api/admin/ai/fraud-alerts)', () => {
      cy.apiAs('admin', {
        method: 'GET',
        url: '/api/admin/ai/fraud-alerts',
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.success).to.eq(true);
      });
    });

    it('AI-09: status / severity フィルタが動作する', () => {
      cy.apiAs('admin', {
        method: 'GET',
        url: '/api/admin/ai/fraud-alerts?status=open&severity=high',
      }).then((res) => {
        expect(res.status).to.eq(200);
      });
    });

    it('AI-10: 存在しないアラート ID への解決操作は 404', () => {
      cy.apiAs('admin', {
        method: 'PATCH',
        url: '/api/admin/ai/fraud-alerts/99999999',
        body: { status: 'resolved', notes: 'E2E test' },
      }).then((res) => {
        expect(res.status).to.eq(404);
      });
    });
  });

  describe('レコメンド', () => {
    it.skip('AI-11: 参加者向けレコメンド生成 - 高コスト / 外部 AI 必要', () => {
      // RecommendationService::generateRecommendations はベクトル DB / 外部推論を呼ぶ事があるため skip
      cy.apiAs('admin', {
        method: 'POST',
        url: '/api/admin/ai/recommendations/1',
      }).then((res) => {
        expect([200, 502, 503]).to.include(res.status);
      });
    });
  });

  describe('NLP (商品情報抽出)', () => {
    it('AI-12: text 未入力は 422 (バリデーション)', () => {
      cy.apiAs('admin', {
        method: 'POST',
        url: '/api/admin/ai/nlp/extract',
        body: {},
      }).then((res) => {
        expect(res.status).to.eq(422);
      });
    });

    it('AI-13: 認可: 参加者は NLP API にアクセス不可', () => {
      cy.apiAs('participant', {
        method: 'POST',
        url: '/api/admin/ai/nlp/classify',
        body: { species_name: '三色ラメ' },
      }).then((res) => {
        expect([401, 403]).to.include(res.status);
      });
    });
  });
});
