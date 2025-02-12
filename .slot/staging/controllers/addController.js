const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
// dkfaklf
async function handleDeletedFiles(snapshot, stagingDir, slotIgnoreFile) {
  try {
    const ignorePatterns = await loadSlotIgnore(slotIgnoreFile);
    const stagingFiles = await fs.readdir(stagingDir);

    for (const relativePath in snapshot) {
      const filePathInStaging = path.join(stagingDir, relativePath);
      const filePathInBackend = path.join(process.cwd(), relativePath);

      if (relativePath.startsWith('.slot')) {
        delete snapshot[relativePath];
        continue;
      }

      if (await isFileIgnored(filePathInBackend, ignorePatterns)) {
        // delete snapshot[relativePath];
        if (await fs.stat(filePathInStaging).catch(() => false)) {
          try {
            await fs.rm(filePathInStaging, { recursive: true, force: true });
          } catch (deleteError) {
            console.error("Error deleting ignored file/folder from staging:", deleteError);
          }
        }
        continue;
      }

      const existsInStaging = stagingFiles.includes(relativePath) || await fs.stat(filePathInStaging).catch(() => false);
      const existsInBackend = await fs.stat(filePathInBackend).catch(() => false);

      if (!existsInStaging || !existsInBackend) {
        try {
          await fs.rm(filePathInStaging, { recursive: true, force: true });
          // delete snapshot[relativePath];
        } catch (deleteError) {
          console.error(`Error deleting ${filePathInStaging}:`, deleteError);
        }
      }
    }
  } catch (err) {
    console.error("Error in handleDeletedFiles:", err);
  }
}

async function loadSlotIgnore(ignoreFile) {
  try {
    const data = await fs.readFile(ignoreFile, "utf-8");
    return data.split("\n").map(line => line.trim()).filter(line => line && !line.startsWith("#"));
  } catch (err) {
    console.error("Error loading slotignore.txt file:", err);
    return [];
  }
}

async function isFileIgnored(filePath, ignorePatterns) {
  const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
  if (relativePath.startsWith('.slot')) {
    return true;
  }
  return ignorePatterns.some(pattern => relativePath.includes(pattern));
}



async function getFileInode(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.ino; // Correct property for the inode number
  } catch (err) {
    console.error(`Error getting inode for ${filePath}:`, err);
    return null;
  }
}

async function findTargetPath(targetName, snapshotPath, currentDir = process.cwd(), ignorePatterns = []) {
  let resolvedPath;
  // Parse the snapshot file
  const snapshotContent = await fs.readFile(snapshotPath, 'utf-8');
  const snapshot = JSON.parse(snapshotContent);
  // Check if the targetName starts with '/relative/' indicating it should be treated as a relative path
  if(targetName.startsWith('/relative/')) {
    targetName = targetName.replace('/relative/', '');
    resolvedPath = path.resolve(process.cwd(), targetName); // Resolve the relative path from currentDir
    return resolvedPath;
  }

  // Recursive search if direct matching fails
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  let matches = [];

  for (const entry of entries) {
    const entryPath = path.resolve(currentDir, entry.name);

    // Skip ignored files or directories
    if (await isFileIgnored(entryPath, ignorePatterns)) {
      continue;
    }

    // If the entry matches the targetName, add it to the matches list
    if (entry.text === targetName) {
      matches.push(entryPath); // Add the match to the list
    }

    // If the entry is a directory, search within it recursively
    if (entry.isDirectory()) {
      const foundPaths = await findTargetPath(targetName, snapshotPath, entryPath, ignorePatterns);
      // If recursive search returns an array, merge matches
      if (Array.isArray(foundPaths)) {
        matches = matches.concat(foundPaths); // Collect matches from subdirectories
      } else if (foundPaths) {
        matches.push(foundPaths); // Add single match from subdirectory
      }
    }
  }

  // If no matches, return null
  if (matches.length === 0) {
    return null;
  }

  // If one match, return it
  if (matches.length === 1) {
    return matches[0];
  }

   // Check for modifications in the snapshot after collecting all matches
modifiedMatches = [];
for (const match of matches) {  
  if (snapshot) {
   const currentHash = await calculateFileHash(match).catch((error))}

    if (currentHash && currentHash !== snapshot.hash) {
      modifiedMatches.push(match);
    }
  }
  // If exactly one modified match, return it
if (modifiedMatches.length === 1) {
 return modifiedMatches[0];
}
  else{
  // If multiple matches, return special message
  return "x17bcc3a699f-*#@%^&()+ask";}
}





async function addFileToRepo(targetName) {
  const slotIgnoreFile = path.join(process.cwd(), "slotignore.txt");
  const repoPath = path.resolve(process.cwd(), ".slot");
  const snapshotFile = path.join(repoPath, "oldSnapshot.json");
  const stagingDir = path.join(repoPath, "staging");
  const ignorePatterns = await loadSlotIgnore(slotIgnoreFile);
const targetPath = await findTargetPath(targetName, snapshotFile, process.cwd(), ignorePatterns);

if (targetPath === "x17bcc3a699f-*#@%^&()+ask") {
  console.error(`Multiple files or directories named "${targetName}" were found.
     Please use the relative path and add "/relative/" in front,
      e.g., slot add /relative/folder1/${targetName}.`);
 
  return;
} else if (!targetPath) {
  console.error(`Target ${targetName} not found.`);
  return;
}

const relativePath = path.relative(process.cwd(), targetPath);

  try {

    const snapshot = JSON.parse(await fs.readFile(snapshotFile, "utf-8"));

    // await handleDeletedFiles(snapshot, stagingDir, slotIgnoreFile);

    async function processFileOrDirectory(targetPath, relativePath) {
      const inode = await getFileInode(targetPath);

      const stat = await fs.stat(targetPath);
      if (stat.isDirectory()) {
        const stagingDirPath = path.join(stagingDir, relativePath);
        await fs.mkdir(stagingDirPath, { recursive: true });
        snapshot[relativePath] = {
          id: inode,
          text: targetName,
          droppable: true,
          parent: "",
          path: relativePath,
          hash: "",
          message: "",
          commit_id: "",
          time: "",
          change: true,
           }; 
         

        const entries = await fs.readdir(targetPath, { withFileTypes: true });
        for (const entry of entries) {
          const entryPath = path.resolve(targetPath, entry.name);
          if (await isFileIgnored(entryPath, ignorePatterns)) continue;
          const entryRelativePath = path.relative(process.cwd(), entryPath);
          await processFileOrDirectory(entryPath, entryRelativePath);
        }
      } else {
        const fileHash = await calculateFileHash(targetPath);
        const oldFileSnapshot = snapshot[relativePath];

        if (oldFileSnapshot && oldFileSnapshot.id === inode && oldFileSnapshot.hash === fileHash) {
          return;
        }

        const stagingFilePath = path.join(stagingDir, relativePath);
        await fs.copyFile(targetPath, stagingFilePath);

        snapshot[relativePath] = { 
          id: inode,
          text: targetName,
          parent: "",
          path: relativePath,
          hash: fileHash,
         droppable: false,
          message: "",
          commit_Id: "",
          date : "",
          change: true,
             };
       
      }
    }

  
    const targetStat = await fs.stat(targetPath).catch(() => null);

    if (!targetStat) {
      console.log(targetPath)
      console.error(`Target ${targetName} not found.`);
      return;
    }

    await processFileOrDirectory(targetPath, relativePath);

    async function checkFolderChanges(snapshot, relativePath) {
      let hasChangedChild = false;
    
      // Loop through all files and subdirectories in the snapshot
      for (const [otherPath, otherFile] of Object.entries(snapshot)) {
        // If the current file or folder is a child (subdirectory or file) of the given folder
        if (otherPath !== relativePath && otherPath.startsWith(relativePath + path.sep)) {
          // If any child file or subdirectory has change: true, mark the parent folder as changed
          if (otherFile.change) {
            hasChangedChild = true;
            break;
          }
    
          // If it's a directory, we recursively check its contents
          if (otherFile.droppable === true) {
            const childChange = await checkFolderChanges(snapshot, otherPath);
            if (childChange) {
              hasChangedChild = true;
              break;
            }
          }
        }
      }
    
      return hasChangedChild;
    }
    
    async function processSnapshotChanges(snapshot) {
      for (const [relativePath, newFile] of Object.entries(snapshot)) {
        if (newFile.droppable === true) {
          // Check if this folder or any of its subdirectories have changes
          const hasChangedChild = await checkFolderChanges(snapshot, relativePath);
    
          // Set the 'change' flag for the folder based on its contents
          if (hasChangedChild) {
            newFile.change = true;
          } else {
            // If no changes in the folder, set its 'change' flag to false
            if (newFile.change) {
              newFile.change = false;
            }
          }
        }
      }
    }
    
    // Call this function to update the snapshot
    await processSnapshotChanges(snapshot);

    await fs.writeFile(path.join(repoPath, "newSnapshot.json"), JSON.stringify(snapshot, null, 2));
    await fs.writeFile(snapshotFile, JSON.stringify(snapshot, null, 2));

    console.log(`Operation complete`);
  } catch (err) {
    console.error("Error adding file or folder to repo:", err);
  }
}


async function addModifiedOrLogs() {
  const slotIgnoreFile = path.join(process.cwd(), "slotignore.txt");
  const repoPath = path.resolve(process.cwd(), ".slot");
  const snapshotFile = path.join(repoPath, "oldSnapshot.json");
  const stagingDir = path.join(repoPath, "staging");

  try {
    const ignorePatterns = await loadSlotIgnore(slotIgnoreFile);
    const oldSnapshot = JSON.parse(await fs.readFile(snapshotFile, "utf-8"));
    const newSnapshot = {};
    await handleDeletedFiles(oldSnapshot, stagingDir, slotIgnoreFile);

    async function processDirectory(currentDir) {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
    
      for (const entry of entries) {
        const entryPath = path.resolve(currentDir, entry.name);
    
        // Skip ignored files and directories
        if (entry.isDirectory() && await isFileIgnored(entryPath, ignorePatterns)) continue;
        if (await isFileIgnored(entryPath, ignorePatterns)) continue;
    
        const relativePath = path.relative(process.cwd(), entryPath);
        const inode = await getFileInode(entryPath);
    
        if (entry.isDirectory()) {
          // Create directories in stagingDir
          const stagingDirPath = path.join(stagingDir, relativePath);
          await fs.mkdir(stagingDirPath, { recursive: true });
          
          const matchedOldFile = Object.values(oldSnapshot).find((oldFile) => oldFile.id === inode);


          newSnapshot[relativePath] = { 
            id: inode,
           text: entry.name,
            droppable: true,
            path: relativePath,
            parent: path.dirname(relativePath),
            commit_id: matchedOldFile ? matchedOldFile.commit_id : "",
            message: matchedOldFile ? matchedOldFile.message : "",
            change: matchedOldFile ? matchedOldFile.change : true,  // Get change field from oldSnapshot if inode matches
            date : matchedOldFile ? matchedOldFile.date: "",
            new: !matchedOldFile,
          };
          
          // Recurse into subdirectories
          await processDirectory(entryPath);
        } else {
          // Read file contents and write them to stagingDir
          const fileContent = await fs.readFile(entryPath); // Read file content
          const fileHash = await calculateFileHash(entryPath); // Calculate file hash
    
          // Write the file to the staging directory
          const stagingFilePath = path.join(stagingDir, relativePath);
          await fs.mkdir(path.dirname(stagingFilePath), { recursive: true }); // Ensure the directory exists
          await fs.writeFile(stagingFilePath, fileContent); // Write the file content
    
          const matchedOldFile = Object.values(oldSnapshot).find((oldFile) => oldFile.id === inode);
          // Debugging output
console.log("Matched Old File:", matchedOldFile);
if (matchedOldFile) {
  console.log("Old File ID:", matchedOldFile.id);
  console.log("Provided inode:", inode);
} else {
  console.log("No match found for inode:", inode);
}

newSnapshot[relativePath] = { 
            id: inode, 
            text: entry.name,
            path: relativePath,
           parent: path.dirname(relativePath),
            hash: fileHash, 
            droppable: false,
            message: matchedOldFile ? matchedOldFile.message : "",
            commit_id: matchedOldFile ? matchedOldFile.commit_id : "",
            change: matchedOldFile ? matchedOldFile.change : true,  // Get change field from oldSnapshot if inode matches
            date: matchedOldFile ? matchedOldFile.date : "",
          };
        }
      }
    }


    await processDirectory(process.cwd());

    for (const [relativePath, newFile] of Object.entries(newSnapshot)) {
      const oldFile = Object.values(oldSnapshot).find((file) => file.id === newFile.id);


      if (oldFile) {
        const oldRelativePath = Object.keys(oldSnapshot).find(key => oldSnapshot[key] === oldFile);
    
 // Check if the file has been modified (hash has changed)
 if (oldFile.hash !== newFile.hash) {
  console.log(`Modified: ${oldFile.text}`);
  newSnapshot[relativePath].change = true; // Mark as changed
}

        // Check if the file has been renamed
        if (oldFile.text !== newFile.text) {
          console.log(`Renamed: ${oldFile.text} -> ${newFile.text}`);
          newSnapshot[relativePath].change = true; // Mark as changed
        }
    
        // Check if the file has been moved (path changed, name is the same)
        if (oldRelativePath !== relativePath) {
          console.log(`Moved: ${oldFile.text} from ${oldRelativePath} to ${relativePath}`);
          newSnapshot[relativePath].change = true; // Mark as changed
        }
    
       
      } else {
        // New file or folder detected
        console.log(`Created: ${relativePath}`);
        newSnapshot[relativePath].change = true; // Mark as changed
      }
    }
    async function checkFolderChanges(newSnapshot, relativePath) {
      let hasChangedChild = false;
    
      // Loop through all files and subdirectories in the snapshot
      for (const [otherPath, otherFile] of Object.entries(newSnapshot)) {
        // If the current file or folder is a child (subdirectory or file) of the given folder
        if (otherPath !== relativePath && otherPath.startsWith(relativePath + path.sep)) {
          // If any child file or subdirectory has change: true, mark the parent folder as changed
          if (otherFile.change) {
            hasChangedChild = true;
            break;
          }
    
          // If it's a directory, we recursively check its contents
          if (otherFile.droppable === true) {
            const childChange = await checkFolderChanges(newSnapshot, otherPath);
            if (childChange) {
              hasChangedChild = true;
              break;
            }
          }
        }
      }
    
      return hasChangedChild;
    }
    
    async function processSnapshotChanges(newSnapshot) {
      for (const [relativePath, newFile] of Object.entries(newSnapshot)) {
        if (newFile.droppable === true) {
          // Check if this folder or any of its subdirectories have changes
          const hasChangedChild = await checkFolderChanges(newSnapshot, relativePath);
    
          // Set the 'change' flag for the folder based on its contents
          if (hasChangedChild) {
            newFile.change = true;
          } else {
            // If no changes in the folder, set its 'change' flag to false
            if (newFile.change) {
              newFile.change = false;
            }
          }
        }
      }
    }
    
    // Call this function to update the snapshot
    await processSnapshotChanges(newSnapshot);
    

    await fs.writeFile(path.join(repoPath, "newSnapshot.json"), JSON.stringify(newSnapshot, null, 2));
    await fs.writeFile(snapshotFile, JSON.stringify(newSnapshot, null, 2));

    // console.log("Operation complete");
  } catch (err) {
    console.error("Error adding files or folders to repo:", err);
  }
}


// Function to calculate the hash of the file content (for future use)
async function calculateFileHash(filePath) {
  const fileBuffer = await fs.readFile(filePath); // Read the file content
  const hash = crypto.createHash("sha256"); // Create a SHA-256 hash instance
  hash.update(fileBuffer); // Update the hash with file content
  return hash.digest("hex"); // Return the hash as a hexadecimal string
}


module.exports = { addFileToRepo, addModifiedOrLogs };
