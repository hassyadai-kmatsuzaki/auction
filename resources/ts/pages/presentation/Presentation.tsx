/**
 * /presentation — 認証不要のデモ体験ページ
 *
 * エントリーポイント：「ガイド付きデモ」と「ガイドなしデモ」の選択画面を表示。
 * 各デモモードは専用コンポーネントに委譲する。
 *
 * - ガイド付きデモ: ホーム → 出品一覧 → 待機室 → オークション（ツアー付き） → 落札者管理ガイド
 * - ガイドなしデモ: 2レーン x 3匹、CPU10人によるリアルオークション → 落札管理
 */
import { useState, useCallback } from 'react';
import { DemoModeSelector } from './DemoModeSelector';
import { GuidedDemo } from './GuidedDemo';
import { FreeDemo } from './FreeDemo';

type DemoMode = 'select' | 'guided' | 'free';

export default function Presentation() {
  const [mode, setMode] = useState<DemoMode>('select');

  const handleBackToTop = useCallback(() => {
    setMode('select');
    window.scrollTo(0, 0);
  }, []);

  if (mode === 'guided') {
    return <GuidedDemo onBackToTop={handleBackToTop} />;
  }

  if (mode === 'free') {
    return <FreeDemo onBackToTop={handleBackToTop} />;
  }

  return (
    <DemoModeSelector
      onSelectGuided={() => setMode('guided')}
      onSelectFree={() => setMode('free')}
    />
  );
}
