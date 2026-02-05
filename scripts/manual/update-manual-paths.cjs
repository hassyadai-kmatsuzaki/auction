#!/usr/bin/env node
/**
 * マニュアルファイルの画像パスを更新
 * 
 * 相対パス → 絶対パス（/manual/images/...）に変換
 */

const fs = require('fs');
const path = require('path');

const MANUAL_DIR = path.join(__dirname, '../../storage/app/manual');

const manualFiles = [
  'お知らせ管理マニュアル.md',
  '出品者マニュアル.md',
  '参加者マニュアル.md',
  '操作マニュアル.md',
];

console.log('==========================================');
console.log('マニュアル画像パスの更新');
console.log('==========================================');
console.log('');

manualFiles.forEach((filename) => {
  const filePath = path.join(MANUAL_DIR, filename);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  スキップ: ${filename} (ファイルが存在しません)`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changeCount = 0;
  
  // 画像パスを置換
  content = content.replace(
    /!\[([^\]]+)\]\(\.\.\/src\/cypress\/screenshots\/[^\/]+\/manual-([^)]+)\)/g,
    (match, alt, filename) => {
      changeCount++;
      return `![${alt}](/manual/images/manual-${filename})`;
    }
  );
  
  // 動画パスを置換
  content = content.replace(
    /\[([^\]]+)\]\(\.\.\/src\/cypress\/videos\/([^)]+)\)/g,
    (match, text, filename) => {
      changeCount++;
      return `[${text}](/manual/videos/${filename})`;
    }
  );
  
  if (changeCount > 0) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ ${filename}: ${changeCount}個のパスを更新`);
  } else {
    console.log(`✓  ${filename}: 更新不要`);
  }
});

console.log('');
console.log('==========================================');
console.log('完了');
console.log('==========================================');
