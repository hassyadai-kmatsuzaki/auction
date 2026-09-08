import { GroupItem, LaneGroup } from './types';

export const groupKeyOf = (item: GroupItem): string =>
  `${item.seller_profile_id ?? 0}:${item.is_anonymous ? 1 : 0}`;

const newGroup = (item: GroupItem): LaneGroup => ({
  key: groupKeyOf(item),
  seller_profile_id: item.seller_profile_id ?? 0,
  seller_name: item.seller_name ?? 'その他',
  seller_code: item.seller_code ?? null,
  is_anonymous: !!item.is_anonymous,
  items: [item],
});

/**
 * レーン内の生体列を「連続区間」でグループに畳む。
 * 同じ出品者×匿名区分が離れて 2 か所にあれば 2 グループになる（確定解除後に起こりうる）。
 */
export function deriveLaneGroups(items: GroupItem[]): LaneGroup[] {
  const groups: LaneGroup[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.key === groupKeyOf(item)) {
      last.items.push(item);
    } else {
      groups.push(newGroup(item));
    }
  }
  return groups;
}

/**
 * 未割当の生体をグループに畳む。
 * 並びは 出品者順序（sellerOrder = seller_profile_id の display_order 順）→ 通常が先・匿名が後。
 * 出品者順序に無い出品者は末尾。グループ内は seller_display_order を反映済みの API 順（item_number 順）を保つ。
 */
export function deriveUnassignedGroups(items: GroupItem[], sellerOrder: number[]): LaneGroup[] {
  const map = new Map<string, LaneGroup>();
  for (const item of items) {
    const key = groupKeyOf(item);
    const g = map.get(key);
    if (g) g.items.push(item);
    else map.set(key, newGroup(item));
  }
  const rank = (sid: number) => {
    const idx = sellerOrder.indexOf(sid);
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
  };
  return [...map.values()].sort((a, b) => {
    if (a.is_anonymous !== b.is_anonymous) return a.is_anonymous ? 1 : -1;
    const r = rank(a.seller_profile_id) - rank(b.seller_profile_id);
    return r !== 0 ? r : a.seller_profile_id - b.seller_profile_id;
  });
}

export const sumQuantity = (items: GroupItem[]): number =>
  items.reduce((acc, it) => acc + (it.quantity ?? 0), 0);
