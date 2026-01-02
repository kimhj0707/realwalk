/**
 * Shapefile to GeoJSON 변환 스크립트
 * 금천구 행정구역 경계 추출
 */

import shapefile from 'shapefile';
import fs from 'fs';
import path from 'path';

async function convertShapefileToGeoJSON(shpPath, outputPath, filterField = null, filterValue = null) {
  try {
    console.log(`📂 읽는 중: ${shpPath}`);

    const features = [];

    // Shapefile 읽기
    const source = await shapefile.open(shpPath);

    let result;
    let count = 0;

    while (!(result = await source.read()).done) {
      const feature = result.value;
      count++;

      // 필터링 (특정 필드 값으로)
      if (filterField && filterValue) {
        const fieldValue = feature.properties[filterField];

        // 디버깅: 모든 속성 출력 (첫 5개만)
        if (count <= 5) {
          console.log(`\n📝 Feature #${count} 속성:`, feature.properties);
        }

        if (fieldValue && fieldValue.includes(filterValue)) {
          console.log(`✅ 발견: ${filterField} = ${fieldValue}`);
          features.push(feature);
        }
      } else {
        // 필터 없으면 모두 추가
        features.push(feature);
      }
    }

    console.log(`\n📊 총 ${count}개 Feature 읽음`);
    console.log(`🎯 필터링 결과: ${features.length}개 Feature`);

    if (features.length === 0) {
      console.log('\n⚠️  필터 조건에 맞는 데이터가 없습니다.');
      console.log('💡 사용 가능한 필드를 확인하세요.');
      return;
    }

    // GeoJSON 생성
    const geojson = {
      type: 'FeatureCollection',
      features: features
    };

    // 파일 저장
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2), 'utf8');

    console.log(`\n✅ 저장 완료: ${outputPath}`);
    console.log(`📏 파일 크기: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);

    // 결과 요약
    if (features.length > 0) {
      console.log('\n📋 첫 번째 Feature 속성:');
      console.log(JSON.stringify(features[0].properties, null, 2));
    }

  } catch (error) {
    console.error('❌ 에러:', error);
    throw error;
  }
}

// 실행
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log(`
사용법:
  node convert-shapefile.js <SHP파일경로> <출력GeoJSON경로> [필터필드] [필터값]

예시:
  node convert-shapefile.js input.shp output.geojson
  node convert-shapefile.js input.shp output.geojson SIG_KOR_NM 금천구
  `);
  process.exit(1);
}

const [shpPath, outputPath, filterField, filterValue] = args;

convertShapefileToGeoJSON(shpPath, outputPath, filterField, filterValue)
  .then(() => {
    console.log('\n✨ 변환 완료!');
  })
  .catch((error) => {
    console.error('\n❌ 변환 실패:', error.message);
    process.exit(1);
  });
