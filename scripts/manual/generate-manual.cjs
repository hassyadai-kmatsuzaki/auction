#!/usr/bin/env node
/**
 * E2Eテストの動画とスクリーンショットからマニュアルを生成
 * 
 * 使い方:
 *   node scripts/manual/generate-manual.js
 */

const fs = require('fs');
const path = require('path');

// プロジェクトルート
const PROJECT_ROOT = path.join(__dirname, '../..');
const VIDEOS_DIR = path.join(PROJECT_ROOT, 'cypress/videos');
const SCREENSHOTS_DIR = path.join(PROJECT_ROOT, 'cypress/screenshots');
const MANUAL_OUTPUT_DIR = path.join(PROJECT_ROOT, 'storage/app/manual');

// E2Eテストの説明マッピング
const TEST_DESCRIPTIONS = {
  'auth.cy.ts': {
    title: '1. 認証・ログイン',
    category: '基本操作',
    description: 'システムへのログイン、ログアウト、パスワードリセットの手順',
    tests: [
      { id: 'AUTH-01', title: 'ログイン画面へのアクセス', description: 'ログイン画面を開きます' },
      { id: 'AUTH-02', title: 'ログイン', description: 'メールアドレスとパスワードを入力してログインします' },
      { id: 'AUTH-05', title: 'ログアウト', description: 'システムからログアウトします' },
      { id: 'AUTH-06', title: '新規登録', description: '新規アカウントを登録します' },
      { id: 'AUTH-09', title: 'パスワード忘れ', description: 'パスワードをリセットします' },
    ],
  },
  'admin-dashboard.cy.ts': {
    title: '2. 管理者ダッシュボード',
    category: '管理者',
    description: '管理者ダッシュボードの使い方と各機能へのアクセス方法',
    tests: [
      { id: 'ADM-01', title: 'ダッシュボード表示', description: '統計情報を確認します' },
      { id: 'ADM-02', title: 'メニュー操作', description: 'サイドメニューから各機能にアクセスします' },
    ],
  },
  'admin-announcements.cy.ts': {
    title: '3. お知らせ管理',
    category: '管理者',
    description: 'お知らせの作成、編集、削除の手順',
    tests: [
      { id: 'ADM-04', title: 'お知らせ作成画面', description: 'お知らせ作成画面を開きます' },
      { id: 'ADM-05', title: 'お知らせ作成', description: '新しいお知らせを作成します' },
      { id: 'ADM-06', title: 'お知らせ編集', description: 'お知らせを編集します' },
      { id: 'ADM-08', title: 'お知らせ削除', description: 'お知らせを削除します' },
    ],
  },
  'admin-auctions.cy.ts': {
    title: '4. オークション管理',
    category: '管理者',
    description: 'オークションの作成、編集、削除の手順',
    tests: [
      { id: 'ADM-11', title: 'オークション作成画面', description: 'オークション作成画面を開きます' },
      { id: 'ADM-12', title: 'オークション作成', description: '新しいオークションを作成します' },
      { id: 'ADM-13', title: 'オークション編集画面', description: 'オークション編集画面を開きます' },
      { id: 'ADM-14', title: 'オークション編集', description: 'オークション情報を編集します' },
    ],
  },
  'admin-items.cy.ts': {
    title: '5. 商品管理',
    category: '管理者',
    description: '商品の登録、編集、削除の手順',
    tests: [
      { id: 'ADM-18', title: '商品一覧表示', description: 'オークションの商品一覧を表示します' },
      { id: 'ADM-19', title: '商品登録画面', description: '商品登録画面を開きます' },
      { id: 'ADM-20', title: '商品登録', description: '新しい商品を登録します' },
      { id: 'ADM-21', title: '商品編集', description: '商品情報を編集します' },
    ],
  },
  'admin-lanes.cy.ts': {
    title: '6. レーン管理',
    category: '管理者',
    description: 'レーンへの商品割り当てと順序変更の手順',
    tests: [
      { id: 'ADM-24', title: 'レーン割り当て画面', description: 'レーン割り当て画面を開きます' },
      { id: 'ADM-25', title: 'レーン割り当て', description: '商品をレーンに割り当てます' },
      { id: 'ADM-26', title: '割り当て保存', description: 'レーン割り当てを保存します' },
      { id: 'ADM-27', title: '順序変更', description: 'レーン内の商品順序を変更します' },
    ],
  },
  'admin-live.cy.ts': {
    title: '7. ライブオークション管理',
    category: '管理者',
    description: 'ライブオークションの開始、進行、終了の手順',
    tests: [
      { id: 'ADM-29', title: 'ライブコントロール画面', description: 'ライブコントロール画面を開きます' },
      { id: 'ADM-30', title: 'ライブ開始', description: 'オークションを開始します' },
      { id: 'ADM-31', title: '次の商品へ', description: '次の商品に進みます' },
      { id: 'ADM-32', title: '落札確定', description: '商品の落札を確定します' },
      { id: 'ADM-33', title: '流札', description: '商品を流札にします' },
      { id: 'ADM-34', title: '商品統計', description: '商品統計とレーン別一覧を確認します' },
      { id: 'ADM-35', title: 'ライブ終了', description: 'オークションを終了します' },
    ],
  },
  'admin-won-items.cy.ts': {
    title: '8. 落札管理',
    category: '管理者',
    description: '落札商品の管理、ステータス変更、CSVエクスポートの手順',
    tests: [
      { id: 'ADM-37', title: '落札一覧表示', description: '落札一覧を表示します' },
      { id: 'ADM-38', title: '落札詳細', description: '落札詳細を確認します' },
      { id: 'ADM-39', title: 'ステータス変更', description: '落札ステータスを変更します' },
      { id: 'ADM-40', title: 'CSVエクスポート', description: '落札情報をCSVでエクスポートします' },
    ],
  },
  'admin-users.cy.ts': {
    title: '9. ユーザー管理',
    category: '管理者',
    description: 'ユーザーの作成、詳細確認、削除の手順',
    tests: [
      { id: 'ADM-43', title: 'ユーザー作成画面', description: 'ユーザー作成画面を開きます' },
      { id: 'ADM-44', title: 'ユーザー作成', description: '新しいユーザーを作成します' },
      { id: 'ADM-45', title: 'ユーザー詳細', description: 'ユーザー詳細を確認します' },
    ],
  },
  'seller.cy.ts': {
    title: '10. 出品者機能',
    category: '出品者',
    description: '出品者の商品出品、履歴確認、発送管理の手順',
    tests: [
      { id: 'SEL-01', title: 'ダッシュボード', description: '出品者ダッシュボードを表示します' },
      { id: 'SEL-02', title: '出品申請画面', description: '出品申請画面を開きます' },
      { id: 'SEL-03', title: '出品申請', description: '商品の出品申請を送信します' },
      { id: 'SEL-04', title: '出品履歴', description: '出品履歴を確認します' },
      { id: 'SEL-05', title: '出品詳細', description: '出品詳細を確認します' },
      { id: 'SEL-07', title: '発送管理', description: '発送管理画面を表示します' },
      { id: 'SEL-09', title: '売上・精算', description: '売上と精算情報を確認します' },
    ],
  },
  'participant.cy.ts': {
    title: '11. 参加者機能',
    category: '参加者',
    description: '参加者のオークション閲覧、入札、落札確認の手順',
    tests: [
      { id: 'PAR-01', title: 'ホーム画面', description: '参加者ホーム画面を表示します' },
      { id: 'PAR-02', title: 'オークション一覧', description: 'オークション一覧を表示します' },
      { id: 'PAR-03', title: 'オークション詳細', description: 'オークション詳細と商品一覧を表示します' },
      { id: 'PAR-04', title: 'ライブオークション', description: 'ライブオークション画面を表示します' },
      { id: 'PAR-07', title: '落札管理', description: '落札一覧を表示します' },
      { id: 'PAR-10', title: '設定', description: '設定画面を表示します' },
    ],
  },
};

/**
 * マニュアルを生成
 */
function generateManual() {
  console.log('==========================================');
  console.log('マニュアル生成');
  console.log('==========================================');
  console.log('');
  
  let markdown = '# MEDAKA AUCTION PORT 操作マニュアル\n\n';
  markdown += `**自動生成日**: ${new Date().toLocaleString('ja-JP')}\n\n`;
  markdown += '> このマニュアルはE2Eテストの動画とスクリーンショットから生成されています。\n\n';
  markdown += '---\n\n';
  markdown += '## 📋 目次\n\n';
  
  // 目次生成
  Object.entries(TEST_DESCRIPTIONS).forEach(([filename, section]) => {
    markdown += `- [${section.title}](#${section.title.replace(/\s+/g, '-').toLowerCase()})\n`;
  });
  
  markdown += '\n---\n\n';
  
  // 各セクションの生成
  Object.entries(TEST_DESCRIPTIONS).forEach(([filename, section]) => {
    markdown += `## ${section.title}\n\n`;
    markdown += `**カテゴリ**: ${section.category}\n\n`;
    markdown += `${section.description}\n\n`;
    
    const videoPath = `../../src/cypress/videos/${filename}.mp4`;
    const videoExists = fs.existsSync(path.join(MANUAL_OUTPUT_DIR, videoPath));
    
    if (videoExists) {
      markdown += `**📹 動画**: [${filename}.mp4](${videoPath})\n\n`;
    }
    
    markdown += '---\n\n';
    
    section.tests.forEach((test, index) => {
      markdown += `### ${test.id}: ${test.title}\n\n`;
      markdown += `${test.description}\n\n`;
      
      // スクリーンショットへのリンク（存在する場合）
      const screenshotPattern = `manual-${test.id}`;
      const screenshotPath = `images/${screenshotPattern}.png`;
      
      markdown += `![${test.title}](${screenshotPath})\n\n`;
      markdown += `> スクリーンショットは \`cy.captureStep('${test.id}', '...')\` で撮影されます\n\n`;
      
      markdown += '---\n\n';
    });
    
    markdown += '\n';
  });
  
  // フッター
  markdown += '## 📝 注意事項\n\n';
  markdown += '- このマニュアルはE2Eテストから自動生成されています\n';
  markdown += '- 画像が表示されない場合は、マニュアル生成用のE2Eテストを実行してください\n';
  markdown += '- 動画は `cypress/videos/` ディレクトリに保存されています\n';
  markdown += '- スクリーンショットは `cy.captureStep()` コマンドで撮影されます\n\n';
  
  markdown += '## 🚀 マニュアルの更新方法\n\n';
  markdown += '```bash\n';
  markdown += '# 1. マニュアル生成用のE2Eテストを実行\n';
  markdown += 'npm run cy:run -- --spec "cypress/e2e/manual/**/*.cy.ts"\n\n';
  markdown += '# 2. マニュアルを生成\n';
  markdown += 'node scripts/manual/generate-manual.js\n';
  markdown += '```\n\n';
  
  // ファイルに書き込み
  if (!fs.existsSync(MANUAL_OUTPUT_DIR)) {
    fs.mkdirSync(MANUAL_OUTPUT_DIR, { recursive: true });
  }
  
  const outputPath = path.join(MANUAL_OUTPUT_DIR, '操作マニュアル.md');
  fs.writeFileSync(outputPath, markdown);
  
  console.log('✅ マニュアル生成完了');
  console.log(`📄 出力先: ${outputPath}`);
  console.log(`📊 セクション数: ${Object.keys(TEST_DESCRIPTIONS).length}`);
  console.log('');
  console.log('==========================================');
}

// 実行
generateManual();
