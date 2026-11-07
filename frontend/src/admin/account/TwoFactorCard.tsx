"use client";

import "@/lib/zodJitless";
import { useId, useState, type FormEvent } from "react";
import * as z from "zod";

import { securityMessage } from "@/admin/auth/copy";
import { adminRequest } from "@/admin/lib/client";
import { BackupCodesSchema, TwoFactorSetupSchema, TwoFactorStatusSchema, type TwoFactorSetup, type TwoFactorStatus } from "@/admin/lib/schemas";
import { useHydrated } from "@/admin/ui/useHydrated";
import { qrModules, qrPath } from "@/lib/booking/qr";

const QUIET = 2;
const Empty = z.null();

type Stage =
  | { kind: "failed"; message: string }
  | { kind: "ready"; status: TwoFactorStatus }
  | { kind: "password" }
  | { kind: "scan"; setup: TwoFactorSetup }
  | { kind: "codes"; codes: string[]; title: string }
  | { kind: "manage"; action: "off" | "codes"; status: TwoFactorStatus };

function SetupQr({ uri }: { uri: string }) {
  const modules = qrModules(uri);
  const size = modules.length + 2 * QUIET;
  return (
    <div className="qr-box">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="QR code to add this account to an authenticator app" shapeRendering="crispEdges">
        <path d={qrPath(modules, QUIET)} fill="currentColor" />
      </svg>
    </div>
  );
}

const grouped = (secret: string) => secret.replace(/(.{4})/g, "$1 ").trim();

/**
 * Two-step sign-in for the signed-in staff member (Feature 011): status, setup (password, then QR or key,
 * then a code), the backup codes (shown once), new codes and turning it off (password and a code).
 */
export function TwoFactorCard({ initial }: { initial: TwoFactorStatus | null }) {
  const [stage, setStage] = useState<Stage>(
    initial ? { kind: "ready", status: initial } : { kind: "failed", message: "We could not load your security settings. Reload the page to try again." },
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const [saved, setSaved] = useState(false);
  const hydrated = useHydrated();
  const ids = { password: useId(), code: useId(), error: useId(), saved: useId(), heading: useId() };

  async function load() {
    try {
      const status = await adminRequest({ path: "two-factor" }, TwoFactorStatusSchema);
      setStage({ kind: "ready", status });
    } catch (caught) {
      setStage({ kind: "failed", message: securityMessage(caught) });
    }
  }

  function reset() {
    setPassword("");
    setCode("");
    setError(null);
    setUseBackup(false);
    setSaved(false);
  }

  async function run(task: () => Promise<void>) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await task();
    } catch (caught) {
      setError(securityMessage(caught));
      setCode("");
    } finally {
      setPending(false);
    }
  }

  const startSetup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(async () => {
      const setup = await adminRequest({ method: "POST", path: "two-factor/setup", body: { currentPassword: password } }, TwoFactorSetupSchema);
      setPassword("");
      setStage({ kind: "scan", setup });
    });
  };

  const enable = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(async () => {
      const { backupCodes } = await adminRequest({ method: "POST", path: "two-factor/enable", body: { code: code.replace(/\s/g, "") } }, BackupCodesSchema);
      reset();
      setStage({ kind: "codes", codes: backupCodes, title: "Two-step sign-in is on" });
    });
  };

  const manage = (action: "off" | "codes") => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const factor = useBackup ? { backupCode: code.trim() } : { code: code.replace(/\s/g, "") };
    void run(async () => {
      if (action === "off") {
        await adminRequest({ method: "POST", path: "two-factor/disable", body: { currentPassword: password, ...factor } }, Empty);
        reset();
        await load();
      } else {
        const { backupCodes } = await adminRequest({ method: "POST", path: "two-factor/backup-codes", body: { currentPassword: password, ...factor } }, BackupCodesSchema);
        reset();
        setStage({ kind: "codes", codes: backupCodes, title: "New backup codes" });
      }
    });
  };

  const errorLine = error ? (
    <p id={ids.error} role="alert" className="field-error">
      {error}
    </p>
  ) : null;

  const passwordField = (
    <div className="field">
      <label htmlFor={ids.password}>Current password</label>
      <input id={ids.password} type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} />
    </div>
  );

  const codeField = (backupAllowed: boolean) => (
    <div className="field">
      <label htmlFor={ids.code}>{useBackup ? "Backup code" : "Code from your authenticator app"}</label>
      <input
        id={ids.code}
        type="text"
        inputMode={useBackup ? "text" : "numeric"}
        autoComplete="one-time-code"
        spellCheck={false}
        required
        maxLength={useBackup ? 13 : 7}
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      {backupAllowed ? (
        <button
          type="button"
          className="btn btn-quiet btn-sm"
          onClick={() => {
            setUseBackup((on) => !on);
            setCode("");
          }}
        >
          {useBackup ? "Use the app code instead" : "Use a backup code instead"}
        </button>
      ) : null}
    </div>
  );

  return (
    <section className="card panel-pad" aria-labelledby={ids.heading}>
      <h2 id={ids.heading}>Two-step sign-in</h2>
      <p className="notice-line">
        After your password, the Command Centre also asks for a 6-digit code from an authenticator app on your phone. A stolen password alone is then not enough to sign in.
      </p>

      {stage.kind === "failed" ? (
        <p role="alert" className="field-error">
          {stage.message}
        </p>
      ) : null}

      {stage.kind === "ready" && stage.status.enabled ? (
        <div className="stack">
          <p>
            <span className="pill pill-ok">On</span> {stage.status.backupCodesLeft ?? 0} of 10 backup codes left.
          </p>
          <div className="form-row">
            <button type="button" className="btn" onClick={() => (reset(), setStage({ kind: "manage", action: "codes", status: stage.status }))}>
              New backup codes
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => (reset(), setStage({ kind: "manage", action: "off", status: stage.status }))}>
              Turn off
            </button>
          </div>
        </div>
      ) : null}

      {stage.kind === "ready" && !stage.status.enabled ? (
        <div className="stack">
          <p>
            <span className="pill pill-off">Off</span>
          </p>
          {stage.status.canEnrol ? (
            <button type="button" className="btn btn-primary" onClick={() => (reset(), setStage({ kind: "password" }))}>
              Turn on two-step sign-in
            </button>
          ) : (
            <p className="notice-line">{stage.status.available ? "Two-step sign-in is offered to admin accounts." : "Two-step sign-in is not available on this system yet."}</p>
          )}
        </div>
      ) : null}

      {stage.kind === "password" ? (
        <form className="form" onSubmit={startSetup} aria-describedby={error ? ids.error : undefined}>
          <p className="notice-line">Step 1 of 3: confirm it is you.</p>
          {passwordField}
          {errorLine}
          <div className="form-row">
            <button type="submit" className="btn btn-primary" disabled={pending || !hydrated}>
              {pending ? "Checking…" : "Continue"}
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => (reset(), void load())}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {stage.kind === "scan" ? (
        <form className="form" onSubmit={enable} aria-describedby={error ? ids.error : undefined}>
          <p className="notice-line">Step 2 of 3: scan the QR code with an authenticator app, or type the key by hand. Then enter the 6-digit code it shows.</p>
          <div className="two-factor-setup">
            <SetupQr uri={stage.setup.otpauthUri} />
            <div className="stack">
              <div>
                <span className="hint">Setup key (type it if you cannot scan)</span>
                <code className="setup-key">{grouped(stage.setup.secret)}</code>
              </div>
              {codeField(false)}
            </div>
          </div>
          {errorLine}
          <div className="form-row">
            <button type="submit" className="btn btn-primary" disabled={pending || !hydrated}>
              {pending ? "Checking…" : "Turn on"}
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => (reset(), void load())}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {stage.kind === "codes" ? (
        <div className="stack">
          <p>
            <strong>{stage.title}.</strong> Step 3 of 3: save these 10 backup codes somewhere safe, for example printed and locked away. Each works once if you lose your phone. They are shown only now.
          </p>
          <ul className="backup-codes" aria-label="Backup codes">
            {stage.codes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="form-row">
            <button type="button" className="btn" onClick={() => void navigator.clipboard?.writeText(stage.codes.join("\n"))}>
              Copy codes
            </button>
            <button type="button" className="btn" onClick={() => window.print()}>
              Print codes
            </button>
          </div>
          <label className="check-line" htmlFor={ids.saved}>
            <input id={ids.saved} type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
            <span>I have saved my backup codes.</span>
          </label>
          <button type="button" className="btn btn-primary" disabled={!saved} onClick={() => (reset(), void load())}>
            Done
          </button>
        </div>
      ) : null}

      {stage.kind === "manage" ? (
        <form className="form" onSubmit={manage(stage.action)} aria-describedby={error ? ids.error : undefined}>
          <p className="notice-line">
            {stage.action === "off"
              ? "Turning it off makes your account easier to break into. Confirm with your password and a code."
              : "New codes replace all your old backup codes. Confirm with your password and a code."}
          </p>
          {passwordField}
          {codeField(true)}
          {errorLine}
          <div className="form-row">
            <button type="submit" className={stage.action === "off" ? "btn" : "btn btn-primary"} disabled={pending || !hydrated}>
              {pending ? "Checking…" : stage.action === "off" ? "Turn off two-step sign-in" : "Make new backup codes"}
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => (reset(), setStage({ kind: "ready", status: stage.status }))}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
