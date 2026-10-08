import { SignOutButton } from "@/admin/auth/SignOutButton";
import type { ThemePreference } from "@/admin/state/themeCore";

import { Brand } from "./Brand";
import { ThemeCycle } from "./ThemeToggle";

/** The sticky navy bar on phones and tablets: the clinic, the theme button (Light, Night, Auto) and Sign out. */
export function MobileTopBar({ clinicName, theme = "light" }: { clinicName: string; theme?: ThemePreference }) {
  return (
    <header className="m-top m-only">
      <Brand clinicName={clinicName} />
      <div className="m-top-actions">
        <ThemeCycle initial={theme} />
        <SignOutButton className="btn btn-sm signout" />
      </div>
    </header>
  );
}
