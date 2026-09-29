'use client';
import Link from 'next/link';
import { Box, Container, Grid, Stack, Typography } from '@mui/material';
import { Logo } from './common';
import LanguageSwitcher from './LanguageSwitcher';
import { useI18n } from '@/i18n/I18nProvider';
import { CATEGORIES, localPath } from '@/lib/constants';

const Col = ({ title, items }) => (
  <Stack spacing={1}>
    <Typography sx={{ fontWeight: 700, color: '#fff', mb: 0.5 }}>{title}</Typography>
    {items.map(([label, href]) => (
      <Typography key={href} component={Link} href={href} variant="body2" sx={{ color: '#C9C4D4', '&:hover': { color: '#fff' } }}>
        {label}
      </Typography>
    ))}
  </Stack>
);

export default function Footer() {
  const { t } = useI18n();
  return (
    <Box component="footer" sx={{ bgcolor: '#111111', color: '#fff', mt: 8, py: 6 }}>
      <Container maxWidth="lg">
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Logo size={34} dark />
            <Typography sx={{ color: '#C9C4D4', mt: 2, maxWidth: 320 }}>
              {t('footer.tagline')} {t('footer.taglineSub')}
            </Typography>
            <Box sx={{ mt: 2.5, maxWidth: 300 }}>
              <LanguageSwitcher variant="buttons" size="small" />
            </Box>
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Col title={t('footer.hireIn')} items={CATEGORIES.slice(0, 5).map((c) => [c.name, localPath(c.slug, 'noida')])} />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <Col
              title={t('footer.company')}
              items={[
                [t('nav.findFreelancers'), '/freelancers'],
                [t('nav.requirements'), '/requirements'],
                [t('nav.cities'), '/cities'],
                [t('nav.becomeFreelancer'), '/login?role=freelancer'],
              ]}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Col
              title={t('footer.policy')}
              items={[
                [t('footer.privacy'), '/privacy'],
                [t('footer.terms'), '/terms'],
              ]}
            />
            <Typography variant="body2" sx={{ color: '#C9C4D4', mt: 2 }}>
              {t('chat.safetyLine')}
            </Typography>
          </Grid>
        </Grid>
        <Typography variant="body2" sx={{ color: '#8E889A', mt: 5 }}>
          {t('footer.madeIn', { year: new Date().getFullYear() })}
        </Typography>
      </Container>
    </Box>
  );
}
