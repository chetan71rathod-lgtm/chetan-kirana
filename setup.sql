-- Apply in Supabase SQL Editor.
create table if not exists public.products (
 id uuid primary key default gen_random_uuid(), name text not null, category text not null default 'किराना',
 price numeric(10,2) not null check(price>=0), unit text default 'पीस', description text,
 image_url text, is_active boolean not null default true, stock integer, created_at timestamptz default now()
);
create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(), customer_name text not null, mobile text not null,
 address text not null, note text, payment_method text not null check(payment_method in ('COD','UPI')),
 subtotal numeric(10,2) not null, delivery_fee numeric(10,2) not null, total numeric(10,2) not null,
 status text not null default 'New', created_at timestamptz default now()
);
create table if not exists public.order_items (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 product_id uuid references public.products(id), product_name text not null, unit_price numeric(10,2) not null,
 quantity integer not null check(quantity>0), line_total numeric(10,2) not null
);
create table if not exists public.admin_users(user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.admin_users enable row level security;
drop policy if exists "Public active product read" on public.products;
create policy "Public active product read" on public.products for select to anon,authenticated using(is_active=true);
drop policy if exists "Admin all product read" on public.products;
create policy "Admin all product read" on public.products for select to authenticated using(exists(select 1 from public.admin_users where user_id=auth.uid()));
drop policy if exists "Admin product insert" on public.products;
create policy "Admin product insert" on public.products for insert to authenticated with check(exists(select 1 from public.admin_users where user_id=auth.uid()));
drop policy if exists "Admin product update" on public.products;
create policy "Admin product update" on public.products for update to authenticated using(exists(select 1 from public.admin_users where user_id=auth.uid())) with check(exists(select 1 from public.admin_users where user_id=auth.uid()));
drop policy if exists "Admin product delete" on public.products;
create policy "Admin product delete" on public.products for delete to authenticated using(exists(select 1 from public.admin_users where user_id=auth.uid()));
drop policy if exists "Admin self read" on public.admin_users;
create policy "Admin self read" on public.admin_users for select to authenticated using(user_id=auth.uid());
drop policy if exists "Admin orders read" on public.orders;
create policy "Admin orders read" on public.orders for select to authenticated using(exists(select 1 from public.admin_users where user_id=auth.uid()));
drop policy if exists "Admin orders update" on public.orders;
create policy "Admin orders update" on public.orders for update to authenticated using(exists(select 1 from public.admin_users where user_id=auth.uid())) with check(exists(select 1 from public.admin_users where user_id=auth.uid()));
drop policy if exists "Admin order items read" on public.order_items;
create policy "Admin order items read" on public.order_items for select to authenticated using(exists(select 1 from public.admin_users where user_id=auth.uid()));
insert into storage.buckets(id,name,public) values('product-images','product-images',true) on conflict(id) do update set public=true;
drop policy if exists "Admin image upload" on storage.objects;
create policy "Admin image upload" on storage.objects for insert to authenticated with check(bucket_id='product-images' and exists(select 1 from public.admin_users where user_id=auth.uid()));
drop policy if exists "Admin image update" on storage.objects;
create policy "Admin image update" on storage.objects for update to authenticated using(bucket_id='product-images' and exists(select 1 from public.admin_users where user_id=auth.uid())) with check(bucket_id='product-images' and exists(select 1 from public.admin_users where user_id=auth.uid()));
drop policy if exists "Admin image delete" on storage.objects;
create policy "Admin image delete" on storage.objects for delete to authenticated using(bucket_id='product-images' and exists(select 1 from public.admin_users where user_id=auth.uid()));
