# Notification channels

## Product decision

SPORTZ does not require activity email. Product activity is delivered through:

- the in-app Notifications screen; and
- optional push alerts on registered iOS and Android devices.

There is no activity-email provider, queue, template set, digest, unsubscribe
token, suppression list, or email preference in the product. Settings must not
claim otherwise.

Supabase Auth transactional email is separate from product activity. Supabase may
send verification, password-recovery, MFA-recovery, and identity-change messages
when those security flows require them. These messages are necessary to complete
an account operation and are not controlled by activity notification preferences.

## Preferences

`notification_preferences.push_enabled` is the master push switch. The category
columns (`likes`, `comments`, `mentions`, `follows`, `messages`, `events`, and
`invites`) determine which optional activity events may produce push alerts.
Disabling a category does not delete or suppress its in-app notification record.

Conversation mutes provide an additional push-delivery check for chat messages.
Preferences are stored locally for immediate foreground handling and in Supabase
for server-side delivery enforcement.

## Data and retention

No activity-email consent, unsubscribe token, provider delivery record, bounce
record, complaint record, or suppression record is collected because activity
email is not sent. Notification data follows the application data-retention
policy. Supabase Auth owns retention and delivery behavior for its transactional
account-security messages.

If activity email becomes a product requirement later, it must be introduced as a
new channel with explicit consent, independently configurable categories,
asynchronous idempotent delivery, signed unsubscribe links, provider webhook
verification, suppression handling, failure monitoring, and a documented
retention policy before any Settings claim is added.
