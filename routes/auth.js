const express = require('express');
const bcrypt = require('bcryptjs');
const store = require('../lib/store');

const router = express.Router();

router.post('/signup', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Email and a password (8+ chars) are required.' });
  }
  if (store.getUserByEmail(email)) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const hash = bcrypt.hashSync(password, 12);
  const user = store.createUser(email, hash);
  req.session.userId = user.id;
  res.json({ ok: true, email: user.email });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = store.getUserByEmail(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  req.session.userId = user.id;
  res.json({ ok: true, email: user.email });
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (!req.session.userId) return res.json({ loggedIn: false });
  const user = store.getUserById(req.session.userId);
  if (!user) return res.json({ loggedIn: false });
  res.json({ loggedIn: true, user: { id: user.id, email: user.email } });
});

module.exports = router;
