import type { ApiRequest, ApiResponse } from './httpTypes';

const REALTIME_BEDS_ENDPOINT = '/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire';
const LOCATION_INFO_ENDPOINT = '/ErmctInfoInqireService/getEgytLcinfoInqire';
const HOSPITAL_LIST_ENDPOINT = '/ErmctInfoInqireService/getEgytListInfoInqire';
const HOSPITAL_BASIC_ENDPOINT = '/ErmctInfoInqireService/getEgytBassInfoInqire';

const ALLOWED_ENDPOINTS = [
  REALTIME_BEDS_ENDPOINT,
  LOCATION_INFO_ENDPOINT,
  HOSPITAL_LIST_ENDPOINT,
  HOSPITAL_BASIC_ENDPOINT,
];

const decodeXmlEntities = (value: string): string =>
  value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const getXmlTag = (xml: string, tagName: string): string | undefined => {
  const match = xml.match(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return match?.[1] === undefined ? undefined : decodeXmlEntities(match[1].trim());
};

const parseXmlItem = (xml: string): Record<string, string> => {
  const item: Record<string, string> = {};
  const tagPattern = /<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(xml)) !== null) {
    const [, key, rawValue] = match;
    if (!key || rawValue === undefined) continue;
    item[key] = decodeXmlEntities(rawValue.trim());
  }

  return item;
};

const parseOptionalNumber = (value?: string): number | undefined => {
  if (value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseEGenXml = (xml: string) => {
  const headerXml = getXmlTag(xml, 'header') ?? '';
  const bodyXml = getXmlTag(xml, 'body') ?? '';
  const itemsXml = getXmlTag(bodyXml, 'items') ?? '';

  const items: Record<string, string>[] = [];
  const itemPattern = /<item>([\s\S]*?)<\/item>/gi;
  let itemMatch: RegExpExecArray | null;
  while ((itemMatch = itemPattern.exec(itemsXml)) !== null) {
    if (itemMatch[1] !== undefined) items.push(parseXmlItem(itemMatch[1]));
  }

  const body: {
    items?: { item: Record<string, string> | Record<string, string>[] };
    numOfRows?: number;
    pageNo?: number;
    totalCount?: number;
  } = {};

  if (items.length === 1) body.items = { item: items[0]! };
  else if (items.length > 1) body.items = { item: items };

  body.numOfRows = parseOptionalNumber(getXmlTag(bodyXml, 'numOfRows'));
  body.pageNo = parseOptionalNumber(getXmlTag(bodyXml, 'pageNo'));
  body.totalCount = parseOptionalNumber(getXmlTag(bodyXml, 'totalCount'));

  return {
    response: {
      header: {
        resultCode: getXmlTag(headerXml, 'resultCode') ?? '99',
        resultMsg: getXmlTag(headerXml, 'resultMsg') ?? 'UNKNOWN RESPONSE',
      },
      body,
    },
  };
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { _endpoint, numOfRows, pageNo, _type, STAGE1, STAGE2, Q0, Q1, QZ, ORD, HPID } = req.query;

    if (!_endpoint || typeof _endpoint !== 'string') {
      return res.status(400).json({ error: 'Bad Request: Missing _endpoint' });
    }
    if (!ALLOWED_ENDPOINTS.includes(_endpoint)) {
      return res.status(403).json({ error: 'Forbidden: Invalid endpoint' });
    }

    const EGEN_KEY = process.env['EGEN_SERVICE_KEY'];
    if (!EGEN_KEY) return res.status(500).json({ error: 'Server configuration error' });

    if (numOfRows !== undefined) {
      const parsedNumOfRows = Number(numOfRows);
      if (!Number.isInteger(parsedNumOfRows) || parsedNumOfRows < 1 || parsedNumOfRows > 300) {
        return res.status(400).json({ error: 'Bad Request: Invalid numOfRows' });
      }
    }
    if (pageNo !== undefined) {
      const parsedPageNo = Number(pageNo);
      if (!Number.isInteger(parsedPageNo) || parsedPageNo < 1 || parsedPageNo > 1000) {
        return res.status(400).json({ error: 'Bad Request: Invalid pageNo' });
      }
    }
    if (_type && _type !== 'json') {
      return res.status(400).json({ error: 'Bad Request: Invalid _type, only json is allowed' });
    }
    if (ORD && (typeof ORD !== 'string' || !['ADDR', 'NAME'].includes(ORD))) {
      return res.status(400).json({ error: 'Bad Request: Invalid ORD' });
    }
    if (HPID !== undefined && (typeof HPID !== 'string' || !/^[A-Za-z0-9_-]{1,30}$/.test(HPID))) {
      return res.status(400).json({ error: 'Bad Request: Invalid HPID' });
    }

    const targetUrl = new URL(`https://apis.data.go.kr/B552657${_endpoint}`);
    targetUrl.searchParams.set('serviceKey', EGEN_KEY);
    if (numOfRows) targetUrl.searchParams.set('numOfRows', String(numOfRows));
    if (pageNo) targetUrl.searchParams.set('pageNo', String(pageNo));
    if (_type) targetUrl.searchParams.set('_type', String(_type));
    if (STAGE1 && typeof STAGE1 === 'string' && STAGE1.length <= 50) targetUrl.searchParams.set('STAGE1', STAGE1);
    if (STAGE2 && typeof STAGE2 === 'string' && STAGE2.length <= 50) targetUrl.searchParams.set('STAGE2', STAGE2);
    if (Q0 && typeof Q0 === 'string' && Q0.length <= 50) targetUrl.searchParams.set('Q0', Q0);
    if (Q1 && typeof Q1 === 'string' && Q1.length <= 50) targetUrl.searchParams.set('Q1', Q1);
    if (QZ && typeof QZ === 'string' && ['A', 'B', 'C', 'D', 'E', 'G', 'H', 'I', 'M', 'N', 'P', 'U', 'V', 'W', 'Y', 'Z'].includes(QZ)) {
      targetUrl.searchParams.set('QZ', QZ);
    }
    if (ORD && typeof ORD === 'string') targetUrl.searchParams.set('ORD', ORD);
    if (HPID && typeof HPID === 'string') targetUrl.searchParams.set('HPID', HPID);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(targetUrl.toString(), {
        signal: controller.signal,
        headers: { Accept: 'application/json, application/xml, text/xml' },
      });
      clearTimeout(timeoutId);

      if (!response.ok) return res.status(502).json({ error: 'Bad Gateway' });

      const contentType = response.headers?.get?.('content-type')?.toLowerCase() ?? '';
      let data: unknown;
      if (contentType.includes('xml')) data = parseEGenXml(await response.text());
      else data = await response.json();

      if (_endpoint === LOCATION_INFO_ENDPOINT || _endpoint === HOSPITAL_LIST_ENDPOINT || _endpoint === HOSPITAL_BASIC_ENDPOINT) {
        res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
      } else {
        res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
      }
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
