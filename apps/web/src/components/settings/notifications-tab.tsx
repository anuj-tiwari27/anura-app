'use client';

import { useState } from 'react';
import { Bell, Mail, MessageCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { Toggle } from './toggle';

interface Channel {
  key: string;
  icon: LucideIcon;
  title: string;
  description: string;
  defaultOn: boolean;
}

const CHANNELS: Channel[] = [
  {
    key: 'inApp',
    icon: Bell,
    title: 'In-app notifications',
    description: 'Case updates, hearing reminders and document alerts inside Anura.',
    defaultOn: true,
  },
  {
    key: 'email',
    icon: Mail,
    title: 'Email',
    description: 'A daily digest and important alerts delivered to your inbox.',
    defaultOn: true,
  },
  {
    key: 'whatsapp',
    icon: MessageCircle,
    title: 'WhatsApp',
    description: 'Next-hearing reminders and urgent updates on WhatsApp.',
    defaultOn: false,
  },
];

const CATEGORIES = [
  { key: 'hearings', title: 'Hearing reminders', description: 'Alerts before your next listed date.', defaultOn: true },
  { key: 'cases', title: 'Case updates', description: 'Status changes, new filings and orders.', defaultOn: true },
  { key: 'documents', title: 'Document processing', description: 'When OCR and indexing finish.', defaultOn: true },
  { key: 'invoices', title: 'Billing & invoices', description: 'Payment receipts and overdue reminders.', defaultOn: false },
];

export function NotificationsTab() {
  const [channels, setChannels] = useState<Record<string, boolean>>(
    Object.fromEntries(CHANNELS.map((c) => [c.key, c.defaultOn])),
  );
  const [categories, setCategories] = useState<Record<string, boolean>>(
    Object.fromEntries(CATEGORIES.map((c) => [c.key, c.defaultOn])),
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Notification channels</CardTitle>
          <CardDescription>
            Choose how Anura reaches you. Preferences here are a preview and are not saved yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {CHANNELS.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.key} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="text-sm">
                    <p className="font-medium">{c.title}</p>
                    <p className="mt-0.5 text-muted-foreground">{c.description}</p>
                  </div>
                </div>
                <Toggle
                  checked={channels[c.key]}
                  onChange={(v) => setChannels((prev) => ({ ...prev, [c.key]: v }))}
                  label={c.title}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What to notify me about</CardTitle>
          <CardDescription>Pick the events worth interrupting you for.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {CATEGORIES.map((c) => (
            <div key={c.key} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
              <div className="text-sm">
                <p className="font-medium">{c.title}</p>
                <p className="mt-0.5 text-muted-foreground">{c.description}</p>
              </div>
              <Toggle
                checked={categories[c.key]}
                onChange={(v) => setCategories((prev) => ({ ...prev, [c.key]: v }))}
                label={c.title}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
