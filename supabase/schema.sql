create extension if not exists pgcrypto;

create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  jenis text not null,
  unit text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);

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

alter table public.stock_items enable row level security;
alter table public.stock_transactions enable row level security;

drop policy if exists "Allow anonymous read stock items" on public.stock_items;
create policy "Allow anonymous read stock items"
on public.stock_items for select
to anon
using (true);

drop policy if exists "Allow anonymous insert stock items" on public.stock_items;
create policy "Allow anonymous insert stock items"
on public.stock_items for insert
to anon
with check (true);

drop policy if exists "Allow anonymous update stock items" on public.stock_items;
create policy "Allow anonymous update stock items"
on public.stock_items for update
to anon
using (true)
with check (true);

drop policy if exists "Allow anonymous delete stock items" on public.stock_items;
create policy "Allow anonymous delete stock items"
on public.stock_items for delete
to anon
using (true);

drop policy if exists "Allow anonymous read stock transactions" on public.stock_transactions;
create policy "Allow anonymous read stock transactions"
on public.stock_transactions for select
to anon
using (true);

drop policy if exists "Allow anonymous insert stock transactions" on public.stock_transactions;
create policy "Allow anonymous insert stock transactions"
on public.stock_transactions for insert
to anon
with check (true);

drop policy if exists "Allow anonymous delete stock transactions" on public.stock_transactions;
create policy "Allow anonymous delete stock transactions"
on public.stock_transactions for delete
to anon
using (true);

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
