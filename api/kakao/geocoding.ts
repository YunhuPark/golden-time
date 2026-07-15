import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { type, query, region, category_group_code, page, size } = req.query;
    
    const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
    if (!KAKAO_KEY) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    let endpoint = '';
    if (type === 'address') {
      endpoint = '/search/address.json';
    } else if (type === 'keyword') {
      endpoint = '/search/keyword.json';
    } else {
      return res.status(400).json({ error: 'Invalid type parameter' });
    }

    if (typeof query !== 'string' || query.trim() === '' || query.length > 100) {
      return res.status(400).json({ error: 'Bad Request: Invalid query parameter' });
    }

    if (page && (isNaN(Number(page)) || Number(page) < 1 || Number(page) > 45)) {
      return res.status(400).json({ error: 'Bad Request: Invalid page parameter' });
    }

    if (size && (isNaN(Number(size)) || Number(size) < 1 || Number(size) > 30)) {
      return res.status(400).json({ error: 'Bad Request: Invalid size parameter' });
    }

    const targetUrl = new URL(`https://dapi.kakao.com/v2/local${endpoint}`);
    targetUrl.searchParams.set('query', query);
    
    if (category_group_code && typeof category_group_code === 'string' && category_group_code.length <= 10) {
      targetUrl.searchParams.set('category_group_code', category_group_code);
    }
    if (page) targetUrl.searchParams.set('page', String(page));
    if (size) targetUrl.searchParams.set('size', String(size));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(targetUrl.toString(), {
        signal: controller.signal,
        headers: {
          Authorization: `KakaoAK ${KAKAO_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      clearTimeout(timeoutId);
      
      if (response.status === 429) {
        return res.status(429).json({ error: 'Rate Limit Exceeded' });
      }
      
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
