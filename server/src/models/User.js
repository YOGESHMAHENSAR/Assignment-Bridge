import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ['admin', 'tasker', 'worker'], required: true },
    phone: { type: String, trim: true, maxlength: 20 },
    upiId: { type: String, trim: true, maxlength: 80 },
    isBlocked: { type: Boolean, default: false },

    // Worker earnings (rupees)
    balance: { type: Number, default: 0, min: 0 }, // available to withdraw
    totalEarned: { type: Number, default: 0 },
    completedCount: { type: Number, default: 0 },
    ratingSum: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

userSchema.virtual('rating').get(function rating() {
  return this.ratingCount ? Math.round((this.ratingSum / this.ratingCount) * 10) / 10 : null;
});

// Async hook without a `next` callback works on every supported Mongoose version.
userSchema.pre('save', async function hash() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.__v;
    delete ret.id;
    return ret;
  },
});

export default mongoose.model('User', userSchema);
