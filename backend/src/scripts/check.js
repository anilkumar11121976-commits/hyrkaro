/* Quick self-check without a database: `npm run check` */
import assert from 'assert';
import { maskContactInfo, deepSanitize, stripPayout, stripUnreleasedFiles } from '../utils/helpers.js';
import { splitMilestones } from '../controllers/orderController.js';
import { normalizePhone, otpRequestSchema, completeProfileSchema } from '../controllers/authController.js';
import User from '../models/User.js';
import { errorHandler } from '../middleware/error.js';
import { createApp } from '../app.js';

let checks = 0;
const ok = (cond, label) => {
  assert.ok(cond, label);
  checks += 1;
};

/* ---- contact masking (PDF §5, report H3) ---- */
const shouldMask = [
  'Call me on 98765 43210',
  'mail a@b.com',
  'wa.me/919876543210',
  'UPI: rahul@paytm',
  'johncafe@okhdfcbank',
  'instagram.com/rahul.designs',
  'discord.gg/abcd1234',
  'calendly.com/rahul/30min',
  '98765.43210',
  '98765_43210',
  'nau aath saat chhe paanch chaar teen do ek shoonya',
];
for (const t of shouldMask) ok(maskContactInfo(t).flagged, `should mask: ${t}`);

const shouldPass = [
  'Budget 7000000000 rupaye ka project hai',
  'Invoice no 8000000001 check karo',
  'Kaam 15000 me ho jayega, 7 din lagenge',
  'Website 45000 me, 20 din me deliver',
];
for (const t of shouldPass) ok(!maskContactInfo(t).flagged, `should not mask: ${t}`);

const masked = maskContactInfo('Call 9876543210 or mail a@b.com, upi rahul@paytm');
ok(!/9876543210/.test(masked.text), 'phone removed');
ok(!/a@b\.com/.test(masked.text), 'email removed');
ok(!/rahul@paytm/.test(masked.text), 'upi removed');

/* ---- NoSQL guard (report M1/M2) ---- */
assert.deepEqual(deepSanitize({ email: { $gt: '' }, 'a.b': 1, ok: 1 }), { email: {}, ok: 1 });
checks += 1;
const arr = [{ $ne: 1, keep: 2 }];
deepSanitize(arr);
assert.deepEqual(arr, [{ keep: 2 }]);
checks += 1;

/* ---- milestone split ---- */
for (const [amt, plan] of [[10000, 1], [10001, 2], [9999, 3], [100, 3]]) {
  const ms = splitMilestones(amt, plan);
  ok(ms.length === plan, `plan ${plan} gives ${plan} milestones`);
  ok(ms.every((m) => m.amount >= 1), `no zero-rupee milestone for ${amt}/${plan}`);
}
// The last milestone absorbs rounding, so totals still match for normal amounts.
ok(splitMilestones(9999, 3).reduce((a, b) => a + b.amount, 0) === 9999, 'split sums to the total');

/* ---- privacy shaping (report M6, PDF §9) ---- */
const order = {
  milestones: [
    { _id: '1', status: 'funded', payout: { commission: 50 }, submission: { note: 'x', files: [{ url: 'secret' }] } },
    { _id: '2', status: 'released', payout: { commission: 50 }, submission: { note: 'y', files: [{ url: 'fine' }] } },
  ],
};
const forClient = stripUnreleasedFiles(stripPayout(JSON.parse(JSON.stringify(order))));
ok(forClient.milestones.every((m) => m.payout === undefined), 'client sees no payout figures');
ok(forClient.milestones[0].submission.files.length === 0, 'unreleased files hidden from client');
ok(forClient.milestones[1].submission.files.length === 1, 'released files visible to client');

/* ---- phone handling (the "Sahi mobile number" bug) ---- */
for (const [input, expected] of [
  ['9876543210', '9876543210'],
  ['+91 98765 43210', '9876543210'],
  ['919876543210', '9876543210'],
  ['09876543210', '9876543210'],
  ['98765-43210', '9876543210'],
]) {
  ok(normalizePhone(input) === expected, `normalizePhone(${input}) -> ${expected}`);
}
// An extra digit must NOT be silently trimmed into a different, valid number.
for (const bad of ['98765432101', '9876543210123', '987654321']) {
  ok(!/^[6-9]\d{9}$/.test(normalizePhone(bad)), `rejects ${bad} instead of truncating it`);
}
ok(otpRequestSchema.safeParse({ phone: '+91 98765 43210' }).success, 'otpRequestSchema accepts a +91 number');
ok(!otpRequestSchema.safeParse({ phone: '5876543210' }).success, 'otpRequestSchema rejects a non 6-9 start');

/**
 * Regression: completeProfile must take the verified number from a signed
 * registration token. If the schema ever stops carrying it, signup breaks with
 * "Sahi mobile number chahiye" again.
 */
const cpShape = completeProfileSchema._def.shape();
ok('registrationToken' in cpShape, 'completeProfileSchema carries registrationToken');
ok(!completeProfileSchema.safeParse({ name: 'Ab Cd', role: 'client', acceptPolicy: true }).success,
  'completeProfile without a registration token is rejected');
const cpOk = completeProfileSchema.safeParse({
  registrationToken: 'x'.repeat(30),
  name: 'Ab Cd',
  role: 'client',
  acceptPolicy: true,
});
ok(cpOk.success && cpOk.data.registrationToken, 'completeProfile keeps the token after parsing');

/**
 * Regression: accounts sign up with a phone and no email, so the unique index
 * on email must be PARTIAL. A plain (or merely sparse) unique index makes the
 * second email-less account fail with "Is email se account pehle se bana hai".
 */
const emailIndex = User.schema.indexes().find(([keys]) => keys.email === 1 && Object.keys(keys).length === 1);
ok(emailIndex, 'User declares an index on email');
ok(emailIndex?.[1]?.unique === true, 'the email index is unique');
ok(
  Boolean(emailIndex?.[1]?.partialFilterExpression),
  'the email index is partial, so any number of accounts can have no email',
);
ok(User.schema.path('email').options.unique !== true, 'email is not ALSO marked unique inline (that would add a second, plain index)');
ok(User.schema.path('email').isRequired !== true, 'email is optional');

/** A duplicate key on an EMPTY value is a stale index, not a real clash. */
{
  const captured = [];
  const res = {
    status(c) { this.code = c; return this; },
    json(b) { captured.push({ code: this.code, body: b }); return this; },
  };
  const origError = console.error;
  console.error = () => {};
  errorHandler(
    Object.assign(new Error('E11000 duplicate key'), { code: 11000, keyValue: { email: null } }),
    { method: 'POST', originalUrl: '/api/auth/complete-profile' },
    res,
    () => {},
  );
  errorHandler(
    Object.assign(new Error('E11000 duplicate key'), { code: 11000, keyValue: { email: 'a@b.com' } }),
    { method: 'POST', originalUrl: '/api/users/me' },
    res,
    () => {},
  );
  console.error = origError;
  ok(!/email se account/i.test(captured[0].body.message), 'a null-email duplicate does not blame the email field');
  ok(/email se account/i.test(captured[1].body.message), 'a real email duplicate still says so');
  ok(captured[1].code === 409, 'a real duplicate is a 409');
}

/* ---- app boots ---- */
ok(createApp(), 'express app builds');

console.log(`All ${checks} checks passed`);
process.exit(0);
