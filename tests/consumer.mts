import { createApprovalEngine, type ApprovalRecord } from '@lp-labs/approval-engine';

const engine = createApprovalEngine({ maxRequests: 20 });
const request: ApprovalRecord = engine.open({
  id: 'change-1',
  subject: 'Change',
  approvers: ['a'],
});
const status: string = engine.decide(request.id, 'a', 'approve').status;
void status;
