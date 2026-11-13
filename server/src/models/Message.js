import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true, versionKey: false }
);

messageSchema.index({ task: 1, worker: 1, createdAt: 1, _id: 1 });

export default mongoose.model('Message', messageSchema);
