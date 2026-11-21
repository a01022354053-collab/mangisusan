// 네이버 Geocoding API 서버사이드 프록시
// 매장 주소를 좌표(위도/경도)로 변환합니다.
// Client ID / Secret은 Vercel 환경변수(NAVER_MAPS_CLIENT_ID, NAVER_MAPS_CLIENT_SECRET)에서만 읽으며
// 브라우저로는 절대 전달되지 않습니다.

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const clientId = (process.env.NAVER_MAPS_CLIENT_ID || '').trim();
  const clientSecret = (process.env.NAVER_MAPS_CLIENT_SECRET || '').trim();

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: '서버에 네이버 지도 API 키가 설정되지 않았습니다.' });
  }

  const query = (req.query.query || '').toString().slice(0, 100);
  if (!query) {
    return res.status(400).json({ error: 'query 파라미터(주소)가 필요합니다.' });
  }

  try {
    const data = await requestGeocode(query, clientId, clientSecret);
    const addresses = data.addresses || [];

    if (addresses.length === 0) {
      return res.status(404).json({ error: '주소에 해당하는 좌표를 찾지 못했습니다.' });
    }

    const first = addresses[0];

    // 주소는 거의 바뀌지 않으므로 하루 동안 캐시
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');

    return res.status(200).json({
      lat: parseFloat(first.y),
      lng: parseFloat(first.x),
      roadAddress: first.roadAddress,
      jibunAddress: first.jibunAddress,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: '지오코딩 중 오류가 발생했습니다.', detail: err.message || String(err) });
  }
}

function requestGeocode(query, clientId, clientSecret) {
  const https = require('https');
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'maps.apigw.ntruss.com',
      path: '/map-geocode/v2/geocode?query=' + encodeURIComponent(query),
      method: 'GET',
      headers: {
        'x-ncp-apigw-api-key-id': clientId,
        'x-ncp-apigw-api-key': clientSecret,
        Accept: 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const err = new Error(body);
          err.statusCode = res.statusCode;
          return reject(err);
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}
