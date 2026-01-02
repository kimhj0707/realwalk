import fs from 'fs';

const data = JSON.parse(fs.readFileSync('backend/data/boundaries/geumcheon_dong_boundaries.geojson', 'utf8'));
console.log('총 Feature 수:', data.features.length);

// 속성 필드명 확인
if (data.features.length > 0) {
  console.log('\n첫 번째 Feature 속성 키:');
  console.log(Object.keys(data.features[0].properties));
  console.log('\n첫 5개 Feature 샘플:');
  data.features.slice(0, 5).forEach((f, i) => {
    console.log(`#${i+1}:`, JSON.stringify(f.properties));
  });
}

// 금천구 관련 동 찾기
const geumcheonDongs = data.features.filter(f => {
  const props = f.properties;
  return (props.sig_cd && props.sig_cd === '11545') ||
         (props.sig_kor_nm && props.sig_kor_nm.includes('금천')) ||
         (props.full_nm && props.full_nm.includes('금천구'));
});

console.log('\n금천구 동 개수:', geumcheonDongs.length);

if (geumcheonDongs.length > 0) {
  console.log('\n금천구 동 목록:');
  geumcheonDongs.forEach((f, i) => {
    const emdNm = f.properties.emd_kor_nm || f.properties.emd_nm || f.properties.EMD_KOR_NM || f.properties.full_nm || '알 수 없음';
    console.log(`  ${i + 1}. ${emdNm}`);
  });

  // 저장
  const geumcheonDongsOnly = {
    type: 'FeatureCollection',
    features: geumcheonDongs
  };
  fs.writeFileSync('backend/data/boundaries/geumcheon_dongs_only.geojson', JSON.stringify(geumcheonDongsOnly, null, 2));
  console.log('\n✅ 금천구 동만 추출하여 저장');
  console.log(`📏 파일 크기: ${(fs.statSync('backend/data/boundaries/geumcheon_dongs_only.geojson').size / 1024).toFixed(2)} KB`);
}
