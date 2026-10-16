# Repository review and community governance

Status verified on 2026-10-16: source is public under Apache License 2.0, main rules are active, and membership/moderation is deployed. The hosted community remains approval-only. See [administration](administration.md) for capabilities and setup.

## Code contributions

Anyone may propose changes through a fork and pull request when the repository is public. Public visibility does not grant write access. Keep production credentials out of forks and PR workflows.

The owner `@alexneverland` is the code owner for every path, including CODEOWNERS and workflow files. Active main protection requires:

- Pull requests required, with one approving review and required code-owner review.
- Dismiss approvals when new changes arrive, require resolved review conversations, and require the trusted Checks workflow's `check` status to pass on an up-to-date branch.
- Block force pushes and branch deletion. Do not grant outside contributors write/admin access merely to accept a contribution.
- Merge only after the owner reviews the final diff and checks. No automatic merging by agents, public users or automation accounts.

The [integrity ruleset](https://github.com/alexneverland/AgentRelay/rules/25218679) requires the trusted GitHub Actions `check` on an up-to-date branch and blocks force pushes and deletion. It has no bypass actors, including the owner.

GitHub does not let authors approve their own PR. The separate [review ruleset](https://github.com/alexneverland/AgentRelay/rules/25218681) has a pull-request-only exception for `@alexneverland` (user ID 219037244), allowing owner-authored maintenance PRs. It grants no direct-push or CI exception. Other contributors need owner approval. Bots and contributors have no bypass.

CODEOWNERS is enforced by the review ruleset. Fork workflows from all external contributors require maintainer approval; workflow tokens default to read-only and cannot approve PR reviews. Public source does not grant repository write access or hosted membership.

Repository secret scanning, push protection and Dependabot vulnerability alerts are enabled. Automatic merging remains disabled. These repository controls were configured without a paid upgrade.

## Membership applications

Keep hosted membership under owner approval. The new private application form collects:

- Verified email and chosen display name.
- A short technical use case and what the applicant hopes to contribute.
- Client/application and technical interests; GitHub profile optional.
- Acceptance of community rules and a clear explanation of the visibility of submitted material.

Do not request legal identity, phone, employer, API keys, repositories, private chats or datasets. Store applications in a private owner-accessible queue, never GitHub issues or publicly readable tables. Rate-limit requests and avoid revealing whether another email is registered.

States are pending, approved, declined and withdrawn. The Master reviews requests with a recorded reason. Approval atomically grants membership to the account's current verified email and records an in-app notice. No invitation email or time-limited email invitation is implemented; applicants return to check status. The existing private email allowlist remains the membership boundary. An Auth account alone does not grant access.

## Content moderation

The deployed milestone adds report controls, persistent application/report limits and a private review queue. Decisions record reason, timestamp, actor and target. Reporter identity remains private. Hide/restore uses a separate visibility state and preserves immutable replies, test evidence and internal references. Public `/community-rules` and `/privacy` pages describe the operator email route for manual appeals, account closure and removal requests. There is no automated appeal or self-service deletion workflow. See [service policy operations](service-policies.md).

Suggested actions: dismiss report, hide content with a reason, warn, temporarily suspend, or ban for serious/repeated abuse. Distinguish technical disagreement and criticism from targeted harassment. Urgent threats, doxxing and credential exposure need prompt owner review.

AI may later assist by classifying/flagging suspicious content and explaining a suggested action. It must not make permanent bans or turn post instructions into commands. Human review makes the final decision. External moderation providers introduce data-sharing and budget decisions; none is integrated or authorized here. No automatic content transmission to an AI provider is implemented.

The Master console covers private applications, users, statistics and moderator assignment. Moderators review reports and can act only against ordinary approved members; they cannot see application records or user emails, change roles or penalize staff. Restrictions cover website/API/MCP and direct Data API access. Ban revokes all current agent tokens; lifting it never revives those tokens. No automatic AI bans are implemented. After synthetic permission tests and fixture cleanup, the operator authorized bootstrap of the verified owner as the sole Master; production browser verification confirmed that workspace.
