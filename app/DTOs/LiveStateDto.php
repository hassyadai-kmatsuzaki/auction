<?php

namespace App\DTOs;

use Illuminate\Http\JsonResponse;

readonly class LiveStateDto
{
    public function __construct(
        public int     $auctionId,
        public string  $auctionTitle,
        public string  $status,
        public float   $countdownSeconds,
        public array   $lanes,
        public bool    $showConsentScreen    = false,
        public ?int    $startingCountdown    = null,
        public ?bool   $entranceAllowed      = null,
        public ?string $entranceAt           = null,
        public ?string $startAt              = null,
        public ?int    $venueOpenMinutes     = null,
        public ?string $message              = null,
    ) {}

    public function toArray(): array
    {
        $data = [
            'auction_id'    => $this->auctionId,
            'auction_title' => $this->auctionTitle,
            'status'        => $this->status,
            'countdown_seconds' => $this->countdownSeconds,
            'lanes'         => $this->lanes,
            'show_consent_screen' => $this->showConsentScreen,
        ];

        if ($this->startingCountdown !== null) {
            $data['starting_countdown'] = $this->startingCountdown;
        }
        if ($this->entranceAllowed !== null) {
            $data['entrance_allowed'] = $this->entranceAllowed;
        }
        if ($this->entranceAt !== null) {
            $data['entrance_at'] = $this->entranceAt;
        }
        if ($this->startAt !== null) {
            $data['start_at'] = $this->startAt;
        }
        if ($this->venueOpenMinutes !== null) {
            $data['venue_open_minutes_before_start'] = $this->venueOpenMinutes;
        }
        if ($this->message !== null) {
            $data['message'] = $this->message;
        }

        return $data;
    }

    public function toResponse(): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $this->toArray()]);
    }

    /** スケジュール済み（入室不可）用ファクトリ */
    public static function entranceBlocked(
        int    $auctionId,
        string $title,
        string $entranceAt,
        string $startAt,
        int    $venueOpenMinutes,
        string $message,
    ): self {
        return new self(
            auctionId:         $auctionId,
            auctionTitle:      $title,
            status:            'scheduled',
            countdownSeconds:  0,
            lanes:             [],
            entranceAllowed:   false,
            entranceAt:        $entranceAt,
            startAt:           $startAt,
            venueOpenMinutes:  $venueOpenMinutes,
            message:           $message,
        );
    }

    /** スケジュール済み（入室可）用ファクトリ */
    public static function waitingRoom(
        int    $auctionId,
        string $title,
        string $startAt,
        bool   $showConsentScreen,
    ): self {
        return new self(
            auctionId:         $auctionId,
            auctionTitle:      $title,
            status:            'scheduled',
            countdownSeconds:  0,
            lanes:             [],
            showConsentScreen: $showConsentScreen,
            entranceAllowed:   true,
            startAt:           $startAt,
        );
    }
}
