const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

const readdir = promisify(fs.readdir);
const copyFile = promisify(fs.copyFile);
const unlink = promisify(fs.unlink);
const rmdir = promisify(fs.rmdir);
const stat = promisify(fs.stat);
const mkdir = promisify(fs.mkdir);

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

        // First, handle files and folders in commit directory
        for (const file of files) {
            const commitFilePath = path.join(commitDir, file);
            const parentFilePath = path.join(parentDir, file);

            // Ignore .git folder and files
            if (file === ".git") {
                continue;
            }

            try {
                const commitFileStat = await stat(commitFilePath);

                if (commitFileStat.isDirectory()) {
                    // If it's a directory and doesn't exist in the parent, copy it
                    if (!fs.existsSync(parentFilePath)) {
                        console.log(`Directory ${file} exists in commit but not in parent. Creating it.`);
                        await mkdir(parentFilePath);
                    }

                    // Handle files inside the directory (recursive copying)
                    const commitFilesInDir = await readdir(commitFilePath);
                    for (const dirFile of commitFilesInDir) {
                        const commitFileInDirPath = path.join(commitFilePath, dirFile);
                        const parentFileInDirPath = path.join(parentFilePath, dirFile);
                        await revertRepoFile(commitFileInDirPath, parentFileInDirPath); // Recursively handle files
                    }
                } else {
                    // It's a file, either copy or overwrite
                    if (!fs.existsSync(parentFilePath)) {
                        console.log(`File ${file} exists in commit but not in parent. Copying it.`);
                        await copyFile(commitFilePath, parentFilePath);
                    } else {
                        console.log(`File ${file} exists in both commit and parent. Overwriting it.`);
                        await copyFile(commitFilePath, parentFilePath);
                    }
                }
            } catch (err) {
                console.error(`Failed to handle file/folder ${file}:`, err.message);
            }
        }

        console.log(`Commit ${commitID} reverted successfully`);
    } catch (err) {
        console.error("Unable to revert:", err);
    }
}

// Function to handle copying files (for recursive calls)
async function revertRepoFile(commitFilePath, parentFilePath) {
    const commitFileStat = await stat(commitFilePath);
    if (commitFileStat.isDirectory()) {
        if (!fs.existsSync(parentFilePath)) {
            console.log(`Directory ${parentFilePath} created from commit.`);
            await mkdir(parentFilePath);
        }

        const filesInDir = await readdir(commitFilePath);
        for (const file of filesInDir) {
            const commitSubFilePath = path.join(commitFilePath, file);
            const parentSubFilePath = path.join(parentFilePath, file);
            await revertRepoFile(commitSubFilePath, parentSubFilePath); // Recursive call for directories
        }
    } else {
        await copyFile(commitFilePath, parentFilePath); // Copy file to parent
    }
}

module.exports = {
    revertRepo,
};
