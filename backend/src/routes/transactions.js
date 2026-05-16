'use strict';
const router      = require('express').Router();
const mongoose    = require('mongoose');
const auth        = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const Account     = require('../models/Account');
const User        = require('../models/User');

// ── GET TRANSACTIONS ──────────────────────────────────────────────
router.get('/', auth, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const page  = Math.max(parseInt(req.query.page)  || 1,   1);
    const skip  = (page - 1) * limit;

    const txns = await Transaction.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json(txns);
  } catch (err) { next(err); }
});

// ── TRANSFER MONEY ────────────────────────────────────────────────
router.post('/transfer', auth, async (req, res, next) => {
  // Use MongoDB session for atomic transfer
  const session = await mongoose.startSession();

  try {
    const { toAccount, amount, note } = req.body;

    // Validate inputs
    if (!toAccount || typeof toAccount !== 'string') {
      return res.status(400).json({ message: 'Recipient account number is required.' });
    }
    const transferAmount = parseFloat(amount);
    if (!transferAmount || transferAmount <= 0 || isNaN(transferAmount)) {
      return res.status(400).json({ message: 'Please enter a valid amount greater than 0.' });
    }
    if (transferAmount < 1) {
      return res.status(400).json({ message: 'Minimum transfer amount is ₹1.' });
    }

    // Find sender account
    const senderAccount = await Account.findOne({ userId: req.user._id });
    if (!senderAccount) {
      return res.status(400).json({ message: 'Sender account not found.' });
    }

    // Check if self-transfer
    if (toAccount.trim() === req.user.accountNumber) {
      return res.status(400).json({ message: 'Cannot transfer money to your own account.' });
    }

    // Find recipient
    const recipient = await User.findOne({
      accountNumber: toAccount.trim().toUpperCase(),
      isActive: true,
    });
    if (!recipient) {
      return res.status(404).json({
        message: `Account ${toAccount} not found. Please check the account number.`
      });
    }

    // Check sufficient funds (checking account used for transfers)
    const totalAvailable = senderAccount.savings + senderAccount.checking;
    if (totalAvailable < transferAmount) {
      return res.status(400).json({
        message: `Insufficient funds. Available balance: ₹${totalAvailable.toFixed(2)}`
      });
    }

    // Find recipient account
    const recipientAccount = await Account.findOne({ userId: recipient._id });
    if (!recipientAccount) {
      return res.status(400).json({ message: 'Recipient account not properly set up.' });
    }

    // ── Atomic transaction using session ─────────────────────────
    await session.withTransaction(async () => {
      // Debit from sender (checking first, then savings)
      let remainingDebit = transferAmount;

      if (senderAccount.checking >= remainingDebit) {
        senderAccount.checking = parseFloat((senderAccount.checking - remainingDebit).toFixed(2));
        remainingDebit = 0;
      } else {
        remainingDebit -= senderAccount.checking;
        senderAccount.checking = 0;
        senderAccount.savings  = parseFloat((senderAccount.savings - remainingDebit).toFixed(2));
      }
      await senderAccount.save({ session });

      // Credit to recipient savings
      recipientAccount.savings = parseFloat(
        (recipientAccount.savings + transferAmount).toFixed(2)
      );
      await recipientAccount.save({ session });

      const senderNewTotal = senderAccount.savings + senderAccount.checking;

      // Record sender debit transaction
      await Transaction.create([{
        userId:       req.user._id,
        type:         'debit',
        amount:       transferAmount,
        description:  `Transfer to ${recipient.firstName} ${recipient.lastName}`,
        note:         note || '',
        toAccount:    recipient.accountNumber,
        balanceAfter: parseFloat(senderNewTotal.toFixed(2)),
        status:       'completed',
      }], { session });

      // Record recipient credit transaction
      await Transaction.create([{
        userId:       recipient._id,
        type:         'credit',
        amount:       transferAmount,
        description:  `Transfer from ${req.user.firstName} ${req.user.lastName}`,
        note:         note || '',
        fromAccount:  req.user.accountNumber,
        balanceAfter: parseFloat(recipientAccount.savings.toFixed(2)),
        status:       'completed',
      }], { session });
    });

    console.log(`✅ Transfer: ${req.user.accountNumber} → ${recipient.accountNumber} | ₹${transferAmount}`);

    res.json({
      message:    `Successfully transferred ₹${transferAmount.toFixed(2)} to ${recipient.firstName} ${recipient.lastName}`,
      newBalance: parseFloat((senderAccount.savings + senderAccount.checking).toFixed(2)),
    });

  } catch (err) {
    next(err);
  } finally {
    await session.endSession();
  }
});

module.exports = router;
