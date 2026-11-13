import Task from '../models/Task.js';
import Transaction from '../models/Transaction.js';
import ApiError from '../utils/ApiError.js';
import { refundPayment } from './payments.js';

/**
 * Cancel a task that no worker has picked up yet and refund the tasker.
 * Used by the tasker (own tasks only) and by admins (any task).
 */
export async function cancelTaskWithRefund(taskId, { taskerId = null } = {}) {
  const existing = await Task.findById(taskId);
  if (!existing) throw new ApiError(404, 'Task not found');
  if (taskerId && !existing.tasker.equals(taskerId)) throw new ApiError(403, 'This is not your task');

  // Atomic status flip: stops a worker accepting it at the same moment.
  const previous = await Task.findOneAndUpdate(
    { _id: taskId, status: { $in: ['pending_payment', 'open'] } },
    { status: 'cancelled', cancelledAt: new Date() },
    { new: false }
  );
  if (!previous) {
    throw new ApiError(409, 'Only tasks that are not yet accepted by a worker can be cancelled');
  }

  if (previous.payment.status !== 'paid') {
    return Task.findById(taskId);
  }

  try {
    const refundId = await refundPayment(previous);
    const updated = await Task.findByIdAndUpdate(
      taskId,
      { 'payment.status': 'refunded', 'payment.refundId': refundId, 'payment.refundedAt': new Date() },
      { new: true }
    );
    await Transaction.create({
      type: 'refund',
      task: taskId,
      user: previous.tasker,
      amount: previous.price,
      reference: refundId,
    });
    return updated;
  } catch (err) {
    // Refund failed: put the task back so nothing is lost, and report it.
    await Task.updateOne(
      { _id: taskId },
      { status: previous.status, $unset: { cancelledAt: 1 } }
    );
    console.error('Refund failed', err?.error || err);
    throw new ApiError(502, 'Refund could not be processed right now. Please try again shortly.');
  }
}
