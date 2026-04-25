const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-sonnet-4-20250514';

function anthropicHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    'anthropic-dangerous-allow-browser': 'true'
  };
}

export async function ocrHeatSheet(imageBase64, mimeType, swimmerName, apiKey) {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: anthropicHeaders(apiKey),
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
          { type: 'text', text: `This is a swim meet heat sheet or results. Extract times for ${swimmerName}.
Return ONLY valid JSON, no markdown:
{"meetName":"name if visible","date":"YYYY-MM-DD if visible","events":[{"event":"50 Free","time":"45.23"}],"notes":"brief note"}
If nothing found: {"events":[],"notes":"No swim times found"}` }
        ]
      }]
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Anthropic error ${res.status}`);
  }

  const d = await res.json();
  const txt = d.content?.find(b => b.type === 'text')?.text || '{}';
  try {
    return JSON.parse(txt.replace(/```json|```/g, '').trim());
  } catch {
    return { events: [], notes: 'Could not parse — fill in manually.' };
  }
}

export async function generateHypeText(name, age, meetsSummary, apiKey) {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: anthropicHeaders(apiKey),
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `You are the SportsCenter voice-over narrator. Write a 150-200 word hype reel narration for ${name}, age ${age}, covering her summer swim season.

Season data:
${meetsSummary}

Rules:
- Open with a dramatic cinematic hook like NFL Films
- Mention her REAL times and improvements by name
- Short punchy sentences built to be read aloud
- Use em dashes and line breaks for dramatic pauses
- Make her feel like an absolute champion
- End with a rallying cry for the season ahead
- No titles, no intro — just the narration text itself`
      }]
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Anthropic error ${res.status}`);
  }

  const d = await res.json();
  return d.content?.find(b => b.type === 'text')?.text || 'Could not generate.';
}

export async function generateVoice(text, elKey, voiceId) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': elKey
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2',
      voice_settings: { stability: 0.45, similarity_boost: 0.82, style: 0.35, use_speaker_boost: true }
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail?.message || 'ElevenLabs error — check your key');
  }

  return await res.blob();
}
