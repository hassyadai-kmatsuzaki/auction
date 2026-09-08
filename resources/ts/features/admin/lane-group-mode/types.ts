/**
 * レーン割当「出品者グループ配置モード」（出品者順序の確定前）で扱う型。
 *
 * グループ = 同一出品者 × 通常/匿名 の生体のまとまり。
 * レーン内では lane_items の並びから「連続区間」として導出するため、
 * 確定解除後に同じ出品者が離れて並んでいれば別グループになる。
 */

/** レーン画面の生体（LaneAssignment の LaneItem と構造互換の最小形） */
export interface GroupItem {
  id: number;
  item_number: number;
  species_name: string;
  quantity: number;
  status: string;
  is_anonymous?: boolean;
  is_premium?: boolean;
  seller_profile_id?: number;
  seller_name?: string;
  seller_code?: string | null;
  exhibit_code?: string | null;
}

export interface LaneGroup {
  /** `${seller_profile_id}:${0|1}` 。seller_profile_id 未設定は 0 */
  key: string;
  seller_profile_id: number;
  seller_name: string;
  seller_code: string | null;
  is_anonymous: boolean;
  items: GroupItem[];
}

/** グループのドロップ先。laneId=null は未割当へ、beforeItemId=null は末尾 */
export interface GroupDropTarget {
  laneId: number | null;
  beforeItemId: number | null;
}
