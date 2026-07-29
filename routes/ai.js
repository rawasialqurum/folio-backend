const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const upload = require('../utils/upload');
const { makeWorkspace } = require('../utils/workspace');
const { extractPdfText } = require('../utils/extractText');
const { askClaude } = require('../utils/anthropic');

const router = express.Router();

// Truncate long documents to keep requests fast and within reasonable cost —
// ~40,000 characters is roughly 8-10k tokens, plenty for summary/chat/translate.
const MAX_CHARS = 40000;

// POST /api/ai/summarize (multipart field: "file")
router.post('/summarize', upload.single('file'), async (req, res) => {
  const { dir, cleanup } = await makeWorkspace();
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Upload a PDF file to summarize.' });

    const inputPath = path.join(dir, 'input.pdf');
    await fs.copy(req.file.path, inputPath);
    const text = (await extractPdfText(inputPath, dir)).slice(0, MAX_CHARS);

    if (!text.trim()) {
      return res.status(400).json({ ok: false, error: 'Could not find any readable text in that PDF.' });
    }

    const summary = await askClaude(
      `Summarize the following document in a few clear paragraphs, capturing the key points, structure, and any important figures or conclusions. Document:\n\n${text}`
    );

    res.json({ ok: true, summary });
  } catch (err) {
    console.error('ai/summarize error:', err);
    res.status(500).json({ ok: false, error: 'Failed to summarize: ' + err.message });
  } finally {
    if (req.file) await fs.remove(req.file.path).catch(() => {});
    await cleanup();
  }
});

// POST /api/ai/chat (multipart field: "file", body field "question")
router.post('/chat', upload.single('file'), async (req, res) => {
  const { dir, cleanup } = await makeWorkspace();
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Upload a PDF file.' });
    const question = (req.body.question || '').trim();
    if (!question) return res.status(400).json({ ok: false, error: 'Enter a question to ask about the document.' });

    const inputPath = path.join(dir, 'input.pdf');
    await fs.copy(req.file.path, inputPath);
    const text = (await extractPdfText(inputPath, dir)).slice(0, MAX_CHARS);

    if (!text.trim()) {
      return res.status(400).json({ ok: false, error: 'Could not find any readable text in that PDF.' });
    }

    const answer = await askClaude(
      `Answer the question using only information from the document below. If the answer isn't in the document, say so clearly.\n\nDocument:\n${text}\n\nQuestion: ${question}`
    );

    res.json({ ok: true, answer });
  } catch (err) {
    console.error('ai/chat error:', err);
    res.status(500).json({ ok: false, error: 'Failed to answer: ' + err.message });
  } finally {
    if (req.file) await fs.remove(req.file.path).catch(() => {});
    await cleanup();
  }
});

// POST /api/ai/translate (multipart field: "file", body field "language")
router.post('/translate', upload.single('file'), async (req, res) => {
  const { dir, cleanup } = await makeWorkspace();
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Upload a PDF file to translate.' });
    const language = (req.body.language || 'Spanish').trim();

    const inputPath = path.join(dir, 'input.pdf');
    await fs.copy(req.file.path, inputPath);
    const text = (await extractPdfText(inputPath, dir)).slice(0, MAX_CHARS);

    if (!text.trim()) {
      return res.status(400).json({ ok: false, error: 'Could not find any readable text in that PDF.' });
    }

    const translated = await askClaude(
      `Translate the following document into ${language}. Preserve the original structure and paragraph breaks as closely as possible. Output only the translation, no commentary.\n\nDocument:\n\n${text}`,
      { maxTokens: 4000 }
    );

    res.json({ ok: true, translated, language });
  } catch (err) {
    console.error('ai/translate error:', err);
    res.status(500).json({ ok: false, error: 'Failed to translate: ' + err.message });
  } finally {
    if (req.file) await fs.remove(req.file.path).catch(() => {});
    await cleanup();
  }
});

module.exports = router;
