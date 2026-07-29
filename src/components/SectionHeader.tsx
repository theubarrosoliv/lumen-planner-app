import { ReactNode } from "react";

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function SectionHeader({ eyebrow, title, description, action }: SectionHeaderProps) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 animate-rise md:mb-8 md:gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.25em] text-primary-glow md:mb-2">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-2xl leading-tight md:text-5xl md:leading-none">
          {title}
        </h1>
        {/* Description is page-level tagline — hidden on mobile to give the
            actual content back the top of the screen; shown on desktop. */}
        {description && (
          <p className="mt-3 hidden max-w-xl text-sm text-muted-foreground md:block md:text-base">
            {description}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
