-- Clean up payment_status = 'pending' on bookings that are already confirmed.
-- These are bookings where a Redsys payment session was initiated but the webhook
-- never fired (old bug, now fixed), yet staff confirmed them from the dashboard.
--
-- The Transactions page now shows 'confirmed' + 'pending' payment as "Completed"
-- via display logic. This script cleans the DB to reflect reality.
--
-- Run in Insforge SQL Editor (SELECT only — DML blocked for security):
SELECT status, payment_status, count(*)
FROM bookings
GROUP BY status, payment_status
ORDER BY status, payment_status;

-- To update, use Insforge Dashboard:
-- Database > Tables > bookings > Filter: status=confirmed AND payment_status=pending
-- Select all > Edit > Set payment_status = NULL
