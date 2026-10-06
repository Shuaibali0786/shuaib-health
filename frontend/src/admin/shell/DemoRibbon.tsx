import Link from "next/link";

/**
 * The demo banner (FR-038, Principle I): on every screen of a demo session, in the shell above the
 * content. A note, not an alert, so it never interrupts a screen reader. The two links leave the demo:
 * back to the public website, or to the staff sign-in (which ends the demo session on sign-in).
 */
export function DemoRibbon() {
  return (
    <div className="ribbon" role="note" data-testid="demo-ribbon">
      <span className="dot" aria-hidden="true" />
      <strong>Demo mode — changes are not saved.</strong>
      <span>All names and numbers are sample data.</span>
      <span className="links">
        <Link href="/" prefetch={false}>
          Back to website
        </Link>
        <Link href="/admin/login" prefetch={false}>
          Staff sign-in
        </Link>
      </span>
    </div>
  );
}
