-- [20260122_incremental_balance.sql]
-- 이 마이그레이션은 실시간 잔액 계산 로직을 '전수 합산' 방식에서 '증분 업데이트' 방식으로 변경하여 성능을 최적화합니다.

-- 1. 금액에 따른 부호 결정 함수 (Helper)
CREATE OR REPLACE FUNCTION public.fn_get_transaction_sign(
    p_type text,
    p_to_asset_id text
) RETURNS integer AS $$
BEGIN
    RETURN CASE 
        WHEN p_type = 'INCOME' THEN 1
        WHEN p_type = 'EXPENSE' THEN -1
        WHEN p_type = 'TRANSFER' THEN 
            CASE 
                WHEN p_to_asset_id IS NOT NULL THEN -1 -- 돈이 나가는 쪽 (Sender)
                ELSE 1 -- 돈이 들어오는 쪽 (Receiver)
            END
        ELSE 0 
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. 증분 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION public.fn_trigger_incremental_asset_balance()
RETURNS TRIGGER AS $$
DECLARE
    delta numeric := 0;
    old_sign integer;
    new_sign integer;
BEGIN
    -- [CASE 1] DELETE: 이전 금액만큼 차감/가산 (반전)
    IF (TG_OP = 'DELETE') THEN
        old_sign := public.fn_get_transaction_sign(OLD.type, OLD.to_asset_id);
        IF (OLD.asset_id IS NOT NULL) THEN
            UPDATE public.assets 
            SET balance = balance - (old_sign * OLD.amount)
            WHERE id = OLD.asset_id;
        END IF;
        RETURN OLD;
    END IF;

    -- [CASE 2] INSERT: 신규 금액만큼 즉시 반영
    IF (TG_OP = 'INSERT') THEN
        new_sign := public.fn_get_transaction_sign(NEW.type, NEW.to_asset_id);
        IF (NEW.asset_id IS NOT NULL) THEN
            UPDATE public.assets 
            SET balance = balance + (new_sign * NEW.amount)
            WHERE id = NEW.asset_id;
        END IF;
        RETURN NEW;
    END IF;

    -- [CASE 3] UPDATE: 차액 계산 또는 자산 이동 처리
    IF (TG_OP = 'UPDATE') THEN
        -- 자산이 바뀐 경우 (이전 자산 차감, 새 자산 가산)
        IF (OLD.asset_id <> NEW.asset_id) THEN
            -- 이전 자산에서 이전 금액 제거
            old_sign := public.fn_get_transaction_sign(OLD.type, OLD.to_asset_id);
            UPDATE public.assets 
            SET balance = balance - (old_sign * OLD.amount)
            WHERE id = OLD.asset_id;
            
            -- 새 자산에 새 금액 추가
            new_sign := public.fn_get_transaction_sign(NEW.type, NEW.to_asset_id);
            UPDATE public.assets 
            SET balance = balance + (new_sign * NEW.amount)
            WHERE id = NEW.asset_id;
        ELSE
            -- 동일 자산 내에서 금액이나 유형이 바뀐 경우 (차액 반영)
            old_sign := public.fn_get_transaction_sign(OLD.type, OLD.to_asset_id);
            new_sign := public.fn_get_transaction_sign(NEW.type, NEW.to_asset_id);
            
            delta := (new_sign * NEW.amount) - (old_sign * OLD.amount);
            
            IF (delta <> 0) THEN
                UPDATE public.assets 
                SET balance = balance + delta
                WHERE id = NEW.asset_id;
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 기존 트리거 교체
DROP TRIGGER IF EXISTS trg_update_balance_on_tx ON public.transactions;
CREATE TRIGGER trg_update_balance_on_tx
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.fn_trigger_incremental_asset_balance();

-- 4. 무결성 보장을 위한 초기 1회 동기화 (O(N) 수행 후 이후부터 O(1))
-- 이 과정은 마이그레이션 시점에 현재 캐시와 장부를 완벽히 일치시킵니다.
DO $$
DECLARE
    a_rec RECORD;
    initial_bal numeric;
    total_change numeric;
BEGIN
    FOR a_rec IN SELECT id FROM public.assets LOOP
        -- 초기 잔액 조회
        SELECT COALESCE(amount, 0) INTO initial_bal
        FROM public.asset_opening_balances
        WHERE asset_id = a_rec.id;

        -- 전수 합산
        SELECT COALESCE(SUM(
            CASE 
                WHEN type = 'INCOME' THEN amount
                WHEN type = 'EXPENSE' THEN -amount
                WHEN type = 'TRANSFER' THEN 
                    CASE 
                        WHEN to_asset_id IS NOT NULL THEN -amount
                        ELSE amount
                    END
                ELSE 0 
            END
        ), 0) INTO total_change
        FROM public.transactions
        WHERE asset_id = a_rec.id;

        -- 최종 캐시 동기화
        UPDATE public.assets
        SET balance = initial_bal + total_change
        WHERE id = a_rec.id;
    END LOOP;
END $$;
