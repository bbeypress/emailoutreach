const express = require('express');
const crypto = require('crypto');
const requireLogin = require('../lib/requireLogin');
const store = require('../lib/store');
const { encrypt } = require('../lib/crypto');
const {
  buildAuthUrl,
  exchangeCodeForTokens,
  fetchGoogleEmail
} = require('../lib/google');

const router = express.Router();

// Kick off the consent flow. Must be logged into your site first.
router.get('/start', requireLogin, (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;
  res.redirect(buildAuthUrl(state));
});

// Google redirects back here after the user approves/denies.
// Same app serves the frontend now, so we just redirect to '/' — no
// separate frontend origin/URL to configure.
router.get('/callback', requireLogin, async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect('/?connect_error=' + encodeURIComponent(error));
  }
  if (!state || state !== req.session.oauthState) {
    return res.status(400).send('Invalid OAuth state — please try connecting again.');
  }
  delete req.session.oauthState;

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      return res.status(400).send(
        'Google did not return a refresh token. Please remove this app\'s access at ' +
        'https://myaccount.google.com/permissions and try connecting again.'
      );
    }

    const gmailAddress = await fetchGoogleEmail(tokens.access_token);
    const expiry = Date.now() + tokens.expires_in * 1000;

    store.upsertAccount({
      userId: req.session.userId,
      gmailAddress,
      accessTokenEnc: encrypt(tokens.access_token),
      refreshTokenEnc: encrypt(tokens.refresh_token),
      tokenExpiry: expiry
    });

    res.redirect('/?connected=' + encodeURIComponent(gmailAddress));
  } catch (e) {
    console.error(e);
    res.status(500).send('Something went wrong connecting your account: ' + e.message);
  }
});

module.exports = router;
