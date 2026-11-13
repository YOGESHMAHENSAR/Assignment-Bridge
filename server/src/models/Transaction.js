import mongoose from 'mongoose';

// Simple ledger so the admin can audit where every rupee went.
const transactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['task_payment', 'worker_earning', 'platform_fee', 'refund', 'payout'],
      required: true,
    },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: { type: Number, required: true },
    reference: String,
  },
  { timestamps: true }
);

export default mongoose.model('Transaction', transactionSchema);
