-- For the AI assistant (off unless switched on in the developer page).

-- Replies written by the assistant are Michael's side of the chat, marked.
alter table messages add column ai boolean not null default false;

-- Michael typing in a chat takes it over: the assistant stays out of it.
alter table conversations add column ai_paused boolean not null default false;

-- Every call to an AI service: what was asked of it and how it went.
create table ai_log (
  id              bigint generated always as identity primary key,
  conversation_id uuid references conversations(id) on delete set null,
  purpose         text not null,               -- 'reply', 'draft' or 'test'
  provider        text not null,
  model           text not null,
  ok              boolean not null,
  error           text,
  ms              int,
  input_tokens    int,
  output_tokens   int,
  created_at      timestamptz not null default now()
);
create index ai_log_recent on ai_log (created_at desc);
alter table ai_log enable row level security;
