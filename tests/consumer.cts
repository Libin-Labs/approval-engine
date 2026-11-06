import { createApprovalEngine } from '@lp-labs/approval-engine';

const engine = createApprovalEngine();
engine.open({ id: 'one', subject: 'One', approvers: ['user'] });
const requests: number = engine.list().length;
void requests;
