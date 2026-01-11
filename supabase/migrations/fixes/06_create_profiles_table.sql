-- Create profiles table for user session management
create table if not exists public.profiles (
  id uuid not null references auth.users(id) on delete cascade primary key,
  email text,
  last_session_id text, -- Stores the ID of the currently active session
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Policies
create policy "Users can view their own profile" on profiles
  for select using (auth.uid() = id);

create policy "Users can insert their own profile" on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update their own profile" on profiles
  for update using (auth.uid() = id);

-- Function to handle updated_at
create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger for updated_at
create trigger on_profiles_updated
  before update on public.profiles
  for each row execute function handle_updated_at();
