require('dotenv').config();
const express = require('express');
const cors = require('cors');

const mergeRoute = require('./routes/merge');
const splitRoute = require('./routes/split');
const rotateRoute = require('./routes/rotate');
const compressRoute = require('./routes/compress');
const watermarkRoute = require('./routes/watermark');
const extractPagesRoute = require('./routes/extractPages');
const deletePagesRoute = require('./routes/deletePages');
const officeToPdfRoute = require('./routes/convert'); // office-to-pdf, pdf-to-office, images-to-pdf, pdf-to-images live here
const securityRoute = require('./routes/security');
const ocrRoute = require('./routes/ocr');
const aiRoute = require('./routes/ai');
const { PUBLIC_DIR } = require('./utils/publicFiles');

const app = express();
const PORT = process.env.PORT || 8080;

// Allow your GitHub Pages frontend (and localhost during development) to call this API.
const allowedOrigins = (process.env.ALLOWED_ORIGIN || 'https://rawasialqurum.github.io,http://localhost:5500,http://127.0.0.1:5500')
  .split(',')
  .map((s) => s.trim());

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS: ' + origin));
  }
}));

app.use(express.json());

// Finished files (merged PDFs, converted images, etc.) are served from here —
// this is what the frontend's `data.url` / `data.urls` values point at.
app.use('/files', express.static(PUBLIC_DIR));

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'folio-backend', endpoints: [
    'POST /api/merge', 'POST /api/split', 'POST /api/rotate', 'POST /api/compress',
    'POST /api/watermark', 'POST /api/extract', 'POST /api/delete-pages',
    'POST /api/office-to-pdf', 'POST /api/pdf-to-office',
    'POST /api/images-to-pdf', 'POST /api/pdf-to-images',
    'POST /api/lock', 'POST /api/unlock', 'POST /api/ocr',
    'POST /api/ai/summarize', 'POST /api/ai/chat', 'POST /api/ai/translate'
  ]});
});

app.get('/health', (req, res) => res.json({ ok: true }));

// Routes match the exact paths folio-frontend's index.html already calls.
app.use('/api/merge', mergeRoute);
app.use('/api/split', splitRoute);
app.use('/api/rotate', rotateRoute);
app.use('/api/compress', compressRoute);
app.use('/api/watermark', watermarkRoute);
app.use('/api/extract', extractPagesRoute);
app.use('/api/delete-pages', deletePagesRoute);
app.use('/api', officeToPdfRoute); // router's internal paths (/office-to-pdf, /pdf-to-office, /images-to-pdf, /pdf-to-images) become /api/...
app.use('/api', securityRoute);    // router's internal paths (/lock, /unlock) become /api/lock, /api/unlock
app.use('/api/ocr', ocrRoute);
app.use('/api/ai', aiRoute);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ ok: false, error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Folio backend listening on port ${PORT}`);
});
