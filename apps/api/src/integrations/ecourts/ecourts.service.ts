import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CaseStatus, CourtType, type CnrLookupView } from '@anura/shared';
import type { AppConfig } from '../../config/configuration';

/**
 * Shape of the eCourtsIndia partner API response we consume
 * (GET /api/partner/case/{cnr}). Only the fields we map are declared.
 */
interface EcourtsCaseResponse {
  data?: {
    courtCaseData?: {
      cnr?: string;
      courtName?: string;
      caseNumber?: string;
      caseType?: string;
      caseTypeRaw?: string;
      caseStatus?: string;
      filingNumber?: string;
      filingDate?: string;
      registrationNumber?: string;
      registrationDate?: string;
      nextHearingDate?: string;
      decisionDate?: string;
      petitioners?: string[];
      respondents?: string[];
      petitionerAdvocates?: string[];
      respondentAdvocates?: string[];
    };
    entityInfo?: {
      nextDateOfHearing?: string;
    };
  };
}

/**
 * eCourts registry lookups (CNR -> case details) via ecourtsindia.com.
 * The client is config-driven so the API boots without keys; calling a
 * method without a configured provider throws a clear 503.
 */
@Injectable()
export class EcourtsService {
  private readonly logger = new Logger(EcourtsService.name);

  constructor(private readonly config: ConfigService) {}

  private get cfg(): AppConfig['ecourts'] {
    return this.config.get<AppConfig['ecourts']>('ecourts')!;
  }

  get enabled(): boolean {
    return this.cfg.provider === 'ecourtsindia' && !!this.cfg.apiToken;
  }

  async fetchCaseByCnr(cnrRaw: string): Promise<CnrLookupView> {
    // CNRs are frequently written with hyphens/spaces (MHAU01-003198-2016);
    // the registry expects the bare 16-character form.
    const cnr = cnrRaw.trim().toUpperCase().replace(/[\s-]/g, '');
    if (!/^[A-Z0-9]{10,30}$/.test(cnr)) {
      throw new BadRequestException('Enter a valid CNR number');
    }

    if (this.cfg.provider !== 'ecourtsindia') {
      throw new ServiceUnavailableException(
        'eCourts lookup is not configured (ECOURTS_PROVIDER=none)',
      );
    }
    if (!this.cfg.apiToken) {
      throw new ServiceUnavailableException('ECOURTS_API_TOKEN is not configured');
    }

    const url = `${this.cfg.apiUrl.replace(/\/$/, '')}/api/partner/case/${encodeURIComponent(cnr)}`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${this.cfg.apiToken}` },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      this.logger.error(`eCourts request failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException('Could not reach the eCourts service');
    }

    if (res.status === 404) {
      throw new NotFoundException('No case found for this CNR');
    }
    if (res.status === 400 || res.status === 422) {
      throw new BadRequestException('The eCourts service rejected this CNR');
    }
    if (!res.ok) {
      this.logger.error(`eCourts lookup ${res.status}: ${await res.text()}`);
      throw new ServiceUnavailableException('eCourts lookup failed, try again later');
    }

    let body: EcourtsCaseResponse;
    try {
      body = (await res.json()) as EcourtsCaseResponse;
    } catch {
      this.logger.error('eCourts returned a non-JSON 2xx response');
      throw new ServiceUnavailableException('eCourts returned an unexpected response');
    }
    const cc = body.data?.courtCaseData;
    if (!cc) {
      throw new NotFoundException('No case found for this CNR');
    }
    return this.toView(cnr, cc, body.data?.entityInfo);
  }

  private toView(
    cnr: string,
    cc: NonNullable<NonNullable<EcourtsCaseResponse['data']>['courtCaseData']>,
    entity?: NonNullable<EcourtsCaseResponse['data']>['entityInfo'],
  ): CnrLookupView {
    const petitioners = (cc.petitioners ?? []).filter(Boolean);
    const respondents = (cc.respondents ?? []).filter(Boolean);
    const title =
      petitioners.length && respondents.length
        ? `${titleCase(petitioners[0])} v. ${titleCase(respondents[0])}`
        : null;

    return {
      cnr: cc.cnr ?? cnr,
      title,
      caseNumber: cc.registrationNumber ?? cc.filingNumber ?? cc.caseNumber ?? null,
      court: cc.courtName ?? null,
      courtType: inferCourtType(cc.courtName),
      status: mapStatus(cc.caseStatus),
      statusRaw: cc.caseStatus ?? null,
      caseTypeRaw: cc.caseTypeRaw ?? cc.caseType ?? null,
      filedAt: toIso(cc.filingDate ?? cc.registrationDate),
      nextHearingDate: toIso(entity?.nextDateOfHearing ?? cc.nextHearingDate),
      petitioners,
      respondents,
      petitionerAdvocates: (cc.petitionerAdvocates ?? []).filter(Boolean),
      respondentAdvocates: (cc.respondentAdvocates ?? []).filter(Boolean),
    };
  }
}

function toIso(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapStatus(status: string | undefined): CaseStatus | null {
  switch ((status ?? '').toUpperCase()) {
    case 'DISPOSED':
      return CaseStatus.DISPOSED;
    case 'PENDING':
      return CaseStatus.ACTIVE;
    default:
      return null;
  }
}

function inferCourtType(courtName: string | undefined): CourtType | null {
  if (!courtName) return null;
  const name = courtName.toLowerCase();
  if (name.includes('supreme court')) return CourtType.SUPREME_COURT;
  if (name.includes('high court')) return CourtType.HIGH_COURT;
  if (name.includes('tribunal')) return CourtType.TRIBUNAL;
  if (name.includes('consumer')) return CourtType.CONSUMER_FORUM;
  if (name.includes('district') || name.includes('magistrate') || name.includes('sessions')) {
    return CourtType.DISTRICT_COURT;
  }
  return CourtType.OTHER;
}

/** eCourts returns party names in ALL CAPS; make them presentable. */
function titleCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\b(Mr|Mrs|Ms|Dr|M\/s)\b/gi, (m) => `${m[0].toUpperCase()}${m.slice(1).toLowerCase()}`)
    .trim();
}
