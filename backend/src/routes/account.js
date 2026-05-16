'use strict';
const router  = require('express').Router();
const auth    = require('../middleware/auth');
const Account = require('../models/Account');

// ── GET BALANCE ───────────────────────────────────────────────────
router.get('/balance', auth, async (req, res, next) => {
  try {
    let account = await Account.findOne({ userId: req.user._id });

    // Auto-create account if missing (shouldn't happen but safety net)
    if (!account) {
      account = await Account.create({
        userId:   req.user._id,
        savings:  0,
        checking: 0,
      });
    }

    res.json({
      savings:  parseFloat(account.savings.toFixed(2)),
      checking: parseFloat(account.checking.toFixed(2)),
      total:    parseFloat((account.savings + account.checking).toFixed(2)),
    });
  } catch (err) { next(err); }
});

// ── GET PROFILE ───────────────────────────────────────────────────
router.get('/profile', auth, async (req, res) => {
  res.json(req.user.toSafeObject());
});

module.exports = router;
