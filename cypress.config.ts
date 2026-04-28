import { defineConfig } from 'cypress';
import fs from 'fs';
import path from 'path';

// マニュアル生成用のステップを記録
let manualSteps: any[] = [];
let currentTestSuite = '';

export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:8430',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    video: true,
    screenshotOnRunFailure: true,
    env: {
      // テスト用アカウント（.env.cypress または環境変数で上書き推奨）
      E2E_ADMIN_EMAIL: process.env.E2E_ADMIN_EMAIL || 'admin@example.com',
      E2E_ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD || 'password',
      E2E_SELLER_EMAIL: process.env.E2E_SELLER_EMAIL || 'seller1@example.com',
      E2E_SELLER_PASSWORD: process.env.E2E_SELLER_PASSWORD || 'password',
      E2E_PARTICIPANT_EMAIL: process.env.E2E_PARTICIPANT_EMAIL || 'participant1@example.com',
      E2E_PARTICIPANT_PASSWORD: process.env.E2E_PARTICIPANT_PASSWORD || 'password',
      // 追加: MailHog (staging で立ち上がっている前提)
      MAILHOG_URL: process.env.MAILHOG_URL || 'http://localhost:8025',
      // 追加: テストヘルパーのベース URL (api-test.php 用)。通常は baseUrl と同じ。
      TEST_HELPER_BASE_URL: process.env.TEST_HELPER_BASE_URL || process.env.CYPRESS_BASE_URL || 'http://localhost:8430',
    },
    setupNodeEvents(on, config) {
      // マニュアル生成用のタスク
      on('task', {
        // マニュアルステップを記録
        logManualStep(step: any) {
          manualSteps.push({
            ...step,
            suite: currentTestSuite,
          });
          console.log(`📸 Manual Step: ${step.step} - ${step.description}`);
          return null;
        },

        // テストスイート名を設定
        setTestSuite(suiteName: string) {
          currentTestSuite = suiteName;
          return null;
        },

        // PDF バイナリを受け取りテキスト化する (cy.downloadPdf から呼ばれる)
        // Cypress の cy.task は Buffer を直接渡せないので base64 文字列で受け取る。
        async pdfParse(payload: { base64: string }): Promise<{
          text: string;
          numpages: number;
          info: any;
          metadata: any;
        }> {
          // pdf-parse は devDependencies に追加が必要。
          // require を try/catch して、未インストールでも他のテストが落ちないようにする。
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const pdfParse = require('pdf-parse');
          const buffer = Buffer.from(payload.base64, 'base64');
          const result = await pdfParse(buffer);
          return {
            text: result.text,
            numpages: result.numpages,
            info: result.info,
            metadata: result.metadata,
          };
        },
        
        // マニュアルを生成
        generateManual(options: { outputPath?: string } = {}) {
          const outputPath = options.outputPath || path.join(__dirname, 'storage/app/manual/操作マニュアル.md');
          
          // マニュアルのMarkdownを生成
          let markdown = '# MEDAKA AUCTION PORT 操作マニュアル\n\n';
          markdown += `**自動生成日**: ${new Date().toLocaleString('ja-JP')}\n\n`;
          markdown += '> このマニュアルはE2Eテストから自動生成されています。\n\n';
          markdown += '---\n\n';
          
          // テストスイートごとにグループ化
          const groupedSteps = manualSteps.reduce((acc, step) => {
            const suite = step.suite || 'その他';
            if (!acc[suite]) {
              acc[suite] = [];
            }
            acc[suite].push(step);
            return acc;
          }, {} as Record<string, any[]>);
          
          // 各スイートのマニュアルを生成
          Object.entries(groupedSteps).forEach(([suite, steps]) => {
            markdown += `## ${suite}\n\n`;
            
            steps.forEach((step, index) => {
              markdown += `### ステップ ${index + 1}: ${step.description}\n\n`;
              markdown += `**URL**: \`${step.url}\`\n\n`;
              markdown += `![${step.description}](/manual/images/manual-${step.step}.png)\n\n`;
              markdown += '---\n\n';
            });
          });
          
          // ファイルに書き込み
          const dir = path.dirname(outputPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(outputPath, markdown);
          
          console.log(`✅ マニュアル生成完了: ${outputPath}`);
          console.log(`📊 総ステップ数: ${manualSteps.length}`);
          
          // ステップをリセット
          manualSteps = [];
          
          return null;
        },
      });
      
      return config;
    },
  },
});
