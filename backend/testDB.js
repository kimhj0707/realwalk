import { testConnection, closePool } from './utils/database.js';

async function main() {
  console.log('🔄 PostgreSQL 연결 테스트 시작...\n');

  try {
    await testConnection();
    console.log('\n✅ 모든 테스트 통과!');
  } catch (error) {
    console.error('\n❌ 테스트 실패:', error.message);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();
