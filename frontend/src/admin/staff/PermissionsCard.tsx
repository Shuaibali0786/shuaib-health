import { Check, Minus } from "lucide-react";

import { CAPABILITIES, ROLES } from "./permissions";

/** "What each role can do": a plain table, so a clinic owner can choose a role without guessing. */
export function PermissionsCard() {
  return (
    <section className="card" aria-labelledby="roles-title">
      <div className="card-head">
        <h2 id="roles-title">Roles and permissions</h2>
      </div>
      <div className="table-wrap">
        <table className="table perm-table">
          <caption>What each role can do</caption>
          <thead>
            <tr>
              <th scope="col">Action</th>
              {ROLES.map(({ role, label }) => (
                <th key={role} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CAPABILITIES.map((capability) => (
              <tr key={capability.id}>
                <th scope="row">{capability.label}</th>
                {ROLES.map(({ role, label }) => {
                  const allowed = capability.roles.includes(role);
                  return (
                    <td key={role} data-allowed={allowed ? "true" : "false"}>
                      {allowed ? <Check className="i i-sm" aria-hidden="true" /> : <Minus className="i i-sm" aria-hidden="true" />}
                      <span className="sr-only">{allowed ? `Allowed for ${label}` : `Not allowed for ${label}`}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="perm-note">The server checks every request against these rules; hiding a button is only a courtesy.</p>
    </section>
  );
}
