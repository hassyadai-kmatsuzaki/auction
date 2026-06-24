<?php

namespace App\Services;

use Aws\Lambda\LambdaClient;
use Aws\Ec2\Ec2Client;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class AwsScalingService
{
    private const LOCK_KEY = 'aws:scaling:lock';
    private const LAST_ACTION_KEY = 'aws:scaling:last_action';
    private const LOCK_TTL_SECONDS = 1800;

    public function getStatus(): array
    {
        $instanceId = config('aws.ec2_instance_id');

        if (! $instanceId) {
            return [
                'mode' => 'unknown',
                'instance_type' => null,
                'is_locked' => false,
                'last_action' => null,
                'error' => 'EC2_INSTANCE_ID is not configured',
            ];
        }

        try {
            $ec2 = new Ec2Client([
                'region'  => config('aws.region', 'ap-northeast-1'),
                'version' => 'latest',
            ]);

            $result = $ec2->describeInstances(['InstanceIds' => [$instanceId]]);
            $instance = $result['Reservations'][0]['Instances'][0] ?? null;

            $instanceType = $instance['InstanceType'] ?? null;
            $state = $instance['State']['Name'] ?? null;

            return [
                'mode' => $this->resolveMode($instanceType),
                'instance_type' => $instanceType,
                'instance_state' => $state,
                'is_locked' => $this->isLocked(),
                'last_action' => Cache::get(self::LAST_ACTION_KEY),
            ];
        } catch (\Throwable $e) {
            Log::error('AwsScalingService::getStatus failed', ['error' => $e->getMessage()]);
            return [
                'mode' => 'unknown',
                'instance_type' => null,
                'is_locked' => $this->isLocked(),
                'last_action' => Cache::get(self::LAST_ACTION_KEY),
                'error' => $e->getMessage(),
            ];
        }
    }

    public function scaleUp(int $userId): array
    {
        return $this->invokeLambda('up', config('aws.lambda_scale_up'), $userId);
    }

    public function scaleDown(int $userId): array
    {
        return $this->invokeLambda('down', config('aws.lambda_scale_down'), $userId);
    }

    private function invokeLambda(string $direction, ?string $functionName, int $userId): array
    {
        if (! $functionName) {
            throw new \RuntimeException('Lambda function name is not configured');
        }

        $lock = Cache::lock(self::LOCK_KEY, self::LOCK_TTL_SECONDS);
        if (! $lock->get()) {
            throw new \RuntimeException('他のスケーリング処理が実行中です。しばらく待ってから再試行してください。');
        }

        try {
            $lambda = new LambdaClient([
                'region'  => config('aws.region', 'ap-northeast-1'),
                'version' => 'latest',
            ]);

            $result = $lambda->invoke([
                'FunctionName'   => $functionName,
                'InvocationType' => 'Event', // 非同期
                'Payload'        => json_encode([
                    'triggered_by' => 'admin_panel',
                    'user_id'      => $userId,
                    'direction'    => $direction,
                ]),
            ]);

            $statusCode = $result['StatusCode'] ?? 0;
            if ($statusCode < 200 || $statusCode >= 300) {
                throw new \RuntimeException("Lambda invoke failed with status {$statusCode}");
            }

            $action = [
                'direction'  => $direction,
                'user_id'    => $userId,
                'started_at' => now()->toIso8601String(),
                'status'     => 'running',
            ];
            Cache::put(self::LAST_ACTION_KEY, $action, 86400);

            Log::info('AwsScalingService: Lambda invoked', [
                'direction' => $direction,
                'function'  => $functionName,
                'user_id'   => $userId,
            ]);

            return $action;
        } catch (\Throwable $e) {
            $lock->release();
            throw $e;
        }

        // ロックは Lambda 完了後に Lambda 側から API コールで解放される想定だが、
        // 簡易実装として TTL による自動解放に任せる
    }

    private function isLocked(): bool
    {
        return Cache::has(self::LOCK_KEY);
    }

    public function releaseLock(): void
    {
        Cache::forget(self::LOCK_KEY);
    }

    private function resolveMode(?string $instanceType): string
    {
        if (! $instanceType) {
            return 'unknown';
        }

        $normalMode = config('aws.normal_instance_type', 't3.small');
        $auctionMode = config('aws.auction_instance_type', 'c6i.2xlarge');

        return match ($instanceType) {
            $normalMode  => 'normal',
            $auctionMode => 'auction',
            default      => 'custom',
        };
    }
}
