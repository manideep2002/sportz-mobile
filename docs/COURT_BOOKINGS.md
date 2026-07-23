# Court scheduling and payment

Each court is configured with:

- An IANA timezone.
- One operating-hours row for each weekday.
- Optional closure ranges for maintenance, holidays, or private use.
- A fixed slot duration from 15 to 240 minutes.
- A future booking window and cancellation notice period.
- Whether venue approval is required.
- Whether payment is external or not required.

New courts receive default 06:00–22:00 hours for all seven days. Administrators should replace these defaults and add known closures before enabling bookings.

SPORTZ does not collect court payments. `external` means the player pays the venue directly; `not_required` means there is no booking charge. No client screen should describe an external booking as paid or verified.

Availability is generated in the court’s timezone and excludes closures plus every pending or confirmed booking. Clients must submit one of the returned slots unchanged. The database revalidates the slot, locks the court, and retains the exclusion constraint as the final concurrent-conflict safeguard.
