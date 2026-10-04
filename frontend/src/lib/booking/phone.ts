// The browser repeats the backend's mobile rule (research R9) so a typo is caught before the request.
// The server stays authoritative; tests/unit/booking-phone.test.ts runs both against one case table.

const NOISE = /[ \t\r\n\-.()]/g;
const PK_MOBILE = /^(?:\+92|0092|92|0)(3[0-9]{9})$/;

/** A Pakistani mobile number as `+923XXXXXXXXX`, or `null` when it is not one. */
export function normalizePkMobile(raw: string): string | null {
  const found = PK_MOBILE.exec(raw.replace(NOISE, ""));
  return found ? `+92${found[1]}` : null;
}
