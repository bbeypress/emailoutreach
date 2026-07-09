# --- Your site's own session security ---
SESSION_SECRET=replace_with_a_long_random_string

# --- Encryption key for tokens stored in the database ---
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
TOKEN_ENCRYPTION_KEY=replace_with_64_hex_characters

# --- Google OAuth client (from Google Cloud Console) ---
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
# Must exactly match your deployed URL + /auth/google/callback
GOOGLE_REDIRECT_URI=https://your-app-name.onrender.com/auth/google/callback

# --- Server ---
PORT=3000
# Your deployed URL (shown on your Render dashboard). Used only for the
# startup log message — not required for the app to function.
BASE_URL=https://your-app-name.onrender.com
