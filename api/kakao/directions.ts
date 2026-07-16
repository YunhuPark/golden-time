import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { origin, destination, priority } = req.query;
    
    const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
    if (!KAKAO_KEY) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    if (typeof origin !== 'string' || typeof destination !== 'string') {
      return res.status(400).json({ error: 'Bad Request: origin and destination are required' });
    }

    // Validate coordinates format (lng,lat)
    const coordRegex = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;
    if (!coordRegex.test(origin) || !coordRegex.test(destination)) {
      return res.status(400).json({ error: 'Bad Request: Invalid coordinate format' });
    }

    // Parse and validate bounds
    const [oLng, oLat] = origin.split(',').map(Number);
    const [dLng, dLat] = destination.split(',').map(Number);
    if (oLng < -180 || oLng > 180 || dLng < -180 || dLng > 180 || oLat < -90 || oLat > 90 || dLat < -90 || dLat > 90) {
      return res.status(400).json({ error: 'Bad Request: Coordinates out of bounds' });
    }

    if (priority && typeof priority !== 'string') {
      return res.status(400).json({ error: 'Bad Request: Invalid priority' });
    }
    const validPriorities = ['RECOMMEND', 'TIME', 'DISTANCE'];
    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({ error: 'Bad Request: Unsupported priority' });
    }

    const targetUrl = new URL('https://apis-navi.kakaomobility.com/v1/directions');
    targetUrl.searchParams.set('origin', origin);
    targetUrl.searchParams.set('destination', destination);
    if (priority) targetUrl.searchParams.set('priority', priority);

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
