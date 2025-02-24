const fs = require("fs").promises;
const path = require("path");
const { s3, S3_BUCKET } = require("../config/aws-config");
const axios = require("axios");

async function pullRepo() {
    const repoPath = path.resolve(process.cwd(), ".slot");
    const remoteFilePath = path.join(repoPath, "remote.json");
    const logsPath = path.join(repoPath, "logs.json");
    const commitsPath = path.join(repoPath, "commits");
    const oldSnapshotPath = path.join(repoPath, "oldsnapshot.json");
    const configPath = path.join(repoPath, "config.json");
   

    const rootPath = process.cwd();


    try {
        // Read remote.json
        const remoteFileContent = await fs.readFile(remoteFilePath, "utf8");
        const remoteData = JSON.parse(remoteFileContent);
        const configContent = await fs.readFile(configPath, "utf8");
        const configData = JSON.parse(configContent);
        theToken = configData.token;
        // Extract last two parts of the URL
        const urlParts = remoteData.url.split("/");
        if (urlParts.length < 3) {
            throw new Error("Invalid URL format in remote.json");
        }
        const repoIdentifier = `${urlParts[urlParts.length - 2]}/${urlParts[urlParts.length - 1]}`;
        const s3LogsKey = `commits/${repoIdentifier}/logs.json`;

        const response = await axios.post("https://gitspace.duckdns.org:3002/repo/user/url/generate-downlaod-urls", { keyNames: [s3LogsKey], theToken }, { headers: { "Content-Type": "application/json" } });
        const { uploadUrls } = response.data;
        if (!uploadUrls || uploadUrls.length === 0) {
            throw new Error("No upload URL received from server.");
        }
        const uploadUrl = uploadUrls[0];

        const logsDataResponse = await axios.get(uploadUrl, { headers: { "Content-Type": "application/octet-stream" }, timeout: 30000 });
        const fileContent = logsDataResponse.data;
        await fs.writeFile(logsPath, fileContent.Body);

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
        const commitDataKey = `commits/${repoIdentifier}/${commitID}/commitData.json`;
        const commitDataResponse = await axios.post("https://gitspace.duckdns.org:3002/repo/user/url/generate-download-urls", { keyNames: [commitDataKey], theToken }, { headers: { "Content-Type": "application/json" } });
        const { uploadUrls: commitDataUrls } = commitDataResponse.data;

        if (!commitDataUrls || commitDataUrls.length === 0) {
            throw new Error("No URL received for commitData.json.");
        }
        
        const commitDataFile = await axios.get(commitDataUrls[0], { headers: { "Content-Type": "application/octet-stream" }, timeout: 30000 });
        const commitDataPath = path.join(commitDir, "commitData.json");
        await fs.writeFile(commitDataPath, commitDataFile.data.Body);

        const commitData = JSON.parse(commitDataFile.data.Body.toString());
        const fileKeys = [
            ...Object.values(commitData).map(file => `commits/${repoIdentifier}/${commitID}/${file.path}`),
            `commits/${repoIdentifier}/${commitID}/commit.json`
        ];

        const urlResponse = await axios.post("https://gitspace.duckdns.org:3002/repo/user/url/generate-download-urls", { keyNames: fileKeys, theToken }, { headers: { "Content-Type": "application/json" } });
        const { uploadUrls: fileUrls } = urlResponse.data;

        if (!fileUrls || fileUrls.length === 0) {
            throw new Error("No URLs received for commit files.");
        }

        for (let i = 0; i < fileUrls.length; i++) {
            const fileData = await axios.get(fileUrls[i], { headers: { "Content-Type": "application/octet-stream" }, timeout: 30000 });
            const relativeFilePath = Object.values(commitData)[i].path;
            
            // Save in commit directory
            const localFilePath = path.join(commitDir, relativeFilePath);
            await fs.writeFile(localFilePath, fileData.data.Body);
            
            // Copy to root directory
            const rootFilePath = path.join(rootPath, relativeFilePath);
            await fs.mkdir(path.dirname(rootFilePath), { recursive: true });
            await fs.writeFile(rootFilePath, fileData.data.Body);
        }
        

    
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
