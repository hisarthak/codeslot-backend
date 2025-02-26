const fs = require("fs").promises;
const path = require("path");
const readline = require("readline");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { s3, S3_BUCKET } = require("../config/aws-config");
const cliProgress = require("cli-progress");


let theToken;
let thePull;
let theLocalRepoId;
let ourRepoName;


const axios = require("axios");
require("dotenv").config();
const apiUrl = process.env.API_URL;



// Helper function to check if the user is logged in (checks the .slot/config.json)
async function isLoggedIn() {
    try {
        const configPath = path.join(__dirname, "..", ".slot", "config.json");
        const config = await fs.readFile(configPath, "utf8");
        const userConfig = JSON.parse(config);

        // Check if token is present
        if (userConfig.token) {
            try {
                // Verify the JWT token (this will automatically check for expiration)
                const response = await axios.post("https://gitspace.duckdns.org:3002/verifyToken", {
                    token: userConfig.token,
                });
              
    if (response.data.valid) {
        theToken = userConfig.token;
        thePull = userConfig.push;
        thePushNumber = userConfig.pushNumber;
        theLocalRepoId = userConfig.localRepoId;

        console.log("✅ Token is valid.");
        return true; // Token is valid
    } else {
        console.error("❌ Invalid token.");
        return false; // Token is invalid
    }


               
            } catch (err) {
                return false; // Invalid token or token is expired
            }
        } else {
            return false; // No token found
        }
    } catch (err) {
        return false; // No config file found or error reading the file
    }
}

// Helper function to validate if the username matches the remote URL
async function validateRepositoryAccess() {
    try {
        // Adjust path to .slot folder
        const configPath = path.join(__dirname, "..", ".slot", "config.json");
        const remotePath = path.join(__dirname, "..", ".slot", "remote.json");
     

        // Read the config file (which contains the username)
        const configData = await fs.readFile(configPath, "utf8");
        const config = JSON.parse(configData);
        const { username } = config;

        // Read the remote file (which contains the URL)
        const remoteData = await fs.readFile(remotePath, "utf8");
        const remote = JSON.parse(remoteData);
        const remoteUrl = remote.url;

        // Validate the URL format
        const match = remoteUrl.match(/^https:\/\/codeslot\.in\/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)$/);
        if (!match) {
            throw new Error("Invalid remote URL format.");
        }

        const remoteUsername = match[1].split("/")[0]; // Extract username from "username/repositoryName"
        const remoteRepo = match[1].split("/")[1]; // Extract repository name from "username/repositoryName"

        // Compare usernames
        if (username !== remoteUsername) {
            throw new Error(
                `Access denied. You do not have permission to access this repository. 
Repository: ${remoteRepo},
Username: ${username} `
            );
        }
    } catch (err) {
        console.error(err.message);
        process.exit(1); // Exit with error
    }
}

// Function to prompt user for username and password
function promptLogin() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve, reject) => {
        rl.question("Enter your username: ", (username) => {
            rl.question("Enter your password: ", async (password) => {
                try {
                    // Send login request to your backend
                    const res = await axios.post(
                        `https://gitspace.duckdns.org:3002/login`,
                        {
                            username: username,
                            password: password,
                        },
                        {
                            headers: { "x-request-source": "cli" }, // Custom header to indicate CLI
                        }
                    );

                    // Save token to .slot/config.json
                    const token = res.data.token;
                    const localRepoId = crypto.randomUUID();

                    const userConfig = {
                        token: token,
                        username: username,
                        localRepoId: localRepoId,
                        pull: "not-required",
                        pushNumber: 0
                        
                    };

                    // Save config file
                    await fs.writeFile(
                        path.join(process.cwd(), ".slot", "config.json"),
                        JSON.stringify(userConfig, null, 2)
                    );
                    thePull = userConfig.pull;
                    theLocalRepoId = userConfig.localRepoId;
                    thePushNumber = userConfig.pushNumber;
                    resolve(token); // Return token after successful login
                } catch (err) {
                    console.error(
                        "Error during authentication: ",
                        err.response?.data?.message || err.message
                    );
                    reject(err);
                } finally {
                    rl.close();
                }
            });
        });
    });
}

async function pushRepo() {
    const chalk = await import("chalk"); 
    const repoPath = path.resolve(process.cwd(), ".slot");
    const remotePath = path.join(repoPath, "remote.json");
    const commitPath = path.join(repoPath, "commits");
    const logsPath = path.join(repoPath, "logs.json");
   
  

    try {
        // Check if remote.json exists
        try {
             console.log(remotePath);
            await fs.access(remotePath);
        } catch(err) {
            console.log(err);
            console.error("Remote not set. Please set the remote repository using 'slot remote add <url>'.");
            return;
        }
        const remoteData = await fs.readFile(remotePath, "utf8");
        const remote = JSON.parse(remoteData);
        const remoteUrl = remote.url;
        const match = remoteUrl.match(/^https:\/\/codeslot\.in\/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)$/);
        const repoName = match ? match[1] : null;
 
          if (!repoName) {
            throw new Error("Invalid repository name format.");
        } 
        ourRepoName= repoName;     
        
        const loggedIn = await isLoggedIn();
        let token;
        if (thePull === "required") {
            console.error(`
        error: failed to push some refs to 'https://codeslot.in/${ourRepoName}'
        hint: Updates were rejected because the remote contains work that you do
        hint: not have locally. This is usually caused by another repository pushing
        hint: to the same ref. You may want to first integrate the remote changes
        hint: (e.g., 'slot pull ...') before pushing again.
            `);
            process.exit(1); // Exit the process with a non-zero status code
        }
        if (!loggedIn) {
           
            console.log(chalk.default.yellow("Authentication required, valid for 30 days."));
            token = await promptLogin(); // Prompt for login if not logged in
         theToken = token;
            console.log("Authentication successful.");
        }
    
        // Validate repository access
        await validateRepositoryAccess();


        // Read and parse logs.json
        const logs = JSON.parse(await fs.readFile(logsPath, "utf8"));
        
         // Find all commit IDs where push is true
         const commitIdsToPush = logs.filter(commit => commit.push).map(commit => commit.commitID);
     
 
         // Set highestCountCommit based on commitIdsToPush
         const highestCountCommit = commitIdsToPush.length > 0;
 
         if (!highestCountCommit) {
             console.log("Everything up-to-date");
             return;
         }
         console.log("Commits to push:", commitIdsToPush);

        
        // console.log(chalk.default.yellow("Pushing..."));


        // Read and validate commit.json
        const commitDirs = await fs.readdir(commitPath);

        for (const commitDir of commitDirs) {
            if (commitIdsToPush.includes(commitDir)) {
                console.log(`Pushing ${chalk.default.yellow("commit")} ${chalk.default.yellow(commitDir)}`);
                const commitDirPath = path.join(commitPath, commitDir);
                
                // Call uploadDirectoryToS3 and check the result
                const result = await uploadDirectoryToS3(commitDirPath, `commits/${repoName}/${commitDir}`, commitDirPath);
                
                if (result.success === "pullError") {
                    console.error("Pull required before pushing. Updating config file...");
                    
                    // Read user config file
                    const configPath = path.join(__dirname, "..", ".slot", "config.json");
                    const configData = await fs.readFile(configPath, "utf8");
                    const userConfig = JSON.parse(configData);
                    
                    // Update values
                    userConfig.pull = "required";
                    userConfig.pushNumber = result.pushNumber;
        
                    // Write back to file
                    await fs.writeFile(configPath, JSON.stringify(userConfig, null, 2), "utf8");
        
                    console.error(`
                error: failed to push some refs to 'https://codeslot.in/${ourRepoName}'
                hint: Updates were rejected because the remote contains work that you do
                hint: not have locally. This is usually caused by another repository pushing
                hint: to the same ref. You may want to first integrate the remote changes
                hint: (e.g., 'slot pull ...') before pushing again.
                    `);
                    process.exit(1); // Stop execution
                }
            }
        }


        
        console.log("Saving changes...");
         // Read user config file
         const configPath = path.join(__dirname, "..", ".slot", "config.json");
         const configData = await fs.readFile(configPath, "utf8");
         const userConfig = JSON.parse(configData);
         
         // Update values
         userConfig.pull = "not-required";
      

         // Write back to file
         await fs.writeFile(configPath, JSON.stringify(userConfig, null, 2), "utf8");
        
      
         logs.forEach(commit => {
            if (commit.push) commit.push = false;
        });
        // Write the updated logs.json back to file
        await fs.writeFile(logsPath, JSON.stringify(logs, null, 2), "utf8");
        
            const logsContent = await fs.readFile(logsPath, "utf8");
            const logsKeyName = `commits/${repoName}/logs.json`;
         
            const response = await axios.post("https://gitspace.duckdns.org:3002/repo/user/url/generate-urls",
                { keyNames: [logsKeyName], theToken, theLocalRepoId, thePull, ourRepoName, thePushNumber },  // Fix 2: Wrap logsKeyName in an array
                { headers: { "Content-Type": "application/json" } }
            );
        
            const { uploadUrls } = response.data;
            if (!uploadUrls || uploadUrls.length === 0) {
                throw new Error("No upload URL received from server.");
            }
        
            const uploadUrl = uploadUrls[0]; // Fix 1: Use correct index
        
            await axios.put(uploadUrl, logsContent, {
                headers: { "Content-Type": "application/octet-stream" },
                timeout: 30000,
            });
        
          
        
  // Upload logs.json to S3

        console.log(chalk.default.green("Pushed successfully"));
    } catch (err) {
        console.error("Error during pushing commits: ", err.message);
    }
}

async function uploadDirectoryToS3(localPath, s3BasePath, rootPath, progressBar = null, totalFilesCount = null) {
    const { default: pLimit } = await import("p-limit");
    const limit = pLimit(5);
    const items = await fs.readdir(localPath);
    const files = [];
    const directories = [];

    for (const item of items) {
        const itemPath = path.join(localPath, item);
        const stats = await fs.stat(itemPath);

        if (stats.isFile()) {
            const keyName = `${s3BasePath}/${path.relative(rootPath, itemPath).replace(/\\/g, "/")}`;
            files.push({ itemPath, keyName });
        } else if (stats.isDirectory()) {
            directories.push(itemPath);
        }
    }

    if (files.length > 0) {
        const keyNames = files.map(file => file.keyName);
        let response;
        try {
            response = await axios.post("https://gitspace.duckdns.org:3002/repo/user/url/generate-urls",
                { keyNames, theToken, theLocalRepoId, thePull, ourRepoName, thePushNumber },
                { headers: { "Content-Type": "application/json" } }
            );
        } catch (error) {
            if (error.response && error.response.status === 403) {
                console.error("403 Error: Local repository ID mismatch or unauthorized.");
                const pushNumber = error.response.data.pushNumber;
                return { success: "pullError", pushNumber }; // Return the pushNumber to the caller
            } else {
                console.error("Error fetching pre-signed URLs:", error);
                return { success: "error", error: "Failed to fetch pre-signed URLs" };
            }
        }

        const { uploadUrls } = response.data;
        
    // 🔹 Create Progress Bar ONLY in the first function call
    let isTopLevel = false;
    if (!progressBar) {
        isTopLevel = true;
        totalFilesCount = { count: 0 }; // Initialize total count
        progressBar = new cliProgress.SingleBar({
            format: '{bar} {percentage}% | {value}/{total} files',
            hideCursor: true
        }, cliProgress.Presets.shades_classic);
    }

    totalFilesCount.count += files.length; // Update total file count

    if (isTopLevel) {
        progressBar.start(totalFilesCount.count, 0); // Start progress bar in top-level call
    } else {
        progressBar.setTotal(totalFilesCount.count); // Update total file count
    }


        try {
            await Promise.all(
                files.map((file, index) => limit(async () => {
                    try {
                        await uploadFileWithRetry(file.itemPath, uploadUrls[index], progressBar);
                    } catch (error) {
                      
                        throw error; // Stop execution if any upload fails
                    }
                }))
            );
        } catch (error) {
           
            return { success: "error", error: "File upload failed" };// Exit the function if an error occurs
        }

    // 🔹 Recursively process subdirectories with the SAME progress bar
    await Promise.all(
        directories.map(async (dir) => {
           await uploadDirectoryToS3(dir, s3BasePath, rootPath, progressBar, totalFilesCount);
           
        })
    );

    // 🔹 Stop progress bar ONLY in the top-level function call
    if (isTopLevel) {
        progressBar.stop();
    }
       return { success: true };
}}

// 🔹 Function to handle upload with retry mechanism
async function uploadFileWithRetry(filePath, uploadUrl, progressBar, maxRetries = 3, timeout = 30000) {
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const fileContent = await fs.readFile(filePath);

            await axios.put(uploadUrl, fileContent, {
                headers: { "Content-Type": "application/octet-stream" },
                timeout: timeout,
            });

            progressBar.increment();
            return;
        } catch (error) {
            attempt++;

            if (attempt < maxRetries) {
                const waitTime = Math.pow(2, attempt) * 1000;
                await new Promise(resolve => setTimeout(resolve, waitTime));
            } else {
                console.error(`error`);
                throw error;
                
            }
        }
    }
}

module.exports = {
    pushRepo,
};



