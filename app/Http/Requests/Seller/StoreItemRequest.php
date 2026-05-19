<?php

namespace App\Http\Requests\Seller;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;

class StoreItemRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'auction_id' => ['required', 'exists:auctions,id'],
            'species_name' => ['required', 'string', 'max:100'],
            'quantity' => ['required', 'integer', 'min:1', 'max:100'],
            'start_price' => ['required', 'numeric', 'min:100', 'max:10000000'],
            'estimated_price' => ['nullable', 'numeric', 'min:0', 'gte:start_price'],
            'is_premium' => ['nullable', 'boolean'],
            'individual_info' => ['nullable', 'string', 'max:2000'],
            'unsold_action' => ['nullable', 'string', 'in:return,keep,dispose'],
            'warranty_type' => ['nullable', 'string', 'max:100'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'auction_id.required' => '出品先オークションを選択してください。',
            'auction_id.exists' => '指定されたオークションが見つかりません。',
            'species_name.required' => '品種名は必須です。',
            'species_name.max' => '品種名は100文字以内で入力してください。',
            'quantity.required' => '匹数は必須です。',
            'quantity.min' => '匹数は1匹以上で指定してください。',
            'quantity.max' => "1出品あたり100匹までとさせていただいております。\n※保証を入れていただく場合は、パックにその旨をご記載ください。",
            'start_price.required' => '開始価格は必須です。',
            'start_price.min' => '開始価格は100円以上で指定してください。',
            'start_price.max' => '開始価格は10,000,000円以下で指定してください。',
            'estimated_price.gte' => '想定落札価格は開始価格以上で指定してください。',
            'individual_info.max' => '個体情報は2000文字以内で入力してください。',
            'unsold_action.in' => '未落札時対応は「返却」「保管」「処分」から選択してください。',
        ];
    }

    /**
     * Configure the validator instance.
     *
     * @param \Illuminate\Validation\Validator $validator
     */
    public function withValidator($validator)
    {
        $validator->after(function ($validator) {
            // オークションの出品締切をチェック
            $auctionId = $this->input('auction_id');
            if ($auctionId) {
                $auction = \App\Models\Auction::find($auctionId);
                if ($auction) {
                    // 締切日チェック
                    if ($auction->entry_deadline && now()->gt($auction->entry_deadline)) {
                        $validator->errors()->add('auction_id', 'このオークションの出品締切は過ぎています。');
                    }
                    // ステータスチェック
                    if (!in_array($auction->status, ['preparing', 'scheduled'])) {
                        $validator->errors()->add('auction_id', 'このオークションには出品できません。');
                    }
                }
            }
        });
    }
}
