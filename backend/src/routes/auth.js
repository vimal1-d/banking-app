'use strict';
const router  = require('express').Router();
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');
const Account = require('../models/Account');

const JWT_SECRET  = process.env.JWT_SECRET  || 'dev-secret-change-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '24h';

// ── REGISTER ──────────────────────────────────────────────────────
router.post('/register', async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, address, password, accountType } = req.body;

    // Validate required fields
    const missing = [];
    if (!firstName) missing.push('firstName');
    if (!lastName)  missing.push('lastName');
    if (!email)     missing.push('email');
    if (!phone)     missing.push('phone');
    if (!address)   missing.push('address');
    if (!password)  missing.push('password');

    if (missing.length > 0) {
      return res.status(400).json({
        message: `Missing required fields: ${missing.join(', ')}`
      });
    }

    // Email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format.' });
    }

    // Password length check
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    // Check duplicate email
    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) {
      return res.status(409).json({ message: 'This email is already registered. Please login.' });
    }

    // Create user (password hashed in pre-save hook)
    const user = await User.create({
      firstName: firstName.trim(),
      lastName:  lastName.trim(),
      email:     email.toLowerCase().trim(),
      phone:     phone.trim(),
      address:   address.trim(),
      password,
      accountType: accountType || 'savings',
    });

    // Create account with welcome balance
    await Account.create({
      userId:   user._id,
      savings:  1000,  // ₹1000 welcome bonus
      checking: 500,   // ₹500 welcome bonus
    });

    console.log(`✅ New user registered: ${user.email} | Account: ${user.accountNumber}`);

    res.status(201).json({
      message:       'Account created successfully! Welcome to NovaBanc.',
      accountNumber: user.accountNumber,
      email:         user.email,
    });

  } catch (err) {
    // Mongoose duplicate key error
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Email already registered.' });
    }
    next(err);
  }
});

// ── LOGIN ─────────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      // Don't reveal if email exists
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account deactivated. Please contact support.' });
    }

    // Issue JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    console.log(`✅ Login: ${user.email}`);

    res.json({
      token,
      user: user.toSafeObject(),
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;
