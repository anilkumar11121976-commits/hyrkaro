'use client';
import { Box, Card, Container, Typography } from '@mui/material';
import { RequireAuth } from '@/components/common';
import { useI18n } from '@/i18n/I18nProvider';
import ConversationList from './ConversationList';
import ChatWindow from './ChatWindow';
import { brand } from '@/lib/theme';

export default function InboxShell({ activeId }) {
  const { t } = useI18n();
  return (
    <RequireAuth>
      <Container maxWidth="lg" sx={{ py: { xs: 0, md: 3 }, px: { xs: 0, md: 3 } }}>
        <Card
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '340px 1fr' },
            height: { xs: 'calc(100dvh - 60px)', md: 'calc(100dvh - 68px - 48px)' },
            minHeight: 480,
            borderRadius: { xs: 0, md: 4 },
          }}
        >
          <Box sx={{ borderRight: { md: `1px solid ${brand.line}` }, overflowY: 'auto', display: { xs: activeId ? 'none' : 'block', md: 'block' } }}>
            <Typography variant="h6" sx={{ px: 2, py: 1.75, borderBottom: `1px solid ${brand.line}` }}>
              {t('chat.title')}
            </Typography>
            <ConversationList activeId={activeId} />
          </Box>
          <Box sx={{ minHeight: 0, display: { xs: activeId ? 'block' : 'none', md: 'block' } }}>
            {activeId ? (
              <ChatWindow id={activeId} />
            ) : (
              <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', p: 4, textAlign: 'center' }}>
                <Box>
                  <Box component="img" src="/mascot.svg" alt="" sx={{ width: 140 }} />
                  <Typography variant="h6" sx={{ mt: 1 }}>
                    {t('chat.pickChat')}
                  </Typography>
                  <Typography color="text.secondary">{t('chat.pickChatSub')}</Typography>
                </Box>
              </Box>
            )}
          </Box>
        </Card>
      </Container>
    </RequireAuth>
  );
}
