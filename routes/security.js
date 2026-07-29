const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const upload = require('../utils/upload');
const { makeWorkspace } = require('../utils/workspace');
const { runCommand } = require('../utils/exec');
const { publishFile } = require('../utils/publicFiles');

const router = express.Router();

// ---- Lock (add password) ----
router.post('/lock', upload.single('file'), async (req, res) => {
  const { dir, cleanup } = await makeWorkspace();
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Upload a PDF file.' });
    const password = req.body.password;
    if (!password || password.length < 4) {
      return res.status(400).json({ ok: false, error: 'password must be at least 4 characters.' });
    }

    const inputPath = path.join(dir, 'input.pdf');
    const outputPath = path.join(dir, 'output.pdf');
    await fs.copy(req.file.path, inputPath);

    await runCommand('qpdf', ['--encrypt', password, password, '256', '--', inputPath, outputPath]);

    const url = await publishFile(outputPath, 'pdf');
    res.json({ ok: true, url });
  } catch (err) {
    console.error('lock error:', err);
    res.status(500).json({ ok: false, error: 'Failed to lock PDF: ' + err.message });
  } finally {
    if (req.file) await fs.remove(req.file.path).catch(() => {});
    await cleanup();
  }
});

// ---- Unlock (remove password) ----
router.post('/unlock', upload.single('file'), async (req, res) => {
  const { dir, cleanup } = await makeWorkspace();
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Upload a PDF file.' });
    const password = req.body.password || '';

    const inputPath = path.join(dir, 'input.pdf');
    const outputPath = path.join(dir, 'output.pdf');
    await fs.copy(req.file.path, inputPath);

    await runCommand('qpdf', [`--password=${password}`, '--decrypt', inputPath, outputPath]);

    const url = await publishFile(outputPath, 'pdf');
    res.json({ ok: true, url });
  } catch (err) {
    console.error('unlock error:', err);
    res.status(400).json({ ok: false, error: 'Failed to unlock PDF. Check the password is correct.' });
  } finally {
    if (req.file) await fs.remove(req.file.path).catch(() => {});
    await cleanup();
  }
});

module.exports = router;
