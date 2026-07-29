const { execFile } = require('child_process');

/**
 * Run a system binary (ghostscript, qpdf, libreoffice, pdftoppm) safely.
 * Uses execFile (no shell) to avoid command injection from filenames.
 */
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: options.timeout || 120000, maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        return reject(error);
      }
      resolve({ stdout, stderr });
    });
  });
}

module.exports = { runCommand };
