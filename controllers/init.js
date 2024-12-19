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

  // Path for the slotignore.txt file, which is outside the .slot folder
  const slotIgnoreTxtFile = path.join(process.cwd(), "slotignore.txt");

  try {
    // Create the slotignore.txt file with the message explaining how to ignore files and folders
    const slotIgnoreTxtContent = `
# slotignore file
This file is used to specify files and folders that should be ignored by the repository.
Each line in this file represents a file or directory that will be excluded from tracking.

- To ignore a specific file or folder, simply write its name or path.
  For example:
  .env                # Ignores the .env file
  node_modules        # Ignores the node_modules folder
  package-lock.json   # Ignores the package-lock.json file
  .git                # Ignores the .git folder
  
- To ignore all files and subfolders inside a specific folder, write the folder's relative path followed by a '/'.
  For example:
  logs/               # Ignores the files and folders inside 'logs' folder
  
- Use relative paths from the root of the repository.
- Blank lines and lines starting with '#' are ignored (for comments).

Note: Ensure that no additional spaces or characters are present when specifying paths.  

# Below are some default ignored files and folders. You may choose to modify these based on your repository's needs.
.env
node_modules
package-lock.json
.git
`;

    await fs.writeFile(slotIgnoreTxtFile, slotIgnoreTxtContent);

    // Create necessary directories
    await fs.mkdir(repoPath, { recursive: true });
    await fs.mkdir(commitsPath, { recursive: true });
    await fs.mkdir(stagingPath, { recursive: true });

    // Initialize files with empty content
    await fs.writeFile(configFile, JSON.stringify({}));
    await fs.writeFile(logsFile, JSON.stringify([])); // logs.json created
    await fs.writeFile(oldSnapshotFile, JSON.stringify({}));
    await fs.writeFile(newSnapshotFile, JSON.stringify({}));

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

    // Skip files and folders listed in the slotignore.txt file
    const slotIgnoreContent = await fs.readFile(path.join(process.cwd(), "slotignore.txt"), "utf8");
    const ignoredPaths = slotIgnoreContent.split("\n").map(line => line.trim());
    if (ignoredPaths.includes(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      // Add directory to the snapshot with new fields
      const inode = await getFileInode(entryPath);  // Get inode (unique file ID)
      snapshot[relativePath] = {
        id : inode || "", // Store inode or empty string if unavailable
        text : entry.name,  // Directory name
        droppable : true,  
        parent: "" ,
        path: relativePath,
        message: "",       // New field: empty string
        commit_id: "",     // New field: empty string
        change: true,     // New field: false (no change initially)
        date: "",
      };

      // Recurse into the subdirectory
      await captureFilesSnapshot(entryPath, snapshot, repoRoot);
    } else if (entry.isFile()) {
      const inode = await getFileInode(entryPath);  // Get inode (unique file ID)
      snapshot[relativePath] = {
        id: inode || "", // Store inode or empty string if unavailable
        text: entry.name,  // File name
        droppable: true,      // Explicitly set type as file
        parent: "", 
        path: relativePath,         // Empty hash for now
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
