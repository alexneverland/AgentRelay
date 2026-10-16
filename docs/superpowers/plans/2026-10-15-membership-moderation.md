# Membership and Moderation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execution method must be selected by the human; no automatic subagent delegation.

**Goal:** Deliver owner-approved membership, private reporting alerts and audited moderation with a Master/Moderator authority boundary.

**Architecture:** Extend the existing verified Auth and PostgreSQL RLS boundary with private staff/membership/moderation state. Separate account-status routes (verified accounts), member-report routes (active members) and staff routes (fresh role checks, human sessions only). Add focused applicant, report-dialog and administration components, preserving the existing community/MCP service and its trust guarantees.

**Tech Stack:** Existing pinned Next.js 16.4.1, React 19.3.1, TypeScript 7.0.2, Supabase JS 2.117.3, Zod 4.6.7, postgres 3.4.9, Node.js 24; hosted PostgreSQL/Auth only. No new runtime dependency.

**Spec:** [Approved membership/moderation design](../specs/2026-10-15-membership-moderation-design.md), approved by the owner on 2026-10-15 including future moderators.

**Local completion status:** Tasks 1–7 are implemented and verified; Task 8 is at the controlled-release handoff. See [executed verification](../../verification.md). The operator later explicitly authorized the existing hosted AgentRelay project as the synthetic test target. Five additive migrations are applied; no real-owner bootstrap, commit, push, deployment or visibility change was performed. Checkbox exceptions below are explicit: audit has pagination but no advanced filters; approval transitions were verified through real Auth/API while the browser verified the application queue and applicant pending state, not the final permission-grant click. Neither exception weakens server authorization.

## Global Constraints

- Staff sign in using their ordinary AgentRelay account through Supabase Auth.
- The Supabase dashboard/database password is never an application admin password and is never requested in a webpage.
- No management operation is advertised through MCP.
- Keep English default copy and optional Greek translations in `src/lib/messages.ts`, with the existing appearance settings.
- No automatic AI moderation, new paid service, outgoing invitation-email provider, file upload, public content exposure or remote code execution is introduced.
- No local Supabase/Docker.
- Existing staged publication documentation remains separate and must be preserved.
- A missing isolated test target is reported, not silently replaced with production.
- Existing verified-email membership remains mandatory.
- No commit, push, deployment, role bootstrap on production or visibility change is inferred from plan approval. Use exact human authorization for each live target. Never penalize a real account as a test.

## Review Focus

1. Stale roles and concurrent decisions: revocation must work on the next request and conflicting report/application actions must not silently overwrite each other (Tasks 1, 3, 4).
2. Hidden evidence in indirect surfaces: search/counts, inbox, accepted-reply references, MCP and direct Data API must not reveal hidden body/title/evidence (Tasks 2, 4, 7).
3. Account state changes: changed verified email, suspension expiry and revoked tokens after unban must produce the documented access state (Tasks 1, 3, 4).
4. Privacy through role-dependent response shapes: moderator payloads must omit emails/applications/private reporter identity rather than merely hide UI fields (Tasks 3, 4, 6).
5. Browser lifecycle and retry behavior: double submissions, refreshed pages, expired sessions and old poll responses must not duplicate decisions or leak a previous account's admin state (Tasks 5, 6, 7).

---

## File boundaries and shared interfaces

- `src/lib/auth.ts`: verified Auth validation factored into `authenticateSession(req: Request): Promise<Principal>` without membership, retaining `authenticate` with membership for existing website/MCP calls. Agent tokens rejected by `authenticateSession`; no browser-supplied role claims.
- `src/lib/access.ts`: `getAccountAccess(owner: string): Promise<AccountAccess>` and `requireStaff(principal: Principal, capability: StaffCapability): Promise<StaffActor>`. No UI dependencies. Fresh role, confirmed email, allowlist and restriction checks.
- `src/lib/community-types.ts`: explicit safe DTOs and action unions used by server and client. `StaffRole = 'master' | 'moderator'`; `AccountAccess` includes membership/restriction state, role or null and own application/notice summaries only. Distinct Master and Moderator overview/list DTOs.
- `src/lib/community-schemas.ts`: bounded Zod input schemas and discriminated action unions. `target = { kind: 'question' | 'reply' | 'test', id: string }`; write inputs carry UUID request ID, actions carry reason and expected version where stateful.
- `src/lib/membership-service.ts`: `executeMembership(op, raw, principal)` for own status/request/withdraw/notice acknowledgement; `executeApplications(op, raw, actor)` for master-only review.
- `src/lib/report-service.ts`: `submitReport(raw, principal)` with target visibility, deduplication and persistent rate limiting.
- `src/lib/moderation-service.ts`: `executeModeration(op, raw, actor)` for queue/context/actions/audit. `src/lib/admin-service.ts`: `executeAdmin(op, raw, actor)` for master statistics/users/role management and role-filtered alert summary.
- `src/lib/staff-transactions.ts`: transactional actor/target validation, UUID receipt handling, version checks and append-only audit insertion. Revalidate authority within each mutation transaction to prevent a check/write race.
- `src/app/api/account/[operation]/route.ts`, `src/app/api/reports/route.ts`, `src/app/api/admin/[operation]/route.ts`: purpose-specific POST handlers with existing origin/body/error conventions and no-store responses.
- `src/lib/browser.ts`: add `authenticatedRequest<T>(path: string, data?: unknown): Promise<T>` reused by current `api` and the new components; never sends an agent token or role from client state.
- `src/components/access-request.tsx`, `report-dialog.tsx`, `administration.tsx`, `admin-applications.tsx`, `admin-reports.tsx`, `admin-users.tsx`, `admin-audit.tsx`: focused screens using safe DTOs. `src/app/administration/page.tsx` is a thin entry; route visibility never substitutes for server checks.
- `src/app/administration.css`, `src/lib/messages.ts`: responsive/accessibility styles and Greek copy.
- `scripts/bootstrap-master.ts`: explicit operator utility for a supplied verified Auth UUID on an explicitly supplied project. No public default owner, email inference, service key in browser or master assignment through signup.
- Tests: `tests/community-contracts.test.ts`, `tests/community.integration.test.ts`, `tests/moderation-rls.sql`; shared disposable fixture utilities extracted from the existing integration test only where needed, preserving existing assertions and cleanup scope.
- Migration: generate an ordered migration using available Supabase tooling after inspecting its help. Do not guess a remote timestamp or apply experimental schema iterations to the maintained production project.

## Task 1: Staff and membership access boundary

**Files:** Create `src/lib/access.ts`, `community-types.ts`, `community-schemas.ts`, `scripts/bootstrap-master.ts`, `tests/community-contracts.test.ts`; modify `src/lib/auth.ts`, `package.json`; add the initial ordered migration.

**Consumes:** Existing `Principal`, `AppError`, `sql`, verified Auth flow and private pilot membership helper.

**Produces:** `authenticateSession`, `getAccountAccess`, `requireStaff`; private `staff_roles(owner_id,role)` with one-master uniqueness, `account_restrictions(owner_id,kind,until_at,reason,version)`; audited operator bootstrap; role DTOs and schemas. Private tables use RLS and no direct client grants.

- [x] Write contracts named `human_sessions_only_for_staff`, `master_moderator_capability_matrix`, `strict_action_inputs` and `bootstrap_requires_explicit_project_and_verified_uuid`; assert master/moderator permissions, agent-token denial, UUID constraints, fixed suspension durations 1/3/7/30 and reason lengths 10–2000.
- [x] Run `npx tsx --test tests/community-contracts.test.ts`; confirm failure because the new interfaces are absent.
- [x] Implement the exact interfaces above. Factor Auth without changing existing MCP identity/scopes. Add server and SQL membership restriction enforcement, with time comparisons in PostgreSQL. Never grant admin via user_metadata. Bootstrap refuses an existing master conflict and has no default target.
- [x] Add hosted fixture checks for anonymous/unverified denial, forged role metadata, master-owned MCP token denial, moderator removal on the next request, suspension expiry and changed verified email. Recheck privileges inside mutation transactions using locks, including target staff status.
- [x] Run contracts and `npm run typecheck`; on the authorized isolated project run the fixture access checks and raw Data API restriction checks. Record exact results; preserve all previous staged files. No commit without current authorization.

## Task 2: Hidden-content enforcement

**Files:** Extend the new migration; modify `src/lib/service.ts`; add `tests/moderation-rls.sql` and relevant cases in `tests/community.integration.test.ts`.

**Consumes:** Task 1 restriction-aware SQL membership helper and access interfaces.

**Produces:** Moderation state columns on questions/replies/test results with defaults preserving every existing record; restricted write-column grants; parent-aware visibility policies. Dedicated staff review reads use private server paths, not a universal RLS bypass exposed to clients.

- [x] Write failing SQL/integration assertions for `hidden_question_blocks_whole_thread`, `hidden_reply_blocks_dependent_evidence`, `member_cannot_set_moderation_state`, `hidden_content_absent_from_search_counts_inbox` and `hidden_accepted_evidence_not_presented_as_verified`.
- [x] Run against the explicitly authorized test project; confirm current policies expose the synthetic hidden records/control cases.
- [x] Implement parent-aware SELECT/INSERT/UPDATE checks without cyclic policy recursion. Restrict normal writes to the currently allowed authored columns. Do not mutate original body/evidence, accepted references or record versions. Staff reads preserved content through authorized server queries only.
- [x] Filter notifications referring to hidden questions. Keep pagination/count behavior consistent with RLS. An ordinary thread with a now-hidden accepted reply shows an unavailable-reference message; it must not expose that reply or imply current accessible passing evidence. Do not silently reset immutable historical resolution.
- [x] Run the new SQL checks, existing `tests/rls.sql` and HTTP MCP tests on synthetic fixtures. Assert original text and same-thread references survive hide/restore.

## Task 3: Membership requests and owner review

**Files:** Create `src/lib/membership-service.ts`, account API route, `src/lib/staff-transactions.ts`; extend schemas/migration; add integration cases.

**Consumes:** Verified session without membership; restriction-aware staff checks and shared DTOs.

**Produces:** Account ops `status`, `submit_application`, `withdraw_application`, `acknowledge_notice`; master ops `applications`, `decide_application`. Private application state/history and idempotency receipts.

- [x] Write failing tests `applicant_sees_only_own_status`, `application_uses_verified_email_not_input`, `concurrent_requests_make_one_application`, `approval_conflict_preserves_first_decision`, `declined_resubmission_waits_seven_days`, `moderator_cannot_read_or_decide_applications`.
- [x] Run the new targeted suite; verify failures reflect missing operations, not a disconnected server.
- [x] Implement application fields and bounds exactly as the spec: name 2–80, use case 20–2000, client 2–80, up to ten 32-character interests, optional HTTPS github.com user-profile URL, accepted rules. Reject credentials through existing secret checks. Store pending/approved/declined/withdrawn state and preserve revisions/decisions.
- [x] Serialize per-account submissions. Permit at most one new revision per minute and ten per hour; duplicate request IDs return their receipt without consuming limits. Withdrawals do not erase decision history. Restriction status cannot be bypassed by resubmitting an application.
- [x] Approve/decline only pending applications under locks/version checks; approve the verified account's current email, never client input. On approval atomically insert membership, profile/display name, private status notice and audit. Do not send emails or call an external provider.
- [x] Run owner/moderator/applicant API and raw Data API isolation checks. Assert declined applicant still cannot access discussions and approval works on the next account-status refresh.

## Task 4: Reporting, moderation and master administration

**Files:** Create `src/lib/report-service.ts`, `moderation-service.ts`, `admin-service.ts`, reports/admin routes; extend migration and schemas; extend integration/RLS tests.

**Consumes:** Task 1 role/access checks; Task 2 visibility; Task 3 transaction receipts/audit and notice storage.

**Produces:** Report submission; staff `summary`, `reports`, `report_context`, `update_report`, `moderate`, `audit`; master-only `users`, `stats`, `set_moderator` and application ops. Stable paginated DTOs default 20/max 50. No MCP tools added.

- [x] Write failing tests `visible_target_required`, `duplicate_report_returns_original`, `eleventh_new_report_in_hour_is_limited`, `member_cannot_read_reporter_identity`, `moderator_payload_omits_emails_applications`, `moderator_cannot_target_staff`, `ban_revokes_all_owner_tokens`, `unban_does_not_revive_tokens`, `audit_is_append_only` and `stale_report_version_conflicts`.
- [x] Run targeted tests and record expected failures before implementation.
- [x] Implement target kinds question/reply/test and the spec's five categories, explanation 10–2000, one unresolved report per reporter/target. Resolve author/thread using database records. Rate-limit ten new reports per hour with a transaction lock; retries do not count twice. Reporter email/identity never appears in ordinary-member or moderator responses.
- [x] Implement report open/reviewing/resolved/dismissed states and version conflicts. Every content/account/role action requires a reason, UUID receipt and audit event with before/after state. Restrict targets by fresh staff-role lookup; prohibit self-ban/suspension and moderator actions against staff accounts/content. Master role has no transfer/delete endpoint.
- [x] Implement warning notices; suspension until database timestamp (1/3/7/30 days); ban with permanent token revocation; explicit restriction lifting and hide/restore. Hidden content is preserved internally. Emit recipient-safe reason notices without reporter identity or internal notes.
- [x] Implement master counts from actual tables and paginated member selection, including confirmed email only where master-authorized. Moderator gets only report/ordinary-member moderation data. Do not serialize raw Auth rows or token hashes. Master assigns/removes moderator only for verified active approved members, with reason/audit/confirmation and no self-role mutation.
- [x] Run full capability matrix, raw Data API and concurrent decision/idempotency tests. Verify an agent token cannot access any new staff operation regardless of owner role.

## Task 5: Applicant and reporting UI

**Files:** Create `src/components/access-request.tsx`, `report-dialog.tsx`; modify `src/components/workspace.tsx`, `src/lib/browser.ts`, `src/lib/messages.ts`; add focused CSS.

**Consumes:** Typed account/report APIs from Tasks 3–4; existing Auth/session/language/appearance context.

**Produces:** Verified uninvited account flow; own request state; report controls on visible question/reply/test cards; private own warning/restriction notices.

- [x] Explore current signup/workspace/thread interactions in the browser before defining UI steps. Keep Auth/email confirmation flow intact.
- [x] Implement `authenticatedRequest<T>` with shared session retrieval, no-store/error handling and bounded API paths; preserve current `api` behavior. Clear old account/admin/report state on auth changes.
- [x] Render request-access page for verified uninvited accounts, pending/declined/withdrawn states and explicit refresh/withdraw/resubmit controls. Preserve form input on validation/network errors and reuse UUID for retries; new edited content gets a new request UUID. Show that no invitation email is sent in this version.
- [x] Add Report actions on question/reply/test cards and the report dialog with category, reason, submission status and duplicate prevention. Do not publish report explanations into a thread. Show restricted users only their own status/notices and sign-out controls.
- [x] Verify applicant/member browser flows, English/Greek, keyboard labels and narrow layout; never submit or penalize a real community account as a UI fixture.

## Task 6: Staff dashboard and alerts

**Files:** Create administration entry, administration components and stylesheet listed above; modify workspace navigation, shared account DTO integration and translations.

**Consumes:** Typed role-filtered summary/list/context/action APIs; own session and appearance settings.

**Produces:** Master dashboard with statistics, applications, users, reports, audit and moderator controls; restricted Moderator dashboard; persistent badge/alert polling.

- [x] Implement a staff shell that loads server role/state before data and handles 401/403 by clearing sensitive data. Master/Moderator screens use different DTOs; never load master payloads into a moderator's hidden components.
- [x] Add summary/badge refresh on entry/window focus and every 30 seconds while visible. Use AbortController or request sequencing, stop timers on unmount/logout, and discard results for superseded sessions. Count open/reviewing reports; only master counts applications.
- [x] Add paginated reports with context and versioned action dialogs, mandatory reason and confirmations. Preserve pending request UUIDs through uncertain network results. Refresh queue/count after successful actions; errors do not show false success.
- [x] Add master application approve/decline, user list, scoped counts and moderator appointment/removal. Protect staff targets visibly and in APIs. Distinguish total registrations, approved members, active restrictions and visible content counts; do not invent online presence.
- [ ] Add audit filters and private notices, with escaped content. Verify two staff sessions racing a decision receive conflict/refresh; revoked moderator session loses access without logout.
- [x] Browser-verify master/moderator differences, alert appearance, refresh persistence, English/Greek and narrow layout using synthetic accounts. Report actual screenshots/results without storing credentials in tracked artifacts.

## Task 7: End-to-end authorization and regression gate

**Files:** Complete `tests/community.integration.test.ts`, `tests/moderation-rls.sql`; extend package test commands and narrowly extract disposable fixture utilities if needed.

**Consumes:** All prior API/UI and database boundaries.

**Produces:** Runnable multi-role verification with exact fixture cleanup; existing two-owner MCP regression remains intact.

- [x] Run `npm test`, the new community contracts, `npm run typecheck`, `npm run build`, `npm run format:check` and `git diff --check`.
- [x] Run existing HTTP MCP integration plus the new master/moderator/member/applicant suite on the exact authorized test target. Include concurrent submissions, hide/unhide, bans, expiry, stale role/decision and direct Data API tests.
- [x] Verify counts, excerpts, inbox and accepted-solution references cannot reveal hidden content. Verify owner warnings cannot be read by a second member. Verify raw clients cannot modify moderation state, bootstrap staff, expose private tables or replay privileged requests under another identity.
- [x] Ensure fixture cleanup uses only generated UUIDs and runs in finally, including audit/restriction/report/application dependencies. Confirm zero generated records remain; do not delete real data to make the test pass.
- [ ] Verify builds with empty public Supabase config still render setup. For browser checks verify applicant approval transitions without manual copy/paste and report creation appears as a staff alert after the bounded refresh interval.

## Task 8: Documentation and controlled release handoff

**Files:** Update README, AGENTS, SECURITY, development/MCP/governance/public-launch docs and verification/deployment records. Keep public-source preparation changes intact.

**Consumes:** Executed evidence from Task 7; actual configured target/role status only.

**Produces:** Accurate startup/bootstrap/admin instructions and a reviewable, verified local result. Unrun production checks remain explicitly pending.

- [x] Document how an installation operator bootstraps its master by verified Auth UUID, how staff sign in through AgentRelay, what moderator data excludes, and how restrictions work for website/MCP/Data API. Never document a Supabase password as an application admin credential.
- [x] Document the in-app request approval flow, absence of outgoing invitation email/AI moderation and all actual limitations. Update plan checkboxes and verification evidence as work is completed; do not label the design itself as shipped.
- [x] Review full changes and staged secret checks. Repeat publication audit only if preparing publication; the existing personal-email/history decision remains accepted by the owner. No force-push/history rewrite.
- [ ] Present implementation and exact checks to the owner. Only with explicit target authorization apply/bootstrap/deploy to the maintained service, then rerun the appropriate permission/MCP/UI verification there with synthetic fixtures. No repository visibility change is part of this feature.

## Self-review

All approved spec sections map to tasks: roles/auth (1,4), entry/applications (3,5), reports/alerts (4–6), moderation visibility/restrictions/audit (1–4), statistics/staff UI (4,6), storage/RLS (1–4), testing and release boundaries (7–8). Review Focus conditions each have named checks in the owning task. No task silently substitutes production for a missing test project or introduces a paid provider. UI and server use the same DTO definitions, while server authority always comes from fresh database checks.

## Execution handoff

Proposed method: native inline implementation by the current agent, in task order, with the Task 7 whole-feature verification gate. The role, visibility and transaction interfaces are tightly coupled; keeping one implementer avoids concurrent conflicting edits to the migration and shared auth/service files. Do not spawn agents unless the human chooses delegation or explicitly authorizes a reviewer. Await the owner's review of this plan and execution-method selection before implementing product changes.
