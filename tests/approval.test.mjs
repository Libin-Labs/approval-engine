import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createApprovalEngine } from '../dist/esm/index.js';

const request = (id = 'r1', values = {}) => ({
  id,
  subject: 'Publish release',
  approvers: ['alice', 'bob', 'carol'],
  ...values,
});

test('opens a request and approves when its quorum is reached', () => {
  const engine = createApprovalEngine();
  assert.equal(engine.open(request('r', { requiredApprovals: 2 })).status, 'pending');
  assert.equal(engine.decide('r', 'alice', 'approve').status, 'pending');
  const approved = engine.decide('r', 'bob', 'approve');
  assert.equal(approved.status, 'approved');
  assert.equal(approved.decisions.length, 2);
});

test('rejects once remaining possible votes cannot meet quorum', () => {
  const engine = createApprovalEngine();
  engine.open(request('r', { requiredApprovals: 2 }));
  engine.decide('r', 'alice', 'reject');
  assert.equal(engine.decide('r', 'bob', 'reject').status, 'rejected');
});

test('defaults the quorum to every listed approver', () => {
  const engine = createApprovalEngine();
  const created = engine.open(request());
  assert.equal(created.requiredApprovals, 3);
  engine.decide('r1', 'alice', 'approve');
  engine.decide('r1', 'bob', 'approve');
  assert.equal(engine.get('r1').status, 'pending');
  assert.equal(engine.decide('r1', 'carol', 'approve').status, 'approved');
});

test('rejects duplicate, unlisted, repeated, and invalid decisions', () => {
  const engine = createApprovalEngine();
  engine.open(request('r', { requiredApprovals: 1 }));
  assert.throws(() => engine.decide('r', 'nobody', 'approve'), /not in this request/);
  assert.throws(() => engine.decide('r', 'alice', 'maybe'), /Invalid decision/);
  engine.decide('r', 'alice', 'reject');
  assert.throws(() => engine.decide('r', 'alice', 'approve'), /already decided/);
});

test('validates unique approvers, quorum, and nonempty input', () => {
  const engine = createApprovalEngine();
  assert.throws(() => engine.open(request('x', { approvers: ['a', 'a'] })), /unique/);
  assert.throws(() => engine.open(request('x', { approvers: [] })), /approvers/);
  assert.throws(() => engine.open(request('x', { requiredApprovals: 4 })), /requiredApprovals/);
  assert.throws(() => engine.open(request('x', { subject: ' ' })), /subject/);
});

test('cancels pending requests and allows removal only after terminal state', () => {
  const engine = createApprovalEngine();
  engine.open(request());
  assert.throws(() => engine.remove('r1'), /Pending/);
  assert.equal(engine.cancel('r1').status, 'cancelled');
  assert.equal(engine.remove('r1'), true);
  assert.equal(engine.get('r1'), undefined);
  assert.equal(engine.remove('r1'), false);
});

test('terminal requests cannot be decided or cancelled again', () => {
  const engine = createApprovalEngine();
  engine.open(request('r', { requiredApprovals: 1 }));
  engine.decide('r', 'alice', 'approve');
  assert.throws(() => engine.decide('r', 'bob', 'approve'), /approved/);
  assert.throws(() => engine.cancel('r'), /approved/);
});

test('returns detached records from create, get, and list', () => {
  const engine = createApprovalEngine();
  const opened = engine.open(request());
  opened.approvers[0] = 'mutated';
  const listed = engine.list();
  listed[0].decisions.push({ approver: 'fake', decision: 'approve' });
  assert.equal(engine.get('r1').approvers[0], 'alice');
  assert.deepEqual(engine.get('r1').decisions, []);
});

test('bounds retained request count and releases capacity on terminal removal', () => {
  const engine = createApprovalEngine({ maxRequests: 1 });
  engine.open(request('first'));
  assert.throws(() => engine.open(request('second')), /capacity/);
  engine.cancel('first');
  engine.remove('first');
  assert.equal(engine.open(request('second')).id, 'second');
});

test('validates configured bounds and maximum approvers', () => {
  for (const maxRequests of [0, -1, 100_001]) {
    assert.throws(() => createApprovalEngine({ maxRequests }), /maxRequests/);
  }
  assert.throws(
    () => createApprovalEngine({ maxApproversPerRequest: 0 }),
    /maxApproversPerRequest/,
  );
  const engine = createApprovalEngine({ maxApproversPerRequest: 1 });
  assert.throws(() => engine.open(request('r', { approvers: ['a', 'b'] })), /approvers/);
});

test('rejects unknown request identifiers explicitly', () => {
  const engine = createApprovalEngine();
  assert.throws(() => engine.decide('missing', 'alice', 'approve'), /Unknown approval request/);
  assert.throws(() => engine.cancel('missing'), /Unknown approval request/);
});

test('CommonJS exposes the same bounded state machine', () => {
  const api = createRequire(import.meta.url)('@lp-labs/approval-engine');
  const engine = api.createApprovalEngine();
  engine.open(request());
  assert.equal(engine.cancel('r1').status, 'cancelled');
});
