/**
 * CPUキャラクターの入札ロジック
 * フロントエンドのみで動作し、各CPUが独立した入札戦略を持つ
 */
import type { LiveLane } from '@/types';
import type { CpuCharacter } from './mockData';

export interface CpuBidState {
  /** このCPUのID */
  cpuId: number;
  /** 各アイテムに対する最大支払い意欲価格 */
  maxPrices: Map<number, number>;
  /** 現在入札中のアイテムID */
  activeBidItemIds: Set<number>;
}

/**
 * CPUの初期状態を生成
 * 各アイテムに対してランダムな最大価格を設定
 */
export function initCpuState(cpu: CpuCharacter, allItemStartPrices: Map<number, number>): CpuBidState {
  const maxPrices = new Map<number, number>();
  allItemStartPrices.forEach((startPrice, itemId) => {
    // 各アイテムに対して、開始価格 × (1.0 ～ maxPriceMultiplier) のランダムな上限を設定
    const multiplier = 1.0 + Math.random() * (cpu.maxPriceMultiplier - 1.0);
    maxPrices.set(itemId, Math.floor(startPrice * multiplier));
  });
  return {
    cpuId: cpu.id,
    maxPrices,
    activeBidItemIds: new Set(),
  };
}

/**
 * CPUが入札するかどうかを判断し、入札対象のレーンIDを返す
 */
export function decideCpuAction(
  cpu: CpuCharacter,
  state: CpuBidState,
  lanes: LiveLane[],
): { laneId: number; itemId: number } | null {
  // 入札可能なレーンをフィルタ
  const eligibleLanes = lanes.filter(lane => {
    if (!lane.current_item) return false;
    if (lane.current_item.phase !== 'bidding') return false;
    // レーン優先度チェック
    if (cpu.preferredLanes && !cpu.preferredLanes.includes(lane.lane_number)) return false;
    // 既に最高入札者でないか確認（CPUは自分が最高入札者なら入札しない）
    // ここではactive_bidders_countで判断
    const item = lane.current_item;
    const maxPrice = state.maxPrices.get(item.id) ?? 0;
    // 現在価格が上限を超えていたら入札しない
    if (item.current_price >= maxPrice) return false;
    return true;
  });

  if (eligibleLanes.length === 0) return null;

  // 確率チェック
  if (Math.random() > cpu.bidProbability) return null;

  // ランダムに1つ選ぶ
  const lane = eligibleLanes[Math.floor(Math.random() * eligibleLanes.length)];
  return { laneId: lane.lane_id, itemId: lane.current_item!.id };
}

/**
 * 価格上昇額を計算（実際のオークションロジックに合わせる）
 */
export function calculatePriceIncrement(currentPrice: number): number {
  if (currentPrice < 1000) return 100;
  if (currentPrice < 5000) return 200;
  if (currentPrice < 10000) return 500;
  return 1000;
}
