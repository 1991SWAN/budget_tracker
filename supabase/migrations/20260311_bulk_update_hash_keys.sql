-- 생성일: 2026-03-11
-- hashKey 배치 업데이트를 위한 helper function
-- Edge Function recalculate-hash-keys에서 호출

CREATE OR REPLACE FUNCTION bulk_update_hash_keys(updates jsonb)
RETURNS int AS $$
DECLARE
  affected int;
BEGIN
  UPDATE transactions t
  SET hash_key = (u->>'hash_key')
  FROM jsonb_array_elements(updates) u
  WHERE t.id = (u->>'id');
  
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
