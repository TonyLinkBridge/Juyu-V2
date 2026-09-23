import {normalizeCategoryIds} from '../categories/model.ts';
import {normalizeFieldSnapshots,type FieldSnapshot} from '../fields/model.ts';
import {qaForKind} from '../qa/metadata.ts';
import type {QaMetadata} from '../qa/model.ts';
import {normalizeDescription,normalizeReleaseNote,normalizePresentation,type ArticlePresentation} from './presentation.ts';
import { canManage, isSuperAdmin } from './access.ts';
import type { Audience, ContentKind, Document, Revision, Status, Viewer, Workflow } from './model.ts';

export interface DraftInput extends ArticlePresentation { categoryIds?:string[]; customFields?:FieldSnapshot[]; qa?:QaMetadata; id: string; title: string; description?:string; body: string; audience: Audience; kind: ContentKind }
export type Command =
  | ({ type: 'edit'; categoryIds?:string[]; customFields?:FieldSnapshot[]; qa?:QaMetadata; title: string; description?:string; body: string; audience: Audience } & ArticlePresentation)
  | { type: 'reject'; reason: string }
  | { type: 'submit' | 'withdraw' | 'reassign' | 'approve' | 'queue' | 'publish' }
  | { type:'direct_publish';englishQualityConfirmed?:boolean };
export interface CommandContext { expectedSequence: number; now: string; reviewer?: Viewer }

function requireAdmin(actor: Viewer | null): asserts actor is Viewer {
  if (!canManage(actor)) throw new Error('FORBIDDEN: 需要通过公司验证的管理员');
}

function validateContent(content: Pick<Revision, 'title' | 'body' | 'audience'>, kind: ContentKind) {
  if (typeof content.title !== 'string' || !content.title.trim() || typeof content.body !== 'string'
    || !['staff', 'ops', 'admin'].includes(content.audience)
    || !['article', 'ops', 'reference', 'qa'].includes(kind)
    || (kind === 'ops' && content.audience === 'staff')) {
    throw new Error('INVALID_CONTENT: 标题、正文、资料类型或可见范围不正确');
  }
}

function freshWorkflow(revisionId: number): Workflow {
  return { revisionId, status: 'draft', approvalMode:'standard', reviewerId: null, submittedBy: null, approvedBy: null };
}

function requireState(document: Document, allowed: Status[]) {
  if (!allowed.includes(document.workflow.status)) throw new Error('INVALID_STATE: 当前状态不允许此操作');
}

function requireReviewer(reviewer: Viewer | undefined, revision: Revision, submittedBy: string): asserts reviewer is Viewer {
  if (!reviewer || !canManage(reviewer)
    || [submittedBy, revision.authorId, revision.editorId].includes(reviewer.id)) {
    throw new Error('INVALID_REVIEWER: 请选择未编写或提交此版本的另一位管理员');
  }
}

function requireAssignedReviewer(document: Document, revision: Revision, actor: Viewer) {
  if (document.workflow.reviewerId !== actor.id
    || [document.workflow.submittedBy, revision.authorId, revision.editorId].includes(actor.id)) {
    throw new Error('NOT_REVIEWER: 只有指定二审管理员可以审核此版本');
  }
}

function requireApproval(document: Document, revision: Revision) {
  const workflow = document.workflow;
  if (!workflow.submittedBy || !workflow.approvedBy || workflow.approvedBy !== workflow.reviewerId
    || [workflow.submittedBy, revision.authorId, revision.editorId].includes(workflow.approvedBy)) {
    throw new Error('INVALID_APPROVAL: 当前版本没有有效的二审批准');
  }
}

export function createDocument(input: DraftInput, actor: Viewer | null, now: string): Document {
  requireAdmin(actor);
  validateContent(input, input.kind);
  if (typeof input.id !== 'string' || !input.id.trim()) throw new Error('INVALID_CONTENT: 缺少资料编号');
  return {
    id: input.id, kind: input.kind, sequence: 0, lifecycle: 'active', publishedRevisionId: null,
    revisions: [{ categoryIds:normalizeCategoryIds(input.categoryIds), customFields:normalizeFieldSnapshots(input.customFields), ...normalizePresentation(input), ...qaForKind(input.kind,input.qa), id: 1, title: input.title.trim(), description:normalizeDescription(input.description), releaseNote:normalizeReleaseNote(input.releaseNote), body: input.body, audience: input.audience, authorId: actor.id, editorId: actor.id, createdAt: now }],
    workflow: freshWorkflow(1),
    audit: [{ sequence: 0, action: 'create', actorId: actor.id, revisionId: 1, at: now, reviewerId: null, previousReviewerId: null, reason: null }],
  };
}

// Persistence must compare sequence and save the result plus audit in one transaction.
export function transition(document: Document, command: Command, actor: Viewer | null, context: CommandContext): Document {
  requireAdmin(actor);
  if (document.lifecycle !== 'active') throw new Error('INACTIVE_DOCUMENT: 资料已归档或移入回收站');
  if (!Number.isSafeInteger(context.expectedSequence) || document.sequence !== context.expectedSequence) {
    throw new Error('CONFLICT: 内容已经变化，请刷新后重试');
  }
  const revision = document.revisions.find((item) => item.id === document.workflow.revisionId);
  if (!revision) throw new Error('INVALID_CONTENT: 工作版本不存在');
  const next = structuredClone(document);
  const previousReviewerId = document.workflow.reviewerId;
  let reason: string | null = null;

  switch (command.type) {
    case 'edit': {
      requireState(document, ['draft', 'changes_requested', 'approved', 'queued', 'published']);
      validateContent(command, document.kind);
      const revisionId = Math.max(...document.revisions.map((item) => item.id)) + 1;
      const isNewDraft = ['approved', 'queued', 'published'].includes(document.workflow.status);
      const presentation=normalizePresentation({tags:command.tags===undefined?revision.tags:command.tags,cover:command.cover===undefined?revision.cover:command.cover,blocks:command.blocks===undefined?revision.blocks:command.blocks,iconKey:command.iconKey===undefined?revision.iconKey:command.iconKey});
      next.revisions.push({ categoryIds:normalizeCategoryIds(command.categoryIds===undefined?revision.categoryIds:command.categoryIds), customFields:normalizeFieldSnapshots(command.customFields===undefined?revision.customFields:command.customFields), ...presentation, ...qaForKind(document.kind,command.qa===undefined?revision.qa:command.qa),
        id: revisionId, title: command.title.trim(), description:normalizeDescription(command.description===undefined?revision.description:command.description), releaseNote:normalizeReleaseNote(command.releaseNote===undefined?revision.releaseNote:command.releaseNote), body: command.body, audience: command.audience,
        authorId: isNewDraft ? actor.id : revision.authorId, editorId: actor.id, createdAt: context.now,
      });
      next.workflow = freshWorkflow(revisionId);
      break;
    }
    case 'submit':
      requireState(document, ['draft', 'changes_requested']);
      requireReviewer(context.reviewer, revision, actor.id);
      next.workflow = { revisionId: revision.id, status: 'in_review', approvalMode:'standard', reviewerId: context.reviewer.id, submittedBy: actor.id, approvedBy: null };
      break;
    case 'withdraw':
      requireState(document, ['in_review']);
      next.workflow = freshWorkflow(revision.id);
      break;
    case 'reassign':
      requireState(document, ['in_review']);
      if (!document.workflow.submittedBy) throw new Error('INVALID_CONTENT: 缺少提交人');
      requireReviewer(context.reviewer, revision, document.workflow.submittedBy);
      next.workflow.reviewerId = context.reviewer.id;
      next.workflow.approvedBy = null;
      break;
    case 'reject':
      requireState(document, ['in_review']);
      requireAssignedReviewer(document, revision, actor);
      if (typeof command.reason !== 'string' || !command.reason.trim()) throw new Error('REASON_REQUIRED: 请填写退回原因');
      reason = command.reason.trim();
      next.workflow.status = 'changes_requested';
      next.workflow.approvedBy = null;
      break;
    case 'approve':
      requireState(document, ['in_review']);
      requireAssignedReviewer(document, revision, actor);
      next.workflow.status = 'approved';
      next.workflow.approvedBy = actor.id;
      break;
    case 'queue':
      requireState(document, ['approved']);
      requireApproval(document, revision);
      next.workflow.status = 'queued';
      break;
    case 'publish':
      requireState(document, ['queued']);
      requireApproval(document, revision);
      next.workflow.status = 'published';
      next.publishedRevisionId = revision.id;
      break;
    case 'direct_publish':
      requireState(document,['draft','changes_requested']);
      if(!isSuperAdmin(actor))throw new Error('FORBIDDEN: 只有 Super Admin 可以直接批准并发布');
      if(revision.editorId!==actor.id)throw new Error('FORBIDDEN: Super Admin 只能直接发布自己最后保存的版本');
      next.workflow={revisionId:revision.id,status:'published',approvalMode:'super_admin',submittedBy:actor.id,reviewerId:actor.id,approvedBy:actor.id};
      next.publishedRevisionId=revision.id;
      break;
    default:
      throw new Error('INVALID_COMMAND: 不支持的操作');
  }

  next.sequence += 1;
  next.audit.push({
    sequence: next.sequence, action: command.type, actorId: actor.id, revisionId: next.workflow.revisionId,
    at: context.now, reviewerId: next.workflow.reviewerId, previousReviewerId, reason,
  });
  return next;
}
