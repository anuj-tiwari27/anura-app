import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CaseStatus, CourtType, PracticeArea, type CnrLookupView } from '@anura/shared';
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
      cnrCourtCode?: string;
      courtComplexCode?: string;
      district?: string;
      state?: string;
      caseNumber?: string;
      caseType?: string;
      caseTypeRaw?: string;
      caseStatus?: string;
      /** e.g. "Criminal Law/Other Criminal Matters"; string[] on some endpoints. */
      caseCategoryFacetPath?: string | string[];
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
    /** Registry code -> human label lookups (caseType, courtCode, ...). */
    descriptions?: {
      enumLookup?: Record<string, Record<string, string>>;
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
    return this.toView(cnr, cc, body.data?.entityInfo, body.data?.descriptions?.enumLookup);
  }

  private toView(
    cnr: string,
    cc: NonNullable<NonNullable<EcourtsCaseResponse['data']>['courtCaseData']>,
    entity?: NonNullable<EcourtsCaseResponse['data']>['entityInfo'],
    enumLookup?: Record<string, Record<string, string>>,
  ): CnrLookupView {
    const petitioners = (cc.petitioners ?? []).filter(Boolean);
    const respondents = (cc.respondents ?? []).filter(Boolean);
    const title =
      petitioners.length && respondents.length
        ? `${titleCase(petitioners[0])} v. ${titleCase(respondents[0])}`
        : null;

    // courtName is empty for some registries (e.g. e-Jagriti consumer
    // commissions); the enum lookup still carries the court label.
    const courtCode = cc.cnrCourtCode ?? cc.courtComplexCode;
    const court =
      cc.courtName ?? (courtCode ? (enumLookup?.courtCode?.[courtCode] ?? null) : null);

    const caseTypeRaw = cc.caseTypeRaw ?? cc.caseType ?? null;
    const caseTypeLabel =
      (cc.caseType ? enumLookup?.caseType?.[cc.caseType] : undefined) ?? caseTypeRaw;

    const status = mapStatus(cc.caseStatus);
    const decisionDate = toIso(cc.decisionDate);
    // For disposed cases the registry repeats the final hearing under
    // nextHearingDate; that is history, not an upcoming hearing.
    const nextHearingDate =
      status === CaseStatus.DISPOSED
        ? null
        : toIso(entity?.nextDateOfHearing ?? cc.nextHearingDate);

    return {
      cnr: cc.cnr ?? cnr,
      title,
      caseNumber: cc.registrationNumber ?? cc.filingNumber ?? cc.caseNumber ?? null,
      court,
      courtType: inferCourtType(court, cc.caseType),
      jurisdiction: buildJurisdiction(cc.district, cc.state),
      practiceArea: inferPracticeArea(cc.caseCategoryFacetPath),
      status,
      statusRaw: cc.caseStatus ?? null,
      caseTypeRaw,
      caseTypeLabel,
      filedAt: toIso(cc.filingDate ?? cc.registrationDate),
      nextHearingDate,
      decisionDate,
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

function inferCourtType(
  courtName: string | null | undefined,
  caseType: string | undefined,
): CourtType | null {
  // e-Jagriti case types (CC_JAGRITI, FA_JAGRITI, ...) are consumer
  // commission matters even when the court name is missing.
  if (caseType?.toUpperCase().includes('JAGRITI')) return CourtType.CONSUMER_FORUM;
  if (!courtName) return null;
  const name = courtName.toLowerCase();
  if (name.includes('supreme court')) return CourtType.SUPREME_COURT;
  if (name.includes('high court')) return CourtType.HIGH_COURT;
  if (name.includes('tribunal') || name.includes('nclt') || name.includes('nclat')) {
    return CourtType.TRIBUNAL;
  }
  if (name.includes('consumer') || name.includes('redressal commission')) {
    return CourtType.CONSUMER_FORUM;
  }
  if (name.includes('district') || name.includes('magistrate') || name.includes('sessions')) {
    return CourtType.DISTRICT_COURT;
  }
  return CourtType.OTHER;
}

/** ISO 3166-2:IN codes as returned in courtCaseData.state. */
const STATE_NAMES: Record<string, string> = {
  AN: 'Andaman and Nicobar Islands',
  AP: 'Andhra Pradesh',
  AR: 'Arunachal Pradesh',
  AS: 'Assam',
  BR: 'Bihar',
  CH: 'Chandigarh',
  CT: 'Chhattisgarh',
  CG: 'Chhattisgarh',
  DD: 'Daman and Diu',
  DL: 'Delhi',
  DN: 'Dadra and Nagar Haveli',
  GA: 'Goa',
  GJ: 'Gujarat',
  HP: 'Himachal Pradesh',
  HR: 'Haryana',
  JH: 'Jharkhand',
  JK: 'Jammu and Kashmir',
  KA: 'Karnataka',
  KL: 'Kerala',
  LA: 'Ladakh',
  LD: 'Lakshadweep',
  MH: 'Maharashtra',
  ML: 'Meghalaya',
  MN: 'Manipur',
  MP: 'Madhya Pradesh',
  MZ: 'Mizoram',
  NL: 'Nagaland',
  OD: 'Odisha',
  OR: 'Odisha',
  PB: 'Punjab',
  PY: 'Puducherry',
  RJ: 'Rajasthan',
  SK: 'Sikkim',
  TN: 'Tamil Nadu',
  TR: 'Tripura',
  TS: 'Telangana',
  TG: 'Telangana',
  UK: 'Uttarakhand',
  UT: 'Uttarakhand',
  UP: 'Uttar Pradesh',
  WB: 'West Bengal',
};

function buildJurisdiction(district: string | undefined, state: string | undefined): string | null {
  const stateName = state ? (STATE_NAMES[state.toUpperCase()] ?? state) : null;
  const parts = [district?.trim(), stateName].filter(Boolean) as string[];
  if (!parts.length) return null;
  // "New Delhi, Delhi" reads worse than "New Delhi".
  if (parts.length === 2 && parts[1].toLowerCase().includes(parts[0].toLowerCase())) {
    return parts[1];
  }
  return [...new Set(parts)].join(', ');
}

/**
 * Conservative map of the registry's case-category facet (first path
 * segment, e.g. "Criminal Law/Other Criminal Matters") to our practice
 * areas. Unknown categories return null so the lawyer picks one.
 */
function inferPracticeArea(facetPath: string | string[] | undefined): PracticeArea | null {
  const first = Array.isArray(facetPath) ? facetPath[0] : facetPath;
  if (!first) return null;
  const category = first.split('/')[0]?.toLowerCase() ?? '';
  if (!category || category.includes('not specified')) return null;
  if (category.includes('criminal')) return PracticeArea.CRIMINAL;
  if (category.includes('matrimonial') || category.includes('family')) return PracticeArea.FAMILY;
  if (category.includes('property') || category.includes('land') || category.includes('rent')) {
    return PracticeArea.PROPERTY;
  }
  if (category.includes('tax')) return PracticeArea.TAXATION;
  if (category.includes('labour') || category.includes('labor') || category.includes('industrial')) {
    return PracticeArea.LABOUR;
  }
  if (category.includes('constitutional') || category.includes('writ')) {
    return PracticeArea.CONSTITUTIONAL;
  }
  if (category.includes('company') || category.includes('corporate') || category.includes('commercial')) {
    return PracticeArea.CORPORATE;
  }
  if (category.includes('banking') || category.includes('negotiable') || category.includes('recovery')) {
    return PracticeArea.BANKING;
  }
  if (category.includes('arbitration')) return PracticeArea.ARBITRATION;
  if (category.includes('intellectual') || category.includes('trademark') || category.includes('patent') || category.includes('copyright')) {
    return PracticeArea.INTELLECTUAL_PROPERTY;
  }
  // Consumer disputes are conventionally handled as civil litigation.
  if (category.includes('civil') || category.includes('consumer')) return PracticeArea.CIVIL;
  return null;
}

/** eCourts returns party names in ALL CAPS; make them presentable. */
function titleCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\b(Mr|Mrs|Ms|Dr|M\/s)\b/gi, (m) => `${m[0].toUpperCase()}${m.slice(1).toLowerCase()}`)
    .trim();
}
