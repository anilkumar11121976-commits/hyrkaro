"use client";

import Link from "next/link";
import { Box, Container, Grid, Stack, Typography } from "@mui/material";
import { Logo } from "./common";
import LanguageSwitcher from "./LanguageSwitcher";
import { useI18n } from "@/i18n/I18nProvider";
import { CATEGORIES, localPath } from "@/lib/constants";

const Col = ({ title, items }) => (
  <Stack spacing={1.2}>
    <Typography
      sx={{
        fontWeight: 700,
        fontSize: "0.95rem",
        color: "#FFFFFF",
        mb: 0.8,
        letterSpacing: "0.2px",
      }}
    >
      {title}
    </Typography>

    {items.map(([label, href]) => (
      <Typography
        key={href}
        component={Link}
        href={href}
        variant="body2"
        sx={{
          color: "#B9B4C3",
          textDecoration: "none",
          width: "fit-content",
          transition: "all 0.2s ease",
          "&:hover": {
            color: "#FFFFFF",
            transform: "translateX(3px)",
          },
        }}
      >
        {label}
      </Typography>
    ))}
  </Stack>
);

export default function Footer() {
  const { t } = useI18n();

  return (
    <Box
      component="footer"
      sx={{
        bgcolor: "#111111",
        color: "#FFFFFF",
        mt: 8,
        pt: { xs: 5, md: 7 },
        pb: 3,
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={{ xs: 4, md: 5 }}>
          {/* Brand */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={2}>
              <Box>
                <Logo size={38} dark />
              </Box>

              <Typography
                sx={{
                  color: "#B9B4C3",
                  fontSize: "0.92rem",
                  lineHeight: 1.7,
                  maxWidth: 360,
                }}
              >
                {t("footer.tagline")} {t("footer.taglineSub")}
              </Typography>

              {/* Language */}
              <Box sx={{ pt: 0.5 }}>
                <Typography
                  sx={{
                    color: "#FFFFFF",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    mb: 1,
                  }}
                >
                  Language
                </Typography>

                <Box
                  sx={{
                    display: "inline-flex",
                    p: "4px",
                    borderRadius: "10px",
                    bgcolor: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.12)",

                    "& button": {
                      color: "#D8D4DE",
                      borderColor: "transparent",
                      backgroundColor: "transparent",
                      minHeight: 32,
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      borderRadius: "7px",
                      transition: "all 0.2s ease",
                    },

                    "& button:hover": {
                      color: "#FFFFFF",
                      backgroundColor: "rgba(255,255,255,0.10)",
                    },
                  }}
                >
                  <LanguageSwitcher variant="buttons" size="small" />
                </Box>
              </Box>
            </Stack>
          </Grid>

          {/* Hire In */}
          <Grid size={{ xs: 6, sm: 4, md: 3 }}>
            <Col
              title={t("footer.hireIn")}
              items={CATEGORIES.slice(0, 5).map((c) => [
                c.name,
                localPath(c.slug, "noida"),
              ])}
            />
          </Grid>

          {/* Company */}
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <Col
              title={t("footer.company")}
              items={[
                [t("nav.findFreelancers"), "/freelancers"],
                [t("nav.requirements"), "/requirements"],
                [t("nav.cities"), "/cities"],
                [t("nav.becomeFreelancer"), "/login?role=freelancer"],
              ]}
            />
          </Grid>

          {/* Policies */}
          <Grid size={{ xs: 12, sm: 4, md: 3 }}>
            <Col
              title={t("footer.policy")}
              items={[
                [t("footer.privacy"), "/privacy"],
                [t("footer.terms"), "/terms"],
              ]}
            />

            <Typography
              variant="body2"
              sx={{
                color: "#8F8999",
                mt: 2.5,
                lineHeight: 1.6,
                maxWidth: 280,
              }}
            >
              {t("chat.safetyLine")}
            </Typography>
          </Grid>
        </Grid>

        {/* Bottom */}
        <Box
          sx={{
            mt: { xs: 5, md: 6 },
            pt: 2.5,
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: "#77717F",
              fontSize: "0.8rem",
            }}
          >
            {t("footer.madeIn", {
              year: new Date().getFullYear(),
            })}
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}