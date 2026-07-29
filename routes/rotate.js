const express = require('express');
const fs = require('fs-extra');
const { PDFDocument, degrees } = require('pdf-lib');
const upload = require('../utils/upload');
const { makeWorkspace } = require('../utils/workspace');
const { publishFile } = require('../utils/publicFiles');

const router = express.Router();

// POST /api/rotate (multipart field: "file", body field "degrees" = 90|180|270)
router.post('/', upload.single('file'), async (req, res) => {
  const { cleanup } = await makeWorkspace();
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Upload a PDF file to rotate.' });

    const angle = parseInt(req.body.degrees, 10);
    if (![90, 180, 270].includes(angle)) {
      return res.status(400).json({ ok: false, error: 'degrees must be one of 90, 180, 270.' });
    }

    const bytes = await fs.readFile(req.file.path);
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    pdfDoc.getPages().forEach((page) => {
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + angle) % 360));
    });

    const outBytes = Buffer.from(await pdfDoc.save());
    const url = await publishFile(outBytes, 'pdf');
    res.json({ ok: true, url });
  } catch (err) {
    console.error('rotate error:', err);
    res.status(500).json({ ok: false, error: 'Failed to rotate PDF: ' + err.message });
  } finally {
    if (req.file) await fs.remove(req.file.path).catch(() => {});
    await cleanup();
  }
});

module.exports = router;
