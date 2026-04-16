<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class ShippingTrackingService
{
    /**
     * 配送ステータスを取得
     */
    public function getTrackingStatus(string $trackingNumber, string $carrier = 'yamato'): array
    {
        $cacheKey = "tracking:{$carrier}:{$trackingNumber}";

        return Cache::remember($cacheKey, 600, function () use ($trackingNumber, $carrier) {
            return match ($carrier) {
                'yamato' => $this->getYamatoStatus($trackingNumber),
                'sagawa' => $this->getSagawaStatus($trackingNumber),
                default => $this->getGenericStatus($trackingNumber),
            };
        });
    }

    /**
     * ヤマト運輸の配送状況取得
     */
    private function getYamatoStatus(string $trackingNumber): array
    {
        try {
            $apiKey = config('services.yamato.api_key');

            if ($apiKey) {
                // ヤマトB2クラウドAPI連携
                $response = Http::withHeaders([
                    'Authorization' => 'Bearer ' . $apiKey,
                    'Content-Type' => 'application/json',
                ])->get(config('services.yamato.api_url', 'https://api.kuronekoyamato.co.jp/api/v1') . '/tracking', [
                    'tracking_number' => $trackingNumber,
                ]);

                if ($response->successful()) {
                    $data = $response->json();
                    return [
                        'carrier' => 'yamato',
                        'tracking_number' => $trackingNumber,
                        'status' => $this->normalizeYamatoStatus($data['status'] ?? ''),
                        'status_detail' => $data['status_detail'] ?? '',
                        'location' => $data['current_location'] ?? '',
                        'estimated_delivery' => $data['estimated_delivery'] ?? null,
                        'events' => $data['events'] ?? [],
                        'tracking_url' => "https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number={$trackingNumber}",
                    ];
                }
            }

            // APIキー未設定またはAPI失敗時はURLのみ返す
            return [
                'carrier' => 'yamato',
                'tracking_number' => $trackingNumber,
                'status' => 'unknown',
                'status_detail' => 'トラッキング情報は配送業者サイトで確認してください',
                'tracking_url' => "https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number={$trackingNumber}",
            ];
        } catch (\Exception $e) {
            Log::warning('Yamato tracking API error', ['error' => $e->getMessage()]);
            return [
                'carrier' => 'yamato',
                'tracking_number' => $trackingNumber,
                'status' => 'unknown',
                'tracking_url' => "https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number={$trackingNumber}",
            ];
        }
    }

    /**
     * 佐川急便の配送状況取得
     */
    private function getSagawaStatus(string $trackingNumber): array
    {
        try {
            $apiKey = config('services.sagawa.api_key');

            if ($apiKey) {
                $response = Http::withHeaders([
                    'Authorization' => 'Bearer ' . $apiKey,
                ])->get(config('services.sagawa.api_url', 'https://api.sagawa-exp.co.jp/api/v1') . '/tracking', [
                    'tracking_number' => $trackingNumber,
                ]);

                if ($response->successful()) {
                    $data = $response->json();
                    return [
                        'carrier' => 'sagawa',
                        'tracking_number' => $trackingNumber,
                        'status' => $data['status'] ?? 'unknown',
                        'status_detail' => $data['status_detail'] ?? '',
                        'events' => $data['events'] ?? [],
                        'tracking_url' => "https://k2k.sagawa-exp.co.jp/p/web/okuijo.do?okuijoNo={$trackingNumber}",
                    ];
                }
            }

            return [
                'carrier' => 'sagawa',
                'tracking_number' => $trackingNumber,
                'status' => 'unknown',
                'tracking_url' => "https://k2k.sagawa-exp.co.jp/p/web/okuijo.do?okuijoNo={$trackingNumber}",
            ];
        } catch (\Exception $e) {
            Log::warning('Sagawa tracking API error', ['error' => $e->getMessage()]);
            return [
                'carrier' => 'sagawa',
                'tracking_number' => $trackingNumber,
                'status' => 'unknown',
                'tracking_url' => "https://k2k.sagawa-exp.co.jp/p/web/okuijo.do?okuijoNo={$trackingNumber}",
            ];
        }
    }

    /**
     * 汎用ステータス取得（その他の配送業者）
     */
    private function getGenericStatus(string $trackingNumber): array
    {
        return [
            'carrier' => 'other',
            'tracking_number' => $trackingNumber,
            'status' => 'unknown',
            'status_detail' => '配送業者サイトで直接ご確認ください',
        ];
    }

    /**
     * ヤマトのステータスを正規化
     */
    private function normalizeYamatoStatus(string $status): string
    {
        return match ($status) {
            '発送済み', '荷物受付' => 'shipped',
            '輸送中', '作業店通過' => 'in_transit',
            '配達中' => 'out_for_delivery',
            '配達完了' => 'delivered',
            '持戻り', '不在' => 'failed_delivery',
            default => 'unknown',
        };
    }

    /**
     * 追跡番号から配送業者を自動判定
     */
    public function detectCarrier(string $trackingNumber): string
    {
        $number = preg_replace('/[^0-9]/', '', $trackingNumber);

        if (strlen($number) === 12) {
            return 'yamato';
        }

        if (strlen($number) === 10 || strlen($number) === 12) {
            return 'sagawa';
        }

        return 'other';
    }
}
