import { LogoMark, type LogoMarkTone } from "./LogoMark";

/**
 * "Powered by Shuaib Health" with the SMALL mark. Plain text, not a link; the mark is decorative.
 * Inline styles, not utility classes: the Command Centre stylesheet only scans src/admin.
 */
export function PoweredBy({ tone = "light", className }: { tone?: LogoMarkTone; className?: string }) {
  return (
    <span data-testid="powered-by" className={className} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <LogoMark size={16} tone={tone} small />
      <span>Powered by Shuaib Health</span>
    </span>
  );
}
