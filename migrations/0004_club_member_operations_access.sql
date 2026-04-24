ALTER TABLE club_members
ADD COLUMN IF NOT EXISTS operations_access boolean NOT NULL DEFAULT false;

