-- What a member of staff is: fisioterapeuta, doctora, nutricionista…
--
-- Free text on purpose: the list of professions here is not closed, and a
-- lookup table would be four rows and a join for something nobody filters by.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS job_title text;
