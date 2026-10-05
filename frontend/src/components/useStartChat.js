'use client';
import { useCallback, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from '@/lib/toast';
import api, { errMsg } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n/I18nProvider';

/**
 * PDF §4: login before chat; only clients start chats; chat first, then hire.
 * Memoised so callers can put `start` in an effect's dependency list safely.
 */
export default function useStartChat() {
  const { user, switchRole } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);

  const start = useCallback(
    async (freelancerProfileId) => {
      if (!user) {
        toast.info(t('auth.loginSubtitle'));
        router.push(`/login?next=${encodeURIComponent(`${pathname}?chat=1`)}`);
        return;
      }
      setBusy(true);
      try {
        // PDF §2: a freelancer can hire too — switch the account to client mode first.
        if (user.role === 'freelancer') {
          await switchRole('client');
        }
        const { data } = await api.post('/conversations', { freelancerId: freelancerProfileId });
        router.push(`/inbox/${data.conversation._id}`);
      } catch (e) {
        toast.error(errMsg(e, t));
      } finally {
        setBusy(false);
      }
    },
    [user, t, router, pathname, switchRole],
  );

  return { start, busy };
}
