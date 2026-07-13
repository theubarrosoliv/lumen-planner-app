import { ReactNode } from "react";

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function SectionHeader({ eyebrow, title, description, action }: SectionHeaderProps) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 animate-rise">
      <div>
        {eyebrow && (
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.25em] text-primary-glow">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-4xl leading-none md:text-5xl">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-xl text-sm text-muted-foreground md:text-base">
            {description}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
