import { LifeDomain } from "@/store/types";

export const DOMAIN_LABEL: Record<LifeDomain, string> = {
  pessoal: "Pessoal",
  profissional: "Profissional",
};

/** Goals/projects saved before `domain` existed have no value for it —
 * treat them as "pessoal" everywhere instead of letting them vanish from
 * both pages. */
export function resolveDomain(item: { domain?: LifeDomain }): LifeDomain {
  return item.domain ?? "pessoal";
}
