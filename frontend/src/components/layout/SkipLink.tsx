/** First focusable element on every page. Hidden until focused, then jumps to the main content. */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-control focus:border-2 focus:border-navy-900 focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-navy-900 focus:shadow-lift"
    >
      Skip to main content
    </a>
  );
}
