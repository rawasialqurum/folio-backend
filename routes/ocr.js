const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const Tesseract = require('tesseract.js');
const upload = require('../utils/upload');
const { makeWorkspace } = require('../utils/workspace');
const { runCommand } = require('../utils/exec');
const { publishFile } = require('../utils/publicFiles');

const router = express.Router();

// POST /api/ocr (multipart field: "file" — image or PDF; optional body field "lang", default "eng")
// Returns a downloadable .txt file with the extracted text.
router.post('/', upload.single('file'), async (req, res) => {
  const { dir, cleanup } = await makeWorkspace();
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Upload an image or PDF file.' });
    const lang = req.body.lang || 'eng';
    const ext = path.extname(req.file.originalname).toLowerCase();

    let imagePaths = [];
    if (ext === '.pdf') {
      const inputPath = path.join(dir, 'input.pdf');
      await fs.copy(req.file.path, inputPath);
      const outPrefix = path.join(dir, 'page');
      await runCommand('pdftoppm', ['-png', '-r', '200', inputPath, outPrefix], { timeout: 90000 });
      const files = (await fs.readdir(dir)).filter((f) => f.startsWith('page') && f.endsWith('.png'));
      imagePaths = files.sort().map((f) => path.join(dir, f));
    } else {
      const inputPath = path.join(dir, `input${ext}`);
      await fs.copy(req.file.path, inputPath);
      imagePaths = [inputPath];
    }

    let fullText = '';
    for (const imgPath of imagePaths) {
      const { data } = await Tesseract.recognize(imgPath, lang);
      fullText += data.text + '\n\n';
    }

    const url = await publishFile(Buffer.from(fullText.trim(), 'utf-8'), 'txt');
    res.json({ ok: true, url, pages: imagePaths.length });
  } catch (err) {
    console.error('ocr error:', err);
    res.status(500).json({ ok: false, error: 'Failed to run OCR: ' + err.message });
  } finally {
    if (req.file) await fs.remove(req.file.path).catch(() => {});
    await cleanup();
  }
});

module.exports = router;
