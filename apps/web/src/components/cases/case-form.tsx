'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CaseStatus, CourtType, Labels, PracticeArea, type CaseDetailView } from '@anura/shared';
import { Button, Field, Input, Select, Textarea } from '@/components/ui';

const schema = z.object({
  title: z.string().trim().min(2, 'Enter a case title'),
  caseNumber: z.string().trim().optional(),
  cnr: z.string().trim().optional(),
  court: z.string().trim().optional(),
  courtType: z.string().optional(),
  jurisdiction: z.string().trim().optional(),
  practiceArea: z.string().optional(),
  clientName: z.string().trim().optional(),
  description: z.string().trim().optional(),
  filedAt: z.string().optional(),
  nextHearingDate: z.string().optional(),
  status: z.string().optional(),
});

export type CaseFormValues = z.infer<typeof schema>;

/** Shape sent to POST/PATCH /cases — empty strings normalised to undefined/null. */
export interface CaseFormPayload {
  title: string;
  caseNumber?: string;
  cnr?: string;
  court?: string;
  courtType?: CourtType;
  jurisdiction?: string;
  practiceArea?: PracticeArea;
  clientName?: string;
  description?: string;
  filedAt?: string;
  nextHearingDate?: string;
  status?: CaseStatus;
}

/** ISO string (or Date) -> yyyy-MM-dd for <input type="date">. */
function toDateInput(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

function clean(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

function toPayload(values: CaseFormValues): CaseFormPayload {
  return {
    title: values.title.trim(),
    caseNumber: clean(values.caseNumber),
    cnr: clean(values.cnr),
    court: clean(values.court),
    courtType: (clean(values.courtType) as CourtType) ?? undefined,
    jurisdiction: clean(values.jurisdiction),
    practiceArea: (clean(values.practiceArea) as PracticeArea) ?? undefined,
    clientName: clean(values.clientName),
    description: clean(values.description),
    filedAt: values.filedAt ? new Date(values.filedAt).toISOString() : undefined,
    nextHearingDate: values.nextHearingDate ? new Date(values.nextHearingDate).toISOString() : undefined,
    status: (clean(values.status) as CaseStatus) ?? undefined,
  };
}

interface CaseFormProps {
  defaultValues?: Partial<CaseDetailView>;
  submitLabel: string;
  loading?: boolean;
  onSubmit: (payload: CaseFormPayload) => void;
  onCancel?: () => void;
  /** id used to link an external submit button via form="…"; also disambiguates the DOM. */
  formId?: string;
}

export function CaseForm({
  defaultValues,
  submitLabel,
  loading,
  onSubmit,
  onCancel,
  formId = 'case-form',
}: CaseFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CaseFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: defaultValues?.title ?? '',
      caseNumber: defaultValues?.caseNumber ?? '',
      cnr: defaultValues?.cnr ?? '',
      court: defaultValues?.court ?? '',
      courtType: defaultValues?.courtType ?? '',
      jurisdiction: defaultValues?.jurisdiction ?? '',
      practiceArea: defaultValues?.practiceArea ?? '',
      clientName: defaultValues?.clientName ?? '',
      description: defaultValues?.description ?? '',
      filedAt: toDateInput(defaultValues?.filedAt),
      nextHearingDate: toDateInput(defaultValues?.nextHearingDate),
      status: defaultValues?.status ?? CaseStatus.ACTIVE,
    },
  });

  return (
    <form id={formId} onSubmit={handleSubmit((v) => onSubmit(toPayload(v)))} className="space-y-5">
      <Field label="Case title" htmlFor="title" error={errors.title?.message} required>
        <Input id="title" placeholder="Sharma vs. State of Maharashtra" {...register('title')} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Case number" htmlFor="caseNumber" error={errors.caseNumber?.message}>
          <Input id="caseNumber" placeholder="CRL.A. 123/2024" {...register('caseNumber')} />
        </Field>
        <Field label="CNR number" htmlFor="cnr" error={errors.cnr?.message} hint="e-Courts CNR, if available">
          <Input id="cnr" placeholder="MHAU010012342024" {...register('cnr')} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Court" htmlFor="court" error={errors.court?.message}>
          <Input id="court" placeholder="Bombay High Court" {...register('court')} />
        </Field>
        <Field label="Court type" htmlFor="courtType">
          <Select id="courtType" {...register('courtType')}>
            <option value="">Select court type</option>
            {Object.values(CourtType).map((c) => (
              <option key={c} value={c}>
                {Labels.CourtType[c]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Jurisdiction" htmlFor="jurisdiction" error={errors.jurisdiction?.message}>
          <Input id="jurisdiction" placeholder="Mumbai" {...register('jurisdiction')} />
        </Field>
        <Field label="Practice area" htmlFor="practiceArea">
          <Select id="practiceArea" {...register('practiceArea')}>
            <option value="">Select practice area</option>
            {Object.values(PracticeArea).map((p) => (
              <option key={p} value={p}>
                {Labels.PracticeArea[p]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client name" htmlFor="clientName" error={errors.clientName?.message}>
          <Input id="clientName" placeholder="Rakesh Sharma" {...register('clientName')} />
        </Field>
        <Field label="Status" htmlFor="status">
          <Select id="status" {...register('status')}>
            {Object.values(CaseStatus).map((s) => (
              <option key={s} value={s}>
                {Labels.CaseStatus[s]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Filed on" htmlFor="filedAt">
          <Input id="filedAt" type="date" {...register('filedAt')} />
        </Field>
        <Field label="Next hearing" htmlFor="nextHearingDate">
          <Input id="nextHearingDate" type="date" {...register('nextHearingDate')} />
        </Field>
      </div>

      <Field label="Description" htmlFor="description" error={errors.description?.message}>
        <Textarea
          id="description"
          rows={4}
          placeholder="Brief summary of the matter, reliefs sought, and current posture."
          {...register('description')}
        />
      </Field>

      <div className="flex items-center justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={loading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
