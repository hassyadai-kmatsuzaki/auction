<x-mail::message>
# パスワード設定のお願い

{{ $user->name }} 様

メダカライブオークションへようこそ！

アカウントが作成されました。以下のボタンをクリックして、パスワードを設定してください。

<x-mail::button :url="$verificationUrl">
パスワードを設定する
</x-mail::button>

**このリンクは7日間有効です。**

もしこのメールに心当たりがない場合は、このメールを無視してください。

よろしくお願いいたします。

{{ config('app.name') }}
</x-mail::message>
