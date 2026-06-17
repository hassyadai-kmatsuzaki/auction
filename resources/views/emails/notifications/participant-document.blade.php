<x-mail::message>
# {{ $documentLabel }}のご案内

{{ $winner->name }} 様

この度は、日本メダカオンライン市場をご利用いただきありがとうございます。

「{{ $auction->title }}」の{{ $documentLabel }}を添付いたしましたので、ご確認ください。

---

## 添付ファイル

- {{ $documentLabel }}（PDF）

---

ご不明な点がございましたら、下記までお問い合わせください。

お問い合わせ: info@nep-corp.com

今後とも日本メダカオンライン市場をよろしくお願いいたします。

{{ config('app.name') }}
</x-mail::message>
