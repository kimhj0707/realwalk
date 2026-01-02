-- 보행로 네트워크 테이블 생성
-- OpenStreetMap 데이터 저장용

CREATE TABLE IF NOT EXISTS KOR.WALKING_PATH (
    path_id SERIAL PRIMARY KEY,
    osm_id BIGINT UNIQUE,                    -- OpenStreetMap ID
    highway VARCHAR(50),                      -- 도로 유형 (footway, residential, etc.)
    name VARCHAR(200),                        -- 도로명
    footway VARCHAR(50),                      -- 보행로 세부 유형 (sidewalk, crossing, etc.)
    surface VARCHAR(50),                      -- 포장 상태 (asphalt, concrete, etc.)
    width VARCHAR(20),                        -- 폭 (문자열로 저장, 예: "3.5")
    lit VARCHAR(10),                          -- 가로등 (yes/no)
    access VARCHAR(20),                       -- 접근 제한 (private, public, etc.)

    -- 실제 유동량 데이터 (추후 추가)
    estimated_daily_traffic INTEGER,          -- 추정 일평균 유동량

    -- Geometry
    path_geom GEOMETRY(LINESTRING, 4326) NOT NULL,

    -- 메타데이터
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 공간 인덱스 생성 (필수!)
CREATE INDEX IF NOT EXISTS idx_walking_path_geom
ON KOR.WALKING_PATH USING GIST(path_geom);

-- 도로 유형별 인덱스
CREATE INDEX IF NOT EXISTS idx_walking_path_highway
ON KOR.WALKING_PATH(highway);

-- OSM ID 인덱스
CREATE INDEX IF NOT EXISTS idx_walking_path_osm_id
ON KOR.WALKING_PATH(osm_id);

-- 통계 출력
DO $$
BEGIN
    RAISE NOTICE '✅ KOR.WALKING_PATH 테이블 생성 완료';
    RAISE NOTICE '📊 공간 인덱스: idx_walking_path_geom';
    RAISE NOTICE '📊 도로 유형 인덱스: idx_walking_path_highway';
END $$;
