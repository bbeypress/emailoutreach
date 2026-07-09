const express = require('express');
const requireLogin = require('../lib/requireLogin');
const store = require('../lib/store');
const { decrypt } = require('../lib/crypto');
const { revokeToken } = require('../lib/google');

const router = express.Router();

// List the logged-in user's connected accounts (never returns tokens)
router.get('/', requireLogin, (req, res) => {
  const rows = store.getAccountsForUser(req.session.userId)
    .map(a => ({ id: a.id, gmail_address: a.gmail_address, created_at: a.created_at }));
  res.json({ accounts: rows });
});

// Disconnect: revoke with Google, then delete the row
router.delete('/:id', requireLogin, async (req, res) => {
  const row = store.getAccountById(Number(req.params.id), req.session.userId);
  if (!row) return res.status(404).json({ error: 'Account not found.' });

  await revokeToken(decrypt(row.refresh_token_enc));
  store.deleteAccount(row.id);
  res.json({ ok: true });
});

module.exports = router;
