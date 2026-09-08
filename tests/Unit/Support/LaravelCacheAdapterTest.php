<?php

namespace Tests\Unit\Support;

use App\Support\Aws\LaravelCacheAdapter;
use Aws\Credentials\Credentials;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/** A-13: AWS SDK の CacheInterface を Laravel cache で実装 */
class LaravelCacheAdapterTest extends TestCase
{
    public function test_set_get_remove(): void
    {
        $adapter = new LaravelCacheAdapter();
        $creds = new Credentials('AKIA', 'secret', 'token', time() + 3600);

        $this->assertNull($adapter->get('credentials:test'));
        $adapter->set('credentials:test', $creds, 3600);

        $got = $adapter->get('credentials:test');
        $this->assertInstanceOf(Credentials::class, $got);
        $this->assertSame('AKIA', $got->getAccessKeyId());
        $this->assertSame('aws:credentials:test', array_keys(array_filter(['aws:credentials:test' => Cache::has('aws:credentials:test')]))[0]);

        $adapter->remove('credentials:test');
        $this->assertNull($adapter->get('credentials:test'));
    }

    public function test_ttl0でも保存される(): void
    {
        $adapter = new LaravelCacheAdapter();
        $adapter->set('k', 'v', 0);
        $this->assertSame('v', $adapter->get('k'));
    }
}
