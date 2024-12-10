const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");

// Initialize the repository
async function initRepo() {
  const repoPath = path.resolve(process.cwd(), ".slot");
  const commitsPath = path.join(repoPath, "commits");
  const stagingPath = path.join(repoPath, "staging");

  const oldSnapshotFile = path.join(repoPath, "oldSnapshot.json");
  const newSnapshotFile = path.join(repoPath, "newSnapshot.json");
  const logsFile = path.join(repoPath, "logs.json"); // Renamed to logs.json
  const configFile = path.join(repoPath, "config.json");

  // Path for the .slotignore file, which is outside the .slot folder
  const slotIgnoreFile = path.join(process.cwd(), ".slotignore");

  try {
    // Create necessary directories
    await fs.mkdir(repoPath, { recursive: true });
    await fs.mkdir(commitsPath, { recursive: true });
    await fs.mkdir(stagingPath, { recursive: true });

    // Initialize files with empty content
    await fs.writeFile(configFile, JSON.stringify({}));
    await fs.writeFile(logsFile, JSON.stringify([])); // logs.json created
    await fs.writeFile(oldSnapshotFile, JSON.stringify({}));
    await fs.writeFile(newSnapshotFile, JSON.stringify({}));

    // Create the .slotignore file outside the .slot folder
    const slotIgnoreContent = `.env\nnode_modules/\npackage-lock.json\n.git\n`;
    await fs.writeFile(slotIgnoreFile, slotIgnoreContent);

    // Take snapshots of all files in the directory and subdirectories
    const snapshot = {};
    await captureFilesSnapshot(process.cwd(), snapshot);

    // Save the snapshot in the oldSnapshot.json
    await fs.writeFile(oldSnapshotFile, JSON.stringify(snapshot, null, 2));

    console.log("Repository initialized successfully!");
  } catch (err) {
    console.error("Error initializing repository", err);
  }
}

// Function to recursively capture file snapshots in a given directory
async function captureFilesSnapshot(dir, snapshot) {
  const files = await fs.readdir(dir);

  // Iterate over all the files and directories in the current directory
  for (let file of files) {
    const filePath = path.join(dir, file);
    const fileStats = await fs.stat(filePath);

    if (fileStats.isDirectory()) {
      // If it's a directory, recurse into the subdirectory
      await captureFilesSnapshot(filePath, snapshot);
    } else if (fileStats.isFile()) {
      // If it's a file, take a snapshot of it
      const uniqueId = generateUniqueId(filePath);  // Generate unique ID based on path
      const fileHash = await calculateFileHash(filePath);  // Calculate the hash of the file content

      // Store file details in the snapshot
      snapshot[filePath] = {
        id: uniqueId,  // Unique ID based on path
        name: file,    // File name
        hash: fileHash // Hash of the file content (empty for now)
      };
    }
  }
}

// Function to generate a unique ID based on file path
function generateUniqueId(filePath) {
  return Buffer.from(filePath).toString('base64');
}

// Function to calculate the hash of the file content
async function calculateFileHash(filePath) {
  const fileBuffer = await fs.readFile(filePath);  // Read the file content
  const hash = crypto.createHash('sha256');         // Create a SHA-256 hash instance
  hash.update(fileBuffer);                          // Update the hash with file content
  return hash.digest('hex');                        // Return the hash as a hexadecimal string
}

module.exports = { initRepo };
