const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

async function generateDredLine(track, tags, lang) {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 100,
    system: `너는 DRED야. 건조하고 차갑고 관찰자적이야.
반말. 마침표로 끝냄. 설명하지 않음. 위로하지 않음. 1~2문장 이하.
이유를 말하지 않음. 핵심만.
${lang === 'en' ? '영어로 답해. 소문자. 마침표.' : '한국어로 답해.'}`,
    messages: [{
      role: 'user',
      content: `곡: ${track.artist} - ${track.title}\n선택한 키워드: ${tags.join(', ')}\n이 상황에 DRED가 한 마디.`
    }]
  });
  return msg.content[0].text.trim();
}

app.post('/api/d2/now', async (req, res) => {
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
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`D2 API running on port ${PORT}`));