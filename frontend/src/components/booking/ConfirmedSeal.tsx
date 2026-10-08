import { SEAL, sealContent } from "@/lib/booking/seal";
import { formatSealBooked } from "@/lib/booking/slip";

/**
 * The CONFIRMED stamp: a double ring with the clinic name over the top, "• DEMO •" along the bottom, and a
 * check, CONFIRMED and "BOOKED 07 OCT" turned a little in the middle. Every glyph is placed from its measured
 * width (lib/booking/seal.ts), the same layout the PDF draws, so no text touches a ring and the two match.
 */
export function ConfirmedSeal({ clinicName, bookedAt, timeZone, sample, className }: { clinicName: string; bookedAt: string; timeZone: string; sample: boolean; className?: string }) {
  const booked = formatSealBooked(bookedAt, timeZone);
  const content = sealContent({ clinicName, booked, sample });
  const half = SEAL.box / 2;
  const [first, second] = content.centre.lines;
  return (
    <svg
      viewBox={`${-half} ${-half} ${SEAL.box} ${SEAL.box}`}
      role="img"
      aria-label={`Confirmed, booked ${booked}${sample ? ", demo booking" : ""}`}
      data-testid="confirmed-seal"
      className={className}
    >
      <circle r={SEAL.outerRadius} strokeWidth={SEAL.outerStroke} className="fill-white stroke-teal-700" />
      <circle r={SEAL.innerRadius} strokeWidth={SEAL.innerStroke} className="fill-none stroke-teal-700" />
      <g className="fill-teal-700 font-sans font-semibold" aria-hidden="true">
        {[...content.top, ...content.bottom].map((glyph, index) => (
          <text key={index} fontSize={glyph.size} transform={`translate(${glyph.x.toFixed(3)} ${glyph.y.toFixed(3)}) rotate(${glyph.rotateDeg.toFixed(3)})`}>
            {glyph.char}
          </text>
        ))}
      </g>
      <g transform={`rotate(${SEAL.tiltDeg})`} aria-hidden="true">
        <polyline
          points={content.centre.check.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join(" ")}
          fill="none"
          strokeWidth={content.centre.checkStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-teal-700"
        />
        {first ? (
          <text x={first.x} y={first.y} fontSize={first.size} letterSpacing={first.spacing} className="fill-teal-700 font-heading font-bold">
            {first.text}
          </text>
        ) : null}
        {second ? (
          <text x={second.x} y={second.y} fontSize={second.size} letterSpacing={second.spacing} className="fill-gold-700 font-sans font-semibold">
            {second.text}
          </text>
        ) : null}
      </g>
    </svg>
  );
}
