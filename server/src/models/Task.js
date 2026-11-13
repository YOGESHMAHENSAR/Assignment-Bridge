import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    point: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (coordinates) => coordinates.length === 2,
          message: 'Location coordinates must contain longitude and latitude',
        },
      },
    },
  },
  { _id: false }
);

export const TASK_STATUS = [
  'pending_payment', // created, tasker has not paid yet (hidden from workers)
  'open', // paid, visible to workers
  'accepted', // a worker is working on it
  'submitted', // worker uploaded finished work, waiting for tasker review
  'revision', // tasker asked for changes
  'approved', // tasker approved, worker paid
  'cancelled',
];

const fileSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: String,
    name: String,
    size: Number,
    mimeType: String,
  },
  { _id: false }
);

const submissionSchema = new mongoose.Schema(
  {
    files: [fileSchema],
    note: { type: String, maxlength: 2000 },
    submittedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    subject: { type: String, trim: true, maxlength: 60 },
    description: { type: String, required: true, trim: true, maxlength: 5000 }, // what to do
    additionalInfo: { type: String, trim: true, maxlength: 3000 },
    pages: { type: Number, min: 0 },
    deadline: { type: Date },
    files: [fileSchema], // tasker's attachments

    workLocation: { type: locationSchema, required: true },
    tasker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    ignoredBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    status: { type: String, enum: TASK_STATUS, default: 'pending_payment', index: true },

    // Money snapshot taken at creation so later price changes don't affect old tasks
    price: { type: Number, required: true },
    workerEarning: { type: Number, required: true },
    platformFee: { type: Number, required: true },

    payment: {
      orderId: String, // latest order
      orderIds: [String], // every order ever created, so a late payment on an older checkout still verifies
      paymentId: String,
      status: {
        type: String,
        enum: ['unpaid', 'paid', 'refunded'],
        default: 'unpaid',
      },
      mock: { type: Boolean, default: false },
      paidAt: Date,
      refundId: String,
      refundedAt: Date,
    },

    submissions: [submissionSchema],
    revisionCount: { type: Number, default: 0 },
    revisionNote: { type: String, maxlength: 2000 },

    review: {
      rating: { type: Number, min: 1, max: 5 },
      comment: { type: String, maxlength: 1000 },
    },

    workerPaid: { type: Boolean, default: false }, // worker's earning credited after approval

    acceptedAt: Date,
    submittedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
  },
  { timestamps: true }
);

taskSchema.index({ status: 1, createdAt: -1 });
taskSchema.index({ 'workLocation.point': '2dsphere' });
taskSchema.set('toJSON', {
  transform: (_doc, ret) => {
    if (ret.workLocation?.point) delete ret.workLocation.point;
    delete ret.__v;
    return ret;
  },
});
taskSchema.set('toObject', {
  transform: (_doc, ret) => {
    if (ret.workLocation?.point) delete ret.workLocation.point;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('Task', taskSchema);
