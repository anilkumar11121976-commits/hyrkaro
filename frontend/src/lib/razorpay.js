import api from './api';

let scriptPromise = null;
function loadCheckout() {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = () => resolve(true);
      s.onerror = () => {
        scriptPromise = null;
        resolve(false);
      };
      document.body.appendChild(s);
    });
  }
  return scriptPromise;
}

/**
 * Pay for one milestone.
 * - With Razorpay keys on the server: opens Razorpay Checkout and verifies the payment.
 * - Without keys: silently uses demo mode (no errors shown).
 * Resolves with { ok: true, order } or { ok: false, cancelled?: true }.
 */
export async function payMilestone(orderId, msId) {
  const { data } = await api.post(`/payments/orders/${orderId}/milestones/${msId}`);

  if (data.mode === 'demo') {
    const res = await api.post('/payments/demo/confirm', { paymentId: data.paymentId });
    return { ok: true, order: res.data.order, demo: true };
  }

  const loaded = await loadCheckout();
  if (!loaded) throw new Error('Payment page load nahi hua. Internet check karke dobara try karo.');

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: data.keyId,
      order_id: data.razorpayOrderId,
      amount: data.amount,
      currency: data.currency,
      name: data.name,
      description: data.description,
      prefill: data.prefill,
      theme: { color: '#5B3FC4' },
      handler: async (resp) => {
        try {
          const res = await api.post('/payments/verify', { paymentId: data.paymentId, ...resp });
          resolve({ ok: true, order: res.data.order });
        } catch (e) {
          reject(e);
        }
      },
      modal: { ondismiss: () => resolve({ ok: false, cancelled: true }) },
    });
    rzp.on('payment.failed', () => {
      /* Razorpay shows its own retry UI; nothing to do here */
    });
    rzp.open();
  });
}
