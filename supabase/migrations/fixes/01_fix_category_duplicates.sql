-- 1. 중복된 데이터 제거 (Remove Duplicates)
-- "가장 먼저 생성된(created_at이 가장 작은)" 1개만 남기고 나머지 중복은 삭제합니다.
DELETE FROM categories
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, name, type 
             ORDER BY created_at ASC
           ) as rnum
    FROM categories
  ) t
  WHERE t.rnum > 1
);

-- 2. 유니크 인덱스 생성 (Create Unique Index)
-- 이제 중복이 제거되었으므로, 이 명령어가 성공할 것입니다.
CREATE UNIQUE INDEX categories_user_id_name_type_key 
ON categories (user_id, name, type);
