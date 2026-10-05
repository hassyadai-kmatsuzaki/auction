/** 生体の性別（F-010）。値は items.sex の enum と同じ。mix は「混合・不明」 */
export const ITEM_SEX_OPTIONS: { value: 'male' | 'female' | 'pair' | 'mix'; label: string }[] = [
  { value: 'male', label: 'オス' },
  { value: 'female', label: 'メス' },
  { value: 'pair', label: 'ペア' },
  { value: 'mix', label: '混合・不明' },
];
