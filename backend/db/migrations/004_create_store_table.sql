-- 004_create_store_table.sql
-- 소상공인시장진흥공단 상가 정보 테이블 생성

-- KOR.STORE 테이블 생성
CREATE TABLE IF NOT EXISTS KOR.STORE (
    store_id SERIAL PRIMARY KEY,
    store_code VARCHAR(50) UNIQUE NOT NULL,  -- 상가 관리번호 (예: MA010120220806772392)
    store_nm VARCHAR(200) NOT NULL,           -- 상가명
    branch_nm VARCHAR(100),                   -- 지점명
    category_large VARCHAR(50),               -- 대분류 (예: 음식, 소매)
    category_medium VARCHAR(50),              -- 중분류
    category_small VARCHAR(50),               -- 소분류
    industry_code VARCHAR(20),                -- 표준산업분류코드
    industry_nm VARCHAR(200),                 -- 표준산업분류명
    dong VARCHAR(50),                         -- 행정동
    address_jibun TEXT,                       -- 지번 주소
    address_road TEXT,                        -- 도로명 주소
    building_nm VARCHAR(200),                 -- 건물명
    floor_info VARCHAR(20),                   -- 층수 정보
    ho_info VARCHAR(20),                      -- 호수 정보
    geom GEOMETRY(Point, 4326),              -- 좌표 (WGS84)
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 공간 인덱스 생성 (반경 검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_store_geom ON KOR.STORE USING GIST(geom);

-- 카테고리별 검색 인덱스
CREATE INDEX IF NOT EXISTS idx_store_category_large ON KOR.STORE(category_large);
CREATE INDEX IF NOT EXISTS idx_store_category_medium ON KOR.STORE(category_medium);
CREATE INDEX IF NOT EXISTS idx_store_category_small ON KOR.STORE(category_small);

-- 동별 검색 인덱스
CREATE INDEX IF NOT EXISTS idx_store_dong ON KOR.STORE(dong);

-- 상가 관리번호 인덱스 (중복 방지)
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_code ON KOR.STORE(store_code);

-- 코멘트 추가
COMMENT ON TABLE KOR.STORE IS '소상공인시장진흥공단 상가(상권) 정보';
COMMENT ON COLUMN KOR.STORE.store_code IS '상가 관리번호 (소진공 제공)';
COMMENT ON COLUMN KOR.STORE.geom IS 'WGS84 좌표계 (EPSG:4326)';
COMMENT ON COLUMN KOR.STORE.category_large IS '대분류 카테고리 (음식, 소매, 부동산 등)';
