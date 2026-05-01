<?php

namespace App\Mail;

use App\Mail\Concerns\RoutesToPriorityQueue;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * 別端末ログインで既存セッションを強制ログアウトしたときに、対象アカウントへ送る警告メール。
 * セキュリティ通知性が高いので priority キュー（パスワードリセット等と同居）に乗せる。
 */
class OtherDeviceLoggedInMail extends Mailable
{
    use Queueable, SerializesModels, RoutesToPriorityQueue;

    public function __construct(
        public User $user,
        public string $loginIp,
        public string $loginUserAgent,
        public string $loginAt,
    ) {
        $this->routeViaPriority();
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: '【日本メダカオンライン市場】他の端末でログインがありました',
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.auth.other-device-login',
        );
    }
}
