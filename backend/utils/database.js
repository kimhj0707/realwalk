import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

// PostgreSQL 연결 풀 설정
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
});

// 연결 풀 에러 핸들링
pool.on('error', (err, client) => {
  console.error('❌ 예상치 못한 데이터베이스 에러:', err);
});

/**
 * 데이터베이스 연결 테스트
 */
export async function testConnection() {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT NOW() as now, version() as version');
    console.log('✅ PostgreSQL 연결 성공!');
    console.log('   시간:', result.rows[0].now);
    console.log('   버전:', result.rows[0].version.split(',')[0]);
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL 연결 실패:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 쿼리 실행 헬퍼 함수
 * @param {string} text - SQL 쿼리
 * @param {Array} params - 쿼리 파라미터
 * @returns {Promise<Object>} - 쿼리 결과
 */
export async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('🔍 쿼리 실행:', { text, duration: `${duration}ms`, rows: result.rowCount });
    return result;
  } catch (error) {
    console.error('❌ 쿼리 실행 에러:', error.message);
    console.error('   쿼리:', text);
    console.error('   파라미터:', params);
    throw error;
  }
}

/**
 * 트랜잭션 헬퍼 함수
 * @param {Function} callback - 트랜잭션 내에서 실행할 함수
 * @returns {Promise<any>} - 콜백 함수의 반환값
 */
export async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 트랜잭션 롤백:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 연결 풀 종료
 */
export async function closePool() {
  await pool.end();
  console.log('🔌 데이터베이스 연결 풀 종료');
}

// 기본 풀 export
export default pool;
