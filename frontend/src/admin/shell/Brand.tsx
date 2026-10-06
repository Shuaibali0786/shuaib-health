import { monogram } from "./nav";

/** The clinic monogram and name on the navy bars. The name comes from the clinic's settings, never from code. */
export function Brand({ clinicName }: { clinicName: string }) {
  return (
    <>
      <div className="mono" aria-hidden="true">
        {monogram(clinicName)}
      </div>
      <div>
        <div className="brand-name">{clinicName}</div>
        <div className="brand-sub">Command Centre</div>
      </div>
    </>
  );
}
