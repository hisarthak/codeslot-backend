const fs = require("fs"); 
const path = require("path");
const { promisify } = require("util");

const readdir = promisify(fs.readdir);
const copyFile = promisify(fs.copyFile);

async function revertRepo(commitID) {
    const repoPath = path.resolve(process.cwd(), ".slot");
    const commitsPath = path.join(repoPath, "commits");

    console.log("Repo Path:", repoPath);
    console.log("Commits Path:", commitsPath);

    try {
        const commitDir = path.join(commitsPath, commitID);
        console.log("Commit Directory:", commitDir);

        const files = await readdir(commitDir);
        console.log(`Files in commit ${commitID}:`, files);

        const parentDir = path.resolve(repoPath, "..");
        console.log("Parent Directory:", parentDir);

        for (const file of files) {
            try {
                console.log(`Copying file: ${file}`);
                await copyFile(path.join(commitDir, file), path.join(parentDir, file));
                console.log(`File ${file} copied successfully`);
            } catch (err) {
                console.error(`Failed to copy file ${file}:`, err.message);
                // Continue to the next file if an error occurs
            }
        }

        console.log(`Commit ${commitID} reverted successfully`);
    } catch (err) {
        console.error("Unable to revert:", err);
    }
}

module.exports = {
    revertRepo,
}
