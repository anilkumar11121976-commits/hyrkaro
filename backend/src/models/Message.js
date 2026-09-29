import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['text', 'file', 'offer', 'meeting', 'system'], default: 'text' },
    text: { type: String, maxlength: 4000, default: '' },
    /** Contact details were found and masked (PDF §5). */
    flagged: { type: Boolean, default: false },
    flagKinds: { type: [String], default: undefined },
    file: {
      url: String,
      publicId: String,
      name: String,
      size: Number,
      mime: String,
      resourceType: String,
      /** PDF §5: set when the order completes; a job deletes the asset after this. */
      purgeAt: Date,
      purgedAt: Date,
    },
    offer: {
      amount: Number,
      deliveryDays: Number,
      description: String,
      status: {
        type: String,
        enum: ['pending', 'accepted', 'declined', 'countered', 'withdrawn', 'used'],
      },
      respondedAt: Date,
      order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    },
    meeting: {
      when: Date,
      mins: Number,
      topic: String,
      status: { type: String, enum: ['proposed', 'confirmed', 'declined', 'cancelled'] },
      link: String,
    },
    readAt: Date,
  },
  { timestamps: true },
);

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ 'file.purgeAt': 1 }, { sparse: true });

export default mongoose.model('Message', messageSchema);
