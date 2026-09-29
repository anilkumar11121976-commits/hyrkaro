'use client';
import Link from 'next/link';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Breadcrumbs,
  Button,
  Card,
  Chip,
  Container,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FreelancerCard from '@/components/FreelancerCard';
import { EmptyState, PolicyNote } from '@/components/common';
import { CATEGORIES, CITIES, localPath } from '@/lib/constants';
import { useI18n } from '@/i18n/I18nProvider';
import { inr } from '@/lib/format';
import { brand } from '@/lib/theme';

export default function LocalView({ cat, city, items, stats, faqs }) {
  const { t } = useI18n();
  const nearby = CITIES.filter((c) => c.region === city.region && c.slug !== city.slug);
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Breadcrumbs sx={{ mb: 2, fontSize: 14 }}>
        <Link href="/">Home</Link>
        <Link href="/cities">{t('nav.cities')}</Link>
        <Typography color="text.primary" sx={{ fontSize: 14 }}>
          {cat.name} in {city.name}
        </Typography>
      </Breadcrumbs>

      <Typography variant="h3" component="h1" sx={{ fontSize: { xs: 30, md: 42 } }}>
        Best {cat.role}s in {city.name}
      </Typography>
      <Typography sx={{ color: 'text.secondary', mt: 1, fontSize: 18, maxWidth: 760 }}>
        {city.name} ke verified {cat.name.toLowerCase()} freelancers. Unke khud ke charges dekho, chat karo, negotiate karo aur safe payment ke saath hire karo. Client fee ₹0.
      </Typography>

      <Box sx={{ mt: 4 }}>
        {items.length ? (
          <Grid container spacing={2}>
            {items.map((p) => (
              <Grid key={p._id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <FreelancerCard p={p} />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Card>
            <EmptyState
              title={`${city.name} mein ${cat.role} jald aa rahe hain`}
              text="Abhi yahan koi verified freelancer nahi hai. Waitlist join karo, launch pe sabse pehle batayenge."
              action={t('search.emptyAction')}
              href="/waitlist"
            />
          </Card>
        )}
        {items.length > 0 && (
          <Button component={Link} href={`/freelancers?category=${cat.slug}&city=${city.slug}`} sx={{ mt: 2 }} color="secondary">
            Saare {cat.role}s dekho →
          </Button>
        )}
      </Box>

      <Grid container spacing={3} sx={{ mt: 3 }}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ p: 3 }}>
            <Typography variant="h5" component="h2">
              {city.name} mein {cat.role} ke charges
            </Typography>
            <Table size="small" sx={{ mt: 1 }}>
              <TableBody>
                <TableRow>
                  <TableCell>{t('home.chipVerified')}</TableCell>
                  <TableCell align="right">{stats?.count || 0}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Shuruaati charges</TableCell>
                  <TableCell align="right">{stats?.count ? inr(stats.minRate) : '—'}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Average charges</TableCell>
                  <TableCell align="right">{stats?.count ? inr(Math.round(stats.avgRate)) : '—'}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t('common.clientFee')}</TableCell>
                  <TableCell align="right">₹0</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Har freelancer apne charges khud rakhta hai (per ghanta, per din ya per project). Final rate chat mein tay karo.
            </Typography>
          </Card>

          <Typography variant="h5" component="h2" sx={{ mt: 4, mb: 1 }}>
            Aksar pooche jaane wale sawaal
          </Typography>
          {faqs.map((f) => (
            <Accordion key={f.q} disableGutters variant="outlined" sx={{ '&:before': { display: 'none' }, mb: 1, borderRadius: '12px !important' }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography sx={{ fontWeight: 600 }}>{f.q}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography color="text.secondary">{f.a}</Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ p: 3 }}>
            <Typography sx={{ fontWeight: 700 }}>{city.name} mein aur kaam</Typography>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mt: 1.5 }}>
              {CATEGORIES.filter((c) => c.slug !== cat.slug).map((c) => (
                <Chip key={c.slug} label={c.name} component={Link} href={localPath(c.slug, city.slug)} clickable variant="outlined" />
              ))}
            </Stack>
            {nearby.length > 0 && (
              <>
                <Typography sx={{ fontWeight: 700, mt: 3 }}>{cat.role}s paas ke shehar mein</Typography>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mt: 1.5 }}>
                  {nearby.map((c) => (
                    <Chip key={c.slug} label={c.name} component={Link} href={localPath(cat.slug, c.slug)} clickable sx={{ bgcolor: brand.soft }} />
                  ))}
                </Stack>
              </>
            )}
            <PolicyNote sx={{ mt: 3 }} />
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}
