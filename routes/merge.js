const express = require('express');
const fs = require('fs-extra');
const { PDFDocument } = require('pdf-lib');
const upload = require('../utils/upload');
const { makeWorkspace } = require('../utils/workspace');
const { publishFile } = require('../utils/publicFiles');

const router = express.Router();

// POST /api/merge  (multipart field: "files", 2+ PDFs, in desired order)
router.post('/', upload.array('files', 20), async (req, res) => {
  const { cleanup } = await makeWorkspace();
  try {
    const files = req.files;
    if (!files || files.length < 2) {
      return res.status(400).json({ ok: false, error: 'Upload at least 2 PDF files to merge.' });
    }

    const mergedPdf = await PDFDocument.create();
    for (const file of files) {
      const bytes = await fs.readFile(file.path);
      const srcPdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
      pages.forEach((page) => mergedPdf.addPage(page));
    }

    const mergedBytes = Buffer.from(await mergedPdf.save());
    const url = await publishFile(mergedBytes, 'pdf');
    res.json({ ok: true, url });
  } catch (err) {
    console.error('merge error:', err);
    res.status(500).json({ ok: false, error: 'Failed to merge PDFs: ' + err.message });
  } finally {
    if (req.files) await Promise.all(req.files.map((f) => fs.remove(f.path).catch(() => {})));
    await cleanup();
  }
});

module.exports = router;
