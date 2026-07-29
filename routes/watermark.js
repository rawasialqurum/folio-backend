const express = require('express');
const fs = require('fs-extra');
const { PDFDocument, rgb, degrees, StandardFonts } = require('pdf-lib');
const upload = require('../utils/upload');
const { makeWorkspace } = require('../utils/workspace');
const { publishFile } = require('../utils/publicFiles');

const router = express.Router();

// POST /api/watermark (multipart field: "file", body field "text")
// Stamps diagonal, semi-transparent text across every page.
router.post('/', upload.single('file'), async (req, res) => {
  const { cleanup } = await makeWorkspace();
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Upload a PDF file to watermark.' });
    const text = (req.body.text || 'CONFIDENTIAL').slice(0, 60);

    const bytes = await fs.readFile(req.file.path);
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    pdfDoc.getPages().forEach((page) => {
      const { width, height } = page.getSize();
      const fontSize = Math.min(width, height) / (text.length * 0.6 || 1) * 2.2;
      page.drawText(text, {
        x: width / 2 - (text.length * fontSize) / 5,
        y: height / 2,
        size: fontSize,
        font,
        color: rgb(0.5, 0.5, 0.5),
        opacity: 0.25,
        rotate: degrees(45)
      });
    });

    const outBytes = Buffer.from(await pdfDoc.save());
    const url = await publishFile(outBytes, 'pdf');
    res.json({ ok: true, url });
  } catch (err) {
    console.error('watermark error:', err);
    res.status(500).json({ ok: false, error: 'Failed to watermark PDF: ' + err.message });
  } finally {
    if (req.file) await fs.remove(req.file.path).catch(() => {});
    await cleanup();
  }
});

module.exports = router;
