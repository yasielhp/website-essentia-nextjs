ALTER TABLE contacts ADD COLUMN IF NOT EXISTS newsletter_subscribed boolean DEFAULT false;
