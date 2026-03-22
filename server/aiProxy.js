// aiProxy.js — proxies AI requests to Google Gemini (free)
// Mount with: app.use('/api', require('./aiProxy'));
// .env: GEMINI_API_KEY=your-key-here

const express = require('express');
const router  = express.Router();

router.post('/ai-signal', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('[aiProxy] GEMINI_API_KEY is not set in .env');
    return res.status(500).json({ error: 'GEMINI_API_KEY missing in .env' });
  }

  // Extract the prompt from the messages array
  const messages = req.body.messages || [];
  const prompt = messages.map(m => m.content).join('\n');

  if (!prompt) {
    return res.status(400).json({ error: 'No prompt provided' });
  }

  try {
    console.log('[aiProxy] → Gemini  prompt length:', prompt.length);

    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000,
          },
        }),
      }
    );

    const data = await upstream.json();

    if (!upstream.ok) {
      console.error('[aiProxy] Gemini error:', data);
      return res.status(upstream.status).json(data);
    }

    // Convert Gemini response format to Anthropic-like format
    // so the frontend code doesn't need to change
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('[aiProxy] ← Gemini  status=200');

    return res.json({
      content: [{ type: 'text', text }],
      type: 'message',
    });

  } catch (err) {
    console.error('[aiProxy] Error:', err.message);
    return res.status(502).json({ error: err.message });
  }
});

module.exports = router;