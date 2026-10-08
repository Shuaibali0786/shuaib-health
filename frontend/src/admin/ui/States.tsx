import type { CSSProperties, ReactNode } from "react";

import { VisuallyHidden } from "./VisuallyHidden";

/** A calm placeholder shaped like the content that is coming. Decorative: the region announces loading. */
export function Skeleton({ width, height = 14, className = "", style }: { width?: number | string; height?: number | string; className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" className={`skeleton ${className}`.trim()} style={{ width, height, ...style }} />;
}

/** Wraps skeletons so a screen reader hears one "Loading" instead of nothing. */
export function LoadingRegion({ label = "Loading", children }: { label?: string; children: ReactNode }) {
  return (
    <div role="status" aria-busy="true">
      <VisuallyHidden>{label}</VisuallyHidden>
      {children}
    </div>
  );
}

/** A designed empty state: says what is missing and, when useful, what to do about it. */
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="state" data-state="empty">
      <h2>{title}</h2>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

/** Calm error copy with a Retry button. It never shows a status code, a stack or a technical message. */
export function ErrorState({ title = "We could not load this", children = "Your last data is still shown where there is any. Please try again in a moment.", onRetry }: { title?: string; children?: ReactNode; onRetry?: () => void }) {
  return (
    <div className="state state-error" role="alert" data-state="error">
      <h2>{title}</h2>
      <p>{children}</p>
      {onRetry ? (
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
