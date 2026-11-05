-- For the developer page: a record of every email sent and of errors, so a
-- lead email that fails or a request that breaks is never silent, and a
-- flag for chats that started while Michael was away.

create table email_log (
  id              bigint generated always as identity primary key,
  kind            text not null,              -- 'lead' or 'test'
  conversation_id uuid references conversations(id) on delete set null,
  recipients      text[] not null,
  subject         text not null,
  ok              boolean not null,
  error           text,
  created_at      timestamptz not null default now()
);
create index email_log_recent on email_log (created_at desc);
alter table email_log enable row level security;

create table error_log (
  id         bigint generated always as identity primary key,
  source     text not null,                   -- 'request', 'push', ...
  message    text not null,
  detail     jsonb,
  created_at timestamptz not null default now()
);
create index error_log_recent on error_log (created_at desc);
alter table error_log enable row level security;

alter table conversations add column started_away boolean not null default false;
update conversations c set started_away = true
where exists (
  select 1 from messages m
  where m.conversation_id = c.id and m.sender = 'system' and m.body like 'Michael is away%'
);
