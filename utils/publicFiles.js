const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

// Files written here are served statically at /files/<name> (see server.js).
// This is ephemeral storage — fine for on-demand downloads, but files vanish
// if the container restarts. That's expected for a free-tier deployment.
const PUBLIC_DIR = path.join(__dirname, '..', 'public_files');
fs.ensureDirSync(PUBLIC_DIR);

/**
 * Copies/writes a finished output file into the public directory under a
 * random name and returns the public URL path to hand back to the frontend.
 */
async function publishFile(sourcePathOrBuffer, extension) {
  const filename = `${uuidv4()}.${extension.replace(/^\./, '')}`;
  const destPath = path.join(PUBLIC_DIR, filename);

  if (Buffer.isBuffer(sourcePathOrBuffer)) {
    await fs.writeFile(destPath, sourcePathOrBuffer);
  } else {
    await fs.copy(sourcePathOrBuffer, destPath);
  }

  return `/files/${filename}`;
}

module.exports = { publishFile, PUBLIC_DIR };
