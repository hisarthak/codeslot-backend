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
    const slotIgnoreContent = `.env\nnode_modules\npackage-lock.json\n.git\n`;
    await fs.writeFile(slotIgnoreFile, slotIgnoreContent);

    // Take snapshots of all files and folders in the directory
    const snapshot = {};
    await captureFilesSnapshot(process.cwd(), snapshot, process.cwd());

    // Save the snapshot in the oldSnapshot.json
    await fs.writeFile(oldSnapshotFile, JSON.stringify(snapshot, null, 2));

    console.log("Repository initialized successfully!");
  } catch (err) {
    console.error("Error initializing repository", err);
  }
}

// Function to recursively capture file and folder snapshots in a given directory
async function captureFilesSnapshot(dir, snapshot, repoRoot) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  // Iterate over all entries (files and directories) in the current directory
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    const relativePath = path.relative(repoRoot, entryPath);

    if (entry.isDirectory()) {
      // Add directory to the snapshot with new fields
      const inode = await getFileInode(entryPath);  // Get inode (unique file ID)
      snapshot[relativePath] = {
        ino: inode || "", // Store inode or empty string if unavailable
        name: entry.name,  // Directory name
        type: "folder",    // Explicitly set type as folder
        message: "",       // New field: empty string
        commit_id: "",     // New field: empty string
        change: false,     // New field: false (no change initially)
        time: "",
      };

      // Recurse into the subdirectory
      await captureFilesSnapshot(entryPath, snapshot, repoRoot);
    } else if (entry.isFile()) {
      // Add file to the snapshot with new fields
      const inode = await getFileInode(entryPath);  // Get inode (unique file ID)
      snapshot[relativePath] = {
        ino: inode || "", // Store inode or empty string if unavailable
        name: entry.name,  // File name
        type: "file",      // Explicitly set type as file
        hash: "",          // Empty hash for now
        message: "",       // New field: empty string
        commit_id: "",     // New field: empty string
        change: true, 
        date : "",
      };
    }
  }
}

// Function to get the inode (unique file ID) of a file
async function getFileInode(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.ino; // Return inode if available
  } catch (err) {
    return null; // Return null if inode can't be retrieved (e.g., file doesn't exist)
  }
}

module.exports = { initRepo };
