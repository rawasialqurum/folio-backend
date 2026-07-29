const express = require('express');
const fs = require('fs-extra');
const { PDFDocument } = require('pdf-lib');
const upload = require('../utils/upload');
const { makeWorkspace } = require('../utils/workspace');
const { publishFile } = require('../utils/publicFiles');
const { parsePageRanges } = require('../utils/pageRanges');

const router = express.Router();

// POST /api/delete-pages (multipart field: "file", body field "pages" e.g. "2,4")
// Returns a PDF with the given pages removed.
router.post('/', upload.single('file'), async (req, res) => {
  const { cleanup } = await makeWorkspace();
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Upload a PDF file.' });

    const bytes = await fs.readFile(req.file.path);
    const srcPdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const totalPages = srcPdf.getPageCount();

    const toDelete = new Set(parsePageRanges(req.body.pages, totalPages));
    const keepIndices = Array.from({ length: totalPages }, (_, i) => i).filter((i) => !toDelete.has(i));

    if (keepIndices.length === 0) {
      return res.status(400).json({ ok: false, error: 'That would delete every page — enter fewer pages.' });
    }

    const newPdf = await PDFDocument.create();
    const pages = await newPdf.copyPages(srcPdf, keepIndices);
    pages.forEach((p) => newPdf.addPage(p));

    const outBytes = Buffer.from(await newPdf.save());
    const url = await publishFile(outBytes, 'pdf');
    res.json({ ok: true, url });
  } catch (err) {
    console.error('delete-pages error:', err);
    res.status(500).json({ ok: false, error: 'Failed to delete pages: ' + err.message });
  } finally {
    if (req.file) await fs.remove(req.file.path).catch(() => {});
    await cleanup();
  }
});

module.exports = router;
