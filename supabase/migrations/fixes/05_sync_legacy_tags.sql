-- Legacy Tags Sync SQL
-- Description: Extracts #tags from transactions.memo and populates tags and transaction_tags tables.

-- 1. Create temporary table to store extracted tags
CREATE TEMP TABLE temp_extracted_tags AS
WITH tags_extracted AS (
    SELECT 
        id as transaction_id,
        user_id,
        (regexp_matches(memo, '#([^\s#]+)', 'g'))[1] as tag_name
    FROM transactions
    WHERE memo ~ '#[^\s#]+'
)
SELECT * FROM tags_extracted;

-- 2. Insert new tags into the tags table
INSERT INTO tags (user_id, name, usage_count)
SELECT DISTINCT user_id, tag_name, 0
FROM temp_extracted_tags
ON CONFLICT (user_id, name) DO NOTHING;

-- 3. Link transactions to tags in the join table
INSERT INTO transaction_tags (transaction_id, tag_id, user_id)
SELECT 
    t.transaction_id,
    tags.id as tag_id,
    t.user_id
FROM temp_extracted_tags t
JOIN tags ON t.tag_name = tags.name AND t.user_id = tags.user_id
ON CONFLICT (transaction_id, tag_id) DO NOTHING;

-- 4. Update usage counts for all tags
UPDATE tags
SET usage_count = (
    SELECT count(*)
    FROM transaction_tags
    WHERE transaction_tags.tag_id = tags.id
);

-- 5. Delete orphan tags (usage_count = 0)
DELETE FROM tags
WHERE usage_count = 0;

-- CLEANUP
DROP TABLE temp_extracted_tags;
