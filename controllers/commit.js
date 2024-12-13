const fs = require("fs").promises;
const path = require("path");
const { v4: uuidv4 } = require("uuid");

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
  const commitLogPath = path.join(repoPath, "commitLogs.json"); // Explicit .json extension
  const oldSnapshotPath = path.join(repoPath, "oldSnapshot.json");

  try {
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

    // Save commit metadata
    const commitMetadata = {
      commitID,
      message: trimmedMessage,
      date: new Date().toISOString(),
    };
    await fs.writeFile(
      path.join(commitDir, "commit.json"),
      JSON.stringify(commitMetadata, null, 2)
    );

    // Create commitData.json and copy oldSnapshot.json contents
    const commitDataPath = path.join(commitDir, "commitData.json");

    try {
      const oldSnapshot = JSON.parse(await fs.readFile(oldSnapshotPath, "utf8"));

      for (const [relativePath, data] of Object.entries(oldSnapshot)) {
        if (data.change === true || data.new === true) {
          oldSnapshot[relativePath] = {
            ...data,
            commit_id: commitID,
            message: trimmedMessage,
            date: commitMetadata.date,
          };
        }
      }

      // Write the updated snapshot data to commitData.json
      await fs.writeFile(
        commitDataPath,
        JSON.stringify(oldSnapshot, null, 2),
        "utf8"
      );

      // After committing, reset the 'change' and 'new' flags to false
      for (const [relativePath, data] of Object.entries(oldSnapshot)) {
        data.change = false;
        data.new = false;
      }

      // Write the updated oldSnapshot back to the file
      await fs.writeFile(
        oldSnapshotPath,
        JSON.stringify(oldSnapshot, null, 2),
        "utf8"
      );
    } catch (err) {
      if (err.code === "ENOENT") {
        console.warn("Warning: oldSnapshot.json does not exist.");
      } else {
        throw err;
      }
    }

    console.log(`Commit ${commitID} created with message: "${trimmedMessage}"`);

    // Write commit metadata to commitLogs JSON file
    try {
      // Read existing logs if the file exists
      let logs = [];
      try {
        const logData = await fs.readFile(commitLogPath, "utf8");
        logs = JSON.parse(logData); // If file exists, parse the content
      } catch (err) {
        if (err.code !== "ENOENT") throw err; // Handle other errors
      }

      // Add the new commit entry to logs
      logs.push(commitMetadata);

      // Write updated logs back to the JSON file
      await fs.writeFile(commitLogPath, JSON.stringify(logs, null, 2), "utf8");
    } catch (err) {
      console.error("Error writing commitLogs: ", err);
    }
  } catch (err) {
    console.error("Error committing files: ", err);
  }
}

module.exports = {
  commitRepo,
};
