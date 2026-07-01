'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CasePartyRole, Labels } from '@anura/shared';
import { Button, Field, Input, Modal, Select } from '@/components/ui';

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a name'),
  role: z.string().min(1, 'Select a role'),
  contactEmail: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
  contactPhone: z.string().trim().optional(),
  advocateName: z.string().trim().optional(),
  isClient: z.boolean().optional(),
});
type FormValues = z.infer<typeof schema>;

export interface PartyPayload {
  name: string;
  role: CasePartyRole;
  contactEmail?: string;
  contactPhone?: string;
  advocateName?: string;
  isClient?: boolean;
}

interface PartyModalProps {
  open: boolean;
  onClose: () => void;
  loading?: boolean;
  onSubmit: (payload: PartyPayload) => void;
}

export function PartyModal({ open, onClose, loading, onSubmit }: PartyModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', role: CasePartyRole.PETITIONER, isClient: false },
  });

  const close = () => {
    reset();
    onClose();
  };

  const submit = (values: FormValues) => {
    onSubmit({
      name: values.name.trim(),
      role: values.role as CasePartyRole,
      contactEmail: values.contactEmail?.trim() || undefined,
      contactPhone: values.contactPhone?.trim() || undefined,
      advocateName: values.advocateName?.trim() || undefined,
      isClient: values.isClient ?? false,
    });
    reset();
  };

  return (
    <Modal open={open} onClose={close} title="Add party" description="Petitioner, respondent, witness or any other party.">
      <form id="party-form" onSubmit={handleSubmit(submit)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="party-name" error={errors.name?.message} required>
            <Input id="party-name" placeholder="Rakesh Sharma" {...register('name')} />
          </Field>
          <Field label="Role" htmlFor="party-role" error={errors.role?.message} required>
            <Select id="party-role" {...register('role')}>
              {Object.values(CasePartyRole).map((r) => (
                <option key={r} value={r}>
                  {Labels.CasePartyRole[r]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact email" htmlFor="party-email" error={errors.contactEmail?.message}>
            <Input id="party-email" type="email" placeholder="rakesh@example.com" {...register('contactEmail')} />
          </Field>
          <Field label="Contact phone" htmlFor="party-phone">
            <Input id="party-phone" placeholder="+91 98xxxxxxxx" {...register('contactPhone')} />
          </Field>
        </div>

        <Field label="Advocate" htmlFor="party-advocate" hint="Counsel representing this party, if any">
          <Input id="party-advocate" placeholder="Adv. Meera Nair" {...register('advocateName')} />
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
            {...register('isClient')}
          />
          This party is my client
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={close} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Add party
          </Button>
        </div>
      </form>
    </Modal>
  );
}
