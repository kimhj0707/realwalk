-- poi_id를 SERIAL로 변경

-- 1. 시퀀스 생성
CREATE SEQUENCE IF NOT EXISTS kor.poi_poi_id_seq;

-- 2. 현재 최대 poi_id 값 찾기
SELECT setval('kor.poi_poi_id_seq', COALESCE((SELECT MAX(poi_id) FROM kor.poi), 0) + 1, false);

-- 3. poi_id에 시퀀스 기본값 설정
ALTER TABLE kor.poi ALTER COLUMN poi_id SET DEFAULT nextval('kor.poi_poi_id_seq');

-- 4. 시퀀스 소유권 설정
ALTER SEQUENCE kor.poi_poi_id_seq OWNED BY kor.poi.poi_id;

COMMIT;
