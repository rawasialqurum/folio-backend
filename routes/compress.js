const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const upload = require('../utils/upload');
const { makeWorkspace } = require('../utils/workspace');
const { runCommand } = require('../utils/exec');
const { publishFile } = require('../utils/publicFiles');

const router = express.Router();

const QUALITY_PRESETS = { low: '/screen', medium: '/ebook', high: '/printer' };

// POST /api/compress (multipart field: "file", optional body field "quality")
router.post('/', upload.single('file'), async (req, res) => {
  const { dir, cleanup } = await makeWorkspace();
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Upload a PDF file to compress.' });

    const preset = QUALITY_PRESETS[req.body.quality] || QUALITY_PRESETS.medium;
    const inputPath = path.join(dir, 'input.pdf');
    const outputPath = path.join(dir, 'output.pdf');
    await fs.copy(req.file.path, inputPath);

    const originalSize = (await fs.stat(inputPath)).size;

    await runCommand('gs', [
      '-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.4', `-dPDFSETTINGS=${preset}`,
      '-dNOPAUSE', '-dQUIET', '-dBATCH', `-sOutputFile=${outputPath}`, inputPath
    ]);

    const newSize = (await fs.stat(outputPath)).size;
    const url = await publishFile(outputPath, 'pdf');
    res.json({ ok: true, url, originalSize, newSize });
  } catch (err) {
    console.error('compress error:', err);
    res.status(500).json({ ok: false, error: 'Failed to compress PDF: ' + err.message });
  } finally {
    if (req.file) await fs.remove(req.file.path).catch(() => {});
    await cleanup();
  }
});

module.exports = router;
