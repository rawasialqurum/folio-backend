const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

const TMP_ROOT = path.join(__dirname, '..', 'tmp');

/**
 * Creates a unique scratch directory under tmp/ for one request,
 * and returns { dir, cleanup } — cleanup() must be called after
 * the response is sent (success or error) to avoid disk buildup
 * on the free-tier host's ephemeral filesystem.
 */
async function makeWorkspace() {
  const dir = path.join(TMP_ROOT, uuidv4());
  await fs.ensureDir(dir);
  const cleanup = async () => {
    try {
      await fs.remove(dir);
    } catch (err) {
      console.error('Cleanup failed for', dir, err.message);
    }
  };
  return { dir, cleanup };
}

module.exports = { makeWorkspace, TMP_ROOT };
