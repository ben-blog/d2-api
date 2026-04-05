/**
 * 달의 위상을 계산한다. API 없음, 수식 기반.
 * @param {Date} date
 * @returns {{ ko: string, en: string }}
 */
function getMoonPhase(date) {
  const knownNew = new Date(2000, 0, 6); // 알려진 기준 신월
  const diff = (date - knownNew) / (1000 * 60 * 60 * 24);
  const cycle = 29.53058867;
  const phase = ((diff % cycle) + cycle) % cycle;

  const labels = {
    ko: ['그믐', '초승달', '반달', '보름에 가까워', '보름달', '기울고 있어', '반달', '그믐에 가까워'],
    en: ['new moon', 'crescent', 'quarter', 'nearly full', 'full moon', 'waning', 'last quarter', 'nearly new']
  };
  const thresholds = [1.85, 7.38, 9.22, 14.77, 16.61, 22.15, 23.99, 29.53];
  const idx = thresholds.findIndex(t => phase < t);
  const i = idx === -1 ? 0 : idx;

  return { ko: labels.ko[i], en: labels.en[i] };
}

/**
 * 월과 반구를 기반으로 계절을 반환한다.
 * @param {number} month - 1~12
 * @param {'north'|'south'} hemisphere
 * @returns {{ ko: string, en: string }}
 */
function getSeason(month, hemisphere = 'north') {
  const table = {
    north: {
      ko: ['겨울','겨울','봄','봄','봄','여름','여름','여름','가을','가을','가을','겨울'],
      en: ['winter','winter','spring','spring','spring','summer','summer','summer','autumn','autumn','autumn','winter']
    },
    south: {
      ko: ['여름','여름','가을','가을','가을','겨울','겨울','겨울','봄','봄','봄','여름'],
      en: ['summer','summer','autumn','autumn','autumn','winter','winter','winter','spring','spring','spring','summer']
    }
  };
  const h = hemisphere === 'south' ? 'south' : 'north';
  return {
    ko: table[h].ko[month - 1],
    en: table[h].en[month - 1]
  };
}

module.exports = { getMoonPhase, getSeason };
