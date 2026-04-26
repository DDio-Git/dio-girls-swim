exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const { voiceId, ...body } = JSON.parse(event.body);

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': process.env.ELEVENLABS_API_KEY
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    return { statusCode: response.status, body: JSON.stringify(err) };
  }

  const buffer = await response.arrayBuffer();
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'audio/mpeg' },
    body: Buffer.from(buffer).toString('base64'),
    isBase64Encoded: true
  };
};
