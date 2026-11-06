-- The rescue: when a visitor waits too long for a reply, and when Michael
-- replies after they have left.

-- When the rescue message was last posted in a chat (or the away message,
-- which does the same job). Another rescue waits until Michael has replied.
alter table conversations add column rescued_at timestamptz;
update conversations set rescued_at = created_at where started_away;

-- The last of Michael's messages already emailed to the visitor.
alter table conversations add column visitor_emailed_upto bigint not null default 0;
