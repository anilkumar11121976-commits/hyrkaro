import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    lastMessage: {
      text: String,
      type: { type: String },
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      at: Date,
    },
    unreadClient: { type: Number, default: 0 },
    unreadFreelancer: { type: Number, default: 0 },
  },
  { timestamps: true },
);

conversationSchema.index({ client: 1, freelancer: 1 }, { unique: true });
conversationSchema.index({ updatedAt: -1 });

conversationSchema.methods.hasMember = function hasMember(userId) {
  const id = String(userId);
  return String(this.client._id || this.client) === id || String(this.freelancer._id || this.freelancer) === id;
};

conversationSchema.methods.otherMember = function otherMember(userId) {
  const id = String(userId);
  return String(this.client._id || this.client) === id ? this.freelancer : this.client;
};

export default mongoose.model('Conversation', conversationSchema);
