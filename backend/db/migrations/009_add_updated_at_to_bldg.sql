-- 009_add_updated_at_to_bldg.sql
-- KOR.BLDG 테이블에 updated_at 컬럼 추가

ALTER TABLE KOR.BLDG
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

COMMENT ON COLUMN KOR.BLDG.updated_at IS '최종 업데이트 시간';
