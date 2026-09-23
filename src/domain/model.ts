import type {FieldSnapshot} from '../fields/model.ts';
import type {QaMetadata} from '../qa/model.ts';
import type {ArticlePresentation} from './presentation.ts';
export type Role = 'support' | 'ops' | 'admin' | 'super_admin';
export type Audience = 'staff' | 'ops' | 'admin';
export type ContentKind = 'article' | 'ops' | 'reference' | 'qa';
export type Status = 'draft' | 'in_review' | 'changes_requested' | 'approved' | 'queued' | 'published';

// Construct only after server-side identity and company verification.
export interface Viewer {
  id: string;
  role: Role | null;
  companyVerified: boolean;
}

export interface Revision extends ArticlePresentation {
  description?:string;
  releaseNote?:string;
  categoryIds?:string[];
  customFields?:FieldSnapshot[];
  qa?:QaMetadata;
  id: number;
  title: string;
  body: string;
  audience: Audience;
  authorId: string;
  editorId: string;
  createdAt: string;
}

export interface Workflow {
  revisionId: number;
  status: Status;
  approvalMode: 'standard' | 'super_admin';
  submittedBy: string | null;
  reviewerId: string | null;
  approvedBy: string | null;
}

export interface AuditEntry {
  sequence: number;
  action: 'create' | 'edit' | 'submit' | 'withdraw' | 'reassign' | 'reject' | 'approve' | 'queue' | 'publish' | 'direct_publish' | 'trash' | 'restore' | 'archive' | 'unpublish' | 'unarchive' | 'restore_version';
  actorId: string;
  revisionId: number;
  at: string;
  reviewerId: string | null;
  previousReviewerId: string | null;
  reason: string | null;
}

export interface Document {
  id: string;
  kind: ContentKind;
  sequence: number;
  lifecycle: 'active' | 'archived' | 'trashed';
  publishedRevisionId: number | null;
  revisions: Revision[];
  workflow: Workflow;
  audit: AuditEntry[];
}
