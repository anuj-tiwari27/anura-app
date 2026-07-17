/**
 * Domain enums shared across the API and web app.
 * Values MUST stay in sync with the Prisma enums of the same name
 * (apps/api/prisma/schema.prisma).
 */

function labelFrom(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export const UserRole = {
  LAWYER: 'LAWYER',
  ADMIN: 'ADMIN',
  STAFF: 'STAFF',
  CLIENT: 'CLIENT',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const CourtType = {
  SUPREME_COURT: 'SUPREME_COURT',
  HIGH_COURT: 'HIGH_COURT',
  DISTRICT_COURT: 'DISTRICT_COURT',
  TRIBUNAL: 'TRIBUNAL',
  CONSUMER_FORUM: 'CONSUMER_FORUM',
  OTHER: 'OTHER',
} as const;
export type CourtType = (typeof CourtType)[keyof typeof CourtType];

export const PracticeArea = {
  CIVIL: 'CIVIL',
  CRIMINAL: 'CRIMINAL',
  CORPORATE: 'CORPORATE',
  FAMILY: 'FAMILY',
  PROPERTY: 'PROPERTY',
  TAXATION: 'TAXATION',
  CONSTITUTIONAL: 'CONSTITUTIONAL',
  LABOUR: 'LABOUR',
  INTELLECTUAL_PROPERTY: 'INTELLECTUAL_PROPERTY',
  BANKING: 'BANKING',
  ARBITRATION: 'ARBITRATION',
  OTHER: 'OTHER',
} as const;
export type PracticeArea = (typeof PracticeArea)[keyof typeof PracticeArea];

export const CaseStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  ON_HOLD: 'ON_HOLD',
  DISPOSED: 'DISPOSED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type CaseStatus = (typeof CaseStatus)[keyof typeof CaseStatus];

export const CasePartyRole = {
  PETITIONER: 'PETITIONER',
  RESPONDENT: 'RESPONDENT',
  PLAINTIFF: 'PLAINTIFF',
  DEFENDANT: 'DEFENDANT',
  APPELLANT: 'APPELLANT',
  APPELLEE: 'APPELLEE',
  COMPLAINANT: 'COMPLAINANT',
  ACCUSED: 'ACCUSED',
  THIRD_PARTY: 'THIRD_PARTY',
  OTHER: 'OTHER',
} as const;
export type CasePartyRole = (typeof CasePartyRole)[keyof typeof CasePartyRole];

export const TimelineEventType = {
  HEARING: 'HEARING',
  FILING: 'FILING',
  ORDER: 'ORDER',
  NOTE: 'NOTE',
  STATUS_CHANGE: 'STATUS_CHANGE',
  DOCUMENT_ADDED: 'DOCUMENT_ADDED',
  REMINDER: 'REMINDER',
  OTHER: 'OTHER',
} as const;
export type TimelineEventType = (typeof TimelineEventType)[keyof typeof TimelineEventType];

export const DocumentStatus = {
  UPLOADED: 'UPLOADED',
  PROCESSING: 'PROCESSING',
  OCR_DONE: 'OCR_DONE',
  INDEXED: 'INDEXED',
  FAILED: 'FAILED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

export const InvoiceStatus = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  CANCELLED: 'CANCELLED',
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const SubscriptionPlan = {
  FREE: 'FREE',
  SOLO: 'SOLO',
  TEAM: 'TEAM',
  FIRM: 'FIRM',
} as const;
export type SubscriptionPlan = (typeof SubscriptionPlan)[keyof typeof SubscriptionPlan];

export const SubscriptionStatus = {
  TRIALING: 'TRIALING',
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  CANCELLED: 'CANCELLED',
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const NotificationType = {
  CASE_UPDATE: 'CASE_UPDATE',
  HEARING_REMINDER: 'HEARING_REMINDER',
  DOCUMENT_READY: 'DOCUMENT_READY',
  INVOICE: 'INVOICE',
  SYSTEM: 'SYSTEM',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const NotificationChannel = {
  IN_APP: 'IN_APP',
  EMAIL: 'EMAIL',
  WHATSAPP: 'WHATSAPP',
  PUSH: 'PUSH',
} as const;
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const AIChatRole = {
  USER: 'USER',
  ASSISTANT: 'ASSISTANT',
  SYSTEM: 'SYSTEM',
} as const;
export type AIChatRole = (typeof AIChatRole)[keyof typeof AIChatRole];

export const AIIntent = {
  DRAFTING: 'DRAFTING',
  CASE_SEARCH: 'CASE_SEARCH',
  RESEARCH: 'RESEARCH',
  TIMELINE: 'TIMELINE',
  GENERAL: 'GENERAL',
} as const;
export type AIIntent = (typeof AIIntent)[keyof typeof AIIntent];

export const TemplateType = {
  PETITION: 'PETITION',
  NOTICE: 'NOTICE',
  AGREEMENT: 'AGREEMENT',
  AFFIDAVIT: 'AFFIDAVIT',
  REPLY: 'REPLY',
  OTHER: 'OTHER',
} as const;
export type TemplateType = (typeof TemplateType)[keyof typeof TemplateType];

/** Human-readable label maps for dropdowns / badges. */
export const Labels = {
  UserRole: Object.fromEntries(Object.values(UserRole).map((v) => [v, labelFrom(v)])) as Record<UserRole, string>,
  CourtType: Object.fromEntries(Object.values(CourtType).map((v) => [v, labelFrom(v)])) as Record<CourtType, string>,
  PracticeArea: Object.fromEntries(
    Object.values(PracticeArea).map((v) => [v, labelFrom(v)]),
  ) as Record<PracticeArea, string>,
  CaseStatus: Object.fromEntries(Object.values(CaseStatus).map((v) => [v, labelFrom(v)])) as Record<CaseStatus, string>,
  CasePartyRole: Object.fromEntries(
    Object.values(CasePartyRole).map((v) => [v, labelFrom(v)]),
  ) as Record<CasePartyRole, string>,
  TimelineEventType: Object.fromEntries(
    Object.values(TimelineEventType).map((v) => [v, labelFrom(v)]),
  ) as Record<TimelineEventType, string>,
  DocumentStatus: Object.fromEntries(
    Object.values(DocumentStatus).map((v) => [v, labelFrom(v)]),
  ) as Record<DocumentStatus, string>,
  InvoiceStatus: Object.fromEntries(
    Object.values(InvoiceStatus).map((v) => [v, labelFrom(v)]),
  ) as Record<InvoiceStatus, string>,
  SubscriptionPlan: Object.fromEntries(
    Object.values(SubscriptionPlan).map((v) => [v, labelFrom(v)]),
  ) as Record<SubscriptionPlan, string>,
};
