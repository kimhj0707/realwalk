-- 005_create_dong_table.sql
-- 금천구 동(행정동) 경계 테이블 생성

-- KOR.DONG 테이블 생성
CREATE TABLE IF NOT EXISTS KOR.DONG (
    dong_id SERIAL PRIMARY KEY,
    emd_cd VARCHAR(20) UNIQUE NOT NULL,  -- 행정동 코드
    dong_nm VARCHAR(50) NOT NULL,        -- 동 이름 (한글)
    dong_eng_nm VARCHAR(100),            -- 동 이름 (영문)
    full_nm VARCHAR(200),                -- 전체 주소
    geom GEOMETRY(MultiPolygon, 4326),   -- 동 경계 (MultiPolygon)
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 공간 인덱스 생성 (Point-in-Polygon 검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_dong_geom ON KOR.DONG USING GIST(geom);

-- 동 이름 인덱스
CREATE INDEX IF NOT EXISTS idx_dong_nm ON KOR.DONG(dong_nm);

-- 동 코드 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_emd_cd ON KOR.DONG(emd_cd);

-- 코멘트 추가
COMMENT ON TABLE KOR.DONG IS '금천구 행정동 경계 정보';
COMMENT ON COLUMN KOR.DONG.emd_cd IS '행정동 코드 (법정동코드)';
COMMENT ON COLUMN KOR.DONG.dong_nm IS '동 이름 (예: 가산동, 독산동)';
COMMENT ON COLUMN KOR.DONG.geom IS 'WGS84 좌표계 MultiPolygon (EPSG:4326)';
