import { SignOutButton } from "@/admin/auth/SignOutButton";
import type { ThemePreference } from "@/admin/state/themeCore";

import { Brand } from "./Brand";
import { NewBookingsBell } from "./NewBookingsBell";
import { ThemeCycle } from "./ThemeToggle";

/** The sticky navy bar on phones and tablets: the clinic, the theme button (Light, Night, Auto) and Sign out. */
export function MobileTopBar({ clinicName, theme = "light", demo = false, timeZone }: { clinicName: string; theme?: ThemePreference; demo?: boolean; timeZone: string }) {
  return (
    <header className="m-top m-only">
      <Brand clinicName={clinicName} />
      <div className="m-top-actions">
        <NewBookingsBell demo={demo} timeZone={timeZone} tone="dark" />
        <ThemeCycle initial={theme} />
        <SignOutButton className="btn btn-sm signout" />
      </div>
    </header>
  );
}
