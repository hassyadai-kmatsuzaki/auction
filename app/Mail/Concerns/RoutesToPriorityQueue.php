<?php

namespace App\Mail\Concerns;

/**
 * Mailable を `notify-priority` キューに乗せる。
 *
 * パスワードリセット等の「ユーザー操作をブロックするトランザクションメール」専用。
 * 一斉配信のキュー詰まりに巻き込まれないよう独立ワーカーで捌く。
 */
trait RoutesToPriorityQueue
{
    protected function routeViaPriority(): void
    {
        $this->onQueue('notify-priority');
    }
}
