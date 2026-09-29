# HyrKro – Freelancer marketplace (web app)

"Freelancer chahiye? HyrKro."

Two separate apps:

| Folder | Stack | Default port |
| --- | --- | --- |
| `backend/` | Node.js, Express 5, MongoDB (Mongoose), JWT, Cloudinary, Razorpay, Socket.io | 5000 |
| `frontend/` | Next.js 16 (App Router), React 19, MUI, react-toastify, socket.io-client | 3000 |

## Languages

The whole UI runs in **Hinglish (default), हिंदी and English**. The switcher is in
the header, the footer and Settings. The choice is kept in a cookie (so
server-rendered pages and metadata come back in the right language), in
`localStorage`, and on the account for logged-in users, so it follows them to
another device.

Adding a string: put it in all three files under `frontend/src/i18n/dictionaries/`
and use `t('namespace.key')` from `useI18n()`. `npm run check:i18n` (frontend)
fails if the three dictionaries drift apart.

## Features

- **Login is mobile + OTP** (no passwords). One account switches between client
  and freelancer. Admins sign in with email + password at `/admin/login`.
  - **Without SMS keys the app runs in DEMO OTP mode**: the code comes back in the
    API response so you can log in locally with no SMS account.
- **Freelancer profiles:** own charges (per hour/day/project), skills, bio,
  portfolio on Cloudinary, and a verification flow. First month of Pro is free.
- **City-first search:** results come back in three groups — your city, then the
  rest of that region, then remote from anywhere else. The sort applies inside
  each group, never across them. Plus SEO city pages at `/hire/[category]/[city]`.
- **Requirement board:** clients post work; verified freelancers send **one**
  interest each, with a daily cap.
- **Chat first, then hire:**
  - Real-time (Socket.io) with typing indicator, read ticks and presence scoped
    to the people you actually chat with.
  - Phone numbers, emails, **UPI handles** and external chat/booking links are
    masked automatically. Repeat attempts earn a strike the admin can see.
  - Files up to 25 MB; executables blocked by both extension and MIME type.
- **Negotiation:** offer → accept / decline / counter / withdraw.
- **Video meetings:** propose, confirm or decline, with a Jitsi link.
- **Hiring and escrow:**
  - Hiring always comes from an **accepted offer**, and the **freelancer accepts
    the order** before any money moves.
  - Escrow: fund → submit → approve → payout due in 3 days. 1, 2 or 3 milestones.
  - **Watermarked preview on delivery** — the client reviews a blurred, watermarked
    copy and the original files unlock only on approval.
  - **Dispute and refund:** either side can open a dispute; the admin resolves it
    to the client, the freelancer, or a split, and refunds go back through Razorpay.
  - **No payout without KYC** (PAN + UPI/bank). Approved money waits on hold until
    KYC clears.
- **Commission is per category and editable by an admin** from the panel, no deploy.
- **Notifications** in-app for every event that needs attention.
- **Reviews** after completion; an admin can hide fake ones and ratings recompute.
- **Privacy:** data export as JSON, and account deletion scheduled 30 days out
  (payment/invoice rows are kept for tax law, the account is anonymised).
- **Admin panel:** stats, verification, KYC, users, orders, disputes, payouts,
  reviews, commission, requirements, waitlist, and a log of every admin action.

## 1. Run locally

Requirements: Node.js 20+ and a MongoDB instance (local, or a free Atlas cluster).

```bash
# Backend
cd backend
cp .env.example .env        # fill in MONGO_URI and JWT_SECRET
npm install
npm run seed                # optional: sample freelancers, clients, requirements
npm run dev                 # http://localhost:5000/api/health

# Frontend (new terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev                 # http://localhost:3000
```

**Seed logins** — login is by OTP, and in demo mode the code is returned by the
API, so any of these numbers works with no SMS account:

| Phone | Role |
| --- | --- |
| `9999900001` | admin (also `admin@hyrkro.test` / `Test@1234` at `/admin/login`) |
| `9999900002` | client (Rahul Traders) |
| `9999900003` | client (has 3 open requirements) |
| `9000000001` … `9000000012` | verified freelancers |

Or with Docker: create `backend/.env`, then `docker compose up --build`.

## 2. Environment variables

`backend/.env.example` and `frontend/.env.example` document every key. The ones
that decide how the app behaves:

| Key | Required | Notes |
| --- | --- | --- |
| `MONGO_URI`, `JWT_SECRET` | yes | The app refuses to start in production with a weak secret |
| `CLIENT_URL` | yes | Frontend URL(s), comma separated (CORS + Socket.io) |
| `SMS_PROVIDER` + keys | for real OTP | `msg91` or `twilio`. Empty = demo OTP (dev only) |
| `CLOUDINARY_*` | for uploads | Without them, uploads return a friendly "not set up" message |
| `RAZORPAY_*` | optional | Empty = demo payment mode. **Refunds need real keys** |
| `REQUIRE_KYC_FOR_PAYOUT` | no | Default true |
| `REDIS_URL` | to scale out | Socket.io adapter + shared rate limits |
| `RUN_BACKGROUND_JOBS` | no | Keep true on exactly one instance |

Webhook URL: `https://<api-domain>/api/payments/webhook`, events
`payment.captured`, `order.paid`, `payment.failed`, `refund.processed`.

## 3. Deploy

1. **Database:** MongoDB Atlas, connection string into `MONGO_URI`.
2. **Backend:** Render, Railway or a VPS — it needs WebSockets, so not serverless.
   - Root `backend`, build `npm ci`, start `npm start`.
   - Create the first admin with `npm run create-admin` (`ADMIN_EMAIL`,
     `ADMIN_PHONE`, `ADMIN_PASSWORD` from `.env`).
3. **Frontend:** Vercel. Root `frontend`, add the 3 `NEXT_PUBLIC_*` vars, redeploy
   after changing them (they are baked into the bundle).
4. **Domains:** `hyrkro.com` → frontend, `api.hyrkro.com` → backend, and set
   `CLIENT_URL=https://hyrkro.com`.
5. **SMS:** get a DLT-registered sender ID and OTP template (mandatory in India),
   then set `SMS_PROVIDER` and the keys.
6. **Razorpay:** test keys first, then live after KYC. For automatic payouts later,
   use RazorpayX; for now admins pay manually and click "Paid mark karo".

> **Rendering note:** reading the language cookie in the root layout makes pages
> server-rendered per request rather than statically cached. SEO pages still
> return full HTML with their metadata in the right language; if you later want
> ISR back, move the switcher to a `/[lang]/` route segment.

## 4. Scripts

Backend: `npm run check` (33 assertions, no database needed) · `npm run seed` ·
`npm run create-admin`.
Frontend: `npm run build` · `npm run check:i18n` (dictionary parity).

## 5. API overview

All routes under `/api`.

- **auth:** `POST /auth/otp/request`, `POST /auth/otp/verify`,
  `POST /auth/complete-profile`, `POST /auth/admin/login`, `GET /auth/me`,
  `POST /auth/switch-role`, `POST /auth/lang`, `POST /auth/change-password`
- **users:** `PATCH /users/me`, `POST /users/me/avatar`, `GET|POST /users/me/kyc`,
  `GET /users/me/export`, `POST /users/me/delete`, `POST /users/me/delete/cancel`
- **notifications:** `GET /notifications`, `POST /notifications/read`
- **freelancers:** `GET /freelancers` (city-first), `GET /freelancers/stats`,
  `GET /freelancers/:id`, `GET|PUT /freelancers/me/profile`,
  `POST /freelancers/me/submit-verification`, `POST /freelancers/me/portfolio`,
  `DELETE /freelancers/me/portfolio/:itemId`
- **requirements:** `GET|POST /requirements`, `GET|PATCH /requirements/:id`,
  `POST /requirements/:id/interest`,
  `POST /requirements/:id/interests/:interestId/chat`,
  `GET /requirements/mine/interests`
- **chat:** `POST|GET /conversations`, `GET /conversations/:id`,
  `GET|POST /conversations/:id/messages`, `POST /conversations/:id/files`,
  `POST /conversations/:id/read`, `POST /conversations/:id/offers`,
  `POST /conversations/:id/meetings`, `POST /messages/:id/offer`,
  `POST /messages/:id/meeting`
- **orders:** `POST|GET /orders`, `GET /orders/:id`, `POST /orders/:id/accept`,
  `/decline`, `/cancel`, `/dispute`, `/dispute/withdraw`, `/review`,
  `POST /orders/:id/milestones/:msId/{submit|approve|request-changes}`
- **payments:** `GET /payments/config`,
  `POST /payments/orders/:orderId/milestones/:msId`, `POST /payments/verify`,
  `POST /payments/demo/confirm`, `POST /payments/webhook`
- **admin:** `/admin/stats`, `/freelancers`, `/kyc`, `/users`, `/orders`,
  `/disputes`, `/disputes/:id/resolve`, `/payouts`, `/reviews`, `/commission`,
  `/requirements`, `/logs`, `/waitlist`
- **misc:** `GET /health` (503 when the database is down), `GET /meta`, `POST /waitlist`

Socket.io events:
- **Client emits:** `conversation:join`, `conversation:leave`, `typing`
- **Server emits:** `message:new`, `message:update`, `conversation:read`,
  `order:update`, `notification:new`, `typing`, `presence`

## 6. Background jobs

Run in-process every 6–12 hours (`RUN_BACKGROUND_JOBS`):
chat + delivery file purge 6 months after completion · Pro plan expiry and the
3-day warning · requirement expiry · scheduled account deletions.

## 7. Before going live

- [ ] Strong `JWT_SECRET`, `NODE_ENV=production`, HTTPS on both domains
- [ ] Atlas IP allowlist and daily backups
- [ ] DLT-registered SMS sender + template, then real `SMS_PROVIDER` keys
- [ ] Cloudinary and Razorpay keys; run one order end to end on `rzp_test_` keys,
      **including a refund**
- [ ] Update the Privacy / Terms contact emails and have a lawyer review them
- [ ] Email notifications (the in-app ones are built; email is not — add Resend or SES)
- [ ] `REDIS_URL` before running a second backend instance
- [ ] Error monitoring (Sentry) and uptime checks on `/api/health`
