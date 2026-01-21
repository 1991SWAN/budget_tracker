-- [20260121_reconciliation_rpc.sql]
-- 이 RPC는 클라이언트의 제한된 데이터(페이지네이션)를 넘어 
-- 데이터베이스 전체에서 이체 조정 후보를 찾아냅니다.

CREATE OR REPLACE FUNCTION public.find_reconciliation_candidates(
    p_user_id uuid,
    p_window_minutes integer DEFAULT 5
)
RETURNS jsonb AS $$
DECLARE
    v_pairs jsonb;
    v_singles jsonb;
BEGIN
    -- 1. 쌍 매칭 (Pairs: Bank to Bank)
    -- 로직: 동일 금액, 반대 타입(Expense/Income), 다른 자산, 짧은 시간 오차
    WITH potential_txs AS (
        SELECT 
            t.*,
            a.type as asset_type
        FROM public.transactions t
        JOIN public.assets a ON t.asset_id = a.id
        WHERE t.user_id = p_user_id
          AND t.linked_transaction_id IS NULL
          AND t.type != 'TRANSFER'
          AND t.is_reconciliation_ignored = false
    ),
    pairs AS (
        SELECT 
            row_to_json(w)::jsonb as withdrawal,
            row_to_json(d)::jsonb as deposit,
            ABS(EXTRACT(EPOCH FROM (COALESCE(w.timestamp, w.date::timestamp) - COALESCE(d.timestamp, d.date::timestamp)))) as time_diff
        FROM potential_txs w
        JOIN potential_txs d ON w.amount = d.amount
        WHERE w.type = 'EXPENSE' 
          AND d.type = 'INCOME'
          AND w.asset_id != d.asset_id
          AND w.asset_type NOT IN ('CREDIT_CARD', 'LOAN')
          AND d.asset_type NOT IN ('CREDIT_CARD', 'LOAN')
          AND ABS(EXTRACT(EPOCH FROM (COALESCE(w.timestamp, w.date::timestamp) - COALESCE(d.timestamp, d.date::timestamp)))) <= (p_window_minutes * 60)
    )
    SELECT jsonb_agg(jsonb_build_object(
        'withdrawal', withdrawal,
        'deposit', deposit,
        'score', 1.0,
        'timeDiff', time_diff
    )) INTO v_pairs
    FROM pairs;

    -- 2. 단일 매칭 (Singles: Payment Detection)
    -- 로직: 지출 내역 중 메모/가맹점에 부채 자산 이름이 포함된 경우
    WITH expenses AS (
        SELECT 
            t.*
        FROM public.transactions t
        WHERE t.user_id = p_user_id
          AND t.type = 'EXPENSE'
          AND t.linked_transaction_id IS NULL
          AND t.is_reconciliation_ignored = false
    ),
    liability_assets AS (
        SELECT id, name, institution, type
        FROM public.assets
        WHERE user_id = p_user_id
          AND type IN ('CREDIT_CARD', 'LOAN')
    ),
    singles AS (
        SELECT 
            row_to_json(e)::jsonb as transaction,
            row_to_json(a)::jsonb as targetAsset,
            'Matched ' || a.name || ' info in memo' as matchReason
        FROM expenses e
        CROSS JOIN liability_assets a
        WHERE (
            LOWER(COALESCE(e.memo, '') || ' ' || COALESCE(e.merchant, '') || ' ' || COALESCE(e.original_text, '')) 
            LIKE '%' || LOWER(a.name) || '%'
            OR 
            LOWER(COALESCE(e.memo, '') || ' ' || COALESCE(e.merchant, '') || ' ' || COALESCE(e.original_text, '')) 
            LIKE '%' || LOWER(COALESCE(a.institution, '')) || '%'
        )
    )
    SELECT jsonb_agg(row_to_json(s)::jsonb) INTO v_singles
    FROM singles;

    RETURN jsonb_build_object(
        'pairs', COALESCE(v_pairs, '[]'::jsonb),
        'singles', COALESCE(v_singles, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
