const fs = require("fs");
const path = require("path");
const chokidar = require("chokidar");
const crypto = require("crypto");

// Path to the snapshot file
const snapshotFile = path.join(process.cwd(), ".myGit", "snapshot.json");

// Function to calculate a file's hash
const calculateHash = (filePath) => {
  const fileBuffer = fs.readFileSync(filePath);
  const hash = crypto.createHash("sha256");
  hash.update(fileBuffer);
  return hash.digest("hex");
};

// Load the existing snapshot
const loadSnapshot = () => {
  if (!fs.existsSync(snapshotFile)) {
    return {}; // Return an empty object if snapshot.json doesn't exist
  }
  const data = fs.readFileSync(snapshotFile, "utf-8");
  return JSON.parse(data);
};

// Save the updated snapshot
const saveSnapshot = (snapshot) => {
  fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2), "utf-8");
};

// Main tracking logic
const trackFiles = () => {
  const watchedDirectory = process.cwd(); // Set to your working directory
  const snapshot = loadSnapshot();

  // Initialize chokidar watcher
  const watcher = chokidar.watch(watchedDirectory, {
    ignored: [
      /(^|[\/\\])\.myGit([\/\\]|$)/,  // Ignore .myGit directory
      /(^|[\/\\])node_modules([\/\\]|$)/,  // Ignore node_modules directory
      /(^|[\/\\])\.git([\/\\]|$)/,  // Ignore .git directory or file
    ],
    persistent: true,
  });

  // Event handlers for file changes
  watcher
    .on("add", (filePath) => {
      if (!fs.statSync(filePath).isFile()) return; // Skip directories
      const relativePath = path.relative(watchedDirectory, filePath);
      snapshot[relativePath] = calculateHash(filePath);
      saveSnapshot(snapshot);
      console.log(`File added: ${relativePath}`);
    })
    .on("change", (filePath) => {
      if (!fs.statSync(filePath).isFile()) return; // Skip directories
      const relativePath = path.relative(watchedDirectory, filePath);
      const newHash = calculateHash(filePath);
    
      // Check if the hash has changed
      if (snapshot[relativePath] === newHash) {
        return; // Content has not changed; skip further processing
      }
    
      // Update the snapshot and save it
      snapshot[relativePath] = newHash;
      saveSnapshot(snapshot);
      console.log(`File modified: ${relativePath}`);
    })
    .on("unlink", (filePath) => {
      const relativePath = path.relative(watchedDirectory, filePath);
      delete snapshot[relativePath];
      saveSnapshot(snapshot);
      console.log(`File deleted: ${relativePath}`);
    });

  console.log("Tracking started...");
};

// Start the file tracker
trackFiles();
