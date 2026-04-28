/**
 * 円表示用フォーマッタ。
 * decimal カラム由来の "100.00" 文字列も整数として扱い、小数点を落とす。
 */
export const formatYen = (value: number | string | null | undefined): string => {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return '0';
  return Math.round(num).toLocaleString();
};
