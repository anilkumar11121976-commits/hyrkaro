'use client';
import Link from 'next/link';
import { Card, Container, Grid, Stack, Typography } from '@mui/material';
import { CATEGORIES, CITIES, localPath } from '@/lib/constants';
import { useI18n } from '@/i18n/I18nProvider';

export default function CitiesView() {
  const { t } = useI18n();
  const regions = [...new Set(CITIES.map((c) => c.region))];
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1">
        {t('nav.cities')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {t('dashboard.pickCategory')}
      </Typography>
      {regions.map((r) => (
        <div key={r}>
          <Typography variant="h6" sx={{ mt: 3, mb: 1.5 }}>
            {r}
          </Typography>
          <Grid container spacing={2}>
            {CITIES.filter((c) => c.region === r).map((c) => (
              <Grid key={c.slug} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card sx={{ p: 2.25, height: '100%' }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 18 }}>{c.name}</Typography>
                  <Stack spacing={0.5} sx={{ mt: 1 }}>
                    {CATEGORIES.map((cat) => (
                      <Typography key={cat.slug} component={Link} href={localPath(cat.slug, c.slug)} variant="body2" sx={{ color: 'secondary.main', '&:hover': { textDecoration: 'underline' } }}>
                        {cat.role}s in {c.name}
                      </Typography>
                    ))}
                  </Stack>
                </Card>
              </Grid>
            ))}
          </Grid>
        </div>
      ))}
    </Container>
  );
}
