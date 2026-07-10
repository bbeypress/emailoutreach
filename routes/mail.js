const express = require('express');
const requireLogin = require('../lib/requireLogin');
const store = require('../lib/store');
const { getValidAccessToken, sendGmail } = require('../lib/google');

const router = express.Router();

// Send one message from one of the logged-in user's connected accounts.
// Body: { accountId, to, subject, body }
router.post('/send', requireLogin, async (req, res) => {
  const { accountId, to, subject, body } = req.body;
  if (!accountId || !to || !subject || !body) {
    return res.status(400).json({ error: 'accountId, to, subject, and body are required.' });
  }

  const account = store.getAccountById(Number(accountId), req.session.userId);
  if (!account) return res.status(404).json({ error: 'Connected account not found.' });

  try {
    const accessToken = await getValidAccessToken(account); // refreshes if needed
    const result = await sendGmail(accessToken, to, subject, body);
    res.json({ ok: true, messageId: result.id });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: e.message });
  }
});

module.exports = router;
