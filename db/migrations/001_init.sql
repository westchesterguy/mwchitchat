-- Live chat for westchesterguy.com and westchesterhorseproperties.com.
--
-- Only this app's server reads and writes these tables, with the database
-- owner's credentials. Row level security is switched on with no policies,
-- so Supabase's public API (the anon and authenticated roles) can read and
-- write nothing here, even though the tables sit in the public schema.

create table visitors (
  id            uuid primary key default gen_random_uuid(),
  -- sha256 of the random token the widget keeps in the visitor's browser
  token_hash    text not null unique,
  first_site    text not null,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  current_site  text,
  current_url   text,
  current_title text,
  referrer      text,
  ip            text,
  country       text,
  region        text,
  city          text,
  user_agent    text,
  name          text,
  email         text,
  phone         text
);

create table conversations (
  id                   uuid primary key default gen_random_uuid(),
  visitor_id           uuid not null references visitors(id) on delete cascade,
  -- where the chat was started; visitors.current_* is where they are now
  site                 text not null,
  start_url            text,
  start_title          text,
  status               text not null default 'open' check (status in ('open', 'closed')),
  -- the pre-chat answers as asked: [{ key, label, value }]
  prechat              jsonb not null default '[]'::jsonb,
  ip                   text,
  country              text,
  region               text,
  city                 text,
  created_at           timestamptz not null default now(),
  last_message_at      timestamptz not null default now(),
  agent_last_read_at   timestamptz,
  closed_at            timestamptz
);
create index conversations_inbox on conversations (status, last_message_at desc);
create index conversations_visitor on conversations (visitor_id, created_at desc);

create table messages (
  id              bigint generated always as identity primary key,
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender          text not null check (sender in ('visitor', 'agent', 'system')),
  body            text not null,
  created_at      timestamptz not null default now()
);
create index messages_by_conversation on messages (conversation_id, id);

-- The pre-chat questionnaire, edited from the admin app.
create table prechat_fields (
  id         uuid primary key default gen_random_uuid(),
  position   int not null default 0,
  key        text not null unique,
  label      text not null,
  type       text not null check (type in ('text', 'email', 'tel', 'textarea', 'select', 'checkbox')),
  required   boolean not null default false,
  options    jsonb not null default '[]'::jsonb,
  sites      text[] not null default '{westchesterguy,horse}',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table settings (
  key   text primary key,
  value jsonb not null
);

-- Devices Michael has turned notifications on for.
create table push_subscriptions (
  endpoint   text primary key,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table visitors           enable row level security;
alter table conversations      enable row level security;
alter table messages           enable row level security;
alter table prechat_fields     enable row level security;
alter table settings           enable row level security;
alter table push_subscriptions enable row level security;

-- Starting questionnaire. Everything here can be changed in the admin app.
-- The consent wording is the sites' own contact-form text, word for word.
insert into prechat_fields (position, key, label, type, required, options) values
  (10, 'name',     'Your name', 'text',  true,  '[]'),
  (20, 'email',    'Email',     'email', true,  '[]'),
  (30, 'phone',    'Phone',     'tel',   false, '[]'),
  (40, 'interest', 'I''m interested in', 'select', false,
       '["Buying", "Selling", "Renting", "Something else"]'),
  (50, 'sms_consent',
       'I agree to receive text messages from Michael Winter about my inquiry. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of any service. See our Privacy Policy and Terms of Service.',
       'checkbox', false, '[]');

insert into settings (key, value) values ('agent_online', 'true'::jsonb);
