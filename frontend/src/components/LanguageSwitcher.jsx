'use client';
import { useState } from 'react';
import { Box, IconButton, ListItemText, Menu, MenuItem, Tooltip, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import TranslateIcon from '@mui/icons-material/Translate';
import CheckIcon from '@mui/icons-material/Check';
import { useI18n } from '@/i18n/I18nProvider';
import api, { getToken } from '@/lib/api';
import { brand } from '@/lib/theme';

/**
 * Two shapes, one behaviour:
 *  - variant="icon"    -> globe button for the header
 *  - variant="buttons" -> inline segmented control for Settings
 * The choice is saved to the cookie + localStorage, and to the account when
 * someone is logged in, so it follows them to another device.
 */
export default function LanguageSwitcher({ variant = 'icon', size = 'medium' }) {
  const { lang, setLang, languages, t } = useI18n();
  const [anchor, setAnchor] = useState(null);

  const choose = (code) => {
    if (code && code !== lang) {
      setLang(code);
      // Best effort: remember it on the account too. Never blocks the UI.
      if (getToken()) api.post('/auth/lang', { lang: code }).catch(() => {});
    }
    setAnchor(null);
  };

  if (variant === 'buttons') {
    return (
      <ToggleButtonGroup
        exclusive
        value={lang}
        onChange={(_, v) => choose(v)}
        color="secondary"
        size={size}
        fullWidth
        aria-label={t('lang.switch')}
      >
        {languages.map((l) => (
          <ToggleButton key={l.code} value={l.code} sx={{ flexDirection: 'column', py: 1.25 }}>
            <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }}>{l.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {l.short}
            </Typography>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    );
  }

  const current = languages.find((l) => l.code === lang);
  return (
    <>
      <Tooltip title={t('lang.switch')}>
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label={t('lang.switch')} size={size}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <TranslateIcon fontSize="small" />
            <Typography variant="caption" sx={{ fontWeight: 700, color: brand.ink }}>
              {current?.short}
            </Typography>
          </Box>
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {languages.map((l) => (
          <MenuItem key={l.code} selected={l.code === lang} onClick={() => choose(l.code)} sx={{ minWidth: 180 }}>
            <ListItemText primary={l.name} secondary={l.short} />
            {l.code === lang && <CheckIcon fontSize="small" sx={{ color: brand.purple, ml: 1 }} />}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
