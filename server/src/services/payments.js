import crypto from 'crypto';
import Razorpay from 'razorpay';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';

const razorpay = env.razorpayEnabled
  ? new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret })
  : null;

export const MOCK_SIGNATURE = 'mock_signature';

/** Create a payment order for a task. Amount is in rupees. */
export async function createOrder(task) {
  if (razorpay) {
    const order = await razorpay.orders.create({
      amount: Math.round(task.price * 100), // paise
      currency: 'INR',
      receipt: `task_${task._id}`,
      notes: { taskId: String(task._id) },
    });
    return { id: order.id, amount: order.amount, currency: order.currency, mock: false };
  }
  if (env.mockPayments) {
    return {
      id: `order_mock_${task._id}_${Date.now()}`,
      amount: Math.round(task.price * 100),
      currency: 'INR',
      mock: true,
    };
  }
  throw new ApiError(503, 'Payments are not configured');
}

/** Verify the signature Razorpay Checkout returns after a successful payment. */
export function verifyPayment({ orderId, paymentId, signature }) {
  if (razorpay) {
    if (!orderId || !paymentId || !signature) return false;
    const expected = crypto
      .createHmac('sha256', env.razorpay.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(String(signature));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  // Demo mode (never enabled in production)
  return env.mockPayments && signature === MOCK_SIGNATURE;
}

/** Refund the full payment for a task. Returns a refund id. */
export async function refundPayment(task) {
  if (razorpay && !task.payment.mock) {
    const refund = await razorpay.payments.refund(task.payment.paymentId, {
      amount: Math.round(task.price * 100),
      notes: { taskId: String(task._id), reason: 'Task cancelled' },
    });
    return refund.id;
  }
  return `refund_mock_${task._id}`;
}
