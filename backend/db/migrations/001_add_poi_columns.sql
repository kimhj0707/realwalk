-- POI 테이블에 데이터 소스 관련 컬럼 추가
-- 실행: psql -h 34.64.194.157 -U kimhj -d kimhj -f backend/db/migrations/001_add_poi_columns.sql

-- 1. data_source 컬럼 추가 (카카오/LBS Tech/병합 구분)
ALTER TABLE KOR.POI ADD COLUMN IF NOT EXISTS data_source VARCHAR(50) DEFAULT 'unknown';

-- 2. kakao_id 컬럼 추가 (카카오 Place ID)
ALTER TABLE KOR.POI ADD COLUMN IF NOT EXISTS kakao_id VARCHAR(100);

-- 3. lbstech_id 컬럼 추가 (LBS Tech POI ID)
ALTER TABLE KOR.POI ADD COLUMN IF NOT EXISTS lbstech_id VARCHAR(100);

-- 4. daily_visitors 컬럼 추가 (일평균 방문객 수)
ALTER TABLE KOR.POI ADD COLUMN IF NOT EXISTS daily_visitors INTEGER;

-- 5. is_active 컬럼 추가 (영업 중 여부)
ALTER TABLE KOR.POI ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 6. phone 컬럼 추가 (전화번호)
ALTER TABLE KOR.POI ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

-- 7. address_name 컬럼 추가 (도로명/지번 주소)
ALTER TABLE KOR.POI ADD COLUMN IF NOT EXISTS address_name TEXT;

-- 8. road_address_name 컬럼 추가 (도로명 주소)
ALTER TABLE KOR.POI ADD COLUMN IF NOT EXISTS road_address_name TEXT;

-- 9. category_name 컬럼 추가 (상세 카테고리)
ALTER TABLE KOR.POI ADD COLUMN IF NOT EXISTS category_name VARCHAR(255);

-- 10. place_url 컬럼 추가 (카카오맵 URL)
ALTER TABLE KOR.POI ADD COLUMN IF NOT EXISTS place_url TEXT;

-- 11. created_at 컬럼 추가 (생성 시각)
ALTER TABLE KOR.POI ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- 12. updated_at 컬럼 추가 (업데이트 시각)
ALTER TABLE KOR.POI ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_poi_data_source ON KOR.POI(data_source);
CREATE INDEX IF NOT EXISTS idx_poi_kakao_id ON KOR.POI(kakao_id);
CREATE INDEX IF NOT EXISTS idx_poi_is_active ON KOR.POI(is_active);
CREATE INDEX IF NOT EXISTS idx_poi_created_at ON KOR.POI(created_at);

-- 기존 데이터 data_source 업데이트 (알 수 없는 출처)
UPDATE KOR.POI SET data_source = 'existing' WHERE data_source = 'unknown';

COMMIT;
