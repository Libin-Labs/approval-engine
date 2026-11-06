# @lp-labs/approval-engine

A bounded in-memory quorum state machine for tracking approval requests and decisions. It is
bookkeeping logic only; it does not authenticate users or provide authorization.

## Install

```bash
npm install @lp-labs/approval-engine
```

ES2022 ESM and CommonJS builds include TypeScript declarations.

## Quickstart

```js
import { createApprovalEngine } from '@lp-labs/approval-engine';

const approvals = createApprovalEngine();
approvals.open({
  id: 'release-42',
  subject: 'Release build 42',
  approvers: ['alice', 'bob', 'carol'],
  requiredApprovals: 2,
});
approvals.decide('release-42', 'alice', 'approve');
const result = approvals.decide('release-42', 'bob', 'approve');
if (result.status !== 'approved') throw new Error('Quorum was not reached');
```

## API and customization

`createApprovalEngine({ maxRequests?, maxApproversPerRequest? })` defaults to 1,000 retained
requests and 100 approvers per request. `open(input)` creates a unique request with an ID, subject,
approver list, and optional required approval quorum (default: all approvers). `decide(id, approver,
decision)` accepts one `approve` or `reject` from each listed approver. A request becomes approved
once its quorum is reached, or rejected when the remaining possible approvals cannot meet quorum.
`cancel(id)` cancels a pending request. `get(id)` and `list()` return detached snapshots. `remove(id)`
releases a terminal request's capacity; pending requests cannot be removed.

IDs, subjects, and approver names are non-empty strings up to 256 characters. Approver identities
must be unique per request. Request capacity is configurable from 1 to 100,000 and per-request
approvers from 1 to 10,000.

## Limits and scope

Requests are held only in process memory and remain until removed; capacity exhaustion is explicit.
Transitions are synchronous and monotonic; terminal requests cannot be changed. The engine does not
verify that an approver is a real or authorized person, bind identity to credentials, persist audit
records, send notifications, expire requests, or coordinate across processes. Applications must
implement authorization and durable audit controls separately.

## Exports

Runtime export: `createApprovalEngine`.
TypeScript-only exports: `ApprovalStatus`, `ApprovalDecision`, `ApprovalRequestInput`,
`ApprovalRecord`, `ApprovalEngineOptions`, `ApprovalEngine`.

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
