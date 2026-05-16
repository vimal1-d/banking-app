'use strict';
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName:     { type: String, required: true, trim: true, maxlength: 50 },
  lastName:      { type: String, required: true, trim: true, maxlength: 50 },
  email:         { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone:         { type: String, required: true, trim: true },
  address:       { type: String, required: true, trim: true },
  password:      { type: String, required: true, minlength: 8 },
  accountType:   { type: String, enum: ['savings', 'checking', 'business'], default: 'savings' },
  accountNumber: { type: String, unique: true, sparse: true },
  isActive:      { type: Boolean, default: true },
}, { timestamps: true });

// ── Indexes ─────────────────────────────────────────────────────────
userSchema.index({ email: 1 });
userSchema.index({ accountNumber: 1 });

// ── Auto-generate account number & hash password ─────────────────────
userSchema.pre('save', async function (next) {
  try {
    if (this.isNew && !this.accountNumber) {
      // Format: NB + timestamp last 6 digits + random 2 digits
      this.accountNumber = 'NB' + Date.now().toString().slice(-6)
        + Math.floor(10 + Math.random() * 90);
    }
    if (this.isModified('password')) {
      const salt    = await bcrypt.genSalt(12);
      this.password = await bcrypt.hash(this.password, salt);
    }
    next();
  } catch (err) {
    next(err);
  }
});

// ── Compare password ─────────────────────────────────────────────────
userSchema.methods.comparePassword = function (plainText) {
  return bcrypt.compare(plainText, this.password);
};

// ── Return user without sensitive fields ─────────────────────────────
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject({ virtuals: false });
  delete obj.password;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
