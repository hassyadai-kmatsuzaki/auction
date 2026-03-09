export interface EcProduct {
  id: number;
  name: string;
  price: number;
  image: string;
  category: string;
  description: string;
  specs: {
    size: string;
    age: string;
    gender: string;
    origin: string;
  };
}

export const EC_CATEGORIES = [
  'すべて',
  '楊貴妃',
  '幹之',
  'ラメ',
  '三色',
  'ダルマ',
  'ヒレ長',
  'ブラック',
  'アルビノ',
  'その他',
] as const;

export const EC_PRODUCTS: EcProduct[] = [
  {
    id: 1,
    name: '楊貴妃ダルマメダカ 5匹セット',
    price: 3980,
    image: 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?w=600&h=400&fit=crop',
    category: '楊貴妃',
    description: '鮮やかな朱赤色が美しい楊貴妃ダルマメダカです。丸みを帯びた体型が愛らしく、観賞用として大変人気があります。水槽でもビオトープでもお楽しみいただけます。',
    specs: { size: '約2〜3cm', age: '若魚〜成魚', gender: 'ミックス', origin: '自家繁殖' },
  },
  {
    id: 2,
    name: '幹之フルボディ ペア',
    price: 5800,
    image: 'https://images.unsplash.com/photo-1524704654690-b56c05c78a00?w=600&h=400&fit=crop',
    category: '幹之',
    description: '背中全体が輝く幹之フルボディのペアです。上見での光の美しさは格別で、ビオトープでの飼育に最適です。繁殖にもチャレンジしていただけます。',
    specs: { size: '約3〜4cm', age: '成魚', gender: 'ペア（オス1・メス1）', origin: '自家繁殖' },
  },
  {
    id: 3,
    name: '夜桜ラメメダカ 3匹セット',
    price: 4500,
    image: 'https://images.unsplash.com/photo-1520301255226-bf5f144451c1?w=600&h=400&fit=crop',
    category: 'ラメ',
    description: '夜空に桜が舞うような美しいラメが特徴の夜桜メダカです。黒い体色にピンクとブルーのラメが散りばめられた幻想的な品種です。',
    specs: { size: '約2.5〜3.5cm', age: '若魚〜成魚', gender: 'ミックス', origin: '自家繁殖' },
  },
  {
    id: 4,
    name: '三色錦メダカ 5匹セット',
    price: 6800,
    image: 'https://images.unsplash.com/photo-1535591273668-578e31182c4f?w=600&h=400&fit=crop',
    category: '三色',
    description: '赤・白・黒の三色が美しく入った錦メダカです。一匹一匹模様が異なり、コレクション性の高い品種です。上見での鑑賞がおすすめです。',
    specs: { size: '約2.5〜3.5cm', age: '若魚〜成魚', gender: 'ミックス', origin: '自家繁殖' },
  },
  {
    id: 5,
    name: 'オロチ（ブラック）メダカ 5匹セット',
    price: 3500,
    image: 'https://images.unsplash.com/photo-1571752726703-5e7d1f6a986d?w=600&h=400&fit=crop',
    category: 'ブラック',
    description: '全身が漆黒に染まるオロチメダカです。ヒレまで真っ黒な個体を厳選してお届けします。他の品種との混泳でも存在感抜群です。',
    specs: { size: '約2〜3cm', age: '若魚〜成魚', gender: 'ミックス', origin: '自家繁殖' },
  },
  {
    id: 6,
    name: 'サファイアラメメダカ ペア',
    price: 7200,
    image: 'https://images.unsplash.com/photo-1504472478235-9bc48ba4d60f?w=600&h=400&fit=crop',
    category: 'ラメ',
    description: '深いブルーの体色に青く輝くラメが散りばめられたサファイアラメメダカです。宝石のような美しさで、愛好家の間で高い人気を誇ります。',
    specs: { size: '約3〜4cm', age: '成魚', gender: 'ペア（オス1・メス1）', origin: '自家繁殖' },
  },
  {
    id: 7,
    name: '紅白ダルマメダカ 3匹セット',
    price: 4200,
    image: 'https://images.unsplash.com/photo-1497752531616-c3afd9760a11?w=600&h=400&fit=crop',
    category: 'ダルマ',
    description: '紅白の美しい模様とダルマ体型が魅力的なメダカです。丸々とした体型は見ているだけで癒されます。飼育も比較的容易です。',
    specs: { size: '約2〜2.5cm', age: '若魚', gender: 'ミックス', origin: '自家繁殖' },
  },
  {
    id: 8,
    name: '松井ヒレ長 幹之メダカ ペア',
    price: 8500,
    image: 'https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=600&h=400&fit=crop',
    category: 'ヒレ長',
    description: '優雅に伸びたヒレと幹之の輝きを併せ持つ松井ヒレ長メダカです。横見での鑑賞が特におすすめで、水槽飼育に最適です。',
    specs: { size: '約3〜4cm', age: '成魚', gender: 'ペア（オス1・メス1）', origin: '自家繁殖' },
  },
  {
    id: 9,
    name: 'アルビノ楊貴妃メダカ 5匹セット',
    price: 4800,
    image: 'https://images.unsplash.com/photo-1559717201-fbb671ff56b7?w=600&h=400&fit=crop',
    category: 'アルビノ',
    description: '透き通るような体色が美しいアルビノ楊貴妃メダカです。赤い目と淡いオレンジの体色が幻想的な雰囲気を醸し出します。',
    specs: { size: '約2〜3cm', age: '若魚〜成魚', gender: 'ミックス', origin: '自家繁殖' },
  },
  {
    id: 10,
    name: '紅帝メダカ 5匹セット',
    price: 5500,
    image: 'https://images.unsplash.com/photo-1571745544682-143ea663cf2c?w=600&h=400&fit=crop',
    category: '楊貴妃',
    description: '楊貴妃系統の中でも特に赤みが強い紅帝メダカです。深い朱赤色は他の品種では見られない美しさです。ビオトープでの上見鑑賞がおすすめです。',
    specs: { size: '約2.5〜3.5cm', age: '若魚〜成魚', gender: 'ミックス', origin: '自家繁殖' },
  },
  {
    id: 11,
    name: '琥珀ラメメダカ 3匹セット',
    price: 5200,
    image: 'https://images.unsplash.com/photo-1522069213448-443a614da9b6?w=600&h=400&fit=crop',
    category: 'ラメ',
    description: '琥珀色の体色にゴールドのラメが輝く美しいメダカです。温かみのある色合いが特徴で、和風のビオトープによく映えます。',
    specs: { size: '約2.5〜3cm', age: '若魚〜成魚', gender: 'ミックス', origin: '自家繁殖' },
  },
  {
    id: 12,
    name: '白ラメ幹之メダカ ペア',
    price: 6500,
    image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&h=400&fit=crop',
    category: '幹之',
    description: '純白の体色に幹之の光とラメが加わった、まるで雪のように美しいメダカです。清涼感のある見た目で夏のビオトープにぴったりです。',
    specs: { size: '約3〜4cm', age: '成魚', gender: 'ペア（オス1・メス1）', origin: '自家繁殖' },
  },
];
