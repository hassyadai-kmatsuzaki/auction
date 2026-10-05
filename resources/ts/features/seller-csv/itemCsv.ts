/**
 * 出品申込の CSV 一括入力（F-015）。
 * CSV はブラウザ内で読み込んで申込フォームに反映するだけ（送信は通常の申込と同じ API・同じ入力チェック）
 */

export const CSV_HEADERS = ['品種名（必須）', '数量（必須）', '単位（匹/kg/袋・省略時は匹）', '種別（省略時は既定）', '生体月数', '個体情報', '匿名出品（0または1）'];

const SAMPLE_ROWS = [
  ['楊貴妃 透明鱗', '10', '匹', '', '6', '体外光あり。色揚げ良好', '0'],
  ['幹之 スーパー光', '5', '匹', '', '8', '', '1'],
];

const UNIT_MAP: Record<string, 'fish' | 'kg' | 'bag'> = { '匹': 'fish', fish: 'fish', 'kg': 'kg', 'ｋｇ': 'kg', '袋': 'bag', bag: 'bag' };

export interface CsvSpeciesType {
  id: number;
  name: string;
  allowed_quantity_units: ('fish' | 'kg' | 'bag')[];
  is_default: boolean;
}

export interface CsvItemRow {
  species_name: string;
  species_type_id: number | '';
  quantity: string;
  quantity_unit: string;
  age_months: string;
  individual_info: string;
  is_anonymous: boolean;
}

const quote = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Excel で文字化けしないよう BOM 付き UTF-8 */
export const buildTemplateCsv = (): string =>
  '﻿' + [CSV_HEADERS, ...SAMPLE_ROWS].map((r) => r.map(quote).join(',')).join('\r\n') + '\r\n';

/** RFC 4180 準拠の簡易パーサ（ダブルクォート・改行入りセルに対応） */
export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
};

/**
 * CSV の行を申込フォームの生体に変換する。問題のある行はエラーとして返し、取り込まない
 */
export const csvToItems = (text: string, speciesTypes: CsvSpeciesType[]): { items: CsvItemRow[]; errors: string[] } => {
  const [, ...rows] = parseCsv(text); // 1行目は見出し
  const defaultType = speciesTypes.find((t) => t.is_default) ?? speciesTypes[0];
  const items: CsvItemRow[] = [];
  const errors: string[] = [];

  rows.forEach((r, idx) => {
    const line = idx + 2;
    const [name = '', qty = '', unitRaw = '', typeName = '', age = '', info = '', anon = ''] = r.map((v) => v.trim());
    if (!name) { errors.push(`${line}行目: 品種名がありません`); return; }
    if (!/^\d+$/.test(qty) || Number(qty) < 1) { errors.push(`${line}行目: 数量は1以上の整数で入力してください`); return; }

    const type = typeName ? speciesTypes.find((t) => t.name === typeName) : defaultType;
    if (!type) { errors.push(`${line}行目: 種別「${typeName}」は選べません`); return; }
    const unit = unitRaw ? UNIT_MAP[unitRaw] : type.allowed_quantity_units[0] ?? 'fish';
    if (!unit || !type.allowed_quantity_units.includes(unit)) {
      errors.push(`${line}行目: 種別「${type.name}」では単位「${unitRaw}」は使えません`); return;
    }
    if (age && !/^\d+$/.test(age)) { errors.push(`${line}行目: 生体月数は数字で入力してください`); return; }

    items.push({
      species_name: name.slice(0, 100),
      species_type_id: type.id,
      quantity: qty,
      quantity_unit: unit,
      age_months: age,
      individual_info: info,
      is_anonymous: anon === '1',
    });
  });

  return { items, errors };
};
