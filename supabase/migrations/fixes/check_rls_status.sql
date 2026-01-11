-- 🔍 RLS 설정 상태 확인 쿼리
-- 이 쿼리를 실행하면 각 테이블의 RLS 활성화 여부(rls_enabled)와 적용된 정책(policy_name)을 볼 수 있습니다.

SELECT
    c.relname AS table_name,
    CASE WHEN c.relrowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END AS rls_status,
    count(p.polname) as policy_count,
    string_agg(p.polname, ', ') as policies
FROM
    pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE
    n.nspname = 'public'
    AND c.relname IN ('transactions', 'assets', 'recurring_transactions', 'savings_goals', 'categories')
GROUP BY
    c.relname, c.relrowsecurity
ORDER BY
    c.relname;
