# ⚡️ Supabase RLS Performance Optimization Report

*Date: 2026-01-16*
*Status: Action Required*
*Severity: Moderate (Performance Warning)*

## 1. 이슈 개요 (Issue Description)

**메시지**:
> "Row level security policy ... re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale."

**현상**:
Supabase 대시보드에서 `categories` 테이블 등의 Row Level Security (RLS) 정책이 비효율적이라는 경고가 발생했습니다.
현재 정책(`auth.uid() = user_id`)은 데이터베이스가 **각 행(Row)을 검사할 때마다** `auth.uid()` 함수를 반복 실행합니다. 데이터가 많아질수록 조회 속도가 느려집니다.

---

## 2. 해결 원리 (Solution Logic)

PostgreSQL 쿼리 옵티마이저가 함수 호출을 **"쿼리당 한 번만"** 수행하도록 강제해야 합니다.

*   **Before (느림)**: `auth.uid() = user_id`
    *   Row 1: 함수 실행 -> 비교
    *   Row 2: 함수 실행 -> 비교
    *   ...
*   **After (빠름)**: `(select auth.uid()) = user_id`
    *   `select auth.uid()`를 먼저 실행하여 값(예: 'user-123')을 캐싱.
    *   Row 1: 'user-123' = user_id
    *   Row 2: 'user-123' = user_id
    *   (순수 값 비교로 전환되어 매우 빠름)

---

## 3. 적용 대상 (Affect Tables)

프로젝트 내 다음 테이블들의 모든 정책(SELECT, INSERT, UPDATE, DELETE)을 수정해야 합니다.

1.  `categories`
2.  `transactions`
3.  `assets`
4.  `recurring_transactions`
5.  `budgets`
7.  `tags`

---

## 4. 실행할 SQL 스크립트 (Migration Script)

아래 SQL을 Supabase **SQL Editor**에서 실행하면 모든 정책이 최적화됩니다.

```sql
-- 0. Tags (Authenticated Users) - NEW
ALTER POLICY "Enable all access for authenticated users" ON tags USING ((select auth.role()) = 'authenticated');
ALTER POLICY "Enable all access for authenticated users" ON tags WITH CHECK ((select auth.role()) = 'authenticated');

-- 1. Categories
COMMENT ON POLICY "Users can view their own categories" ON categories IS 'Optimized RLS';
ALTER POLICY "Users can view their own categories" ON categories USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can update their own categories" ON categories USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can delete their own categories" ON categories USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can insert their own categories" ON categories WITH CHECK ((select auth.uid()) = user_id);

-- 2. Transactions
ALTER POLICY "Users can view their own transactions" ON transactions USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can update their own transactions" ON transactions USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can delete their own transactions" ON transactions USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can insert their own transactions" ON transactions WITH CHECK ((select auth.uid()) = user_id);

-- 3. Assets
ALTER POLICY "Users can view their own assets" ON assets USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can update their own assets" ON assets USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can delete their own assets" ON assets USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can insert their own assets" ON assets WITH CHECK ((select auth.uid()) = user_id);

-- 4. Recurring Transactions
ALTER POLICY "Users can view their own recurring" ON recurring_transactions USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can update their own recurring" ON recurring_transactions USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can delete their own recurring" ON recurring_transactions USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can insert their own recurring" ON recurring_transactions WITH CHECK ((select auth.uid()) = user_id);

-- 5. Budgets
ALTER POLICY "Users can view their own budgets" ON budgets USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can update their own budgets" ON budgets USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can delete their own budgets" ON budgets USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can insert their own budgets" ON budgets WITH CHECK ((select auth.uid()) = user_id);

-- 6. Profiles (id 컬럼 매칭)
ALTER POLICY "Users can view their own profile" ON profiles USING ((select auth.uid()) = id);
ALTER POLICY "Users can update their own profile" ON profiles USING ((select auth.uid()) = id);
-- Profile Insert는 trigger로 처리될 수 있으나 정책이 있다면 최적화
ALTER POLICY "Users can insert their own profile" ON profiles WITH CHECK ((select auth.uid()) = id);
```

## 5. 결론
이 조치를 통해 대량 데이터 조회 시 CPU 부하를 크게 줄이고 반응 속도를 향상시킬 수 있습니다. 즉시 적용을 권장합니다.
