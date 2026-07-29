const multer = require('multer');
const os = require('os');

// Files land in the OS temp dir first; each route moves/reads them
// into its own request-scoped workspace and multer's own cleanup
// (or our workspace cleanup) removes them afterward.
const upload = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file — adjust for your plan's limits
    files: 20
  }
});

module.exports = upload;
