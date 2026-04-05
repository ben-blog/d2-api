const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^192\.168\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^::1$/,
  /^localhost$/
];

function isPrivateIp(ip) {
  if (!ip) return true;
  return PRIVATE_IP_PATTERNS.some(p => p.test(ip));
}

/**
 * IP 주소로 위치 정보를 조회한다.
 * ipapi.co 무료 플랜 사용 (API 키 불필요, 1000req/day)
 * 실패 시 null 반환 — 서비스에 영향 없음.
 *
 * @param {string|null} ip
 * @returns {Promise<{ city: string|null, country: string|null, hemisphere: 'north'|'south' }>}
 */
async function getLocation(ip) {
  const fallback = { city: null, country: null, hemisphere: 'north' };

  if (isPrivateIp(ip)) return fallback;

  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { 'User-Agent': 'dred-api/1.0' },
      signal: AbortSignal.timeout(3000) // 3초 타임아웃
    });

    if (!res.ok) return fallback;

    const data = await res.json();

    // ipapi.co 오류 응답 처리
    if (data.error) return fallback;

    const hemisphere = (typeof data.latitude === 'number' && data.latitude < 0)
      ? 'south'
      : 'north';

    return {
      city: data.city || null,
      country: data.country_name || null,
      hemisphere
    };
  } catch {
    return fallback;
  }
}

/**
 * Express 요청에서 클라이언트 IP를 추출한다.
 * Railway/Vercel 등 프록시 환경 대응.
 *
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    null
  );
}

module.exports = { getLocation, getClientIp };
