
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import {
  AppBar,
  Badge,
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Tooltip,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import WorkOutlinedIcon from '@mui/icons-material/WorkOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';

import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { toast } from 'react-toastify';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { useI18n } from '@/i18n/I18nProvider';
import { errMsg } from '@/lib/api';
import { Logo, UserAvatar } from './common';
import LanguageSwitcher from './LanguageSwitcher';
import { brand } from '@/lib/theme';

export default function Header() {
  const { user, roles, logout, switchRole, ready } = useAuth();
  const { unread, notifUnread } = useSocket();
  const { t } = useI18n();

  const [anchor, setAnchor] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [switching, setSwitching] = useState(false);

  const router = useRouter();
  const pathname = usePathname() || '/';

  /*
   * IMPORTANT:
   * Only icons that already existed in your original working file
   * are used here. No new @mui/icons-material dependency is required.
   */
 const links = [
  /* {
    href: '/',
    label: t('Home'),
    icon: <HomeOutlinedIcon fontSize="small" />,
  }, */
  {
    href: '/freelancers',
    label: t('nav.findFreelancers'),
   icon: <PeopleOutlinedIcon fontSize="small" />,
  },
  {
    href: '/requirements',
    label: t('nav.requirements'),
    icon: <AssignmentOutlinedIcon fontSize="small" />,
  },
  {
    href: '/cities',
    label: t('nav.cities'),
    icon: <LocationOnOutlinedIcon fontSize="small" />,
  },
  ...(user
    ? [
        {
          href: '/orders',
          label: t('nav.orders'),
          icon: <ReceiptLongOutlinedIcon fontSize="small" />,
        },
      ]
    : [
        {
          href: '/login?role=freelancer',
          label: t('nav.becomeFreelancer'),
         icon: <WorkOutlinedIcon fontSize="small" /> ,
        },
      ]),
  ...(user?.role === 'admin'
    ? [
        {
          href: '/admin',
          label: t('nav.admin'),
          icon: <AdminPanelSettingsOutlinedIcon fontSize="small" />,
        },
      ]
    : []),
];
  /**
   * "/" is a prefix of every route, so the home link needs an exact match.
   */
  const isActive = (href) => {
    const path = href.split('?')[0];

    return path === '/'
      ? pathname === '/'
      : pathname.startsWith(path);
  };

  const doLogout = () => {
    setAnchor(null);
    logout();
    router.push('/');
  };

  /** One account switches between client and freelancer. */
  const otherRole = user?.role === 'client' ? 'freelancer' : 'client';
  const canSwitch = user && user.role !== 'admin';

  const doSwitch = async () => {
    setAnchor(null);
    setSwitching(true);

    try {
      await switchRole(otherRole);

      const label =
        otherRole === 'client'
          ? t('nav.switchToClient')
          : t('nav.switchToFreelancer');

      toast.success(t('nav.switchedTo', { role: label }));
      router.push('/dashboard');
    } catch (e) {
      toast.error(errMsg(e, t));
    } finally {
      setSwitching(false);
    }
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        borderBottom: `1px solid ${brand.line}`,
      }}
    >
      <Container maxWidth="lg">
        <Toolbar
          disableGutters
          sx={{
            minHeight: { xs: 60, md: 68 },
            gap: 1,
          }}
        >
          <Logo size={34} />

          {/* Desktop Navigation */}
          <Stack
            direction="row"
            spacing={0.5}
            sx={{
              ml: 2,
              display: { xs: 'none', lg: 'flex' },
            }}
          >
            {links.map((l) => (
              <Button
                key={l.href}
                component={Link}
                href={l.href}
                color="primary"
                startIcon={l.icon}
                aria-current={
                  isActive(l.href) ? 'page' : undefined
                }
                sx={{
                  fontWeight: isActive(l.href) ? 700 : 500,
                }}
              >
                {l.label}
              </Button>
            ))}
          </Stack>

          <Box sx={{ flex: 1 }} />

          <LanguageSwitcher
            variant="icon"
            size="small"
          />

          {/* Notifications + Chats */}
          {ready && user && (
            <>
              <Tooltip title={t('nav.notifications')}>
                <IconButton
                  component={Link}
                  href="/notifications"
                  aria-label={t('nav.notifications')}
                >
                  <Badge
                    badgeContent={notifUnread}
                    color="secondary"
                    max={99}
                  >
                    <NotificationsNoneIcon />
                  </Badge>
                </IconButton>
              </Tooltip>

              <Tooltip title={t('nav.chats')}>
                <IconButton
                  component={Link}
                  href="/inbox"
                  aria-label={t('nav.chats')}
                >
                  <Badge
                    badgeContent={unread}
                    color="secondary"
                    max={99}
                  >
                    <ChatBubbleOutlineIcon />
                  </Badge>
                </IconButton>
              </Tooltip>
            </>
          )}

          {/* Guest Buttons */}
          {ready && !user && (
            <Stack
              direction="row"
              spacing={1}
              sx={{
                display: { xs: 'none', sm: 'flex' },
              }}
            >
              <Button
                component={Link}
                href="/login"
                variant="text"
                startIcon={
                  <HomeOutlinedIcon />
                }
              >
                {t('nav.login')}
              </Button>

              <Button
                component={Link}
                href="/login?intent=signup"
                variant="contained"
                startIcon={
                  <SwapHorizIcon />
                }
              >
                {t('nav.signup')}
              </Button>
            </Stack>
          )}

          {/* User Account */}
          {ready && user && (
            <>
              <IconButton
                onClick={(e) =>
                  setAnchor(e.currentTarget)
                }
                aria-label={t('nav.account')}
                sx={{ p: 0.5 }}
              >
                <UserAvatar
                  user={user}
                  size={36}
                />
              </IconButton>

              <Menu
                anchorEl={anchor}
                open={Boolean(anchor)}
                onClose={() => setAnchor(null)}
              >
                <MenuItem
                  disabled
                  sx={{
                    opacity: '1 !important',
                    fontWeight: 600,
                  }}
                >
                  {user.name}
                </MenuItem>

                <Divider />

                <MenuItem
                  component={Link}
                  href="/dashboard"
                  onClick={() => setAnchor(null)}
                >
                  <ListItemIcon>
                    <HomeOutlinedIcon fontSize="small" />
                  </ListItemIcon>

                  {t('nav.dashboard')}
                </MenuItem>

                <MenuItem
                  component={Link}
                  href="/inbox"
                  onClick={() => setAnchor(null)}
                >
                  <ListItemIcon>
                    <ChatBubbleOutlineIcon fontSize="small" />
                  </ListItemIcon>

                  {t('nav.chats')}
                </MenuItem>

                <MenuItem
                  component={Link}
                  href="/orders"
                  onClick={() => setAnchor(null)}
                >
                  <ListItemIcon>
                    <NotificationsNoneIcon fontSize="small" />
                  </ListItemIcon>

                  {t('nav.orders')}
                </MenuItem>

                <MenuItem
                  component={Link}
                  href="/requirements"
                  onClick={() => setAnchor(null)}
                >
                  <ListItemIcon>
                    <ChatBubbleOutlineIcon fontSize="small" />
                  </ListItemIcon>

                  {t('nav.requirements')}
                </MenuItem>

                <MenuItem
                  component={Link}
                  href="/settings"
                  onClick={() => setAnchor(null)}
                >
                  <ListItemIcon>
                    <SwapHorizIcon fontSize="small" />
                  </ListItemIcon>

                  {t('nav.settings')}
                </MenuItem>

                {user.role === 'admin' && (
                  <MenuItem
                    component={Link}
                    href="/admin"
                    onClick={() => setAnchor(null)}
                  >
                    <ListItemIcon>
                      <NotificationsNoneIcon fontSize="small" />
                    </ListItemIcon>

                    {t('nav.adminPanel')}
                  </MenuItem>
                )}

                {canSwitch && (
                  <>
                    <Divider />

                    <MenuItem
                      onClick={doSwitch}
                      disabled={switching}
                    >
                      <ListItemIcon>
                        <SwapHorizIcon
                          fontSize="small"
                          sx={{
                            color: brand.purple,
                          }}
                        />
                      </ListItemIcon>

                      {otherRole === 'client'
                        ? t('nav.switchToClient')
                        : t(
                            'nav.switchToFreelancer'
                          )}
                    </MenuItem>
                  </>
                )}

                <Divider />

                <MenuItem onClick={doLogout}>
                  <ListItemIcon>
                    <SwapHorizIcon fontSize="small" />
                  </ListItemIcon>

                  {t('nav.logout')}
                </MenuItem>
              </Menu>
            </>
          )}

          {/* Mobile Menu */}
          <IconButton
            sx={{
              display: { lg: 'none' },
            }}
            onClick={() => setDrawer(true)}
            aria-label={t('nav.menu')}
          >
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </Container>

      {/* Mobile Drawer */}
      <Drawer
        anchor="right"
        open={drawer}
        onClose={() => setDrawer(false)}
      >
        <Box
          sx={{
            width: 280,
            p: 2,
          }}
        >
          <Logo size={30} />

          <Box sx={{ mt: 2 }}>
            <LanguageSwitcher
              variant="buttons"
              size="small"
            />
          </Box>

          <List
            sx={{ mt: 1 }}
            onClick={() => setDrawer(false)}
          >
            {links.map((l) => (
              <ListItemButton
                key={l.href}
                component={Link}
                href={l.href}
                selected={isActive(l.href)}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 34,
                    color: brand.purple,
                  }}
                >
                  {l.icon}
                </ListItemIcon>

                <ListItemText
                  primary={l.label}
                />
              </ListItemButton>
            ))}

            <Divider sx={{ my: 1 }} />

            {/* Guest Mobile */}
            {!user && (
              <>
                <ListItemButton
                  component={Link}
                  href="/login"
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 34,
                      color: brand.purple,
                    }}
                  >
                    <HomeOutlinedIcon fontSize="small" />
                  </ListItemIcon>

                  <ListItemText
                    primary={t('nav.login')}
                  />
                </ListItemButton>

                <ListItemButton
                  component={Link}
                  href="/login?intent=signup"
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 34,
                      color: brand.purple,
                    }}
                  >
                    <SwapHorizIcon fontSize="small" />
                  </ListItemIcon>

                  <ListItemText
                    primary={t('nav.signup')}
                  />
                </ListItemButton>
              </>
            )}

            {/* Logged-in Mobile */}
            {user && (
              <>
                <ListItemButton
                  component={Link}
                  href="/dashboard"
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 34,
                      color: brand.purple,
                    }}
                  >
                    <HomeOutlinedIcon fontSize="small" />
                  </ListItemIcon>

                  <ListItemText
                    primary={t('nav.dashboard')}
                  />
                </ListItemButton>

                <ListItemButton
                  component={Link}
                  href="/notifications"
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 34,
                      color: brand.purple,
                    }}
                  >
                    <NotificationsNoneIcon fontSize="small" />
                  </ListItemIcon>

                  <ListItemText
                    primary={t('nav.notifications')}
                  />
                </ListItemButton>

                <ListItemButton
                  component={Link}
                  href="/inbox"
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 34,
                      color: brand.purple,
                    }}
                  >
                    <ChatBubbleOutlineIcon fontSize="small" />
                  </ListItemIcon>

                  <ListItemText
                    primary={t('nav.chats')}
                  />
                </ListItemButton>

                <ListItemButton
                  component={Link}
                  href="/settings"
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 34,
                      color: brand.purple,
                    }}
                  >
                    <SwapHorizIcon fontSize="small" />
                  </ListItemIcon>

                  <ListItemText
                    primary={t('nav.settings')}
                  />
                </ListItemButton>

                {canSwitch && (
                  <ListItemButton
                    onClick={doSwitch}
                    disabled={switching}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 34,
                        color: brand.purple,
                      }}
                    >
                      <SwapHorizIcon fontSize="small" />
                    </ListItemIcon>

                    <ListItemText
                      primary={
                        otherRole === 'client'
                          ? t(
                              'nav.switchToClient'
                            )
                          : t(
                              'nav.switchToFreelancer'
                            )
                      }
                    />
                  </ListItemButton>
                )}

                <ListItemButton onClick={doLogout}>
                  <ListItemIcon
                    sx={{
                      minWidth: 34,
                      color: brand.purple,
                    }}
                  >
                    <SwapHorizIcon fontSize="small" />
                  </ListItemIcon>

                  <ListItemText
                    primary={t('nav.logout')}
                  />
                </ListItemButton>
              </>
            )}
          </List>
        </Box>
      </Drawer>
    </AppBar>
  );
}