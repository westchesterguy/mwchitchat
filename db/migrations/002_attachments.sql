-- Photos and PDFs sent in a chat, by either side. Kept in the database so
-- they are as private as the messages: served only through this app, by an
-- id nobody can guess, and never through Supabase's public API.
create table attachments (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  name            text not null,
  type            text not null,
  size            int not null,
  -- for photos, so the thread can hold their space before they load
  width           int,
  height          int,
  data            bytea not null,
  created_at      timestamptz not null default now()
);
create index attachments_by_conversation on attachments (conversation_id);
alter table attachments enable row level security;

alter table messages add column attachment_id uuid references attachments(id) on delete set null;
