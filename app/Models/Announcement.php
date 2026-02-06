<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;

class Announcement extends BaseModel
{
    use HasFactory, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<string>
     */
    protected $fillable = [
        'title',
        'content',
        'status',
        'target_roles',
        'is_important',
        'published_at',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'target_roles' => 'array',
        'is_important' => 'boolean',
        'published_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * 作成者とのリレーション
     */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * 更新者とのリレーション
     */
    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * 削除者とのリレーション
     */
    public function deleter()
    {
        return $this->belongsTo(User::class, 'deleted_by');
    }

    /**
     * 編集可能かどうか
     */
    public function canEdit(): bool
    {
        return in_array($this->status, ['draft', 'scheduled']);
    }

    /**
     * ステータス変更可能かどうか
     */
    public function canChangeStatus(): bool
    {
        return true;
    }

    /**
     * 削除可能かどうか
     */
    public function canDelete(): bool
    {
        return $this->deleted_at === null;
    }

    /**
     * 指定されたロールが対象かどうか
     */
    public function isTargetedTo(string $role): bool
    {
        return in_array($role, $this->target_roles);
    }

    /**
     * 指定されたユーザーに表示可能かどうか
     */
    public function isVisibleToUser(User $user): bool
    {
        // 公開中かつ公開日時を過ぎている
        if ($this->status !== 'published') {
            return false;
        }
        
        if ($this->published_at && $this->published_at > now()) {
            return false;
        }
        
        // 削除されていない
        if ($this->deleted_at !== null) {
            return false;
        }
        
        // ユーザーのロールが対象に含まれている
        foreach ($user->roles as $role) {
            if ($this->isTargetedTo($role->name)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * 公開予約されたお知らせを公開するスコープ
     */
    public function scopePublishScheduled($query)
    {
        return $query->where('status', 'scheduled')
                     ->where('published_at', '<=', now())
                     ->whereNull('deleted_at')
                     ->update(['status' => 'published']);
    }

    /**
     * ユーザーに表示可能なお知らせを取得するスコープ
     */
    public function scopeVisibleTo($query, User $user)
    {
        $roleNames = $user->roles->pluck('name')->toArray();
        
        return $query->where('status', 'published')
                     ->where('published_at', '<=', now())
                     ->whereNull('deleted_at')
                     ->where(function ($q) use ($roleNames) {
                         foreach ($roleNames as $role) {
                             $q->orWhereJsonContains('target_roles', $role);
                         }
                     })
                     ->orderByDesc('is_important')
                     ->orderByDesc('published_at');
    }

    /**
     * 管理画面用のお知らせ一覧を取得するスコープ
     */
    public function scopeForAdmin($query, $filters = [])
    {
        // 削除されていないもののみ
        $query->whereNull('deleted_at');

        // ステータスフィルター
        if (!empty($filters['status']) && $filters['status'] !== 'all') {
            $query->where('status', $filters['status']);
        }

        // 対象ロールフィルター
        if (!empty($filters['target_role']) && $filters['target_role'] !== 'all') {
            $query->whereJsonContains('target_roles', $filters['target_role']);
        }

        // 重要度フィルター
        if (isset($filters['is_important']) && $filters['is_important'] !== '') {
            // 文字列 'true'/'false' を boolean に変換
            $isImportant = filter_var($filters['is_important'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($isImportant !== null) {
                $query->where('is_important', $isImportant);
            }
        }

        // 検索
        if (!empty($filters['search'])) {
            $query->where(function ($q) use ($filters) {
                $q->where('title', 'like', '%' . $filters['search'] . '%')
                  ->orWhere('content', 'like', '%' . $filters['search'] . '%');
            });
        }

        // ソート
        $sortBy = $filters['sort_by'] ?? 'published_at';
        $sortOrder = $filters['sort_order'] ?? 'desc';
        $query->orderBy($sortBy, $sortOrder);

        return $query;
    }
}
