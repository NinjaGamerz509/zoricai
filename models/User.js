const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  name: { type: String, default: 'Boss' },
  preferences: {
    theme: { type: String, default: 'neon-cyan' },
    voiceEnabled: { type: Boolean, default: true },
    model: { type: String, default: 'llama-3.3-70b-versatile' },
    ttsLanguage: { type: String, default: 'hi' }
  },
  googleTokens: {
    access_token: String,
    refresh_token: String,
    expiry_date: Number,
    token_type: String,
    scope: String
  }
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
