const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Claude에 메시지를 보내고 텍스트 응답을 반환한다.
 * @param {object} params
 * @param {string} params.system - 시스템 프롬프트
 * @param {string} params.user   - 유저 메시지
 * @param {number} [params.maxTokens=100]
 * @returns {Promise<string>}
 */
async function ask({ system, user, maxTokens = 100 }) {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }]
  });

  let text = msg.content[0].text.trim();
  // 따옴표 제거 (Claude가 간혹 감쌈)
  text = text.replace(/^["'"'「『]|["'"'」』]$/g, '').trim();
  return text;
}

module.exports = { anthropic, ask };
