import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import analysisRoutes from './routes/analysis.js';

// ES 모듈에서 __dirname 사용하기
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 환경변수 로드 (루트 디렉토리의 .env 파일)
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*'
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적 파일 제공 (프론트엔드)
app.use(express.static(path.join(__dirname, '../frontend')));

// 데이터 파일 제공 (GeoJSON 등)
app.use('/data', express.static(path.join(__dirname, 'data')));

// API 라우트
app.use('/api', analysisRoutes);

// 기본 라우트
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'RealWalk API Server is running',
    timestamp: new Date().toISOString()
  });
});

// 404 핸들러
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `경로 ${req.url}을 찾을 수 없습니다.`
  });
});

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 RealWalk 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
});
