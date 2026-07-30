/** Reads an item's tags whether it was saved before (singular `tag`) or
 * after (`tags` array) the multi-tag change, so existing stored tasks/events
 * keep displaying correctly without a data migration. */
export function itemTags(item: { tag?: string; tags?: string[] }): string[] {
  return item.tags ?? (item.tag ? [item.tag] : []);
}
