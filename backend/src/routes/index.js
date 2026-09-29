import { Router } from 'express';
import mongoose from 'mongoose';
import { protect, optionalAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter, otpLimiter, uploadLimiter, writeLimiter } from '../middleware/security.js';
import { imageOnly, upload } from '../middleware/upload.js';

import * as auth from '../controllers/authController.js';
import * as users from '../controllers/userController.js';
import * as fl from '../controllers/freelancerController.js';
import * as chat from '../controllers/chatController.js';
import * as orders from '../controllers/orderController.js';
import * as pay from '../controllers/paymentController.js';
import * as admin from '../controllers/adminController.js';
import * as meta from '../controllers/metaController.js';
import * as reqs from '../controllers/requirementController.js';

const r = Router();

/* ---------- health & meta ---------- */
/**
 * Report H1: a down database means an unhealthy service. Uptime checks watch
 * the status code, so this returns 503 rather than a cheerful 200.
 */
r.get('/health', (_req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({
    success: dbUp,
    status: dbUp ? 'ok' : 'degraded',
    db: dbUp ? 'up' : 'down',
    uptimeSec: Math.round(process.uptime()),
    time: new Date().toISOString(),
  });
});
r.get('/meta', meta.meta);
r.post('/waitlist', authLimiter, validate({ body: meta.waitlistSchema }), meta.joinWaitlist);

/* ---------- auth: OTP login (PDF §2) ---------- */
r.post('/auth/otp/request', otpLimiter, validate({ body: auth.otpRequestSchema }), auth.requestOtp);
r.post('/auth/otp/verify', authLimiter, validate({ body: auth.otpVerifySchema }), auth.verifyOtp);
r.post('/auth/complete-profile', authLimiter, validate({ body: auth.completeProfileSchema }), auth.completeProfile);
r.post('/auth/admin/login', authLimiter, validate({ body: auth.adminLoginSchema }), auth.adminLogin);
r.get('/auth/me', protect, auth.me);
r.post('/auth/switch-role', protect, validate({ body: auth.switchRoleSchema }), auth.switchRole);
r.post('/auth/lang', protect, validate({ body: auth.setLangSchema }), auth.setLang);
r.post('/auth/change-password', protect, authLimiter, validate({ body: auth.changePasswordSchema }), auth.changePassword);

/* ---------- users ---------- */
r.patch('/users/me', protect, validate({ body: users.updateMeSchema }), users.updateMe);
r.post('/users/me/avatar', protect, uploadLimiter, imageOnly.single('avatar'), users.uploadAvatar);
r.get('/users/me/kyc', protect, users.getKyc);
r.post('/users/me/kyc', protect, writeLimiter, validate({ body: users.kycSchema }), users.submitKyc);
r.get('/users/me/export', protect, users.exportMyData);
r.post('/users/me/delete', protect, validate({ body: users.deleteAccountSchema }), users.requestAccountDeletion);
r.post('/users/me/delete/cancel', protect, users.cancelAccountDeletion);

/* ---------- notifications (PDF §15) ---------- */
r.get('/notifications', protect, users.listNotifications);
r.post('/notifications/read', protect, users.markNotificationsRead);

/* ---------- freelancers ---------- */
r.get('/freelancers', validate({ query: fl.searchSchema }), fl.searchFreelancers);
r.get('/freelancers/stats', validate({ query: fl.statsSchema }), fl.freelancerStats);
r.get('/freelancers/me/profile', protect, requireRole('freelancer'), fl.getMyProfile);
r.put('/freelancers/me/profile', protect, requireRole('freelancer'), validate({ body: fl.updateProfileSchema }), fl.updateMyProfile);
r.post('/freelancers/me/submit-verification', protect, requireRole('freelancer'), fl.submitVerification);
r.post('/freelancers/me/portfolio', protect, requireRole('freelancer'), uploadLimiter, upload.array('files', 5), fl.addPortfolio);
r.delete('/freelancers/me/portfolio/:itemId', protect, requireRole('freelancer'), fl.removePortfolio);
r.get('/freelancers/:id', optionalAuth, fl.getFreelancer);

/* ---------- requirements (PDF §11) ---------- */
r.get('/requirements', optionalAuth, validate({ query: reqs.listRequirementsSchema }), reqs.listRequirements);
r.post('/requirements', protect, writeLimiter, validate({ body: reqs.createRequirementSchema }), reqs.createRequirement);
r.get('/requirements/mine/interests', protect, reqs.myInterests);
r.get('/requirements/:id', optionalAuth, reqs.getRequirement);
r.patch('/requirements/:id', protect, validate({ body: reqs.closeSchema }), reqs.setRequirementStatus);
r.post('/requirements/:id/interest', protect, writeLimiter, validate({ body: reqs.interestSchema }), reqs.sendInterest);
r.post('/requirements/:id/interests/:interestId/chat', protect, reqs.chatWithInterest);

/* ---------- chat ---------- */
r.post('/conversations', protect, validate({ body: chat.startSchema }), chat.startConversation);
r.get('/conversations', protect, chat.listConversations);
r.get('/conversations/:id', protect, chat.getConversation);
r.get('/conversations/:id/messages', protect, validate({ query: chat.listMessagesSchema }), chat.listMessages);
r.post('/conversations/:id/messages', protect, validate({ body: chat.messageSchema }), chat.sendMessage);
r.post('/conversations/:id/files', protect, uploadLimiter, upload.single('file'), chat.sendFile);
r.post('/conversations/:id/read', protect, chat.markRead);
r.post('/conversations/:id/offers', protect, validate({ body: chat.offerSchema }), chat.sendOffer);
r.post('/conversations/:id/meetings', protect, validate({ body: chat.meetingSchema }), chat.proposeMeeting);
r.post('/messages/:messageId/offer', protect, validate({ body: chat.offerRespondSchema }), chat.respondOffer);
r.post('/messages/:messageId/meeting', protect, validate({ body: chat.meetingRespondSchema }), chat.respondMeeting);

/* ---------- orders & milestones ---------- */
r.post('/orders', protect, validate({ body: orders.createOrderSchema }), orders.createOrder);
r.get('/orders', protect, validate({ query: orders.listOrdersSchema }), orders.listOrders);
r.get('/orders/:id', protect, orders.getOrder);
r.post('/orders/:id/accept', protect, orders.acceptOrder);
r.post('/orders/:id/decline', protect, validate({ body: orders.declineSchema }), orders.declineOrder);
r.post('/orders/:id/cancel', protect, validate({ body: orders.cancelSchema }), orders.cancelOrder);
r.post('/orders/:id/dispute', protect, validate({ body: orders.disputeSchema }), orders.openDispute);
r.post('/orders/:id/dispute/withdraw', protect, orders.withdrawDispute);
r.post('/orders/:id/review', protect, validate({ body: orders.reviewSchema }), orders.reviewOrder);
r.post('/orders/:id/milestones/:msId/submit', protect, uploadLimiter, upload.array('files', 5), orders.submitMilestone);
r.post('/orders/:id/milestones/:msId/approve', protect, orders.approveMilestone);
r.post('/orders/:id/milestones/:msId/request-changes', protect, validate({ body: orders.changesSchema }), orders.requestChanges);

/* ---------- payments ---------- */
r.get('/payments/config', pay.paymentConfig);
r.post('/payments/orders/:orderId/milestones/:msId', protect, pay.createMilestonePayment);
r.post('/payments/verify', protect, validate({ body: pay.verifySchema }), pay.verifyPayment);
r.post('/payments/demo/confirm', protect, validate({ body: pay.demoConfirmSchema }), pay.confirmDemoPayment);
// NOTE: /payments/webhook is mounted in app.js with a raw body parser.

/* ---------- admin (PDF §16) ---------- */
const a = Router();
a.use(protect, requireRole('admin'));
a.get('/stats', admin.stats);
a.get('/freelancers', validate({ query: admin.listFreelancersSchema }), admin.listFreelancers);
a.patch('/freelancers/:id/verification', validate({ body: admin.verifySchema }), admin.setVerification);
a.get('/kyc', admin.listKyc);
a.patch('/kyc/:id', validate({ body: admin.kycDecisionSchema }), admin.setKyc);
a.get('/users', validate({ query: admin.listUsersSchema }), admin.listUsers);
a.patch('/users/:id/block', validate({ body: admin.blockSchema }), admin.setBlocked);
a.get('/orders', validate({ query: admin.listOrdersSchema }), admin.listOrders);
a.get('/disputes', admin.listDisputes);
a.post('/disputes/:id/resolve', validate({ body: admin.disputeResolveSchema }), admin.resolveDispute);
a.get('/payouts', admin.listPayouts);
a.post('/payouts/:orderId/:msId/paid', validate({ body: admin.payoutSchema }), admin.markPayoutPaid);
a.post('/payments/:paymentId/refund/retry', pay.retryRefund);
a.get('/reviews', admin.listReviews);
a.patch('/reviews/:id/hidden', validate({ body: admin.hideReviewSchema }), admin.setReviewHidden);
a.get('/commission', admin.getCommission);
a.put('/commission', validate({ body: admin.commissionSchema }), admin.setCommission);
a.get('/requirements', admin.listRequirementsAdmin);
a.get('/logs', validate({ query: admin.listLogsSchema }), admin.listLogs);
a.get('/waitlist', admin.listWaitlist);
r.use('/admin', a);

export default r;
