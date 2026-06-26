create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text default '',
  role text not null default 'staff' check (role in ('admin', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  jenis text not null,
  unit text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);

alter table public.stock_items add column if not exists jenis text;
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stock_items'
      and column_name = 'category'
  ) then
    execute 'update public.stock_items set jenis = category where jenis is null';
  end if;
end;
$$;
update public.stock_items set jenis = 'Umum' where jenis is null;
alter table public.stock_items alter column jenis set not null;
alter table public.stock_items drop column if exists category;
alter table public.stock_items drop column if exists low_stock_limit;

create table if not exists public.stock_transactions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.stock_items(id) on delete cascade,
  type text not null check (type in ('in', 'out')),
  quantity integer not null check (quantity > 0),
  note text default '',
  transaction_date date not null default current_date,
  created_at timestamptz not null default now()
);

create or replace view public.stock_summary as
select
  item.id,
  item.name,
  item.jenis,
  item.unit,
  coalesce(sum(case when trx.type = 'in' then trx.quantity else 0 end), 0) as incoming_qty,
  coalesce(sum(case when trx.type = 'out' then trx.quantity else 0 end), 0) as outgoing_qty,
  coalesce(sum(case when trx.type = 'in' then trx.quantity else -trx.quantity end), 0) as remaining_qty
from public.stock_items item
left join public.stock_transactions trx on trx.item_id = item.id
group by item.id;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists stock_items_set_updated_at on public.stock_items;
create trigger stock_items_set_updated_at
before update on public.stock_items
for each row execute function public.set_updated_at();

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'staff')
  )
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.current_user_role()
returns text as $$
  select coalesce(
    (select role from public.user_profiles where id = auth.uid()),
    'staff'
  );
$$ language sql security definer stable set search_path = public;

insert into public.user_profiles (id, full_name, role)
select id, coalesce(raw_user_meta_data->>'full_name', ''), 'staff'
from auth.users
on conflict (id) do nothing;

alter table public.user_profiles enable row level security;
alter table public.stock_items enable row level security;
alter table public.stock_transactions enable row level security;

drop policy if exists "Read own user profile" on public.user_profiles;
create policy "Read own user profile"
on public.user_profiles for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Update own profile name" on public.user_profiles;

drop policy if exists "Allow anonymous read stock items" on public.stock_items;
drop policy if exists "Allow anonymous insert stock items" on public.stock_items;
drop policy if exists "Allow anonymous update stock items" on public.stock_items;
drop policy if exists "Allow anonymous delete stock items" on public.stock_items;
drop policy if exists "Allow authenticated read stock items" on public.stock_items;
drop policy if exists "Allow admin insert stock items" on public.stock_items;
drop policy if exists "Allow admin update stock items" on public.stock_items;
drop policy if exists "Allow admin delete stock items" on public.stock_items;

create policy "Allow authenticated read stock items"
on public.stock_items for select
to authenticated
using (true);

create policy "Allow admin insert stock items"
on public.stock_items for insert
to authenticated
with check (public.current_user_role() = 'admin');

create policy "Allow admin update stock items"
on public.stock_items for update
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy "Allow admin delete stock items"
on public.stock_items for delete
to authenticated
using (public.current_user_role() = 'admin');

drop policy if exists "Allow anonymous read stock transactions" on public.stock_transactions;
drop policy if exists "Allow anonymous insert stock transactions" on public.stock_transactions;
drop policy if exists "Allow anonymous delete stock transactions" on public.stock_transactions;
drop policy if exists "Allow authenticated read stock transactions" on public.stock_transactions;
drop policy if exists "Allow staff insert stock transactions" on public.stock_transactions;
drop policy if exists "Allow admin delete stock transactions" on public.stock_transactions;

create policy "Allow authenticated read stock transactions"
on public.stock_transactions for select
to authenticated
using (true);

create policy "Allow staff insert stock transactions"
on public.stock_transactions for insert
to authenticated
with check (public.current_user_role() in ('admin', 'staff'));

create policy "Allow admin delete stock transactions"
on public.stock_transactions for delete
to authenticated
using (public.current_user_role() = 'admin');

do $$
begin
  alter publication supabase_realtime add table public.stock_items;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.stock_transactions;
exception
  when duplicate_object then null;
end;
$$;
