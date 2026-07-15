import { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_ENDPOINTS = [
  '/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire',
  '/ErmctInfoInqireService/getHsptlBassInfoInqire'
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { _endpoint, numOfRows, pageNo, _type, STAGE1, STAGE2, Q0, Q1, QZ } = req.query;
    
    if (!_endpoint || typeof _endpoint !== 'string') {
      return res.status(400).json({ error: 'Bad Request: Missing _endpoint' });
    }
    if (!ALLOWED_ENDPOINTS.includes(_endpoint)) {
      return res.status(403).json({ error: 'Forbidden: Invalid endpoint' });
    }

    const EGEN_KEY = process.env.EGEN_SERVICE_KEY;
    if (!EGEN_KEY) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Number validations
    if (numOfRows && (isNaN(Number(numOfRows)) || Number(numOfRows) < 1 || Number(numOfRows) > 300)) {
      return res.status(400).json({ error: 'Bad Request: Invalid numOfRows' });
    }
    if (pageNo && (isNaN(Number(pageNo)) || Number(pageNo) < 1)) {
      return res.status(400).json({ error: 'Bad Request: Invalid pageNo' });
    }

    // Type validation
    if (_type && _type !== 'json' && _type !== 'xml') {
      return res.status(400).json({ error: 'Bad Request: Invalid _type' });
    }

    const targetUrl = new URL(`http://apis.data.go.kr/B552657${_endpoint}`);
    targetUrl.searchParams.set('serviceKey', EGEN_KEY);
    
    if (numOfRows) targetUrl.searchParams.set('numOfRows', String(numOfRows));
    if (pageNo) targetUrl.searchParams.set('pageNo', String(pageNo));
    if (_type) targetUrl.searchParams.set('_type', String(_type));
    if (STAGE1 && typeof STAGE1 === 'string' && STAGE1.length <= 50) targetUrl.searchParams.set('STAGE1', STAGE1);
    if (STAGE2 && typeof STAGE2 === 'string' && STAGE2.length <= 50) targetUrl.searchParams.set('STAGE2', STAGE2);
    if (Q0 && typeof Q0 === 'string' && Q0.length <= 50) targetUrl.searchParams.set('Q0', Q0);
    if (Q1 && typeof Q1 === 'string' && Q1.length <= 50) targetUrl.searchParams.set('Q1', Q1);
    if (QZ && typeof QZ === 'string' && ['A', 'B', 'C', 'D', 'E', 'G', 'H', 'I', 'M', 'N', 'P', 'U', 'V', 'W', 'Y', 'Z'].includes(QZ)) targetUrl.searchParams.set('QZ', QZ);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(targetUrl.toString(), { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        return res.status(502).json({ error: 'Bad Gateway' });
      }
      
      const data = await response.json();
      return res.status(200).json(data);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        return res.status(504).json({ error: 'Gateway Timeout' });
      }
      return res.status(502).json({ error: 'Bad Gateway' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
