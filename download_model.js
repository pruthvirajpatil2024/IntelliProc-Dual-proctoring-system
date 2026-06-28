import https from 'https';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://storage.googleapis.com/tfjs-models/savedmodel/ssd_mobilenet_v2/';
const DEST_DIR = './frontend/public/models/coco-ssd';

// Helper function to download a file
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: Status Code ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {}); // Delete local file on error
      reject(err);
    });
  });
}

async function main() {
  try {
    if (!fs.existsSync(DEST_DIR)) {
      fs.mkdirSync(DEST_DIR, { recursive: true });
    }

    console.log('Downloading model.json...');
    const modelJsonUrl = `${BASE_URL}model.json`;
    const modelJsonDest = path.join(DEST_DIR, 'model.json');
    await downloadFile(modelJsonUrl, modelJsonDest);
    console.log('model.json downloaded successfully!');

    // Read and parse model.json to get weights
    const modelJsonRaw = fs.readFileSync(modelJsonDest, 'utf8');
    const modelJson = JSON.parse(modelJsonRaw);

    if (!modelJson.weightsManifest || !Array.isArray(modelJson.weightsManifest)) {
      throw new Error('Invalid model.json format: weightsManifest not found or not an array');
    }

    const weightFiles = [];
    for (const manifest of modelJson.weightsManifest) {
      if (manifest.paths && Array.isArray(manifest.paths)) {
        weightFiles.push(...manifest.paths);
      }
    }

    console.log(`Found ${weightFiles.length} weight shards to download.`);

    for (let i = 0; i < weightFiles.length; i++) {
      const shardName = weightFiles[i];
      const shardUrl = `${BASE_URL}${shardName}`;
      const shardDest = path.join(DEST_DIR, shardName);

      console.log(`Downloading shard ${i + 1}/${weightFiles.length}: ${shardName}...`);
      await downloadFile(shardUrl, shardDest);
    }

    console.log('All model files downloaded successfully!');
  } catch (error) {
    console.error('Error during download:', error);
    process.exit(1);
  }
}

main();
