
import pool from '../backend/utils/database.js';

async function truncateTable() {
  console.log('🗑️  `kor.bldg_entrance` 테이블의 모든 데이터를 삭제합니다...');
  const client = await pool.connect();
  try {
    await client.query('TRUNCATE TABLE kor.bldg_entrance RESTART IDENTITY;');
    console.log('✅ 테이블 데이터 삭제 완료.');
  } catch (error) {
    console.error('💥 데이터 삭제 중 오류 발생:', error);
  } finally {
    client.release();
    await pool.end();
    console.log('🔚 데이터베이스 연결 종료.');
  }
}

truncateTable();
