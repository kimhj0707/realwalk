/**
 * POI 카테고리 확인 스크립트
 * 실제 DB에 있는 카테고리 목록을 확인합니다.
 */

require('dotenv').config();
const { pool, query } = require('./utils/database');

async function checkPOICategories() {
  try {
    console.log('=== POI 카테고리 분석 시작 ===\n');

    // 1. 전체 POI 카테고리 목록 및 개수
    const categoryQuery = `
      SELECT
        ctgry_group_nm as category,
        COUNT(*) as count
      FROM kor.poi
      WHERE ctgry_group_nm IS NOT NULL
      GROUP BY ctgry_group_nm
      ORDER BY count DESC;
    `;

    const categories = await query(categoryQuery);

    console.log(`📊 총 ${categories.rows.length}개의 카테고리 발견\n`);
    console.log('카테고리별 POI 개수:');
    console.log('─'.repeat(60));

    categories.rows.forEach((row, index) => {
      console.log(`${(index + 1).toString().padStart(3)}. ${row.category.padEnd(30)} : ${row.count.toLocaleString()}개`);
    });

    // 2. 주요 업종 관련 카테고리 찾기
    console.log('\n\n=== 주요 업종별 관련 카테고리 ===\n');

    const searchKeywords = {
      '카페': ['카페', '커피', 'coffee', 'cafe'],
      '편의점': ['편의점', 'CVS', 'GS25', 'CU', '세븐일레븐'],
      '치킨': ['치킨', '통닭', 'chicken'],
      '음식점': ['음식', '식당', '한식', '중식', '일식', '양식', '분식']
    };

    for (const [business, keywords] of Object.entries(searchKeywords)) {
      console.log(`\n🔍 ${business} 관련 카테고리:`);

      const matchedCategories = categories.rows.filter(row =>
        keywords.some(keyword =>
          row.category.toLowerCase().includes(keyword.toLowerCase())
        )
      );

      if (matchedCategories.length > 0) {
        matchedCategories.forEach(cat => {
          console.log(`   - ${cat.category} (${cat.count}개)`);
        });
      } else {
        console.log('   ⚠️  일치하는 카테고리 없음');
      }
    }

    // 3. NULL 카테고리 체크
    const nullCheckQuery = `
      SELECT COUNT(*) as null_count
      FROM kor.poi
      WHERE ctgry_group_nm IS NULL;
    `;
    const nullResult = await query(nullCheckQuery);

    console.log(`\n\n⚠️  카테고리가 NULL인 POI: ${nullResult.rows[0].null_count}개`);

    // 4. 총 POI 개수
    const totalQuery = `SELECT COUNT(*) as total FROM kor.poi;`;
    const totalResult = await query(totalQuery);

    console.log(`📍 총 POI 개수: ${totalResult.rows[0].total.toLocaleString()}개`);

    console.log('\n=== 분석 완료 ===');

  } catch (error) {
    console.error('❌ 에러 발생:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

// 스크립트 실행
checkPOICategories();
