-- [20260121_balance_automation.sql]
-- 이 마이그레이션은 거래 내역(Transactions)을 근거로 자산(Assets) 잔액을 자동 계산하는 로직을 구현합니다.

-- 1. 자산 잔액 재계산 함수
CREATE OR REPLACE FUNCTION public.update_asset_balance(target_asset_id text)
RETURNS void AS $$
DECLARE
    initial_bal numeric;
    total_change numeric;
BEGIN
    -- 초기 잔액 조회 (오프닝 밸런스)
    SELECT COALESCE(amount, 0) INTO initial_bal
    FROM public.asset_opening_balances
    WHERE asset_id = target_asset_id;

    -- 거래 내역 기반 총 변동량 계산
    -- INCOME: +, EXPENSE: -, TRANSFER(출금): -, TRANSFER(입금): +
    SELECT COALESCE(SUM(
        CASE 
            WHEN type = 'INCOME' THEN amount
            WHEN type = 'EXPENSE' THEN -amount
            WHEN type = 'TRANSFER' THEN 
                CASE 
                    WHEN to_asset_id IS NOT NULL THEN -amount -- 돈이 나가는 쪽
                    ELSE amount -- 돈이 들어오는 쪽
                END
            ELSE 0 
        END
    ), 0) INTO total_change
    FROM public.transactions
    WHERE asset_id = target_asset_id;

    -- 자산 테이블의 잔액 업데이트
    UPDATE public.assets
    SET balance = initial_bal + total_change
    WHERE id = target_asset_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 트리거 함수 (거래 내역 변경 감지)
CREATE OR REPLACE FUNCTION public.fn_trigger_update_asset_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- 신규 생성(INSERT) 또는 수정(UPDATE) 시
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        PERFORM public.update_asset_balance(NEW.asset_id);
    END IF;

    -- 삭제(DELETE) 또는 수정(UPDATE) 시 이전 자산에 대해서도 처리
    -- (자산 간 거래 수정 시 양쪽 모두 업데이트 필요)
    IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
        PERFORM public.update_asset_balance(OLD.asset_id);
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 트리거 등록
DROP TRIGGER IF EXISTS trg_update_balance_on_tx ON public.transactions;
CREATE TRIGGER trg_update_balance_on_tx
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.fn_trigger_update_asset_balance();

-- 4. 기존 데이터 동기화 (전수 조사 기반 초기화)
-- 이 과정에서 현재 데이터와 장부 간의 오차를 수정합니다.
DO $$
DECLARE
    a_id text;
BEGIN
    FOR a_id IN SELECT id FROM public.assets LOOP
        PERFORM public.update_asset_balance(a_id);
    END LOOP;
END $$;
