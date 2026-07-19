import type {
  AIChatRole,
  CasePartyRole,
  CaseStatus,
  CourtType,
  DocumentStatus,
  InvoiceStatus,
  NotificationChannel,
  NotificationType,
  PracticeArea,
  SubscriptionPlan,
  SubscriptionStatus,
  TemplateType,
  TimelineEventType,
  UserRole,
} from './enums.js';

// --- Generic envelopes ------------------------------------------------------

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
  path?: string;
  timestamp?: string;
}

// --- Auth -------------------------------------------------------------------

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: UserRole;
  lawyerId?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
  fullName: string | null;
  avatarUrl: string | null;
  /** Identity fields live on User (single source of truth). */
  phone: string | null;
  city: string | null;
  state: string | null;
  emailVerified: boolean;
  onboardingComplete: boolean;
  lawyerId: string | null;
  createdAt: string;
}

/**
 * Signup no longer returns tokens: the account is created unverified and a
 * one-time code is emailed. Tokens are issued by POST /auth/signup/verify.
 */
export interface SignupResult {
  email: string;
  verificationRequired: true;
}

export interface AuthResponse {
  user: PublicUser;
  tokens: AuthTokens;
}

// --- Profile ----------------------------------------------------------------

export interface LawyerProfileView {
  id: string;
  userId: string;
  fullName: string;
  phone: string | null;
  barCouncilId: string | null;
  enrollmentYear: number | null;
  experienceYears: number | null;
  practiceAreas: PracticeArea[];
  courts: string[];
  primaryCourtType: CourtType | null;
  city: string | null;
  state: string | null;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Cases ------------------------------------------------------------------

export interface CasePartyView {
  id: string;
  name: string;
  role: CasePartyRole;
  contactEmail: string | null;
  contactPhone: string | null;
  advocateName: string | null;
  isClient: boolean;
}

export interface TimelineEventView {
  id: string;
  type: TimelineEventType;
  title: string;
  description: string | null;
  eventDate: string;
  createdAt: string;
}

export interface CaseNoteView {
  id: string;
  body: string;
  authorId: string;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CaseSummaryView {
  id: string;
  title: string;
  caseNumber: string | null;
  cnr: string | null;
  court: string | null;
  courtType: CourtType | null;
  practiceArea: PracticeArea | null;
  status: CaseStatus;
  nextHearingDate: string | null;
  clientName: string | null;
  partyCount: number;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CaseDetailView extends CaseSummaryView {
  description: string | null;
  jurisdiction: string | null;
  filedAt: string | null;
  parties: CasePartyView[];
  timeline: TimelineEventView[];
  notes: CaseNoteView[];
}

/** Case details fetched from the eCourts registry by CNR, mapped to our domain. */
export interface CnrLookupView {
  cnr: string;
  title: string | null;
  caseNumber: string | null;
  court: string | null;
  courtType: CourtType | null;
  /** District/state the case is registered in, e.g. "Aurangabad, Maharashtra". */
  jurisdiction: string | null;
  practiceArea: PracticeArea | null;
  status: CaseStatus | null;
  statusRaw: string | null;
  caseTypeRaw: string | null;
  /** Human-readable case type from the registry's enum lookup, e.g. "Criminal Complaint Case". */
  caseTypeLabel: string | null;
  filedAt: string | null;
  nextHearingDate: string | null;
  decisionDate: string | null;
  petitioners: string[];
  respondents: string[];
  petitionerAdvocates: string[];
  respondentAdvocates: string[];
}

// --- Documents --------------------------------------------------------------

export interface DocumentView {
  id: string;
  caseId: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  version: number;
  hasOcr: boolean;
  downloadUrl: string | null;
  /** Set when status=ARCHIVED; the document is purged 30 days after this. */
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- AI ---------------------------------------------------------------------

export interface AIMessageView {
  id: string;
  role: AIChatRole;
  content: string;
  citations?: CitationView[];
  createdAt: string;
}

export interface AIChatView {
  id: string;
  title: string;
  caseId: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: AIMessageView[];
}

export interface CitationView {
  title: string;
  court: string | null;
  citation: string | null;
  judgementId: string | null;
}

export interface DraftView {
  id: string;
  title: string;
  content: string;
  caseId: string | null;
  templateType: TemplateType | null;
  citations: CitationView[];
  createdAt: string;
}

// --- Research / judgements --------------------------------------------------

export interface JudgementView {
  id: string;
  title: string;
  court: string | null;
  citation: string | null;
  decidedAt: string | null;
  summary: string | null;
  practiceArea: PracticeArea | null;
  url: string | null;
}

export interface SimilarCaseView extends JudgementView {
  score: number; // 0..1 cosine similarity
}

// --- Billing ----------------------------------------------------------------

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number; // INR
  amount: number; // INR
}

export interface InvoiceView {
  id: string;
  number: string;
  caseId: string | null;
  clientName: string | null;
  status: InvoiceStatus;
  currency: string;
  subtotal: number;
  gstPercent: number;
  gstAmount: number;
  total: number;
  items: InvoiceLineItem[];
  issuedAt: string | null;
  dueAt: string | null;
  createdAt: string;
}

/** Invoice as rendered on the public share page (no auth). */
export interface PublicInvoiceView extends InvoiceView {
  /** Display name of the advocate/firm that issued the invoice. */
  fromName: string | null;
}

/** Result of generating (or reusing) an invoice share link. */
export interface InvoiceShareResult {
  token: string;
  /** Absolute URL to the public invoice page. */
  url: string;
}

/** Result of sending an invoice to the client via a channel. */
export interface SendInvoiceResult {
  ok: boolean;
  channel: 'whatsapp' | 'email';
  /** The phone/email the invoice was sent to. */
  to: string;
  url: string;
}

export interface SubscriptionView {
  id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  seats: number;
  currentPeriodEnd: string | null;
  provider: string | null;
}

/**
 * Result of picking a plan during signup. `checkoutUrl` is set only for paid
 * plans when a payments provider is configured; otherwise the choice is
 * recorded and payment can be completed later from Settings.
 */
export interface SelectPlanResult {
  subscription: SubscriptionView;
  checkoutUrl: string | null;
}

// --- Notifications ----------------------------------------------------------

export interface NotificationView {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string | null;
  read: boolean;
  link: string | null;
  createdAt: string;
}

// --- Audit --------------------------------------------------------------------

/** One row of the account activity / audit trail. */
export interface AuditLogView {
  id: string;
  /** Machine-readable action slug, e.g. "case.status_change", "document.archive". */
  action: string;
  entityType: string | null;
  entityId: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

// --- Dashboard --------------------------------------------------------------

export interface DashboardStats {
  activeCases: number;
  hearingsThisWeek: number;
  pendingDocuments: number;
  outstandingInvoiceAmount: number;
  unreadNotifications: number;
}

export interface DashboardSummary {
  stats: DashboardStats;
  upcomingHearings: Array<{
    caseId: string;
    caseTitle: string;
    court: string | null;
    eventDate: string;
  }>;
  recentCases: CaseSummaryView[];
}
