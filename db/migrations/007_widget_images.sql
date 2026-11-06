-- Images uploaded on the developer page for the chat button and the
-- greeting beside it: a logo, or a photo. Small (the developer page shrinks
-- them first) and public, since every visitor's browser loads them.
create table widget_images (
  id         uuid primary key default gen_random_uuid(),
  type       text not null,
  data       bytea not null,
  created_at timestamptz not null default now()
);
alter table widget_images enable row level security;
