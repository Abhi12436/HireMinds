# ════════════════════════════════════════════════════════════
#  EMAIL CONFIGURATION
#  Fill these in to enable REAL email sending.
#  Leave blank to use SIMULATED mode (demo-safe, no emails sent).
# ════════════════════════════════════════════════════════════

# ─── OPTION 1: Gmail (easiest) ───
# 1. Go to your Google Account → Security → 2-Step Verification (turn ON)
# 2. Then Security → App passwords → generate one for "Mail"
# 3. Paste the 16-character password below (remove spaces)
GMAIL_ADDRESS = ""          # e.g. "abhiya2005@gmail.com"
GMAIL_APP_PASSWORD = ""     # e.g. "abcd efgh ijkl mnop" -> "abcdefghijklmnop"

# ─── Sender display name ───
SENDER_NAME = "HireMinds Recruiting Team"

# ─── How emails are sent ───
# If GMAIL_ADDRESS and GMAIL_APP_PASSWORD are both filled, real emails are sent.
# Otherwise the system runs in SIMULATED mode and just returns success.
