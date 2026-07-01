'use client';

import { useState } from 'react';
import { PageHeader, Tabs, type TabItem } from '@/components/ui';
import { AccountTab } from '@/components/settings/account-tab';
import { NotificationsTab } from '@/components/settings/notifications-tab';
import { ProfileTab } from '@/components/settings/profile-tab';

const TABS: TabItem[] = [
  { value: 'profile', label: 'Profile' },
  { value: 'account', label: 'Account' },
  { value: 'notifications', label: 'Notifications' },
];

export default function SettingsPage() {
  const [tab, setTab] = useState('profile');

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your profile, account and notification preferences." />

      <Tabs tabs={TABS} value={tab} onValueChange={setTab} />

      <div className="mx-auto max-w-3xl">
        {tab === 'profile' && <ProfileTab />}
        {tab === 'account' && <AccountTab />}
        {tab === 'notifications' && <NotificationsTab />}
      </div>
    </div>
  );
}
