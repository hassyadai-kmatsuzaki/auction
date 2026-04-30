<?php

namespace App\Mail\Concerns;

/**
 * Mailable を `notify` キューに乗せる。
 *
 * 一斉配信（CampaignMail）と非トランザクション系の通知メール（落札・出荷・新規出品など）が利用する。
 * パスワードリセット等の即時性が要るメールは {@see RoutesToPriorityQueue} を使う。
 *
 * Mailable の `__construct` 末尾で `$this->routeViaNotify();` を呼ぶ前提。
 */
trait RoutesToNotifyQueue
{
    protected function routeViaNotify(): void
    {
        $this->onQueue('notify');
    }
}
