-- Allow delegating forward/share clearance to collaborators and groups

ALTER TABLE profile_shares ADD COLUMN can_share INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profile_group_shares ADD COLUMN can_share INTEGER NOT NULL DEFAULT 0;
