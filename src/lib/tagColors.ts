/**
 * Maps a tag name to one of the eight tag hues defined in src/index.css, so
 * tasks carrying different tags read apart at a glance.
 *
 * Used ONLY by the Cronograma (src/components/ScheduleView.tsx): that's the
 * one view where dozens of items share a dense grid and color is the only
 * cheap way to tell them apart. Everywhere else tags stay on the neutral
 * badge styling they already had — coloring them app-wide would turn every
 * list into confetti without adding information.
 */

export interface TagStyle {
  /** Solid fill — the accent stripe on a block, the dot on an all-day pill. */
  accent: string;
  /** Matching outline for a block carrying that accent. */
  border: string;
  /**
   * Wash laid over the block's whole face. The stripe alone covered ~2% of a
   * block's area, which simply did not read as "this task is blue" at a
   * glance (least of all on a phone) — the tint is what actually makes the
   * color visible. Applied as an overlay on top of an opaque background, not
   * as the background itself, so the day-lane shading behind can't bleed
   * through and merge neighbouring blocks together.
   */
  tint: string;
}

/**
 * Class names are written out in full on purpose. Tailwind's scanner reads
 * source text, so a template-built `bg-tag-${slot}` would never be emitted
 * and every block would come out unstyled.
 */
const TAG_STYLES: TagStyle[] = [
  { accent: "bg-tag-1", border: "border-tag-1/60", tint: "bg-tag-1/20" },
  { accent: "bg-tag-2", border: "border-tag-2/60", tint: "bg-tag-2/20" },
  { accent: "bg-tag-3", border: "border-tag-3/60", tint: "bg-tag-3/20" },
  { accent: "bg-tag-4", border: "border-tag-4/60", tint: "bg-tag-4/20" },
  { accent: "bg-tag-5", border: "border-tag-5/60", tint: "bg-tag-5/20" },
  { accent: "bg-tag-6", border: "border-tag-6/60", tint: "bg-tag-6/20" },
  { accent: "bg-tag-7", border: "border-tag-7/60", tint: "bg-tag-7/20" },
  { accent: "bg-tag-8", border: "border-tag-8/60", tint: "bg-tag-8/20" },
];

/**
 * Fixed slots for the tags the app ships with, so the six defaults are
 * guaranteed not to collide with each other (a hash alone could easily land
 * two of them on the same hue) and keep roughly the meaning they already
 * carried elsewhere — Saúde red, Reunião green, Hábito amber.
 */
const NAMED_TAG_SLOT: Record<string, number> = {
  Foco: 0,
  Saúde: 1,
  Reunião: 2,
  Hábito: 3,
  Trabalho: 4,
  Pessoal: 5,
};

/**
 * Stable hash → slot for user-created tags. Keyed off the tag's own text
 * rather than its position in any list, so a tag keeps its color when other
 * tags are added, renamed or deleted around it.
 */
function hashSlot(tag: string): number {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (Math.imul(h, 31) + tag.charCodeAt(i)) | 0;
  return Math.abs(h) % TAG_STYLES.length;
}

export function tagStyle(tag: string): TagStyle {
  return TAG_STYLES[NAMED_TAG_SLOT[tag] ?? hashSlot(tag)];
}

/** The style for a tagged item: its first tag wins, so an item's color stays
 * predictable instead of shifting with tag order. Null when untagged, letting
 * the caller fall back to its own default. */
export function firstTagStyle(tags: string[]): TagStyle | null {
  return tags.length > 0 ? tagStyle(tags[0]) : null;
}
