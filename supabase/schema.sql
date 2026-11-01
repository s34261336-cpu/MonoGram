-- Monogram data model. This migration is additive and safe to re-run.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null default 'Новый пользователь',
  bio text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z][a-z0-9_]{2,31}$')
);

create table if not exists public.star_wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance integer not null default 100 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.dm_conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.dm_members (
  conversation_id uuid not null references public.dm_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists dm_members_user_idx on public.dm_members(user_id, conversation_id);

create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.dm_conversations(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (length(trim(content)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists dm_messages_conversation_created_idx
  on public.dm_messages(conversation_id, created_at desc);

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(trim(title)) between 2 and 80),
  username text not null unique,
  description text not null default '' check (length(description) <= 500),
  created_at timestamptz not null default now(),
  constraint channels_username_format check (username ~ '^[a-z][a-z0-9_]{2,31}$')
);

create table if not exists public.channel_members (
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create index if not exists channel_members_user_idx on public.channel_members(user_id, channel_id);

create table if not exists public.channel_posts (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists channel_posts_channel_created_idx
  on public.channel_posts(channel_id, created_at desc);

create table if not exists public.star_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount <> 0),
  reason text not null,
  reference_post_id uuid references public.channel_posts(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists star_transactions_user_created_idx
  on public.star_transactions(user_id, created_at desc);

create table if not exists public.star_reactions (
  post_id uuid not null references public.channel_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  stars integer not null check (stars > 0),
  updated_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create or replace function public.is_current_dm_member(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.dm_members
    where conversation_id = target_conversation_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_current_channel_member(target_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.channel_members
    where channel_id = target_channel_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_current_channel_owner(target_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.channels
    where id = target_channel_id
      and owner_id = auth.uid()
  );
$$;

drop trigger if exists on_monogram_user_created on auth.users;
drop function if exists public.handle_monogram_user_created();

create or replace function public.start_conversation(p_username text)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  target_user_id uuid;
  conversation_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Нужно войти в аккаунт';
  end if;

  select id into target_user_id
  from public.profiles
  where username = lower(trim(p_username));

  if target_user_id is null then
    raise exception 'Пользователь не найден';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'Нельзя начать чат с собой';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      least(auth.uid()::text, target_user_id::text) || ':' ||
      greatest(auth.uid()::text, target_user_id::text),
      0
    )
  );

  select first_member.conversation_id into conversation_id
  from public.dm_members first_member
  join public.dm_members second_member
    on second_member.conversation_id = first_member.conversation_id
  where first_member.user_id = auth.uid()
    and second_member.user_id = target_user_id
    and (
      select count(*)
      from public.dm_members member_count
      where member_count.conversation_id = first_member.conversation_id
    ) = 2
  limit 1;

  if conversation_id is null then
    insert into public.dm_conversations default values
    returning id into conversation_id;
    insert into public.dm_members (conversation_id, user_id)
    values (conversation_id, auth.uid()), (conversation_id, target_user_id);
  end if;

  return conversation_id;
end;
$$;

create or replace function public.create_channel(
  p_title text,
  p_username text,
  p_description text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  new_channel_id uuid;
  clean_title text := trim(p_title);
  clean_username text := lower(trim(p_username));
  clean_description text := coalesce(trim(p_description), '');
begin
  if auth.uid() is null then
    raise exception 'Нужно войти в аккаунт';
  end if;
  if length(clean_title) < 2 or length(clean_title) > 80 then
    raise exception 'Название канала должно содержать от 2 до 80 символов';
  end if;
  if clean_username !~ '^[a-z][a-z0-9_]{2,31}$' then
    raise exception 'Юзернейм канала должен начинаться с латинской буквы и содержать 3–32 символа';
  end if;
  if length(clean_description) > 500 then
    raise exception 'Описание слишком длинное';
  end if;

  insert into public.channels (owner_id, title, username, description)
  values (auth.uid(), clean_title, clean_username, clean_description)
  returning id into new_channel_id;

  insert into public.channel_members (channel_id, user_id, role)
  values (new_channel_id, auth.uid(), 'owner');

  return new_channel_id;
end;
$$;

create or replace function public.join_channel(p_channel_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Нужно войти в аккаунт';
  end if;
  if not exists (select 1 from public.channels where id = p_channel_id) then
    raise exception 'Канал не найден';
  end if;

  insert into public.channel_members (channel_id, user_id, role)
  values (p_channel_id, auth.uid(), 'member')
  on conflict (channel_id, user_id) do nothing;
end;
$$;

create or replace function public.send_star_reaction(p_post_id uuid, p_stars integer)
returns integer
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  target_channel_id uuid;
  current_balance integer;
begin
  if auth.uid() is null then
    raise exception 'Нужно войти в аккаунт';
  end if;
  if p_stars is null or p_stars < 1 or p_stars > 50 then
    raise exception 'Можно отправить от 1 до 50 звёзд';
  end if;

  select channel_id into target_channel_id
  from public.channel_posts
  where id = p_post_id;
  if target_channel_id is null then
    raise exception 'Публикация не найдена';
  end if;
  if not exists (
    select 1 from public.channel_members
    where channel_id = target_channel_id and user_id = auth.uid()
  ) then
    raise exception 'Сначала вступите в канал';
  end if;

  select balance into current_balance
  from public.star_wallets
  where user_id = auth.uid()
  for update;
  if current_balance is null then
    raise exception 'Кошелёк не найден';
  end if;
  if current_balance < p_stars then
    raise exception 'Недостаточно MonoStars';
  end if;

  update public.star_wallets
  set balance = balance - p_stars, updated_at = now()
  where user_id = auth.uid();

  insert into public.star_transactions (user_id, amount, reason, reference_post_id)
  values (auth.uid(), -p_stars, 'channel_reaction', p_post_id);

  insert into public.star_reactions (post_id, user_id, stars)
  values (p_post_id, auth.uid(), p_stars)
  on conflict (post_id, user_id)
  do update set stars = public.star_reactions.stars + excluded.stars, updated_at = now();

  return current_balance - p_stars;
end;
$$;

alter table public.profiles enable row level security;
alter table public.star_wallets enable row level security;
alter table public.dm_conversations enable row level security;
alter table public.dm_members enable row level security;
alter table public.dm_messages enable row level security;
alter table public.channels enable row level security;
alter table public.channel_members enable row level security;
alter table public.channel_posts enable row level security;
alter table public.star_transactions enable row level security;
alter table public.star_reactions enable row level security;

drop policy if exists profiles_authenticated_read on public.profiles;
create policy profiles_authenticated_read on public.profiles
  for select to authenticated using (true);
drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists wallets_owner_read on public.star_wallets;
create policy wallets_owner_read on public.star_wallets
  for select to authenticated using (user_id = auth.uid());
drop policy if exists transactions_owner_read on public.star_transactions;
create policy transactions_owner_read on public.star_transactions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists dm_conversations_member_read on public.dm_conversations;
create policy dm_conversations_member_read on public.dm_conversations
  for select to authenticated using (public.is_current_dm_member(id));
drop policy if exists dm_members_conversation_read on public.dm_members;
create policy dm_members_conversation_read on public.dm_members
  for select to authenticated using (public.is_current_dm_member(conversation_id));
drop policy if exists dm_messages_member_read on public.dm_messages;
create policy dm_messages_member_read on public.dm_messages
  for select to authenticated using (public.is_current_dm_member(conversation_id));
drop policy if exists dm_messages_member_insert on public.dm_messages;
create policy dm_messages_member_insert on public.dm_messages
  for insert to authenticated
  with check (author_id = auth.uid() and public.is_current_dm_member(conversation_id));

drop policy if exists channels_authenticated_read on public.channels;
create policy channels_authenticated_read on public.channels
  for select to authenticated using (true);
drop policy if exists channel_members_member_read on public.channel_members;
create policy channel_members_member_read on public.channel_members
  for select to authenticated using (public.is_current_channel_member(channel_id));
drop policy if exists channel_posts_member_read on public.channel_posts;
create policy channel_posts_member_read on public.channel_posts
  for select to authenticated using (public.is_current_channel_member(channel_id));
drop policy if exists channel_posts_member_insert on public.channel_posts;
create policy channel_posts_member_insert on public.channel_posts
  for insert to authenticated
  with check (author_id = auth.uid() and public.is_current_channel_owner(channel_id));
drop policy if exists star_reactions_channel_read on public.star_reactions;
create policy star_reactions_channel_read on public.star_reactions
  for select to authenticated using (
    exists (
      select 1
      from public.channel_posts
      where id = post_id and public.is_current_channel_member(channel_id)
    )
  );

grant select, update on public.profiles to authenticated;
grant select on public.star_wallets, public.star_transactions to authenticated;
grant select on public.dm_conversations, public.dm_members, public.dm_messages to authenticated;
grant insert on public.dm_messages to authenticated;
grant select on public.channels, public.channel_members, public.channel_posts, public.star_reactions to authenticated;
grant insert on public.channel_posts to authenticated;

revoke all on function public.is_current_dm_member(uuid) from public;
revoke all on function public.is_current_channel_member(uuid) from public;
revoke all on function public.is_current_channel_owner(uuid) from public;
revoke all on function public.start_conversation(text) from public;
revoke all on function public.create_channel(text, text, text) from public;
revoke all on function public.join_channel(uuid) from public;
revoke all on function public.send_star_reaction(uuid, integer) from public;
grant execute on function public.is_current_dm_member(uuid) to authenticated;
grant execute on function public.is_current_channel_member(uuid) to authenticated;
grant execute on function public.is_current_channel_owner(uuid) to authenticated;
grant execute on function public.start_conversation(text) to authenticated;
grant execute on function public.create_channel(text, text, text) to authenticated;
grant execute on function public.join_channel(uuid) to authenticated;
grant execute on function public.send_star_reaction(uuid, integer) to authenticated;

do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['dm_messages', 'channel_posts', 'star_reactions'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end;
$$;

-- Demo phone sign-in uses server-issued sessions, not Supabase Auth.
-- Existing profile and chat rows are kept; only the auth.users foreign key is removed.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and confrelid = 'auth.users'::regclass
      and contype = 'f'
  loop
    execute format('alter table public.profiles drop constraint %I', constraint_name);
  end loop;
end;
$$;

create table if not exists public.demo_users (
  phone text primary key check (phone ~ '^[+]7[0-9]{10}$'),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

insert into public.demo_users (phone, user_id)
select u.phone, p.id
from auth.users u
join public.profiles p on p.id = u.id
where u.phone ~ '^[+]7[0-9]{10}$'
on conflict do nothing;

alter table public.demo_users enable row level security;
revoke all on public.demo_users from public, anon, authenticated;
grant all on public.demo_users to service_role;

create or replace function public.get_or_create_demo_user(p_phone text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  demo_user_id uuid;
  generated_id uuid;
  generated_username text;
begin
  if p_phone !~ '^[+]7[0-9]{10}$' then
    raise exception 'Некорректный номер телефона';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_phone, 0));
  select user_id into demo_user_id from public.demo_users where phone = p_phone;
  if demo_user_id is not null then
    return demo_user_id;
  end if;

  generated_id := gen_random_uuid();
  generated_username := 'demo_' || substr(replace(generated_id::text, '-', ''), 1, 12);

  insert into public.profiles (id, username, display_name)
  values (generated_id, generated_username, 'Новый пользователь');
  insert into public.star_wallets (user_id, balance)
  values (generated_id, 100);
  insert into public.star_transactions (user_id, amount, reason)
  values (generated_id, 100, 'welcome_bonus');
  insert into public.demo_users (phone, user_id)
  values (p_phone, generated_id);

  return generated_id;
end;
$$;

create or replace function public.demo_start_conversation(p_user_id uuid, p_username text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_user_id uuid;
  conversation_id uuid;
begin
  select id into target_user_id
  from public.profiles
  where username = lower(trim(p_username));

  if target_user_id is null then raise exception 'Пользователь не найден'; end if;
  if target_user_id = p_user_id then raise exception 'Нельзя начать чат с собой'; end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      least(p_user_id::text, target_user_id::text) || ':' ||
      greatest(p_user_id::text, target_user_id::text),
      0
    )
  );

  select first_member.conversation_id into conversation_id
  from public.dm_members first_member
  join public.dm_members second_member on second_member.conversation_id = first_member.conversation_id
  where first_member.user_id = p_user_id
    and second_member.user_id = target_user_id
    and (
      select count(*) from public.dm_members member_count
      where member_count.conversation_id = first_member.conversation_id
    ) = 2
  limit 1;

  if conversation_id is null then
    insert into public.dm_conversations default values returning id into conversation_id;
    insert into public.dm_members (conversation_id, user_id)
    values (conversation_id, p_user_id), (conversation_id, target_user_id);
  end if;
  return conversation_id;
end;
$$;

create or replace function public.demo_create_channel(
  p_user_id uuid,
  p_title text,
  p_username text,
  p_description text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_channel_id uuid;
  clean_title text := trim(p_title);
  clean_username text := lower(trim(p_username));
  clean_description text := coalesce(trim(p_description), '');
begin
  if length(clean_title) < 2 or length(clean_title) > 80 then raise exception 'Название канала должно содержать от 2 до 80 символов'; end if;
  if clean_username !~ '^[a-z][a-z0-9_]{2,31}$' then raise exception 'Некорректное имя канала'; end if;
  if length(clean_description) > 500 then raise exception 'Описание слишком длинное'; end if;

  insert into public.channels (owner_id, title, username, description)
  values (p_user_id, clean_title, clean_username, clean_description)
  returning id into new_channel_id;
  insert into public.channel_members (channel_id, user_id, role)
  values (new_channel_id, p_user_id, 'owner');
  return new_channel_id;
end;
$$;

create or replace function public.demo_join_channel(p_user_id uuid, p_channel_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.channels where id = p_channel_id) then raise exception 'Канал не найден'; end if;
  insert into public.channel_members (channel_id, user_id, role)
  values (p_channel_id, p_user_id, 'member')
  on conflict (channel_id, user_id) do nothing;
end;
$$;

create or replace function public.demo_send_star_reaction(p_user_id uuid, p_post_id uuid, p_stars integer)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_channel_id uuid;
  current_balance integer;
begin
  if p_stars is null or p_stars < 1 or p_stars > 50 then raise exception 'Можно отправить от 1 до 50 звёзд'; end if;
  select channel_id into target_channel_id from public.channel_posts where id = p_post_id;
  if target_channel_id is null then raise exception 'Публикация не найдена'; end if;
  if not exists (
    select 1 from public.channel_members
    where channel_id = target_channel_id and user_id = p_user_id
  ) then raise exception 'Сначала вступите в канал'; end if;

  select balance into current_balance from public.star_wallets where user_id = p_user_id for update;
  if current_balance is null then raise exception 'Кошелёк не найден'; end if;
  if current_balance < p_stars then raise exception 'Недостаточно MonoStars'; end if;

  update public.star_wallets
  set balance = balance - p_stars, updated_at = now()
  where user_id = p_user_id;
  insert into public.star_transactions (user_id, amount, reason, reference_post_id)
  values (p_user_id, -p_stars, 'channel_reaction', p_post_id);
  insert into public.star_reactions (post_id, user_id, stars)
  values (p_post_id, p_user_id, p_stars)
  on conflict (post_id, user_id)
  do update set stars = public.star_reactions.stars + excluded.stars, updated_at = now();
  return current_balance - p_stars;
end;
$$;

revoke all on function public.get_or_create_demo_user(text) from public, anon, authenticated;
revoke all on function public.demo_start_conversation(uuid, text) from public, anon, authenticated;
revoke all on function public.demo_create_channel(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.demo_join_channel(uuid, uuid) from public, anon, authenticated;
revoke all on function public.demo_send_star_reaction(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.get_or_create_demo_user(text) to service_role;
grant execute on function public.demo_start_conversation(uuid, text) to service_role;
grant execute on function public.demo_create_channel(uuid, text, text, text) to service_role;
grant execute on function public.demo_join_channel(uuid, uuid) to service_role;
grant execute on function public.demo_send_star_reaction(uuid, uuid, integer) to service_role;
