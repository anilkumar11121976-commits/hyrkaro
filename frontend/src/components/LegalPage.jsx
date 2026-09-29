'use client';
import { Box, Card, Container, Stack, Typography } from '@mui/material';
import { brand } from '@/lib/theme';
import { useI18n } from '@/i18n/I18nProvider';

export default function LegalPage({ title, updated, intro, sections }) {
  const { t } = useI18n();
  return (
    <Box>
      <Box sx={{ bgcolor: brand.soft, py: { xs: 5, md: 7 } }}>
        <Container maxWidth="md">
          <Typography variant="h3" component="h1">
            {title}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {t('legal.lastUpdated', { date: updated })}
          </Typography>
          <Typography sx={{ mt: 2, fontSize: 18 }}>{intro}</Typography>
        </Container>
      </Box>
      <Container maxWidth="md" sx={{ py: 5 }}>
        <Card sx={{ p: { xs: 2.5, md: 3 }, mb: 4 }}>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>{t('legal.onThisPage')}</Typography>
          <Stack component="ol" sx={{ m: 0, pl: 2.5 }} spacing={0.5}>
            {sections.map((s, i) => (
              <li key={s.h}>
                <Box component="a" href={`#s${i + 1}`} sx={{ color: 'secondary.main' }}>
                  {s.h}
                </Box>
              </li>
            ))}
          </Stack>
        </Card>
        <Stack spacing={4}>
          {sections.map((s, i) => (
            <Box key={s.h} id={`s${i + 1}`} sx={{ scrollMarginTop: 90 }}>
              <Typography variant="h5" component="h2">
                {i + 1}. {s.h}
              </Typography>
              {s.p.map((para) => (
                <Typography key={para.slice(0, 40)} sx={{ mt: 1.5, color: '#2E2B35', lineHeight: 1.7 }}>
                  {para}
                </Typography>
              ))}
            </Box>
          ))}
        </Stack>
      </Container>
    </Box>
  );
}
