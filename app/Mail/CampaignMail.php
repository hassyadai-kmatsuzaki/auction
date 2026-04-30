<?php

namespace App\Mail;

use App\Mail\Concerns\RoutesToNotifyQueue;
use App\Models\EmailCampaign;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * 管理画面で作成されたキャンペーンを 1 ユーザー宛に送る Mailable。
 *
 * 件名・本文は EmailCampaign から取得し、`{{name}}` `{{email}}` などの簡易プレースホルダーを
 * ユーザー情報で置換する。本文は Markdown としてレンダリングされ、共通フッター（送信専用文言・
 * 問い合わせ先 info@nep-corp.com・配信停止リンク）が自動付与される。
 */
class CampaignMail extends Mailable
{
    use Queueable, SerializesModels, RoutesToNotifyQueue;

    public function __construct(
        public EmailCampaign $campaign,
        public User $user,
    ) {
        $this->routeViaNotify();
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->renderTemplate($this->campaign->subject),
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.campaign',
            with: [
                'bodyMarkdown' => $this->renderTemplate($this->campaign->body_markdown),
                'unsubscribeUrl' => $this->user->getUnsubscribeUrl(),
            ],
        );
    }

    /**
     * `{{name}}` 等のプレースホルダーをユーザー情報で置換。
     * 不明なキーはそのまま残す（誤った差し込みを防ぐ）。
     */
    private function renderTemplate(string $template): string
    {
        $vars = [
            'name' => $this->user->name ?? '',
            'email' => $this->user->email ?? '',
            'trade_name' => $this->user->trade_name ?? '',
            'company_name' => $this->user->company_name ?? '',
        ];
        return preg_replace_callback('/\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/i', function ($m) use ($vars) {
            $key = strtolower($m[1]);
            return array_key_exists($key, $vars) ? (string) $vars[$key] : $m[0];
        }, $template);
    }
}
