const express = require('express');
const fs = require('fs-extra');
const { PDFDocument } = require('pdf-lib');
const upload = require('../utils/upload');
const { makeWorkspace } = require('../utils/workspace');
const { publishFile } = require('../utils/publicFiles');

const router = express.Router();

// POST /api/split (multipart field: "file", single PDF)
// Returns one PDF per page, each published individually.
router.post('/', upload.single('file'), async (req, res) => {
  const { cleanup } = await makeWorkspace();
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Upload a PDF file to split.' });

    const bytes = await fs.readFile(req.file.path);
    const srcPdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const totalPages = srcPdf.getPageCount();

    const urls = [];
    for (let i = 0; i < totalPages; i++) {
      const newPdf = await PDFDocument.create();
      const [page] = await newPdf.copyPages(srcPdf, [i]);
      newPdf.addPage(page);
      const outBytes = Buffer.from(await newPdf.save());
      urls.push(await publishFile(outBytes, 'pdf'));
    }

    res.json({ ok: true, urls, pageCount: totalPages });
  } catch (err) {
    console.error('split error:', err);
    res.status(500).json({ ok: false, error: 'Failed to split PDF: ' + err.message });
  } finally {
    if (req.file) await fs.remove(req.file.path).catch(() => {});
    await cleanup();
  }
});

module.exports = router;
