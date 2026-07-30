<x-mail::message>
# 支払通知書のご案内

{{ $sellerName }} 様

いつも日本メダカオンライン市場をご利用いただきありがとうございます。

「{{ $auction->title }}」の支払通知書を添付いたしましたので、ご確認ください。

---

## 添付ファイル

- 支払通知書（PDF）

---

お支払金額の明細・精算状況は、マイページの「売上・精算」からもご確認いただけます。

<x-mail::button :url="config('app.frontend_url') . '/seller/sales'">
売上・精算を確認する
</x-mail::button>

ご不明な点がございましたら、下記までお問い合わせください。

お問い合わせ: info@nep-corp.com

今後とも日本メダカオンライン市場をよろしくお願いいたします。

{{ config('app.name') }}
</x-mail::message>
