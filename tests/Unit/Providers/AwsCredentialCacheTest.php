<?php

namespace Tests\Unit\Providers;

use App\Providers\AppServiceProvider;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** A-13: IAM Role 運用（key 空）のときだけ S3 ディスクにキャッシュ付き認証プロバイダを差し込む */
class AwsCredentialCacheTest extends TestCase
{
    private function applyProvider(): void
    {
        $provider = new AppServiceProvider($this->app);
        (new \ReflectionMethod($provider, 'configureAwsCredentialCache'))->invoke($provider);
    }

    private function s3(array $over = []): void
    {
        config(['filesystems.disks.s3' => array_merge([
            'driver' => 's3', 'key' => '', 'secret' => '', 'region' => 'ap-northeast-1',
            'bucket' => 'test-bucket', 'url' => null, 'endpoint' => null, 'use_path_style_endpoint' => false,
        ], $over)]);
        config(['filesystems.aws_credential_cache' => true]);
        Storage::forgetDisk('s3');
    }

    public function test_key空_bucketありなら_callableな認証プロバイダが入りS3ディスクが組める(): void
    {
        $this->s3();
        $this->applyProvider();

        $this->assertIsCallable(config('filesystems.disks.s3.credentials'));
        $this->assertNotNull(Storage::disk('s3'), 'credentials は遅延評価なのでクライアント生成で IMDS には行かない');
    }

    public function test_アクセスキーがあれば差し込まない(): void
    {
        $this->s3(['key' => 'AKIA', 'secret' => 'x']);
        $this->applyProvider();
        $this->assertArrayNotHasKey('credentials', config('filesystems.disks.s3'));
    }

    public function test_bucketが無ければ差し込まない(): void
    {
        $this->s3(['bucket' => '']);
        $this->applyProvider();
        $this->assertArrayNotHasKey('credentials', config('filesystems.disks.s3'));
    }

    public function test_フラグOFFなら差し込まない(): void
    {
        $this->s3();
        config(['filesystems.aws_credential_cache' => false]);
        $this->applyProvider();
        $this->assertArrayNotHasKey('credentials', config('filesystems.disks.s3'));
    }
}
