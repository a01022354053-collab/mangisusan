// 네이버 Geocoding API 서버사이드 프록시
// 매장 주소를 좌표(위도/경도)로 변환합니다.
// Client ID / Secret은 Vercel 환경변수(NAVER_MAPS_CLIENT_ID, NAVER_MAPS_CLIENT_SECRET)에서만 읽으며
// 브라우저로는 절대 전달되지 않습니다.

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const clientId = process.env.NAVER_MAPS_CLIENT_ID;
  const clientSecret = process.env.NAVER_MAPS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: '서버에 네이버 지도 API 키가 설정되지 않았습니다.' });
  }

  const query = (req.query.query || '').toString().slice(0, 100);
  if (!query) {
    return res.status(400).json({ error: 'query 파라미터(주소)가 필요합니다.' });
  }

  const apiUrl = `https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(query)}`;

  try {
    const naverRes = await fetch(apiUrl, {
      headers: {
        'X-NCP-APIGW-API-KEY-ID': clientId,
        'X-NCP-APIGW-API-KEY': clientSecret,
      },
    });

    if (!naverRes.ok) {
      const text = await naverRes.text();
      return res.status(naverRes.status).json({ error: 'Geocoding API 호출 실패', detail: text });
    }

    const data = await naverRes.json();
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
    return res.status(500).json({ error: '지오코딩 중 오류가 발생했습니다.', detail: String(err) });
  }
}
