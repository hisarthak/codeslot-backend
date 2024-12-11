const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");



// Function to load and parse .slotignore file
async function loadSlotIgnore(ignoreFile) {
  try {
    const data = await fs.readFile(ignoreFile, "utf-8");
    return data.split("\n").map(line => line.trim()).filter(line => line && !line.startsWith("#")); // Filter out empty lines and comments
  } catch (err) {
    console.error("Error loading .slotignore file", err);
    return [];
  }
}

// Function to check if a file or folder should be ignored based on .slotignore
async function isFileIgnored(filePath, ignorePatterns) {
  for (const pattern of ignorePatterns) {
    // Check if the file path matches any ignore pattern
    const fullPattern = path.resolve(process.cwd(), pattern);
    if (filePath.includes(fullPattern)) {
      return true; // If the file is in the ignore list, return true
    }
  }
  return false; // If no match, return false
}

// Helper function to generate a unique ID based on the file's path
function generateUniqueId(filePath) {
  return Buffer.from(filePath).toString("base64");
}

// Helper function to calculate the hash of the file's content
async function calculateFileHash(filePath) {
  const fileBuffer = await fs.readFile(filePath);
  const hash = crypto.createHash("sha256");
  hash.update(fileBuffer);
  return hash.digest("hex");
}

// Function to add a specific file to the repo
async function addFileToRepo(file) {
  const slotIgnoreFile = path.join(process.cwd(), ".slotignore");

  const repoPath = path.resolve(process.cwd(), ".slot");
  const snapshotFile = path.join(repoPath, "oldSnapshot.json");
  const stagingDir = path.join(repoPath, "staging");

  try {
    const ignorePatterns = await loadSlotIgnore(slotIgnoreFile);  // Load the ignore patterns



    const filePath = path.resolve(process.cwd(), file);

     // Skip the file if it's in the ignore list
     if (await isFileIgnored(filePath, ignorePatterns)) {
      console.log(`${file} is ignored due to .slotignore.`);
      return; // Skip this file
    }

    const snapshot = JSON.parse(await fs.readFile(snapshotFile, "utf-8"));
    const fileHash = await calculateFileHash(filePath);
    const uniqueId = generateUniqueId(filePath);  // Generate a unique ID based on the file's path

    const oldFileSnapshot = snapshot[file];

    if (oldFileSnapshot) {
      // Case 1: File is unchanged (same UUID, filename, and filehash)
      if (oldFileSnapshot.id === uniqueId && oldFileSnapshot.hash === fileHash) {
        console.log(`${file} has not been modified. No changes detected.`);
        return;
      }

      // Case 2: File is renamed (same UUID, different filename or filehash)
      if (oldFileSnapshot.id === uniqueId) {
        if (oldFileSnapshot.name !== file && oldFileSnapshot.hash !== fileHash) {
          console.log(`${file} has been renamed and modified. Staging it...`);
        } else if (oldFileSnapshot.name !== file) {
          console.log(`${file} has been renamed. Staging it...`);
        } else {
          console.log(`${file} has been modified. Staging it...`);
        }
      } else {
        // Case 3: Completely new file or moved file (new UUID)
        console.log(`${file} is a new file or moved. Staging it...`);
      }
    } else {
      // Case 4: If it's a completely new file or moved file (new UUID)
      console.log(`${file} is a new file. Staging it...`);
    }

    // Move the file to the staging folder
    await fs.copyFile(filePath, path.join(stagingDir, path.basename(file)));

    // Update the snapshot and save it in newSnapshot.json
    snapshot[file] = { id: uniqueId, name: file, hash: fileHash };
    await fs.writeFile(path.join(repoPath, "newSnapshot.json"), JSON.stringify(snapshot, null, 2));

    // Update oldSnapshot.json
    await fs.writeFile(snapshotFile, JSON.stringify(snapshot, null, 2));
    console.log(`${file} has been staged and snapshot updated.`);
  } catch (err) {
    console.error("Error adding file to repo", err);
  }
}
async function addModifiedOrLogs() {
  const slotIgnoreFile = path.join(process.cwd(), ".slotignore");
  const repoPath = path.resolve(process.cwd(), ".slot");
  const snapshotFile = path.join(repoPath, "oldSnapshot.json");
  const stagingDir = path.join(repoPath, "staging");

  try {
    const ignorePatterns = await loadSlotIgnore(slotIgnoreFile);  // Load the ignore patterns
    const snapshot = JSON.parse(await fs.readFile(snapshotFile, "utf-8"));
    const filesInDir = await fs.readdir(process.cwd());

    // Iterate through the files in the current directory
    for (const file of filesInDir) {
      const filePath = path.resolve(process.cwd(), file);

      // Skip directories and .slot folder
      if ((await fs.stat(filePath)).isDirectory() || file === ".slot") {
        continue;
      }

      // Skip the file if it's in the ignore list
      if (await isFileIgnored(filePath, ignorePatterns)) {
        console.log(`${file} is ignored due to .slotignore.`);
        continue; // Skip this file
      }

      const fileHash = await calculateFileHash(filePath);
      const uniqueId = generateUniqueId(filePath);

      const oldFileSnapshot = snapshot[file];

      // Case 1: Unchanged file
      if (oldFileSnapshot && oldFileSnapshot.id === uniqueId && oldFileSnapshot.hash === fileHash) {
        console.log(`${file} has not been modified. No changes detected.`);
        continue;
      }

      // Case 2: Renamed or modified file (same UUID, different filehash or name)
      if (oldFileSnapshot && oldFileSnapshot.id === uniqueId) {
        if (oldFileSnapshot.name !== file && oldFileSnapshot.hash !== fileHash) {
          console.log(`${file} has been renamed and modified. Staging it...`);
        } else if (oldFileSnapshot.name !== file) {
          console.log(`${file} has been renamed. Staging it...`);
        } else {
          console.log(`${file} has been modified. Staging it...`);
        }
      } else {
        // Case 3: New or moved file (new UUID)
        console.log(`${file} is a new file or moved. Staging it...`);
      }

      // Stage the file by copying it to the staging folder
      await fs.copyFile(filePath, path.join(stagingDir, path.basename(file)));

      // Update the snapshot for the file
      snapshot[file] = { id: uniqueId, name: file, hash: fileHash };
      console.log(`${file} has been staged.`);

      // Update the snapshot and save it in newSnapshot.json
      await fs.writeFile(path.join(repoPath, "newSnapshot.json"), JSON.stringify(snapshot, null, 2));

      // Update oldSnapshot.json
      await fs.writeFile(snapshotFile, JSON.stringify(snapshot, null, 2));
    }

    console.log("All modified and new files have been staged and snapshots updated.");
  } catch (err) {
    console.error("Error adding files to repo", err);
  }
}


module.exports = { addFileToRepo, addModifiedOrLogs };
