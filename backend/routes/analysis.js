import express from 'express';
import { analyzeLocation, getDataStatus, reverseGeocode, generatePDFReport } from '../controllers/analysisController.js';

const router = express.Router();

// 상권 분석 API
router.post('/analyze', analyzeLocation);

// PDF 리포트 생성 API
router.post('/generate-pdf', generatePDFReport);

// 데이터 상태 확인 API
router.get('/data-status', getDataStatus);

// 역지오코딩 API (좌표 → 주소)
router.get('/reverse-geocode', reverseGeocode);

// 테스트 엔드포인트
router.get('/test', (req, res) => {
  res.json({
    message: 'Analysis API is working',
    timestamp: new Date().toISOString()
  });
});

export default router;
