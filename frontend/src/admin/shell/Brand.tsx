import { LogoMark, type LogoMarkTone } from "@/components/brand/LogoMark";

/**
 * The Booking Plus mark and the clinic name. The name comes from the clinic's settings, never from code.
 * `tone` "night" is for the always-navy side and top bars; the sign-in card uses "auto", which follows the
 * Night theme through the --logo-* variables in admin.css.
 */
export function Brand({ clinicName, tone = "night" }: { clinicName: string; tone?: LogoMarkTone }) {
  return (
    <>
      <LogoMark size={42} tone={tone} className="brand-mark" />
      <div>
        <div className="brand-name">{clinicName}</div>
        <div className="brand-sub">Command Centre</div>
      </div>
    </>
  );
}
