'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Labels, TimelineEventType } from '@anura/shared';
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui';

const schema = z.object({
  type: z.string().min(1, 'Select a type'),
  title: z.string().trim().min(1, 'Enter a title'),
  description: z.string().trim().optional(),
  eventDate: z.string().min(1, 'Pick a date'),
});
type FormValues = z.infer<typeof schema>;

export interface TimelinePayload {
  type: TimelineEventType;
  title: string;
  description?: string;
  eventDate: string;
}

interface AddTimelineModalProps {
  open: boolean;
  onClose: () => void;
  loading?: boolean;
  onSubmit: (payload: TimelinePayload) => void;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AddTimelineModal({ open, onClose, loading, onSubmit }: AddTimelineModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: TimelineEventType.HEARING, title: '', description: '', eventDate: today() },
  });

  const close = () => {
    reset();
    onClose();
  };

  const submit = (values: FormValues) => {
    onSubmit({
      type: values.type as TimelineEventType,
      title: values.title.trim(),
      description: values.description?.trim() || undefined,
      eventDate: new Date(values.eventDate).toISOString(),
    });
    reset();
  };

  return (
    <Modal open={open} onClose={close} title="Add timeline event" description="Record a hearing, filing, order or note.">
      <form id="timeline-form" onSubmit={handleSubmit(submit)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type" htmlFor="tl-type" error={errors.type?.message} required>
            <Select id="tl-type" {...register('type')}>
              {Object.values(TimelineEventType).map((t) => (
                <option key={t} value={t}>
                  {Labels.TimelineEventType[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date" htmlFor="tl-date" error={errors.eventDate?.message} required>
            <Input id="tl-date" type="date" {...register('eventDate')} />
          </Field>
        </div>

        <Field label="Title" htmlFor="tl-title" error={errors.title?.message} required>
          <Input id="tl-title" placeholder="Next hearing for arguments" {...register('title')} />
        </Field>

        <Field label="Notes" htmlFor="tl-desc">
          <Textarea id="tl-desc" rows={3} placeholder="Optional details about this event." {...register('description')} />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={close} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Add event
          </Button>
        </div>
      </form>
    </Modal>
  );
}
