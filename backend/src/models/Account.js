'use strict';
const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  userId:   {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  savings:  { type: Number, default: 0, min: 0 },
  checking: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

// Virtual: total balance
accountSchema.virtual('total').get(function () {
  return parseFloat((this.savings + this.checking).toFixed(2));
});

accountSchema.set('toJSON',   { virtuals: true });
accountSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Account', accountSchema);
