import mongoose from 'mongoose';

const payoutSchema = new mongoose.Schema(
  {
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    upiId: { type: String, required: true, trim: true },
    status: { type: String, enum: ['requested', 'paid', 'rejected'], default: 'requested', index: true },
    adminNote: { type: String, maxlength: 500 },
    reference: { type: String, maxlength: 120 }, // UTR / transaction id entered by admin
    processedAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model('Payout', payoutSchema);
