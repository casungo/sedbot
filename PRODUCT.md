# PRD — SedBot

Audit date: 2026-08-12
Status: Telegram Worker implementation; live bot behavior not triggered or independently verified.

## Intent

- Target users: Telegram users who need POSIX `sed`-style transformations on replied text, including guest-mode updates.
- Core job: parse a constrained sed script, apply it to replied text, and return the transformed message without filesystem access.
- Non-goals: arbitrary shell execution, file-backed transformations, chat-history indexing, or a public HTTP UI.

## Current maturity

### Shipped or verified in the repository

The README documents Telegram webhook handling, private/group/guest modes, addresses/ranges/groups/labels/hold space, commands/flags, and explicit file-backed-operation rejection. The Worker has a typecheck script and Cloudflare deployment configuration.

### Real-use evidence

No public HTTP route was used and no Telegram update was sent. Operational/deployed status is documented but actual bot delivery and parser behavior were not independently verified in this audit.

## Work state

- Completed: documented Worker/bot contract and parser implementation path.
- Active: maintenance/typechecking.
- Blocked: parser/security behavior has no repository test script or test suite visible in the checked source tree.
- Frozen/undecided: no file or shell execution scope is planned.

## Next action / owner decision

Add or run a small local fixture matrix for parser commands, ranges, malformed scripts, and guest-mode boundaries, then decide whether a controlled bot smoke is warranted; do not trigger the bot from this audit.

## Anti-slop audit

### Text

No confirmed copy defect at 75% confidence or higher. The README’s command and boundary descriptions are concrete despite the badge-heavy header.

### Code

Finding: the complex sed parser has no test script in [package.json](package.json#L5-L10) and no checked-in test files were found in the source tree. Impact: command parsing, malformed-input rejection, and guest-mode behavior lack a repeatable regression lock. Confidence: 92%. Suggested remediation: add focused local fixtures before expanding syntax or changing the trust boundary; no code changes were made.

### Design

Not applicable: Telegram bot, no owned visual product surface.

## Evidence sources

- [README.md](README.md)
- [package.json](package.json)
- `worker.ts`, parser/runtime source, and Wrangler configuration
- No Telegram or live HTTP state-changing action was performed.
