const express = require('express');
const fs = require('fs-extra');
const { PDFDocument } = require('pdf-lib');
const upload = require('../utils/upload');
const { makeWorkspace } = require('../utils/workspace');
const { publishFile } = require('../utils/publicFiles');
const { parsePageRanges } = require('../utils/pageRanges');

const router = express.Router();

// POST /api/extract (multipart field: "file", body field "ranges" e.g. "1-3,5")
// Returns a single PDF containing only the requested pages, in order.
router.post('/', upload.single('file'), async (req, res) => {
  const { cleanup } = await makeWorkspace();
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Upload a PDF file.' });

    const bytes = await fs.readFile(req.file.path);
    const srcPdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const totalPages = srcPdf.getPageCount();

    const indices = parsePageRanges(req.body.ranges, totalPages);
    if (indices.length === 0) {
      return res.status(400).json({ ok: false, error: 'Enter a valid page range, e.g. 1-3,5.' });
    }

    const newPdf = await PDFDocument.create();
    const pages = await newPdf.copyPages(srcPdf, indices);
    pages.forEach((p) => newPdf.addPage(p));

    const outBytes = Buffer.from(await newPdf.save());
    const url = await publishFile(outBytes, 'pdf');
    res.json({ ok: true, url });
  } catch (err) {
    console.error('extract error:', err);
    res.status(500).json({ ok: false, error: 'Failed to extract pages: ' + err.message });
  } finally {
    if (req.file) await fs.remove(req.file.path).catch(() => {});
    await cleanup();
  }
});

module.exports = router;
