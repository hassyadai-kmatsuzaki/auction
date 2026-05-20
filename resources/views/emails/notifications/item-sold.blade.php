<x-mail::message>
# 出品商品が落札されました

{{ $seller->trade_name ?? $seller->name ?? '-' }} 様

おめでとうございます！
出品された商品が落札されましたのでお知らせいたします。

---

## 落札内容

**商品名**: {{ $wonItem->item->species_name ?? '商品名' }}

**品番**: No.{{ $wonItem->item->item_number ?? '-' }}

**数量**: {{ $wonItem->quantity }}匹

**落札価格**: ¥{{ number_format($wonItem->winning_price) }}

---

## 今後の流れ

商品の発送は弊社で代行いたしますので、出品者様での発送作業は不要です。
落札代金は所定の精算スケジュールに従ってお支払いいたします。

---

ご不明な点がございましたら、お気軽にお問い合わせください。

今後とも日本メダカオンライン市場をよろしくお願いいたします。

{{ config('app.name') }}
</x-mail::message>
