const fs = require("fs").promises;
const path = require("path");
const readline = require("readline");
const jwt = require("jsonwebtoken");
const { s3, S3_BUCKET } = require("../config/aws-config");
let theToken;


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
                jwt.verify(userConfig.token, process.env.JWT_SECRET_KEY);
                theToken = userConfig.token;
                return true; // Token is valid and not expired
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

                    const userConfig = {
                        token: token,
                        username: username,
                    };

                    // Save config file
                    await fs.writeFile(
                        path.join(process.cwd(), ".slot", "config.json"),
                        JSON.stringify(userConfig, null, 2)
                    );
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
            // console.error("Remote not set. Please set the remote repository using 'slot remote add <url>'.");
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
        
        const loggedIn = await isLoggedIn();
        let token;
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
        
        // Find the object with the highest count
        const highestCountCommit = logs.reduce((max, commit) => 
            commit.count > max.count ? commit : max, 
            logs[0] || {}
        );

        // Check if the commit exists and push is true
        if (!highestCountCommit || !highestCountCommit.push) {
            console.log("Everything up-to-date");
            return;
        }
        console.log(chalk.default.yellow("Pushing..."));


        // Read and validate commit.json
        const commitDirs = await fs.readdir(commitPath);

        for (const commitDir of commitDirs) {

            const commitDirPath = path.join(commitPath, commitDir);
          
          

            

            // Recursively upload files and directories with correct paths
            await uploadDirectoryToS3(commitDirPath, `commits/${repoName}/${commitDir}`, commitDirPath);
        }
        const logsContent = await fs.readFile(logsPath, "utf8");

        const logsS3Params = {
            Bucket: S3_BUCKET,
            Key: `commits/${repoName}/logs.json`,  // Save logs.json to the "commits/repoName" folder
            Body: logsContent,
        };
        await s3.upload(logsS3Params).promise();  // Upload logs.json to S3

        highestCountCommit.push = false;
        // Write the updated logs.json back to file
        await fs.writeFile(logsPath, JSON.stringify(logs, null, 2), "utf8");
        console.log(chalk.default.green("Pushed successfully"));
    } catch (err) {
        console.error("Error during pushing commits: ", err.message);
    }
}


async function uploadDirectoryToS3(localPath, s3BasePath, rootPath) {
    const items = await fs.readdir(localPath);
    const files = [];
    const directories = [];

    // STEP 1: Collect all files and directories
    for (const item of items) {
        const itemPath = path.join(localPath, item);
        const stats = await fs.stat(itemPath);

        if (stats.isFile()) {
            // Determine S3 key path
            const keyName = `${s3BasePath}/${path.relative(rootPath, itemPath).replace(/\\/g, "/")}`;
            files.push({ itemPath, keyName });
        } else if (stats.isDirectory()) {
            // Store directories separately for recursive processing
            directories.push(itemPath);
        }
    }

    // STEP 2: Request ALL pre-signed URLs at once for all files
    if (files.length > 0) {
        const keyNames = files.map(file => file.keyName);
        try {
            const response = await axios.post(
                "https://gitspace.duckdns.org:3002/repo/user/url/generate-urls",
                { keyNames, theToken },  // Data must match backend expectations
                { headers: { "Content-Type": "application/json" } }
            );
            console.log("Success:", response.data);
        } catch (error) {
            console.error("Error Response:", error.response?.data || error.message);
        }

        const { uploadUrls } = await response.json(); // Backend returns all URLs
        console.log(uploadUrls);

        // STEP 3: Upload ALL files in parallel using Promise.all
        await Promise.all(
            files.map(async (file, index) => {
                const fileContent = await fs.readFile(file.itemPath);
                await fetch(uploadUrls[index], {
                    method: "PUT",
                    body: fileContent,
                });
                console.log(`Uploaded: ${file.keyName}`);
            })
        );
    }

    // STEP 4: Recursively upload directories (process them in parallel)
    await Promise.all(
        directories.map(async (dir) => {
            await uploadDirectoryToS3(dir, s3BasePath, rootPath);
        })
    );

    console.log("All files and directories uploaded!");
}



module.exports = {
    pushRepo,
};
