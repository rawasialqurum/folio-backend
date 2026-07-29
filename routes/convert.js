const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const { PDFDocument } = require('pdf-lib');
const upload = require('../utils/upload');
const { makeWorkspace } = require('../utils/workspace');
const { runCommand } = require('../utils/exec');
const { publishFile } = require('../utils/publicFiles');

const router = express.Router();

// ---- Office (docx/xlsx/pptx/odt...) -> PDF ----
router.post('/office-to-pdf', upload.single('file'), async (req, res) => {
  const { dir, cleanup } = await makeWorkspace();
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Upload an Office document.' });

    const originalExt = path.extname(req.file.originalname) || '.docx';
    const inputPath = path.join(dir, `input${originalExt}`);
    await fs.copy(req.file.path, inputPath);

    await runCommand('libreoffice', [
      '--headless', '--norestore', '--convert-to', 'pdf', '--outdir', dir, inputPath
    ], { timeout: 90000 });

    const outputPath = path.join(dir, 'input.pdf');
    const url = await publishFile(outputPath, 'pdf');
    res.json({ ok: true, url });
  } catch (err) {
    console.error('office-to-pdf error:', err);
    res.status(500).json({ ok: false, error: 'Failed to convert document to PDF: ' + err.message });
  } finally {
    if (req.file) await fs.remove(req.file.path).catch(() => {});
    await cleanup();
  }
});

// ---- PDF -> Office ----
router.post('/pdf-to-office', upload.single('file'), async (req, res) => {
  const { dir, cleanup } = await makeWorkspace();
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Upload a PDF file.' });
    const format = (req.body.format || 'docx').replace(/[^a-z]/gi, '');

    const inputPath = path.join(dir, 'input.pdf');
    await fs.copy(req.file.path, inputPath);

    await runCommand('libreoffice', [
      '--headless', '--norestore', '--convert-to', format, '--outdir', dir, inputPath
    ], { timeout: 90000 });

    const outputPath = path.join(dir, `input.${format}`);
    const url = await publishFile(outputPath, format);
    res.json({ ok: true, url });
  } catch (err) {
    console.error('pdf-to-office error:', err);
    res.status(500).json({ ok: false, error: 'Failed to convert PDF to office document: ' + err.message });
  } finally {
    if (req.file) await fs.remove(req.file.path).catch(() => {});
    await cleanup();
  }
});

// ---- Images -> PDF ----
router.post('/images-to-pdf', upload.array('files', 30), async (req, res) => {
  const { cleanup } = await makeWorkspace();
  try {
    if (!req.files || req.files.length < 1) {
      return res.status(400).json({ ok: false, error: 'Upload at least one image.' });
    }

    const pdfDoc = await PDFDocument.create();
    for (const file of req.files) {
      const bytes = await fs.readFile(file.path);
      const ext = path.extname(file.originalname).toLowerCase();
      const image = ext === '.png' ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
      const page = pdfDoc.addPage([image.width, image.height]);
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    }

    const outBytes = Buffer.from(await pdfDoc.save());
    const url = await publishFile(outBytes, 'pdf');
    res.json({ ok: true, url });
  } catch (err) {
    console.error('images-to-pdf error:', err);
    res.status(500).json({ ok: false, error: 'Failed to convert images to PDF: ' + err.message });
  } finally {
    if (req.files) await Promise.all(req.files.map((f) => fs.remove(f.path).catch(() => {})));
    await cleanup();
  }
});

// ---- PDF -> Images (one PNG per page) ----
router.post('/pdf-to-images', upload.single('file'), async (req, res) => {
  const { dir, cleanup } = await makeWorkspace();
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Upload a PDF file.' });
    const dpi = parseInt(req.body.dpi, 10) || 150;

    const inputPath = path.join(dir, 'input.pdf');
    await fs.copy(req.file.path, inputPath);

    const outPrefix = path.join(dir, 'page');
    await runCommand('pdftoppm', ['-png', '-r', String(dpi), inputPath, outPrefix], { timeout: 90000 });

    const files = (await fs.readdir(dir)).filter((f) => f.startsWith('page') && f.endsWith('.png')).sort();
    const urls = [];
    for (const f of files) urls.push(await publishFile(path.join(dir, f), 'png'));

    res.json({ ok: true, urls, pageCount: urls.length });
  } catch (err) {
    console.error('pdf-to-images error:', err);
    res.status(500).json({ ok: false, error: 'Failed to render PDF pages to images: ' + err.message });
  } finally {
    if (req.file) await fs.remove(req.file.path).catch(() => {});
    await cleanup();
  }
});

module.exports = router;
