import api from '../api';

function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/** Opens Razorpay Checkout (or the demo prompt) and resolves with the payment result. */
async function collectPayment({ order, task, user }) {
  if (order.mock) {
    const ok = window.confirm(
      `DEMO MODE (no Razorpay keys configured)\n\nSimulate a successful payment of ₹${order.amount / 100}?`
    );
    if (!ok) throw new Error('Payment cancelled');
    return {
      razorpay_order_id: order.id,
      razorpay_payment_id: `pay_mock_${Date.now()}`,
      razorpay_signature: 'mock_signature',
    };
  }

  if (!(await loadRazorpay())) throw new Error('Could not load Razorpay. Check your internet connection.');

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.id,
      name: 'Assignment Bridge',
      description: `${task.title} · ${task.workLocation?.name || 'Work location not provided'}`,
      prefill: { name: user.name, email: user.email, contact: user.phone || '' },
      theme: { color: '#4f46e5' },
      handler: resolve,
      modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
    });
    rzp.on('payment.failed', (r) => reject(new Error(r?.error?.description || 'Payment failed')));
    rzp.open();
  });
}

/** Pay for a task and have the server verify the signature. Returns the updated task. */
export async function payForTask({ task, order, user }) {
  const result = await collectPayment({ order, task, user });
  const { data } = await api.post(`/tasks/${task._id}/verify-payment`, result);
  return data.task;
}
