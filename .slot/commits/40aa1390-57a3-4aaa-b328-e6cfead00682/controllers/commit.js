const fs = require("fs").promises;
const path = require("path");
const { v4: uuidv4 } = require("uuid");
let commitCount2;
let num = 1;

async function commitRepo(message) {
  // Validate the commit message
  if (!message || typeof message !== "string") {
    console.error("Error: Commit message cannot be blank.");
    return;
  }

  // Trim the message and remove extra spaces
  const trimmedMessage = message.trim().replace(/\s+/g, " ");
  if (!trimmedMessage) {
    console.error("Error: Commit message cannot be blank or contain only spaces.");
    return;
  }

  const repoPath = path.resolve(process.cwd(), ".slot");
  const stagedPath = path.join(repoPath, "staging");
  const commitPath = path.join(repoPath, "commits");
  const commitLogPath = path.join(repoPath, "logs.json"); // Explicit .json extension
  const oldSnapshotPath = path.join(repoPath, "oldSnapshot.json");

  try {
    // Check if there are any changes to commit
    let oldSnapshot;
    try {
      oldSnapshot = JSON.parse(await fs.readFile(oldSnapshotPath, "utf8"));
    } catch (err) {
      if (err.code === "ENOENT") {
        console.error("Error: oldSnapshot.json does not exist.");
        return;
      }
      throw err;
    }

    const hasChanges = Object.values(oldSnapshot).some(
      (data) => data.change === true || data.new === true
    );

    if (!hasChanges) {
      console.log("Nothing to commit");
      return;
    }

    // Generate a unique commit ID
    const commitID = uuidv4();

    

    // Create the commit directory
    const commitDir = path.join(commitPath, commitID);
    await fs.mkdir(commitDir, { recursive: true });

    // Copy files and directories from staging to the commit directory
    const items = await fs.readdir(stagedPath);
    for (const item of items) {
      const itemPath = path.join(stagedPath, item);
      const stats = await fs.stat(itemPath);

      if (stats.isDirectory()) {
        // Handle directories: use fs.cp (Node.js v16.7.0+)
        await fs.cp(itemPath, path.join(commitDir, item), { recursive: true });
      } else if (stats.isFile()) {
        // Handle files: use fs.copyFile
        await fs.copyFile(itemPath, path.join(commitDir, item));
      }
    }
       // Write commit metadata to commitLogs JSON file
try {
  // Read existing logs if the file exists
  let logs = [];
  try {
    const logData = await fs.readFile(commitLogPath, "utf8");
    logs = JSON.parse(logData); // If file exists, parse the content
  } catch (err) {
    if (err.code !== "ENOENT") throw err; // Handle other errors (if any)
  }

  // Add the new commit metadata to the logs array
  const previousCount = logs.length > 0 ? logs[logs.length - 1].count : 0;
  const commitCount = previousCount + 1;
commitCount2 = commitCount;
  const commitMetadata2 = {
    commitID,
    message: trimmedMessage,
    date: new Date().toISOString(),
    push: true,
    count: commitCount, // New count field
  };

  logs.push(commitMetadata2);  // Add the new commit metadata to logs

  // Write updated logs back to the JSON file
  await fs.writeFile(commitLogPath, JSON.stringify(logs, null, 2), "utf8");

} catch (err) {
  console.error("Error writing commitLogs: ", err);
}


    // Save commit metadata
    const commitMetadata = {
      commitID,
      message: trimmedMessage,
      date: new Date().toISOString(),
      push: true,
      count: commitCount2, // New count field
    };
    await fs.writeFile(
      path.join(commitDir, "commit.json"),
      JSON.stringify(commitMetadata, null, 2)
    );
   
    const commitDataPath = path.join(commitDir, "commitData.json");

    // Function to propagate updates to parent directories
    function updateParentDirectories(relativePath, updatedData, snapshot) {
      let parentPath = path.dirname(relativePath);
    
      while (parentPath) { // Allow parentPath === "."
        if (snapshot[parentPath]) {
          snapshot[parentPath] = {
            ...snapshot[parentPath],
            commit_id: updatedData.commit_id,
            message: updatedData.message,
            date: updatedData.date,
          };
        }
    
        // Stop when parentPath equals "." but still process it once
        if (parentPath === ".") break;
    
        parentPath = path.dirname(parentPath); // Move to the next parent
      }
    }
    
    // Create commitData.json and update oldSnapshot
    for (const [relativePath, data] of Object.entries(oldSnapshot)) {
      if (data.change === true || data.new === true) {
        // Update the file or folder itself
        oldSnapshot[relativePath] = {
          ...data,
          commit_id: commitID,
          message: trimmedMessage,
          date: commitMetadata.date,
        };
    
        // Update parent directories recursively
        updateParentDirectories(relativePath, oldSnapshot[relativePath], oldSnapshot);
      }
    }
    // Write the updated snapshot data to commitData.json
    await fs.writeFile(
      commitDataPath,
      JSON.stringify(oldSnapshot, null, 2),
      "utf8"
    );

    // After committing, reset the 'change' and 'new' flags to false
    for (const data of Object.values(oldSnapshot)) {
      data.change = false;
      data.new = false;
    }

    // Write the updated oldSnapshot back to the file
    await fs.writeFile(
      oldSnapshotPath,
      JSON.stringify(oldSnapshot, null, 2),
      "utf8"
    );
    

    console.log(`Commit ${commitID} created with message: "${trimmedMessage}"`);


  } catch (err) {
    console.error("Error committing files: ", err);
  }
}

module.exports = {
  commitRepo,
};
