const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");

// Paths for PM2 logs, snapshot, and old snapshot
const pm2LogsDir = path.join(process.env.HOME || process.env.USERPROFILE, ".pm2", "logs");
const snapshotFile = path.resolve(process.cwd(), ".myGit", "snapshot.json");
const oldSnapshotFile = path.resolve(process.cwd(), ".myGit", "oldsnapshot.json");

// Function to calculate file hash
function calculateHash(content) {
  const hash = crypto.createHash("sha256");
  hash.update(content);
  return hash.digest("hex");
}

// Load or create snapshot
async function loadSnapshot(file) {
  try {
    const data = await fs.readFile(file, "utf-8");
    return JSON.parse(data);
  } catch {
    return {}; // Return empty object if file doesn't exist
  }
}

// Save snapshot
async function saveSnapshot(file, snapshot) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(snapshot, null, 2), "utf-8");
}

// Add a specific file to the repository
async function addFileToRepo(filePath) {
  const repoPath = path.resolve(process.cwd(), ".myGit");
  const stagingPath = path.join(repoPath, "staging");

  try {
    await fs.mkdir(stagingPath, { recursive: true });
    const fileName = path.basename(filePath);
    await fs.copyFile(filePath, path.join(stagingPath, fileName));
    console.log(`File ${fileName} added to the staging area!`);
  } catch (err) {
    console.error("Error adding file: ", err);
  }
}

// Process PM2 logs and identify new/modified files
async function processPm2Logs() {
  try {
    const snapshot = await loadSnapshot(snapshotFile);
    const oldSnapshot = await loadSnapshot(oldSnapshotFile);
    const currentFiles = await fs.readdir(pm2LogsDir);
    let filesAdded = 0;

    // Go through each PM2 log file and find file-related logs
    for (const logFile of currentFiles) {
      const logFilePath = path.join(pm2LogsDir, logFile);
      const logContent = await fs.readFile(logFilePath, "utf-8");

      // Find all lines mentioning "file added" or "file modified"
      const regex = /File (added|modified): (.+)/g;
      let match;

      while ((match = regex.exec(logContent)) !== null) {
        const filePath = match[2]; // Get the file path from log
        const fileAbsolutePath = path.resolve(process.cwd(), filePath);

        try {
          // Check if the file exists before proceeding
          await fs.access(fileAbsolutePath, fs.constants.F_OK);

          const fileStat = await fs.stat(fileAbsolutePath);
          if (fileStat.isFile()) {
            const fileContent = await fs.readFile(fileAbsolutePath);
            const fileHash = calculateHash(fileContent);

            // Compare with old snapshot to detect changes
            if (oldSnapshot[filePath] !== fileHash) {
              snapshot[filePath] = fileHash; // Update snapshot
              await addFileToRepo(fileAbsolutePath); // Add the file to staging area
              filesAdded++;
            }
          }
        } catch (err) {
          if (err.code === "ENOENT") {
            console.log(`File not found: ${fileAbsolutePath}`);
          } else {
            console.error("Error reading file: ", fileAbsolutePath, err);
          }
        }
      }
    }

    // Save the updated snapshots
    await saveSnapshot(oldSnapshotFile, snapshot); // Save new snapshot as old snapshot
    await saveSnapshot(snapshotFile, snapshot); // Save current snapshot
    console.log(`${filesAdded} file(s) added to the staging area.`);
  } catch (err) {
    console.error("Error processing PM2 logs: ", err);
  }
}

// Add all new or modified PM2 log files
async function addModifiedOrNewLogs() {
  await processPm2Logs();
}

module.exports = {
  addFileToRepo,
  addModifiedOrNewLogs,
};
