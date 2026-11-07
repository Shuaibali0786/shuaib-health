# Specification Analysis Report: 011 admin two-step sign-in

| ID | Category | Severity | Location(s) | Summary | Recommendation / resolution |
|----|----------|----------|-------------|---------|----------------|
| F1 | Inconsistency | HIGH | contracts/two-factor-api.md (sign-in, verify rows) | The contract says the lock is 423, but `app/errors.py` maps `account_locked` to **429** | Use 429 `account_locked` everywhere. **Fixed in the contract.** |
| C1 | Underspecification | MEDIUM | spec US1 scenario 2 vs data-model (15 min) | The spec says the setup key "stays the same until finished or cancelled"; the data model replaces a pending secret after 15 min | Spec now says the key stays the same for 15 minutes. **Fixed.** |
| D1 | Constitution (II/VI) | MEDIUM | contract policy SELF_STAFF | SELF_STAFF is exempt from "must change password", so a person still on a temporary password could enrol | Setup refuses with 409 `password_change_required` while `must_change_password` is true. **Added to the contract and T008.** |
| E1 | Coverage | MEDIUM | FR-016 vs tasks | axe was planned only for the sign-in step, not for the Security page or the Staff reset dialog | **T018 extended**: axe on Security and Staff reset |
| E2 | Coverage | LOW | SC-001, SC-006 | Time-to-complete criteria are checked manually, not automated | Record a manual check in results.md (T031) |
| F2 | Terminology | LOW | spec ("two-step sign-in") vs plan/API ("two-factor", 2FA) | Intentional: plain words in the UI, technical names in code | Keep; the UI copy uses "two-step sign-in" |
| D2 | Constitution (VI) | LOW | plan Complexity Tracking | Reversible storage applies to the TOTP secret, not to passwords | Justified in Complexity Tracking; ADR-0014 (T029) |
| D3 | Constitution (XI) | LOW | plan | The feature switch is "key present" rather than a boolean flag | Acceptable: no key means no enrolment (default off); documented in research R6 |

## Coverage summary

| Requirement | Has task? | Task IDs |
|---|---|---|
| FR-001 enrol with app | yes | T003, T008, T011 |
| FR-002 password to start, code to finish | yes | T008, T010 |
| FR-003 10 backup codes, shown once, hashed | yes | T004, T008, T010 |
| FR-004 two-step sign-in, 5 min, 5 tries | yes | T013, T015 |
| FR-005 ±1 step, replay | yes | T003, T013, T015 |
| FR-006 shared lockout | yes | T013, T015 |
| FR-007 backup code single use | yes | T013, T015 |
| FR-008 disable / regenerate | yes | T023–T025 |
| FR-009 admin reset, not self | yes | T019, T021, T022 |
| FR-010 operator reset | yes | T020, T021, T030 |
| FR-011 audit events, no secrets | yes | T007, T010, T015, T021, T024, T026 |
| FR-012 encrypted secret | yes | T004, T005 |
| FR-013 key switch, never password-only | yes | T002, T015 |
| FR-014 staff status | yes | T019, T022 |
| FR-015 demo read-only | yes | T010 |
| FR-016 phone, keyboard, screen reader | yes | T011, T016, T018 |

**Metrics**:
- Requirements: 16. Tasks: 32. Coverage: 100%.
- Ambiguities: 1 (C1, fixed). Duplications: 0. Critical: 0.

**Next actions**: no critical issues; F1, C1, D1 and E1 were fixed in the artifacts. Proceed to implementation.
