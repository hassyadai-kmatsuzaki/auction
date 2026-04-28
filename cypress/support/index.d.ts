// =============================================================================
// Cypress カスタムコマンドの型定義
//
// 実体は cypress/support/commands.ts 側で declare global しているが、
// エディタや tsc が .d.ts を別ファイルで参照する構成にも対応できるように
// ここでも型を再エクスポートしておく。
// =============================================================================

/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      // ----- 既存 (commands.ts に実装あり) -----
      loginAsAdmin(email?: string, password?: string): Chainable<void>;
      loginAsSeller(email?: string, password?: string): Chainable<void>;
      loginAsParticipant(email?: string, password?: string): Chainable<void>;
      logout(): Chainable<void>;
      captureStep(stepName: string, description: string, options?: { wait?: number }): Chainable<void>;
      apiToken(email: string, password: string): Chainable<string>;
      apiTokenAs(role: 'admin' | 'seller' | 'participant'): Chainable<string>;
      apiAs(
        role: 'admin' | 'seller' | 'participant',
        options: Partial<Cypress.RequestOptions>
      ): Chainable<Cypress.Response<any>>;

      // ----- §10.4 追加 6 種 -----

      /** Sanctum API トークンで高速ログイン。Cypress.env('apiToken') にも保存。 */
      apiLoginAs(role: 'admin' | 'seller' | 'participant'): Chainable<string>;

      /** WonItem を staging 限定エンドポイント経由で生成する。 */
      seedWonItem(params?: {
        winnerId?: number;
        sellerId?: number;
        paymentStatus?: 'pending' | 'paid' | 'confirmed';
        deliveryStatus?: 'preparing' | 'shipped' | 'completed';
        paymentDeadline?: string;
        winningPrice?: number;
        quantity?: number;
      }): Chainable<any>;

      /** php artisan schedule:run (or 任意 artisan command) を発火する。 */
      runSchedule(taskName?: string): Chainable<any>;

      /** MailHog 検索 API のラッパー。 */
      mailbox(email: string): Chainable<{
        items: Array<{
          id: string;
          subject: string;
          body: string;
          receivedAt: string;
          raw: any;
        }>;
        total: number;
      }>;

      /** LINE 通知送信履歴を取得する。 */
      lineSent(userId?: number): Chainable<Array<{
        id: number;
        user_id: number | null;
        notification_type: string | null;
        line_user_id: string | null;
        message_payload: any;
        status: string | null;
        error_message: string | null;
        sent_at: string | null;
        created_at: string | null;
      }>>;

      /** PDF をバイナリ取得し pdf-parse でテキスト化する。 */
      downloadPdf(url: string): Chainable<{
        contentType: string;
        contentDisposition: string;
        filename: string | null;
        text: string;
        info: any;
      }>;
    }
  }
}

export {};
