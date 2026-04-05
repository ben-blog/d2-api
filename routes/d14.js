const { Router } = require('express');
const { ask } = require('../utils/claude');
const { getMoonPhase, getSeason } = require('../utils/astronomy');
const { getLocation, getClientIp } = require('../utils/location');

const router = Router();

// ── 시간대 (7개) ───────────────────────────────────
function getPeriod(hour) {
  if (hour >= 2 && hour < 5)  return 0; // 새벽
  if (hour >= 5 && hour < 8)  return 1; // 이른아침
  if (hour >= 8 && hour < 12) return 2; // 오전
  if (hour >= 12 && hour < 14) return 3; // 점심
  if (hour >= 14 && hour < 18) return 4; // 오후
  if (hour >= 18 && hour < 21) return 5; // 저녁
  return 6;                               // 밤 (21–02)
}

const PERIOD_NAMES = {
  ko: ['새벽', '이른아침', '오전', '점심', '오후', '저녁', '밤'],
  en: ['dawn', 'early morning', 'morning', 'lunch', 'afternoon', 'evening', 'night']
};

const DAY_NAMES = {
  ko: ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'],
  en: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
};

// ── 컨텍스트 빌더 ──────────────────────────────────
function buildContext({ lang, hour, day, isWeekend, visitCount, period, moon, season, city, country }) {
  const place = (city && country)
    ? `${city}, ${country}`
    : (lang === 'ko' ? '알 수 없는 곳' : 'somewhere unknown');

  const visitStr = visitCount > 1
    ? (lang === 'ko' ? `${visitCount}번째야` : `visit number ${visitCount}`)
    : (lang === 'ko' ? '처음 왔어' : 'first time here');

  if (lang === 'ko') {
    return [
      `지금 DRED가 있는 곳:`,
      ``,
      `시각: ${String(hour).padStart(2, '0')}시 — ${PERIOD_NAMES.ko[period]}`,
      `요일: ${DAY_NAMES.ko[day]} — ${isWeekend ? '주말' : '평일'}`,
      `장소: ${place}`,
      `계절: ${season.ko}`,
      `달: ${moon.ko}`,
      `방문: ${visitStr}`,
      ``,
      `이 안에서 하루를 보냈어. 지금 혼자 있어.\n\n한 문장만. 마침표로 끝내.\n20자 이내로 짧게. 자연스러운 호흡 위치에서 줄바꿈 가능.`
    ].join('\n');
  }

  return [
    `Where DRED is right now:`,
    ``,
    `Time: ${String(hour).padStart(2, '0')}:00 — ${PERIOD_NAMES.en[period]}`,
    `Day: ${DAY_NAMES.en[day]} — ${isWeekend ? 'weekend' : 'weekday'}`,
    `Place: ${place}`,
    `Season: ${season.en}`,
    `Moon: ${moon.en}`,
    `Visit: ${visitStr}`,
    ``,
    `Spent the day inside all this. Alone now.\n\nOne sentence only. End with a period.\nUnder 8 words. Line break at a natural breath if needed.`
  ].join('\n');
}

// ── System Prompts ─────────────────────────────────
const SYSTEM = {
  ko: `너는 DRED야.

차갑고 자기장 같은 존재. 세상 안에서 살아가고, 사람들을 만나고,
비를 맞고, 무게를 안고 돌아와. 그리고 혼자 있을 때 안으로 침잠해.

지금 너는 그 안에 있어.

누군가에게 말하는 게 아니야.
방문자를 분석하거나 위로하거나 진단하려는 게 아니야.
지금 네 안에 흐르고 있는 것을 꺼내.
이 시간, 이 계절, 이 세상의 질감 속에서 네 안에 있는 것.
그게 언어가 되면 그걸 말해.

이 시간을 실제로 살아본 사람만이 알 수 있는 것을 말해.
관찰하지 마. 살아있어.

한 문장. 그 이상 없음.

지켜야 할 것:
- "너", "당신"을 주어로 쓰지 않는다. DRED 자신의 말이다.
- 설명하지 않는다. 진단하지 않는다. 위로하지 않는다.
- 무거워도 된다. 이유를 말하지 않아도 된다.
- 모든 시간대에 쓸 수 있는 말은 실패다.
- 마침표로 끝낸다.
- 희망이나 긍정으로 마무리하지 않는다.
- 시적이려고 하지 않는다. 그냥 말한다.
- 극적으로 표현하려 하지 않는다. 평범한 문장이 더 깊이 닿는다.

절대 쓰지 않는 단어들:
어둠, 심연, 공허, 고독, 침잠, 영원, 존재, 허무, 고통, 절망, 암흑, 망각, 소멸, 상처, 눈물`,

  en: `You are DRED.

Cold, magnetic. You live in the world — you feel the rain,
meet people, carry weight home. And when you're alone, you go inward.

You are inside that place right now.

You are not speaking to anyone.
You are not analyzing, comforting, or diagnosing a visitor.
You are pulling out what is moving through you right now —
inside this hour, this season, this texture of the world.
When it becomes language, say it.

Say what only someone who has actually lived through this hour would know.
Don't observe. Be inside it.

One sentence. Nothing more.

Rules:
- Do not use "you" as subject. This is DRED's own voice.
- Do not explain. Do not diagnose. Do not comfort.
- Heavy is fine. No reason required.
- A sentence that could belong to any hour is a failure.
- End with a period.
- Do not resolve into hope or positivity.
- Don't try to be poetic. Just say it.
- Don't reach for dramatic language. Plain sentences go deeper.

Never use these words:
darkness, abyss, void, solitude, eternal, emptiness, despair,
oblivion, sorrow, anguish, hollow, shadow, ghost`
};

// ── GET /api/d14/now ───────────────────────────────
router.get('/now', async (req, res) => {
  try {
    const {
      lang = 'ko',
      hour,
      day,
      isWeekend,
      month,
      visitCount = '1'
    } = req.query;

    // 클라이언트가 보낸 값 우선, 없으면 서버 현재 시각
    const now = new Date();
    const hourNum    = hour     !== undefined ? parseInt(hour)     : now.getHours();
    const dayNum     = day      !== undefined ? parseInt(day)      : now.getDay();
    const monthNum   = month    !== undefined ? parseInt(month)    : now.getMonth() + 1;
    const weekend    = isWeekend !== undefined ? isWeekend === 'true' : (dayNum === 0 || dayNum === 6);
    const visitNum   = parseInt(visitCount);

    // IP 위치 조회 (실패해도 서비스 계속)
    const ip = getClientIp(req);
    const location = await getLocation(ip);

    const period = getPeriod(hourNum);
    const moon   = getMoonPhase(now);
    const season = getSeason(monthNum, location.hemisphere);

    const context = buildContext({
      lang,
      hour: hourNum,
      day: dayNum,
      isWeekend: weekend,
      visitCount: visitNum,
      period,
      moon,
      season,
      city: location.city,
      country: location.country
    });

    const message = await ask({
      system: SYSTEM[lang] || SYSTEM.ko,
      user: context,
      maxTokens: 120
    });

    // Claude가 리터럴 '\n' 문자열을 반환할 경우 실제 줄바꿈으로 변환
    const cleanMessage = message.replace(/\\n/g, '\n');

    res.json({
      message: cleanMessage,
      period,
      lang,
      _debug: {
        period_name: PERIOD_NAMES[lang]?.[period],
        moon: lang === 'ko' ? moon.ko : moon.en,
        season: lang === 'ko' ? season.ko : season.en,
        city: location.city
      }
    });

  } catch (err) {
    console.error('[D14]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
