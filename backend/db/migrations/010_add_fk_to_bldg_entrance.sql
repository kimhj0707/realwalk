-- 010_add_fk_to_bldg_entrance.sql
-- 건물 출입구 테이블에 외래 키 제약조건 추가

-- 기존에 제약조건이 있을 경우를 대비하여 삭제 후 추가
ALTER TABLE KOR.BLDG_ENTRANCE
DROP CONSTRAINT IF EXISTS fk_bldg_entrance_bldg;

ALTER TABLE KOR.BLDG_ENTRANCE
ADD CONSTRAINT fk_bldg_entrance_bldg
FOREIGN KEY (bd_mgt_sn)
REFERENCES KOR.BLDG(bd_mgt_sn)
ON DELETE CASCADE;

COMMENT ON CONSTRAINT fk_bldg_entrance_bldg ON KOR.BLDG_ENTRANCE IS '건물 출입구와 건물을 연결하는 외래 키';
