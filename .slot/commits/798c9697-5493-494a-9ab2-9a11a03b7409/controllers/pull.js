const fs = require("fs").promises;
const path = require("path");
const { s3, S3_BUCKET } = require("../config/aws-config");

async function pullRepo() {
    const repoPath = path.resolve(process.cwd(), ".slot");
    const remoteFilePath = path.join(repoPath, "remote.json");
    const logsPath = path.join(repoPath, "logs.json");
    const commitsPath = path.join(repoPath, "commits");
    const oldSnapshotPath = path.join(repoPath, "oldsnapshot.json");
    const newSnapshotPath = path.join(repoPath, "newsnapshot.json");
    const configPath = path.join(repoPath, "config.json");


    const rootPath = process.cwd();


    try {
        // Read remote.json
        const remoteFileContent = await fs.readFile(remoteFilePath, "utf8");
        const remoteData = JSON.parse(remoteFileContent);

        // Extract last two parts of the URL
        const urlParts = remoteData.url.split("/");
        if (urlParts.length < 3) {
            throw new Error("Invalid URL format in remote.json");
        }
        const repoIdentifier = `${urlParts[urlParts.length - 2]}/${urlParts[urlParts.length - 1]}`;
        const s3LogsKey = `commits/${repoIdentifier}/logs.json`;

        // Fetch logs.json from S3
        const fileContent = await s3.getObject({ Bucket: S3_BUCKET, Key: s3LogsKey }).promise();
        await fs.writeFile(logsPath, fileContent.Body);
        console.log("✅ logs.json downloaded successfully!");

        // Parse logs.json
        const logs = JSON.parse(fileContent.Body.toString());
        const highestCommit = logs.reduce((max, commit) => commit.count > max.count ? commit : max, logs[0]);
        const commitID = highestCommit.commitID;

        if (!commitID) {
            console.error("❌ No commitID found in logs.json.");
            return;
        }

        console.log(`📌 Highest commit found: ${commitID}`);

        // Create folder for commit
        const commitDir = path.join(commitsPath, commitID);
        await fs.mkdir(commitDir, { recursive: true });
        console.log(`📂 Created directory: ${commitDir}`);

        // Fetch all files and subdirectories from S3
        const commitPrefix = `commits/${repoIdentifier}/${commitID}/`;
        const commitFiles = await s3.listObjectsV2({ Bucket: S3_BUCKET, Prefix: commitPrefix }).promise();

        if (!commitFiles.Contents || commitFiles.Contents.length === 0) {
            console.error(`❌ No files found for commit ${commitID} in S3.`);
            return;
        }

          // Download each file and copy it to root
          for (const file of commitFiles.Contents) {
           
            
            const fileKey = file.Key;
            const relativePath = fileKey.replace(commitPrefix, "");
            const localFilePath = path.join(commitDir, relativePath);
            if (relativePath === "commit.json" || relativePath === "commitData.json") {
                continue;
            }
            const rootFilePath = path.join(rootPath, relativePath);

            // Ensure parent directories exist before writing file
            await fs.mkdir(path.dirname(localFilePath), { recursive: true });
            await fs.mkdir(path.dirname(rootFilePath), { recursive: true });

            if (!fileKey.endsWith("/")) {
                const fileData = await s3.getObject({ Bucket: S3_BUCKET, Key: fileKey }).promise();
                await fs.writeFile(localFilePath, fileData.Body);
                await fs.writeFile(rootFilePath, fileData.Body);
                console.log(`📄 Downloaded & Copied file: ${relativePath}`);
            }
        }

        console.log("✅ Commit files successfully downloaded & copied to root!");
        console.log(`📥 Fetching ${commitFiles.Contents.length} files for commit ${commitID}...`);

        

        console.log("✅ Commit files successfully downloaded!");
       // Replace oldsnapshot.json with commitData.json from the commit folder
       try {
        const commitDataPath = path.join(commitDir, "commitData.json");
        const commitDataContent = await fs.readFile(commitDataPath, "utf8");
    
      
        // Modify oldsnapshot.json: Set all 'change' and 'new' values to false
        const oldSnapshot = JSON.parse(commitDataContent);
        for (const key in oldSnapshot) {
            if (Object.prototype.hasOwnProperty.call(oldSnapshot, key)) {
                oldSnapshot[key].change = false;
                oldSnapshot[key].new = false;
                oldSnapshot[key].pull = true;
            }
          

        } 
        await fs.writeFile(oldSnapshotPath, JSON.stringify(oldSnapshot, null, 2));
 
        console.log("✅ oldsnapshot.json updated: All 'change' and 'new' set to false!");
    } catch (snapshotErr) {
        console.error("❌ Error updating oldsnapshot.json:", snapshotErr.message);
    } 
    try {
            const configContent = await fs.readFile(configPath, "utf8");
            const configData = JSON.parse(configContent);
            if (configData.pull === "required") {
                configData.pull = "done";
                await fs.writeFile(configPath, JSON.stringify(configData, null, 2));
                console.log("✅ Updated config.json: pull set to 'done'");
            }
        } catch (configErr) {
            console.error("❌ Error updating config.json:", configErr.message);
        }

    } catch (err) {
        console.error("❌ Error pulling repository:", err.message);
    }
}

module.exports = { pullRepo };
