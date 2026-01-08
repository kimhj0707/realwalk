-- 007_add_bd_mgt_sn_to_bldg.sql
-- KOR.BLDG 테이블에 건물 관리 번호 컬럼 추가

ALTER TABLE KOR.BLDG
ADD COLUMN IF NOT EXISTS bd_mgt_sn VARCHAR(50) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_bd_mgt_sn ON KOR.BLDG(bd_mgt_sn);

COMMENT ON COLUMN KOR.BLDG.bd_mgt_sn IS '건물관리번호 (Shapefile의 BD_MGT_SN)';
