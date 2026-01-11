-- Enable Realtime for profiles table
-- By default, new tables are not exposed to Realtime. We must add them to the publication.

begin;
  -- Remove if already exists to avoid error (though 'add table' is usually idempotent or throws if exists)
  -- Safer to just run ADD TABLE. If it fails saying "already in publication", that's fine.
  
  -- Method 1: Standard Supabase Realtime activation
  alter publication supabase_realtime add table profiles;
  
commit;
