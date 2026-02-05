/// <reference types="cypress" />

/**
 * 管理者としてログインする
 */
Cypress.Commands.add('loginAsAdmin', (email?: string, password?: string) => {
  const e = email ?? Cypress.env('E2E_ADMIN_EMAIL');
  const p = password ?? Cypress.env('E2E_ADMIN_PASSWORD');
  cy.visit('/login');
  cy.get('input[type="email"]').clear().type(e);
  cy.get('input[type="password"]').clear().type(p);
  cy.contains('button', 'ログイン').click();
  // 管理者は /admin にリダイレクトされる
  cy.url().should('include', '/admin');
});

/**
 * 出品者としてログインする
 */
Cypress.Commands.add('loginAsSeller', (email?: string, password?: string) => {
  const e = email ?? Cypress.env('E2E_SELLER_EMAIL');
  const p = password ?? Cypress.env('E2E_SELLER_PASSWORD');
  cy.visit('/login');
  cy.get('input[type="email"]').clear().type(e);
  cy.get('input[type="password"]').clear().type(p);
  cy.contains('button', 'ログイン').click();
  cy.url().should('include', '/seller');
});

/**
 * 参加者としてログインする
 */
Cypress.Commands.add('loginAsParticipant', (email?: string, password?: string) => {
  const e = email ?? Cypress.env('E2E_PARTICIPANT_EMAIL');
  const p = password ?? Cypress.env('E2E_PARTICIPANT_PASSWORD');
  cy.visit('/login');
  cy.get('input[type="email"]').clear().type(e);
  cy.get('input[type="password"]').clear().type(p);
  cy.contains('button', 'ログイン').click();
  cy.url().should('include', '/participant');
});

/**
 * ログアウトする（ヘッダー等のログアウトをクリック）
 */
Cypress.Commands.add('logout', () => {
  cy.contains('ログアウト').click();
  cy.url().should('include', '/login');
});

/**
 * マニュアル用のステップをキャプチャする
 * @param stepName ステップ名（例: '01-login'）
 * @param description 説明文（例: '管理者でログインします'）
 * @param options オプション設定
 */
Cypress.Commands.add('captureStep', (stepName: string, description: string, options?: { wait?: number }) => {
  // オプションの待機時間
  if (options?.wait) {
    cy.wait(options.wait);
  }
  
  // スクリーンショットを撮影
  cy.screenshot(`manual-${stepName}`, {
    capture: 'viewport',
    overwrite: true,
  });
  
  // マニュアル用のメタデータを記録
  cy.url().then((url) => {
    cy.task('logManualStep', {
      step: stepName,
      description: description,
      url: url,
      timestamp: new Date().toISOString(),
    }, { log: false });
  });
});

declare global {
  namespace Cypress {
    interface Chainable {
      loginAsAdmin(email?: string, password?: string): Chainable<void>;
      loginAsSeller(email?: string, password?: string): Chainable<void>;
      loginAsParticipant(email?: string, password?: string): Chainable<void>;
      logout(): Chainable<void>;
      captureStep(stepName: string, description: string, options?: { wait?: number }): Chainable<void>;
    }
  }
}

export {};
