import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { origin, destination, priority } = req.query;

    const KAKAO_KEY = process.env['KAKAO_REST_API_KEY'];
    if (!KAKAO_KEY) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    if (typeof origin !== 'string' || typeof destination !== 'string') {
      return res.status(400).json({ error: 'Bad Request: origin and destination are required' });
    }

    const coordRegex = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;
    if (!coordRegex.test(origin) || !coordRegex.test(destination)) {
      return res.status(400).json({ error: 'Bad Request: Invalid coordinate format' });
    }

    const originParts = origin.split(',').map(Number);
    const destinationParts = destination.split(',').map(Number);
    const oLng = originParts[0];
    const oLat = originParts[1];
    const dLng = destinationParts[0];
    const dLat = destinationParts[1];

    if (
      oLng === undefined ||
      oLat === undefined ||
      dLng === undefined ||
      dLat === undefined ||
      !Number.isFinite(oLng) ||
      !Number.isFinite(oLat) ||
      !Number.isFinite(dLng) ||
      !Number.isFinite(dLat)
    ) {
      return res.status(400).json({ error: 'Bad Request: Invalid coordinates' });
    }

    if (
      oLng < -180 || oLng > 180 ||
      dLng < -180 || dLng > 180 ||
      oLat < -90 || oLat > 90 ||
      dLat < -90 || dLat > 90
    ) {
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

    // Keep the server budget shorter than the browser budget. This lets the
    // client receive an explicit 504 and retry once instead of abandoning a
    // still-running serverless request after its own timeout.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

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

      if (response.status === 401 || response.status === 403) {
        return res.status(response.status).json({ error: 'Unauthorized' });
      }

      if (response.status >= 400 && response.status < 500) {
        return res.status(response.status).json({ error: 'Bad Request' });
      }

      if (!response.ok) {
        return res.status(502).json({ error: 'Bad Gateway' });
      }

      const data = await response.json();
      return res.status(200).json(data);
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return res.status(504).json({ error: 'Gateway Timeout' });
      }
      return res.status(502).json({ error: 'Bad Gateway' });
    }
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
