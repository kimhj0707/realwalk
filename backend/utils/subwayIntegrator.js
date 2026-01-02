/**
 * 지하철역 데이터 통합
 * - CSV에서 가산디지털단지역 데이터 추출
 * - 나머지 금천구 역은 수동 입력
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import pool from './database.js';
import iconv from 'iconv-lite';

// 금천구 지하철역 기본 정보 (CSV에 없는 역들)
const GEUMCHEON_STATIONS = [
  {
    station_name: "독산역",
    line: "1호선",
    lat: 37.4664,
    lng: 126.8931,
    daily_users: 25000,  // 추정치
    exits: [
      { exit_num: 1, lat: 37.4668, lng: 126.8928 },
      { exit_num: 2, lat: 37.4660, lng: 126.8934 }
    ]
  },
  {
    station_name: "금천구청역",
    line: "1호선",
    lat: 37.4567,
    lng: 126.8952,
    daily_users: 20000,
    exits: [
      { exit_num: 1, lat: 37.4570, lng: 126.8950 },
      { exit_num: 2, lat: 37.4564, lng: 126.8954 }
    ]
  },
  {
    station_name: "석수역",
    line: "1호선",
    lat: 37.4353,
    lng: 126.8970,
    daily_users: 15000,
    exits: [
      { exit_num: 1, lat: 37.4356, lng: 126.8968 },
      { exit_num: 2, lat: 37.4350, lng: 126.8972 }
    ]
  },
  {
    station_name: "관악역",
    line: "1호선",
    lat: 37.4476,
    lng: 126.9023,
    daily_users: 8000,
    exits: [
      { exit_num: 1, lat: 37.4478, lng: 126.9021 },
      { exit_num: 2, lat: 37.4474, lng: 126.9025 }
    ]
  }
];

/**
 * CSV 파일에서 가산디지털단지역 데이터 추출
 */
async function extractGasanFromCSV() {
  try {
    // CSV 파일 읽기 (EUC-KR 인코딩)
    const fileBuffer = fs.readFileSync('backend/data/subway_stats.csv');
    const fileContent = iconv.decode(fileBuffer, 'EUC-KR');

    // CSV 파싱
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    // 가산디지털단지역 데이터 필터링
    const gasanData = records.filter(row =>
      row['역명'] && row['역명'].includes('가산디지털단지')
    );

    if (gasanData.length === 0) {
      console.log('⚠️  CSV에 가산디지털단지역 데이터 없음 - 수동 입력 사용');
      return null;
    }

    // 일평균 승하차 인원 계산
    let totalIn = 0;
    let totalOut = 0;
    let dayCount = 0;

    gasanData.forEach(row => {
      // 시간대별 합계 계산
      let dailySum = 0;
      for (let key in row) {
        if (key.includes('시') && !key.includes('이전') && !key.includes('이후')) {
          dailySum += parseInt(row[key]) || 0;
        }
      }

      if (row['승하차구분'] === '승차') {
        totalIn += dailySum;
        dayCount++;
      } else if (row['승하차구분'] === '하차') {
        totalOut += dailySum;
      }
    });

    const avgDaily = Math.round((totalIn + totalOut) / dayCount);

    console.log(`✅ 가산디지털단지역 CSV 데이터 추출`);
    console.log(`   - 일평균 승차: ${Math.round(totalIn / (dayCount / 2)).toLocaleString()}명`);
    console.log(`   - 일평균 하차: ${Math.round(totalOut / (dayCount / 2)).toLocaleString()}명`);
    console.log(`   - 총 이용객: ${avgDaily.toLocaleString()}명`);

    return {
      station_name: "가산디지털단지역",
      line: "1호선/7호선",
      lat: 37.4817,
      lng: 126.8825,
      daily_users: avgDaily,
      exits: [
        { exit_num: 1, lat: 37.4820, lng: 126.8823 },
        { exit_num: 2, lat: 37.4815, lng: 126.8828 },
        { exit_num: 3, lat: 37.4814, lng: 126.8822 }
      ]
    };

  } catch (error) {
    console.error('❌ CSV 파싱 에러:', error.message);
    return null;
  }
}

/**
 * DB 테이블 생성
 */
async function createSubwayTable() {
  // 기존 테이블 삭제 후 재생성
  const dropQuery = `DROP TABLE IF EXISTS KOR.SUBWAY_STATION CASCADE;`;
  await pool.query(dropQuery);

  const createQuery = `
    CREATE TABLE KOR.SUBWAY_STATION (
      station_id SERIAL PRIMARY KEY,
      station_name VARCHAR(100) NOT NULL UNIQUE,
      line VARCHAR(50),
      station_geom GEOMETRY(POINT, 4326),
      daily_in INTEGER,
      daily_out INTEGER,
      daily_total INTEGER,
      data_source VARCHAR(50) DEFAULT 'manual',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX idx_subway_station_geom ON KOR.SUBWAY_STATION USING GIST(station_geom);
    CREATE INDEX idx_subway_station_name ON KOR.SUBWAY_STATION(station_name);
  `;

  await pool.query(createQuery);
  console.log('✅ SUBWAY_STATION 테이블 생성');
}

/**
 * 지하철역 저장
 */
async function saveStation(station, source = 'manual') {
  const query = `
    INSERT INTO KOR.SUBWAY_STATION (
      station_name,
      line,
      station_geom,
      daily_total,
      data_source
    ) VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, $6)
    ON CONFLICT (station_name) DO UPDATE SET
      daily_total = EXCLUDED.daily_total,
      data_source = EXCLUDED.data_source,
      updated_at = NOW();
  `;

  await pool.query(query, [
    station.station_name,
    station.line,
    station.lng,
    station.lat,
    station.daily_users,
    source
  ]);
}

/**
 * 메인 통합 함수
 */
async function integrateSubwayData() {
  console.log('🚇 지하철역 데이터 통합 시작\n');

  try {
    // 1. 테이블 생성
    await createSubwayTable();

    // 2. CSV에서 가산디지털단지역 추출
    const gasanStation = await extractGasanFromCSV();

    const allStations = gasanStation
      ? [gasanStation, ...GEUMCHEON_STATIONS]
      : [
          // CSV 실패 시 가산디지털단지역도 수동 입력
          {
            station_name: "가산디지털단지역",
            line: "1호선/7호선",
            lat: 37.4817,
            lng: 126.8825,
            daily_users: 85000,
            exits: []
          },
          ...GEUMCHEON_STATIONS
        ];

    // 3. 모든 역 저장
    console.log(`\n📥 DB 저장 중...`);
    for (const station of allStations) {
      await saveStation(
        station,
        station.station_name === "가산디지털단지역" && gasanStation ? 'csv' : 'manual'
      );
      console.log(`   ✅ ${station.station_name} (${station.line}) - ${station.daily_users.toLocaleString()}명/일`);
    }

    // 4. 결과 확인
    const result = await pool.query('SELECT COUNT(*) as count FROM KOR.SUBWAY_STATION');
    console.log(`\n🎉 완료! 총 ${result.rows[0].count}개 지하철역 저장됨`);

  } catch (error) {
    console.error('❌ 에러:', error);
  } finally {
    await pool.end();
  }
}

// 실행
integrateSubwayData();
