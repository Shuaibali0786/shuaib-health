# Feature Specification: Admin two-step sign-in (authenticator app)

**Feature Branch**: `011-admin-two-factor`
**Created**: 2026-11-07
**Status**: Draft
**Input**: User description: "Admin two-factor login (TOTP, authenticator app) for admin accounts, optional per user, with backup codes, and all events in the Activity log. If it needs a production database migration: build and test the PR, but do NOT merge. STOP and explain the exact migration steps and the risk."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An admin turns on two-step sign-in (Priority: P1)

An admin opens their account security page, chooses "Turn on two-step sign-in", confirms their password, scans a QR code with an authenticator app on their phone (or types the setup key), and enters the 6-digit code the app shows. Two-step sign-in is now on. The screen shows 10 backup codes once, with a clear warning to save them.

**Why this priority**: Nothing else works until an account can be enrolled. It is the smallest slice that protects an account.

**Independent Test**: Enrol a test admin; the account shows "Two-step sign-in: on" and the Activity log shows "Two-step sign-in turned on".

**Acceptance Scenarios**:

1. **Given** an admin with two-step sign-in off, **When** they confirm their password and enter a correct code from the app, **Then** two-step sign-in is on, 10 backup codes are shown once, and the Activity log records it.
2. **Given** setup has started, **When** the admin enters a wrong code, **Then** two-step sign-in stays off, they can try again, and the setup key stays the same for 15 minutes, so the app entry they already added keeps working.
3. **Given** setup has started, **When** the admin leaves without finishing, **Then** two-step sign-in stays off and the next attempt shows a new setup key.
4. **Given** the wrong current password, **When** the admin starts setup, **Then** setup does not start and nothing changes.

---

### User Story 2 - Signing in with a code (Priority: P1)

An admin with two-step sign-in on enters their email and password as usual. Instead of the dashboard, they see a second step that asks for the 6-digit code from their app. A correct code opens the dashboard. A link "Use a backup code instead" accepts one of their backup codes; each backup code works only once.

**Why this priority**: This is the protection itself. A stolen password alone no longer opens the dashboard.

**Independent Test**: With an enrolled account, a correct password alone does not create a session; the password plus a valid code does.

**Acceptance Scenarios**:

1. **Given** an enrolled admin, **When** they enter the right password, **Then** no session is created yet and the code step is shown.
2. **Given** the code step, **When** they enter the current code, **Then** they are signed in and the Activity log shows a normal sign-in.
3. **Given** the code step, **When** they enter a code that was already used, **Then** it is refused ("this code was already used, wait for the next one").
4. **Given** the code step, **When** they enter a wrong code 5 times, **Then** the step ends, they must start again with the password, and repeated failures lock the account the same way wrong passwords do.
5. **Given** the code step, **When** they wait more than 5 minutes, **Then** the step expires and they start again.
6. **Given** a backup code, **When** it is used once, **Then** it signs them in, the Activity log records "backup code used", and the same code is refused afterwards.
7. **Given** an account without two-step sign-in, **When** they sign in, **Then** nothing changes from today.

---

### User Story 3 - Lost phone: an admin resets another person's two-step sign-in (Priority: P2)

A staff member loses their phone and their backup codes. Another admin opens Staff, chooses the person, and selects "Reset two-step sign-in". The person's two-step sign-in is turned off, their sessions are signed out, and they can sign in with the password and enrol again.

**Why this priority**: Without a recovery path, a lost phone locks a person out for good.

**Independent Test**: Admin A resets admin B's two-step sign-in. B can then sign in with the password only, and the Activity log shows "Two-step sign-in reset" with A as the actor and B as the target.

**Acceptance Scenarios**:

1. **Given** admin A and admin B with two-step sign-in on, **When** A resets B, **Then** B's two-step sign-in is off, B's backup codes are deleted, B's sessions end, and the log records it.
2. **Given** an admin, **When** they try to reset their own two-step sign-in from Staff, **Then** it is refused (they use the turn-off flow, which needs a code).
3. **Given** the only admin has lost their phone and codes, **When** the operator runs the documented command-line reset, **Then** two-step sign-in is turned off for that account and the action is logged as a system action.

---

### User Story 4 - Turning it off, and new backup codes (Priority: P3)

An admin can turn two-step sign-in off, or get a fresh set of backup codes, after confirming their password and a current code. New codes replace all old ones.

**Why this priority**: Needed for a complete feature, but not for protection.

**Independent Test**: Regenerate codes; the old codes no longer work and the new ones do. Turn off; sign-in asks for the password only.

**Acceptance Scenarios**:

1. **Given** two-step sign-in is on, **When** the admin confirms the password and a current code and chooses "Turn off", **Then** it is off, the secret and codes are deleted, and the log records it.
2. **Given** two-step sign-in is on, **When** the admin chooses "New backup codes" with the password and a current code, **Then** 10 new codes are shown once and all earlier codes stop working.
3. **Given** a wrong password or code, **When** the admin tries either action, **Then** nothing changes and the failure is logged.

---

### Edge Cases

- Phone clock is a little off: a code from the step just before or after the current one is accepted. Older or newer codes are not.
- The same code is entered twice within its 30 seconds (replay): the second use is refused.
- Two code-step attempts race: only one can succeed, and the code is used once.
- An account is deactivated or its password is reset while a code step is open: the code step fails.
- The protection key setting is missing on the server: setup is not offered. Accounts that already use two-step sign-in cannot finish signing in, and an operator must restore the key or reset the accounts. Sign-in never falls back to "password only".
- The demo viewer is read-only and never sees setup or reset controls.
- A receptionist cannot start setup (it is offered to admins in this version), but an enrolled account that is later changed to receptionist keeps two-step sign-in.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: An admin MUST be able to turn on two-step sign-in for their own account with a standard authenticator app (time-based 6-digit codes, a 30-second step), using a QR code or a setup key typed by hand.
- **FR-002**: Setup MUST require the current password to start, and a correct code from the app to finish. It is not on until it is finished.
- **FR-003**: Finishing setup MUST show 10 single-use backup codes once. Only a protected form of each code is stored, so nobody, including the clinic, can see them again.
- **FR-004**: Sign-in for an enrolled account MUST be two steps. The password alone MUST NOT create a session. The second step lasts at most 5 minutes and allows at most 5 wrong codes.
- **FR-005**: The code step MUST accept the current code and the codes for one step before and one step after, and MUST refuse a code for a time step that was already used for that account.
- **FR-006**: Wrong codes MUST count toward the same account lockout used for wrong passwords.
- **FR-007**: A backup code MUST work once, and only in place of the app code.
- **FR-008**: An admin MUST be able to turn two-step sign-in off, or replace the backup codes, after confirming both the password and a current code (or backup code).
- **FR-009**: An admin MUST be able to reset another staff member's two-step sign-in. This turns it off, deletes their codes, and ends their sessions. An admin MUST NOT be able to reset their own from Staff.
- **FR-010**: An operator MUST have a documented command-line reset for when no admin can sign in.
- **FR-011**: The Activity log MUST record each of these events, with the actor, target and outcome but never a code, secret or password:
  - turned on
  - turned off
  - code step failed
  - backup code used
  - backup codes replaced
  - reset by an admin
  - reset by the operator
- **FR-012**: The secret behind each account's codes MUST be stored encrypted with a server-side key, never in plain form, and never returned after setup.
- **FR-013**: Setup MUST be offered only when the server has its protection key. Whether or not the key is present, an enrolled account MUST never be let in with the password alone.
- **FR-014**: Staff (admin view) MUST show whether each person has two-step sign-in on.
- **FR-015**: The public demo MUST stay read-only. No setup, reset or code screens act on demo data.
- **FR-016**: All new screens MUST work on a phone, with a keyboard and with a screen reader. The code field supports one-time-code autofill.

### Key Entities

- **Staff account (extended)**: adds whether two-step sign-in is on and since when, the encrypted secret (or a pending one during setup), and the last time step used.
- **Backup code**: belongs to one staff account. Holds the protected form of the code, when it was created and when it was used.
- **Sign-in challenge**: the short-lived second step after a correct password. It holds the account, a one-time token (protected form only), the expiry, the wrong-code count and when it was used.
- **Activity entry**: the existing audit log, with the new event names.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can turn on two-step sign-in in under 2 minutes from the security page.
- **SC-002**: With two-step sign-in on, 100% of sign-in attempts with the correct password but no valid code are refused, in automated tests.
- **SC-003**: A code or backup code works at most once, verified by automated tests for both.
- **SC-004**: Every listed event appears in the Activity log within the same request, and no log row or error report contains a code, secret or password (automated check).
- **SC-005**: Accounts without two-step sign-in sign in exactly as before; all existing sign-in tests stay green.
- **SC-006**: A locked-out admin is back in within 5 minutes using the admin reset or the documented operator reset.

## Assumptions

- **A-1** Offered to admins only in this version, as asked. An account that becomes a receptionist keeps it. Offering it to receptionists is a question for Shuaib.
- **A-2** Optional, never forced. A "require for all admins" switch is a later question.
- **A-3** Standard authenticator settings (6 digits, 30 seconds, ±1 step) work with every common authenticator app.
- **A-4** A new server-side protection key setting is needed for encryption. The owner adds it in Vercel; it is a generated random value, not a paid service or an API key. Until it exists, setup is not offered (the feature switch).
- **A-5** A database migration is needed: new columns on staff accounts, two new tables, and new allowed audit actions. It is additive, with a tested downgrade. **It is not run on production without Shuaib's approval**, and the PR is not merged before that.
- **A-6** Backup codes are 10 characters from a 32-letter alphabet without look-alike characters, shown in two groups of 5.
- **A-7** A code step that expires or fails 5 times needs a new password entry.

## Out of Scope

- SMS or email codes, passkeys/WebAuthn, "remember this device", forcing two-step sign-in for everyone.
- Two-step sign-in for patients (there are no patient accounts).
