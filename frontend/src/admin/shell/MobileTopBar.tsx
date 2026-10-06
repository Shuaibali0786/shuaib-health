import { SignOutButton } from "@/admin/auth/SignOutButton";

import { Brand } from "./Brand";

/** The sticky navy bar on phones and tablets. The theme switch joins it with the mobile polish story. */
export function MobileTopBar({ clinicName }: { clinicName: string }) {
  return (
    <header className="m-top m-only">
      <Brand clinicName={clinicName} />
      <SignOutButton className="btn btn-sm signout" />
    </header>
  );
}
