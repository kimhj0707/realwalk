-- kakao_id에 UNIQUE 제약조건 추가
-- 중복 제거를 위해 필요

-- 1. 기존 중복 데이터 확인 및 제거 (있을 경우)
DELETE FROM KOR.POI a
USING KOR.POI b
WHERE a.poi_id > b.poi_id
  AND a.kakao_id IS NOT NULL
  AND a.kakao_id = b.kakao_id;

-- 2. UNIQUE 제약조건 추가 (이미 존재하지 않을 경우에만)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'poi_kakao_id_unique'
        AND conrelid = 'kor.poi'::regclass
    ) THEN
        ALTER TABLE KOR.POI ADD CONSTRAINT poi_kakao_id_unique UNIQUE (kakao_id);
    END IF;
END
$$;
