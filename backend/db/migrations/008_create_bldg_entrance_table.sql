-- 008_create_bldg_entrance_table.sql
-- 건물 출입구 정보 테이블 생성

CREATE TABLE IF NOT EXISTS KOR.BLDG_ENTRANCE (
    entrance_id BIGINT PRIMARY KEY,
    bd_mgt_sn VARCHAR(50),
    geom GEOMETRY(Point, 4326) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 건물 관리 번호를 이용한 외래 키 제약 조건 추가 (참조 무결성)
ALTER TABLE KOR.BLDG_ENTRANCE
ADD CONSTRAINT fk_bldg_entrance_bldg
FOREIGN KEY (bd_mgt_sn)
REFERENCES KOR.BLDG(bd_mgt_sn)
ON DELETE CASCADE;
-- NOTE: Foreign key is commented out to allow for more flexible data loading.
-- It can be enabled after both tables are populated.

-- 공간 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_bldg_entrance_geom ON KOR.BLDG_ENTRANCE USING GIST(geom);

-- 건물 관리 번호 인덱스
CREATE INDEX IF NOT EXISTS idx_bldg_entrance_bd_mgt_sn ON KOR.BLDG_ENTRANCE(bd_mgt_sn);

-- 코멘트 추가
COMMENT ON TABLE KOR.BLDG_ENTRANCE IS '건물 출입구 위치 정보';
COMMENT ON COLUMN KOR.BLDG_ENTRANCE.entrance_id IS '출입구 ID (도로명주소출입구 파일의 고유번호)';
COMMENT ON COLUMN KOR.BLDG_ENTRANCE.bd_mgt_sn IS '건물관리번호 (KOR.BLDG 테이블 참조)';
COMMENT ON COLUMN KOR.BLDG_ENTRANCE.geom IS '출입구 위치 WGS84 좌표계 Point (EPSG:4326)';
