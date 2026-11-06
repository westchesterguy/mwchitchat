-- Notifications: when Michael is actually looking at a chat (so its new
-- messages don't also buzz his phone), and a record of every notification
-- sent, so a late or missing one can be traced.

-- Set only while a chat is on screen, in focus, with recent taps or typing.
-- "Read" (agent_last_read_at) stays separate: a chat left open on a laptop
-- is read, but nobody is watching it.
alter table conversations add column agent_watching_at timestamptz;

create table push_log (
  id         bigint generated always as identity primary key,
  title      text not null,
  service    text not null,          -- the push service's host, e.g. fcm.googleapis.com
  status     int,
  ok         boolean not null,
  error      text,
  ms         int,
  created_at timestamptz not null default now()
);
create index push_log_recent on push_log (created_at desc);
alter table push_log enable row level security;
