-- Create categories table
create table categories (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  emoji text default '🏷️',
  type text check (type in ('EXPENSE', 'INCOME', 'TRANSFER')),
  is_default boolean default false,
  sort_order integer default 0,
  color text,
  created_at timestamptz default now()
);

-- Add RLS policies
alter table categories enable row level security;

create policy "Users can view their own categories"
  on categories for select
  using (auth.uid() = user_id);

create policy "Users can insert their own categories"
  on categories for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own categories"
  on categories for update
  using (auth.uid() = user_id);

create policy "Users can delete their own categories"
  on categories for delete
  using (auth.uid() = user_id);

-- Create index for performance
create index categories_user_id_idx on categories (user_id);
create index categories_type_idx on categories (type);
