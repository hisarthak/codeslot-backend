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

  const repoPath = path.resolve(process.cwd(), ".myGit");
  const stagedPath = path.join(repoPath, "staging");
  const commitPath = path.join(repoPath, "commits");
  const commitLogPath = path.join(repoPath, "commitLogs.json"); // Explicit .json extension

  try {
    // Generate a unique commit ID
    const commitID = uuidv4();

    // Create the commit directory
    const commitDir = path.join(commitPath, commitID);
    await fs.mkdir(commitDir, { recursive: true });

    // Copy files from staging to the commit directory
    const files = await fs.readdir(stagedPath);
    for (const file of files) {
      await fs.copyFile(
        path.join(stagedPath, file),
        path.join(commitDir, file)
      );
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
