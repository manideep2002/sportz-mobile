# Account security and recovery

## Security boundary

SPORTZ never treats a client timestamp or an unlocked screen as proof of recent authentication. Password or
verified-email proof is checked by the `account-security` Edge Function. A successful proof creates a
server-only grant bound to the current Supabase `session_id`; it expires after 10 minutes.

Password changes, identity changes, MFA changes, session revocation, MFA recovery, and account deletion
require that grant. Each operation also has a server-side rate limit. Password changes revoke every other
session. MFA recovery removes all authenticator factors and invalidates other sessions. Account deletion
requires the current verified email or phone plus the exact word `DELETE`.

Access and refresh tokens, passwords, OTP values, MFA secrets, private media URLs, email addresses, phone
numbers, and IP addresses are never stored in the security audit log or notification payload. Edge logs use
the shared observability redactor.

## Recovery

1. On the MFA challenge, choose **I lost my authenticator**.
2. Prove account ownership with the current password. Password accounts then confirm the one-time recovery
   code delivered to the verified email.
3. Confirm recovery. All TOTP factors are removed and other sessions are invalidated.
4. Sign in again and immediately enroll a new authenticator from **Settings → Account security**.

Social-login or passwordless users who do not yet have an account password first sign out, use **Forgot
Password** to establish one through the verified email recovery flow, and then return to MFA recovery. The
password-recovery route is available before the MFA gate and signs out other sessions after the password is
changed.

If the verified email is no longer accessible, automated recovery is intentionally unavailable. Support must
perform the documented ownership-verification procedure before an administrator removes factors. Support
must never ask for a password, OTP, access token, refresh token, or authenticator secret.

## Identity verification

Email changes use Supabase double-confirmation: the old and new addresses must both approve the change.
Phone changes require an enabled SMS provider and a successful `phone_change` OTP. Production must not
enable the phone UI without an operational SMS provider.

## Sessions and history

The active-session view exposes only creation/last-active time, a shortened user-agent label, and whether the
session is current. It deliberately omits tokens and IP addresses. SPORTZ does not keep a general login
history. Privacy-minimized security events are retained for 90 days and then pruned, unless an abuse or legal
hold explicitly requires longer retention.

## Operational recovery checklist

- Verify the requester through the approved support workflow outside chat.
- Record only the support case identifier; do not copy identity documents into application logs.
- Use Supabase administrator MFA factor removal only after approval.
- Revoke all sessions after factor removal.
- Notify the account through its verified channel.
- Ask the user to reset the password and enroll MFA again.
