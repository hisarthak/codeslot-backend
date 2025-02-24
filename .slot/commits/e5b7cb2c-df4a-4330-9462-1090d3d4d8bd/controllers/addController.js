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
  console.log("[START] findTargetPath called with:", { targetName, snapshotPath, currentDir});

  let resolvedPath;
  console.log("Reading snapshot file:", snapshotPath);
  const snapshotContent = await fs.readFile(snapshotPath, 'utf-8');
  console.log("Snapshot content loaded");
  const snapshot = JSON.parse(snapshotContent);
  // console.log("Snapshot parsed:", snapshot);

  if (targetName.startsWith('/relative/')) {
      console.log("Target is a relative path, resolving...");
      targetName = targetName.replace('/relative/', '');
      resolvedPath = path.resolve(process.cwd(), targetName);
      console.log("Resolved relative path:", resolvedPath);
      return resolvedPath;
  }

  console.log("Starting directory scan in:", currentDir);
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  let matches = [];

  for (const entry of entries) {
      const entryPath = path.resolve(currentDir, entry.name);
      console.log("Checking entry:", entryPath);

      if (await isFileIgnored(entryPath, ignorePatterns)) {
          console.log("Ignoring file:", entryPath);
          continue;
      }

      if (entry.name === targetName) {
          console.log("Match found:", entryPath);
          matches.push(entryPath);
      }

      if (entry.isDirectory()) {
          console.log("Entering directory:", entryPath);
          const foundPaths = await findTargetPath(targetName, snapshotPath, entryPath, ignorePatterns);
          
          if (Array.isArray(foundPaths)) {
              matches = matches.concat(foundPaths);
          } else if (foundPaths) {
              matches.push(foundPaths);
          }
      }
  }

  console.log("Total matches found:", matches);
  if (matches.length === 0) {
      console.log("No matches found, returning null.");
      return null;
  }

  if (matches.length === 1) {
      console.log("Single match found, returning:", matches[0]);
      return matches[0];
  }

  console.log("Checking for modified matches...");
  let modifiedMatches = [];
  for (const match of matches) {  
      if (snapshot) {
        console.log( "albela",match);
          try {
              const currentHash = await calculateFileHash(match);
              const relativeMatch = path.relative(process.cwd(), match);
              console.log("File hash:", match, currentHash);
              console.log(snapshot.hash)
              if (currentHash && currentHash !== snapshot[relativeMatch]?.hash) {
                  console.log("File modified:", match);
                  modifiedMatches.push(match);
              }
          } catch (error) {
              console.error("Error calculating hash for:", match, error);
          }
      }
  }

  if (modifiedMatches.length === 1) {
      console.log("Returning single modified match:", modifiedMatches[0]);
      return modifiedMatches[0];
  }

  console.log("Multiple matches found, returning special message.");
  return "x17bcc3a699f-*#@%^&()+ask";
}

async function addFileToRepo(targetName) {
  const slotIgnoreFile = path.join(process.cwd(), "slotignore.txt");
  const repoPath = path.resolve(process.cwd(), ".slot");
  const snapshotFile = path.join(repoPath, "oldSnapshot.json");
  const stagingDir = path.join(repoPath, "staging");
  const ignorePatterns = await loadSlotIgnore(slotIgnoreFile);
const targetPath = await findTargetPath(targetName, snapshotFile, process.cwd(), ignorePatterns);
targetName = targetName.split('/').pop();
console.log("Processed targetName:", targetName);

console.log(targetPath);

if (targetPath === "x17bcc3a699f-*#@%^&()+ask") {
  console.error(`Multiple files or directories named "${targetName}" were found.
     Please use the relative path and add "/relative/" in front,
      e.g., slot add /relative/folder1/${targetName}.`);
 
  return;
} else if (!targetPath) {
  console.error(`${targetName} not found.`);
  return;
}

const relativePath = path.relative(process.cwd(), targetPath);
console.log("Relative path:", relativePath);

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
        const stagingFileDir = path.dirname(stagingFilePath);

await fs.mkdir(stagingFileDir, { recursive: true });

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
      console.error(`${targetName} not found.`);
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
  const chalk = await import("chalk");
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
          
          let matchedOldFile = Object.values(oldSnapshot).find((oldFile) => oldFile.id === inode);
  
          if (!matchedOldFile) {
            const potentialMatch = oldSnapshot[relativePath]; // Find match based on relative path
           
          
            if (potentialMatch && potentialMatch.pull) {
             
              matchedOldFile = potentialMatch;
            }
          }
              

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
            pull: false
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
    let hi;
    let matchedOldFile = Object.values(oldSnapshot).find((oldFile) => oldFile.id === inode);

  
    
    if (!matchedOldFile) {
      const potentialMatch = oldSnapshot[relativePath]; // Find match based on relative path
    
    
      if (potentialMatch && potentialMatch.pull) {
       
        matchedOldFile = potentialMatch;
      } 
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
            pull: matchedOldFile ? matchedOldFile.pull : false,
          };
        }
      }
    }


    await processDirectory(process.cwd());

    for (const [relativePath, newFile] of Object.entries(newSnapshot)) {
      const oldFile = Object.values(oldSnapshot).find((file) => file.id === newFile.id);
let renameCount = false;

      if (oldFile) {
        const oldRelativePath = Object.keys(oldSnapshot).find(key => oldSnapshot[key] === oldFile);
    
 // Check if the file has been modified (hash has changed)
 if (oldFile.hash !== newFile.hash) {
 
  console.log(chalk.default.blueBright("Modified:"),oldFile.text);
  newSnapshot[relativePath].change = true; // Mark as changed
}

        // Check if the file has been renamed
        if (oldFile.text !== newFile.text) {
          console.log(chalk.default.blueBright("Renamed:"),oldFile.text,"->",newFile.text);
          newSnapshot[relativePath].change = true; // Mark as changed
          renameCount = true;
        }
   
        // Check if the file has been moved (path changed, name is the same)
        if (oldRelativePath !== relativePath) {
          if(renameCount === true){
            const oldRelativePathDir = path.dirname(oldRelativePath);
            const relativePathDir = path.dirname(relativePath);
            renameCount = false;
           if(oldRelativePathDir !== relativePathDir){
              console.log(chalk.default.blueBright("Moved:"),newFile.text,"from",`${oldRelativePathDir}\\${newFile.text}`,"to",relativePath);
              newSnapshot[relativePath].change = true; // Mark as changed
            }
          }else{
          console.log(chalk.default.blueBright("Moved:"),oldFile.text,"from",oldRelativePath,"to",relativePath);
          newSnapshot[relativePath].change = true;
        }
        }
    
       
      } else {
        if(newFile.pull == true){
          newSnapshot[relativePath].pull = false;
        }else{
        // New file or folder detected
        console.log(`Created: ${relativePath}`);
        newSnapshot[relativePath].change = true; // Mark as changed
      }}
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
