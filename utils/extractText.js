const path = require('path');
const fs = require('fs-extra');
const Tesseract = require('tesseract.js');
const { runCommand } = require('./exec');

/**
 * Extracts text from a PDF. Tries pdftotext first (fast, exact — works for
 * PDFs with embedded text). If that comes back empty (a scanned PDF with no
 * text layer), falls back to rendering pages to images and running OCR.
 */
async function extractPdfText(pdfPath, workDir) {
  const txtPath = path.join(workDir, 'extracted.txt');
  try {
    await runCommand('pdftotext', ['-layout', pdfPath, txtPath], { timeout: 60000 });
    const text = (await fs.readFile(txtPath, 'utf-8')).trim();
    if (text.length > 20) return text; // looks like a real text layer
  } catch (err) {
    // fall through to OCR
  }

  // OCR fallback for scanned/image-only PDFs
  const outPrefix = path.join(workDir, 'ocrpage');
  await runCommand('pdftoppm', ['-png', '-r', '200', pdfPath, outPrefix], { timeout: 90000 });
  const files = (await fs.readdir(workDir)).filter((f) => f.startsWith('ocrpage') && f.endsWith('.png')).sort();

  let fullText = '';
  for (const f of files) {
    const { data } = await Tesseract.recognize(path.join(workDir, f), 'eng');
    fullText += data.text + '\n\n';
  }
  return fullText.trim();
}

module.exports = { extractPdfText };
