ALTER TABLE club_members
ADD COLUMN IF NOT EXISTS report_publish_access boolean NOT NULL DEFAULT false;
