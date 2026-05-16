'use strict';
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type:         { type: String, enum: ['credit', 'debit'], required: true },
  amount:       { type: Number, required: true, min: 0.01 },
  description:  { type: String, required: true, maxlength: 200 },
  note:         { type: String, maxlength: 200, default: '' },
  toAccount:    { type: String, default: null },
  fromAccount:  { type: String, default: null },
  balanceAfter: { type: Number, default: 0 },
  status:       { type: String, enum: ['completed', 'pending', 'failed'], default: 'completed' },
}, { timestamps: true });

// Index for fast user transaction lookup
transactionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
