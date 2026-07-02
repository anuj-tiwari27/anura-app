'use client';

import { useEffect, useState } from 'react';
import { PageHeader, Tabs, type TabItem } from '@/components/ui';
import { AccountTab } from '@/components/settings/account-tab';
import { NotificationsTab } from '@/components/settings/notifications-tab';
import { PlanBillingTab } from '@/components/settings/plan-billing-tab';
import { ProfileTab } from '@/components/settings/profile-tab';

const TABS: TabItem[] = [
  { value: 'profile', label: 'Profile' },
  { value: 'account', label: 'Account' },
  { value: 'billing', label: 'Plan & Billing' },
  { value: 'notifications', label: 'Notifications' },
];

const TAB_VALUES = new Set(TABS.map((t) => t.value));

export default function SettingsPage() {
  const [tab, setTab] = useState('profile');

  // Support deep links like /settings?tab=billing without useSearchParams
  // (which would force a Suspense boundary for static prerendering).
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    if (requested && TAB_VALUES.has(requested)) setTab(requested);
  }, []);

  const changeTab = (value: string) => {
    setTab(value);
    // Keep the URL shareable without triggering a Next.js navigation.
    window.history.replaceState(null, '', value === 'profile' ? '/settings' : `/settings?tab=${value}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your profile, account, subscription and notification preferences." />

      <Tabs tabs={TABS} value={tab} onValueChange={changeTab} />

      <div className={tab === 'billing' ? undefined : 'mx-auto max-w-3xl'}>
        {tab === 'profile' && <ProfileTab />}
        {tab === 'account' && <AccountTab />}
        {tab === 'billing' && <PlanBillingTab />}
        {tab === 'notifications' && <NotificationsTab />}
      </div>
    </div>
  );
}
