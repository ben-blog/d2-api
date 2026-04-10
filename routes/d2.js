const { Router } = require('express');
const https = require('https');
const http = require('http');
const supabase = require('../utils/supabase');
const { ask } = require('../utils/claude');

const router = Router();

// ── DRED 에이전트 이벤트 전송 (fire-and-forget) ────
function notifyDredAgent(service, event_type, payload) {
  const dredApiUrl = process.env.DRED_API_URL;
  if (!dredApiUrl) return; // env 미설정이면 스킵

  try {
    const url = new URL('/api/dred/event', dredApiUrl);
    const body = JSON.stringify({ service, event_type, payload });
    const lib = url.protocol === 'https:' ? https : http;

    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      },
      () => {} // 응답 무시
    );
    req.on('error', (err) => console.error('[D2→DRED]', err.message));
    req.write(body);
    req.end();
  } catch (err) {
    console.error('[D2→DRED] URL 파싱 오류:', err.message);
  }
}

// ── 트랙 선택 로직 ─────────────────────────────────
class RuleBasedSelector {
  async select(tags, isRandom) {
    if (isRandom || !tags || tags.length === 0) {
      const { data } = await supabase
        .from('d2_tracks')
        .select('*')
        .eq('is_active', true)
        .limit(100);
      return data[Math.floor(Math.random() * data.length)];
    }

    // 1순위: AND 매칭
    let { data } = await supabase
      .from('d2_tracks')
      .select('*')
      .eq('is_active', true)
      .contains('d2_tags', tags);
    if (data && data.length > 0)
      return data[Math.floor(Math.random() * data.length)];

    // 2순위: OR 매칭
    ({ data } = await supabase
      .from('d2_tracks')
      .select('*')
      .eq('is_active', true)
      .overlaps('d2_tags', tags));
    if (data && data.length > 0)
      return data[Math.floor(Math.random() * data.length)];

    // 3순위: 랜덤
    ({ data } = await supabase
      .from('d2_tracks')
      .select('*')
      .eq('is_active', true));
    return data[Math.floor(Math.random() * data.length)];
  }
}

const selector = new RuleBasedSelector();

// ── DRED 한 줄 생성 ────────────────────────────────
async function generateDredLine(track, tags, lang) {
  return ask({
    system: `너는 DRED야. 건조하고 차갑고 관찰자적이야.
반말. 마침표로 끝냄. 설명하지 않음. 위로하지 않음. 1~2문장 이하.
이유를 말하지 않음. 핵심만.
${lang === 'en' ? '영어로 답해. 소문자. 마침표.' : '한국어로 답해.'}`,
    user: `곡: ${track.artist} - ${track.title}\n선택한 키워드: ${tags.join(', ')}\n이 상황에 DRED가 한 마디.`,
    maxTokens: 100
  });
}

// ── POST /api/d2/now ───────────────────────────────
router.post('/now', async (req, res) => {
  try {
    const { tags = [], is_random = false, lang = 'ko' } = req.body;

    const track = await selector.select(tags, is_random);
    if (!track) return res.status(404).json({ error: 'no track found' });

    const dred_line = await generateDredLine(track, tags, lang);

    await supabase.from('d2_sessions').insert({
      tags_input: tags,
      is_random,
      track_id: track.id,
      lang
    });

    // DRED 에이전트에 이벤트 전송 (선언 저장 + 패턴 감지)
    notifyDredAgent('d2', 'line_generated', {
      keywords: tags,
      song_title: track.title,
      artist: track.artist,
      dred_line,
      lang,
      is_random
    });

    res.json({
      track: {
        id: track.id,
        artist: track.artist,
        title: track.title,
        spotify_id: track.spotify_id,
        genre: track.genre
      },
      dred_line,
      lang
    });
  } catch (err) {
    console.error('[D2]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
