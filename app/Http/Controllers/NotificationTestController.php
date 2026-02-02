<?php

namespace App\Http\Controllers;

use App\Mail\AuctionStartNotificationMail;
use App\Mail\ItemSoldNotificationMail;
use App\Mail\NewAuctionNotificationMail;
use App\Mail\PaymentConfirmedMail;
use App\Mail\SellerPaymentReceivedMail;
use App\Mail\ShippingNotificationMail;
use App\Mail\WonItemNotificationMail;
use App\Models\Auction;
use App\Models\Item;
use App\Models\WonItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;

class NotificationTestController extends Controller
{
    /**
     * テストメール送信（参加者向け）
     */
    public function sendParticipantTest(Request $request)
    {
        $user = Auth::user();
        $type = $request->input('type');

        if (!$user->email) {
            return response()->json([
                'success' => false,
                'message' => 'メールアドレスが設定されていません。',
            ], 400);
        }

        try {
            switch ($type) {
                case 'won_item':
                    $this->sendTestWonItemMail($user);
                    break;
                case 'payment_confirmed':
                    $this->sendTestPaymentConfirmedMail($user);
                    break;
                case 'shipping':
                    $this->sendTestShippingMail($user);
                    break;
                case 'new_auction':
                    $this->sendTestNewAuctionMail($user);
                    break;
                case 'auction_start':
                    $this->sendTestAuctionStartMail($user);
                    break;
                default:
                    return response()->json([
                        'success' => false,
                        'message' => '不明な通知タイプです。',
                    ], 400);
            }

            Log::info('テストメール送信（参加者）', ['user_id' => $user->id, 'type' => $type, 'email' => $user->email]);

            return response()->json([
                'success' => true,
                'message' => 'テストメールを送信しました。',
            ]);
        } catch (\Exception $e) {
            Log::error('テストメール送信エラー（参加者）', ['error' => $e->getMessage(), 'user_id' => $user->id]);
            return response()->json([
                'success' => false,
                'message' => 'メール送信に失敗しました: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * テストメール送信（出品者向け）
     */
    public function sendSellerTest(Request $request)
    {
        $user = Auth::user();
        $type = $request->input('type');

        if (!$user->email) {
            return response()->json([
                'success' => false,
                'message' => 'メールアドレスが設定されていません。',
            ], 400);
        }

        try {
            switch ($type) {
                case 'new_auction':
                    $this->sendTestNewAuctionMail($user);
                    break;
                case 'item_sold':
                    $this->sendTestItemSoldMail($user);
                    break;
                case 'payment_received':
                    $this->sendTestSellerPaymentReceivedMail($user);
                    break;
                case 'shipping_reminder':
                    // 発送リマインダーはシンプルなテストメール
                    $this->sendTestSellerPaymentReceivedMail($user);
                    break;
                default:
                    return response()->json([
                        'success' => false,
                        'message' => '不明な通知タイプです。',
                    ], 400);
            }

            Log::info('テストメール送信（出品者）', ['user_id' => $user->id, 'type' => $type, 'email' => $user->email]);

            return response()->json([
                'success' => true,
                'message' => 'テストメールを送信しました。',
            ]);
        } catch (\Exception $e) {
            Log::error('テストメール送信エラー（出品者）', ['error' => $e->getMessage(), 'user_id' => $user->id]);
            return response()->json([
                'success' => false,
                'message' => 'メール送信に失敗しました: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * テスト用の落札通知メール送信
     */
    private function sendTestWonItemMail($user)
    {
        $wonItem = $this->createMockWonItem($user);
        Mail::to($user->email)->send(new WonItemNotificationMail($wonItem));
    }

    /**
     * テスト用の入金確認メール送信
     */
    private function sendTestPaymentConfirmedMail($user)
    {
        $wonItem = $this->createMockWonItem($user);
        Mail::to($user->email)->send(new PaymentConfirmedMail($wonItem));
    }

    /**
     * テスト用の発送通知メール送信
     */
    private function sendTestShippingMail($user)
    {
        $wonItem = $this->createMockWonItem($user);
        $wonItem->shipping_company = 'ヤマト運輸';
        $wonItem->tracking_number = '1234-5678-9012';
        Mail::to($user->email)->send(new ShippingNotificationMail($wonItem));
    }

    /**
     * テスト用の新規オークション通知メール送信
     */
    private function sendTestNewAuctionMail($user)
    {
        $auction = $this->createMockAuction();
        Mail::to($user->email)->send(new NewAuctionNotificationMail($auction, $user));
    }

    /**
     * テスト用のオークション開始通知メール送信
     */
    private function sendTestAuctionStartMail($user)
    {
        $auction = $this->createMockAuction();
        Mail::to($user->email)->send(new AuctionStartNotificationMail($auction, $user));
    }

    /**
     * テスト用の出品者向け落札通知メール送信
     */
    private function sendTestItemSoldMail($user)
    {
        $wonItem = $this->createMockWonItemForSeller($user);
        Mail::to($user->email)->send(new ItemSoldNotificationMail($wonItem));
    }

    /**
     * テスト用の出品者向け入金確認メール送信
     */
    private function sendTestSellerPaymentReceivedMail($user)
    {
        $wonItem = $this->createMockWonItemForSeller($user);
        Mail::to($user->email)->send(new SellerPaymentReceivedMail($wonItem));
    }

    /**
     * モックの落札アイテムを作成（参加者向け）
     */
    private function createMockWonItem($user)
    {
        $wonItem = new WonItem();
        $wonItem->id = 0;
        $wonItem->winning_price = 15000;
        $wonItem->quantity = 3;
        $wonItem->total_amount = 16500;
        $wonItem->commission_amount = 1500;
        $wonItem->payment_deadline = now()->addDays(3);
        
        // リレーション用のモックアイテム
        $item = new Item();
        $item->id = 0;
        $item->item_number = 'TEST-001';
        $item->species_name = '【テスト】三色ラメ体外光';
        $item->quantity = 3;
        
        $wonItem->setRelation('item', $item);
        $wonItem->setRelation('user', $user);
        
        return $wonItem;
    }

    /**
     * モックの落札アイテムを作成（出品者向け）
     */
    private function createMockWonItemForSeller($user)
    {
        $wonItem = new WonItem();
        $wonItem->id = 0;
        $wonItem->winning_price = 15000;
        $wonItem->quantity = 3;
        $wonItem->total_amount = 16500;
        $wonItem->commission_amount = 1500;
        $wonItem->shipping_address = '東京都渋谷区テスト町1-2-3';
        
        // リレーション用のモックアイテム
        $item = new Item();
        $item->id = 0;
        $item->item_number = 'TEST-001';
        $item->species_name = '【テスト】三色ラメ体外光';
        $item->quantity = 3;
        $item->setRelation('seller', $user);
        
        $wonItem->setRelation('item', $item);
        
        return $wonItem;
    }

    /**
     * モックのオークションを作成
     */
    private function createMockAuction()
    {
        $auction = new Auction();
        $auction->id = 0;
        $auction->title = '【テスト】第99回メダカライブオークション';
        $auction->event_date = now()->addDays(7);
        $auction->start_time = '20:00';
        $auction->description = 'これはテストメールです。実際のオークションではありません。';
        
        return $auction;
    }
}
