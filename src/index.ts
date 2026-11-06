export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type ApprovalDecision = 'approve' | 'reject';

export interface ApprovalRequestInput {
  readonly id: string;
  readonly subject: string;
  readonly approvers: readonly string[];
  readonly requiredApprovals?: number;
}

export interface ApprovalRecord {
  readonly id: string;
  readonly subject: string;
  readonly approvers: readonly string[];
  readonly requiredApprovals: number;
  readonly status: ApprovalStatus;
  readonly decisions: readonly { readonly approver: string; readonly decision: ApprovalDecision }[];
}

export interface ApprovalEngineOptions {
  readonly maxRequests?: number;
  readonly maxApproversPerRequest?: number;
}

export interface ApprovalEngine {
  readonly size: number;
  open(input: ApprovalRequestInput): ApprovalRecord;
  decide(id: string, approver: string, decision: ApprovalDecision): ApprovalRecord;
  cancel(id: string): ApprovalRecord;
  get(id: string): ApprovalRecord | undefined;
  list(): readonly ApprovalRecord[];
  remove(id: string): boolean;
}

interface MutableApproval {
  readonly id: string;
  readonly subject: string;
  readonly approvers: readonly string[];
  readonly requiredApprovals: number;
  status: ApprovalStatus;
  readonly decisions: { readonly approver: string; readonly decision: ApprovalDecision }[];
}

const DEFAULT_MAX_REQUESTS = 1_000;
const DEFAULT_MAX_APPROVERS = 100;
const MAX_REQUESTS = 100_000;
const MAX_APPROVERS = 10_000;

function validateText(value: string, field: string): void {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 256) {
    throw new TypeError(`${field} must be a non-empty string of at most 256 characters`);
  }
}

function snapshot(record: MutableApproval): ApprovalRecord {
  return {
    ...record,
    approvers: [...record.approvers],
    decisions: record.decisions.map((decision) => ({ ...decision })),
  };
}

/** In-memory quorum bookkeeping only; this does not authenticate or authorize people. */
export function createApprovalEngine(options: ApprovalEngineOptions = {}): ApprovalEngine {
  const maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const maxApprovers = options.maxApproversPerRequest ?? DEFAULT_MAX_APPROVERS;
  if (!Number.isSafeInteger(maxRequests) || maxRequests < 1 || maxRequests > MAX_REQUESTS) {
    throw new RangeError(`maxRequests must be between 1 and ${MAX_REQUESTS}`);
  }
  if (!Number.isSafeInteger(maxApprovers) || maxApprovers < 1 || maxApprovers > MAX_APPROVERS) {
    throw new RangeError(`maxApproversPerRequest must be between 1 and ${MAX_APPROVERS}`);
  }
  const records = new Map<string, MutableApproval>();
  const requireRecord = (id: string): MutableApproval => {
    const record = records.get(id);
    if (!record) throw new Error(`Unknown approval request: ${id}`);
    return record;
  };
  return {
    get size() {
      return records.size;
    },
    open(input) {
      if (typeof input !== 'object' || input === null)
        throw new TypeError('Request input is required');
      validateText(input.id, 'id');
      validateText(input.subject, 'subject');
      if (records.has(input.id)) throw new Error(`Duplicate approval request: ${input.id}`);
      if (records.size >= maxRequests) throw new RangeError('Approval engine is at capacity');
      if (
        !Array.isArray(input.approvers) ||
        input.approvers.length === 0 ||
        input.approvers.length > maxApprovers
      ) {
        throw new RangeError(`approvers must contain between 1 and ${maxApprovers} entries`);
      }
      const approvers = input.approvers.map((approver) => {
        validateText(approver, 'approver');
        return approver;
      });
      if (new Set(approvers).size !== approvers.length)
        throw new TypeError('Approvers must be unique');
      const required = input.requiredApprovals ?? approvers.length;
      if (!Number.isSafeInteger(required) || required < 1 || required > approvers.length) {
        throw new RangeError('requiredApprovals must be between 1 and the number of approvers');
      }
      const record: MutableApproval = {
        id: input.id,
        subject: input.subject,
        approvers,
        requiredApprovals: required,
        status: 'pending',
        decisions: [],
      };
      records.set(record.id, record);
      return snapshot(record);
    },
    decide(id, approver, decision) {
      const record = requireRecord(id);
      validateText(approver, 'approver');
      if (record.status !== 'pending') throw new Error(`Approval request is ${record.status}`);
      if (decision !== 'approve' && decision !== 'reject') throw new TypeError('Invalid decision');
      if (!record.approvers.includes(approver)) throw new Error('Approver is not in this request');
      if (record.decisions.some((entry) => entry.approver === approver)) {
        throw new Error('Approver has already decided');
      }
      record.decisions.push({ approver, decision });
      const approved = record.decisions.filter((entry) => entry.decision === 'approve').length;
      const rejected = record.decisions.length - approved;
      if (approved >= record.requiredApprovals) {
        record.status = 'approved';
      } else if (rejected > record.approvers.length - record.requiredApprovals) {
        record.status = 'rejected';
      }
      return snapshot(record);
    },
    cancel(id) {
      const record = requireRecord(id);
      if (record.status !== 'pending') throw new Error(`Approval request is ${record.status}`);
      record.status = 'cancelled';
      return snapshot(record);
    },
    get(id) {
      const record = records.get(id);
      return record ? snapshot(record) : undefined;
    },
    list() {
      return [...records.values()].map(snapshot);
    },
    remove(id) {
      const record = records.get(id);
      if (!record) return false;
      if (record.status === 'pending') throw new Error('Pending requests cannot be removed');
      return records.delete(id);
    },
  };
}
