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
  onboardingComplete: boolean;
  lawyerId: string | null;
  createdAt: string;
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

export interface SubscriptionView {
  id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  seats: number;
  currentPeriodEnd: string | null;
  provider: string | null;
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
