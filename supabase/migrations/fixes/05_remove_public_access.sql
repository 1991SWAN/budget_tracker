-- 🚫 공개 접근 정책 삭제 (보안 강화)
-- 현재 "Enable all access for all users"라는 정책이 있어서, RLS가 켜져 있어도 데이터가 다 보이고 있습니다.
-- 이 정책을 삭제하면, 아까 추가한 "내 것만 보기" 정책이 드디어 효력을 발휘합니다.

DROP POLICY IF EXISTS "Enable all access for all users" ON transactions;
DROP POLICY IF EXISTS "Enable all access for all users" ON assets;
DROP POLICY IF EXISTS "Enable all access for all users" ON recurring_transactions;
DROP POLICY IF EXISTS "Enable all access for all users" ON savings_goals;
DROP POLICY IF EXISTS "Enable all access for all users" ON categories;

-- 혹시 모르니 "Enable read access for all users" 같은 유사한 이름도 삭제 (안전장치)
DROP POLICY IF EXISTS "Enable read access for all users" ON transactions;
DROP POLICY IF EXISTS "Enable read access for all users" ON assets;
DROP POLICY IF EXISTS "Enable read access for all users" ON recurring_transactions;
DROP POLICY IF EXISTS "Enable read access for all users" ON savings_goals;
DROP POLICY IF EXISTS "Enable read access for all users" ON categories;
