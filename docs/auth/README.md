# Auth V2

Auth V2 foundations exist, but the running application still uses legacy Neon authentication. Do not infer runtime completion from migration or test-harness coverage.

Read these files in order:

1. [`STATUS.md`](STATUS.md) - current runtime truth, completed foundations, and active slice.
2. [`AUTH_V2_CONTRACT.md`](AUTH_V2_CONTRACT.md) - durable security and product boundaries.
3. [`IMPLEMENTATION.md`](IMPLEMENTATION.md) - the single lean delivery plan and acceptance criteria.
4. [`OPERATIONS.md`](OPERATIONS.md) - commands and release constraints.

There are intentionally no separate gate matrix, decision ledger, historical audit, or evidence archive. Durable decisions are in the contract, open choices are in status, acceptance checks are beside the work, and detailed history remains in git and CI.

The immediate objective is not another framework: it is one real browser signup/login that produces an opaque session, provisions one product user, crosses the typed Next-to-Go boundary, and returns `ViewerBootstrapV1`.