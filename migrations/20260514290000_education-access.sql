ALTER TABLE public.education_sessions
ADD COLUMN IF NOT EXISTS access TEXT NOT NULL DEFAULT 'members_only'
CHECK (access IN ('members_only', 'open', 'paid', 'paid_members_free'));
