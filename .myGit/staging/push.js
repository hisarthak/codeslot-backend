const fs = require("fs").promises;
const path = require("path");
const readline = require("readline");
const jwt = require("jsonwebtoken");
const { s3, S3_BUCKET } = require("../config/aws-config");
const axios = require("axios");
require("dotenv").config();
const apiUrl = process.env.API_URL;

// Helper function to check if the user is logged in (checks the .myGit/config.json)
async function isLoggedIn() {
    try {
        const configPath = path.join(__dirname, "..", ".myGit", "config.json");
        const config = await fs.readFile(configPath, "utf8");
        const userConfig = JSON.parse(config);

        // Check if token is present
        if (userConfig.token) {
            try {
                // Verify the JWT token (this will automatically check for expiration)
                jwt.verify(userConfig.token, process.env.JWT_SECRET_KEY);
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
        // Adjust path to .myGit folder
        const configPath = path.join(__dirname, "..", ".myGit", "config.json");
        const remotePath = path.join(__dirname, "..", ".myGit", ".remote.json");

        // Read the config file (which contains the username)
        const configData = await fs.readFile(configPath, "utf8");
        const config = JSON.parse(configData);
        const { username } = config;

        // Read the remote file (which contains the URL)
        const remoteData = await fs.readFile(remotePath, "utf8");
        const remote = JSON.parse(remoteData);
        const remoteUrl = remote.url;

        // Validate the URL format
        const match = remoteUrl.match(/^https:\/\/slotcode\.in\/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)$/);
        if (!match) {
            throw new Error("Invalid remote URL format.");
        }

        const remoteUsername = match[1].split("/")[0]; // Extract username from "username/repositoryName"
        const remoteRepo = match[1].split("/")[1]; // Extract repository name from "username/repositoryName"

        // Compare usernames
        if (username !== remoteUsername) {
            throw new Error(
                `Access denied. You do not have permission to access this repository. Repository: ${remoteRepo}`
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
                        `https://${apiUrl}/login`,
                        {
                            username: username,
                            password: password,
                        },
                        {
                            headers: { "x-request-source": "cli" }, // Custom header to indicate CLI
                        }
                    );

                    // Save token to .myGit/config.json
                    const token = res.data.token;

                    const userConfig = {
                        token: token,
                        username: username,
                    };

                    // Save config file
                    await fs.writeFile(
                        path.join(process.cwd(), ".myGit", "config.json"),
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

// The main pushRepo function which combines login, validation, and pushing to S3
async function pushRepo() {
    const loggedIn = await isLoggedIn();

    let token;
    if (!loggedIn) {
        console.log("Authentication required, valid for 30 days.");
        token = await promptLogin(); // Prompt for login if not logged in
        console.log("Authentication successful.");
    }

    // Validate repository access
    await validateRepositoryAccess();

    console.log("Pushing...");
    const repoPath = path.resolve(process.cwd(), ".myGit");
    const commitsPath = path.join(repoPath, "commits");

    try {
        const commitDirs = await fs.readdir(commitsPath);
        for (const commitDir of commitDirs) {
            const commitPath = path.join(commitsPath, commitDir);
            const files = await fs.readdir(commitPath);

            for (const file of files) {
                const filePath = path.join(commitPath, file);
                const fileContent = await fs.readFile(filePath);

                // Use repoName for the Key structure in S3
                const remotePath = path.join(__dirname, "..", ".myGit", ".remote.json");
                const remoteData = await fs.readFile(remotePath, "utf8");
                const remote = JSON.parse(remoteData);
                const remoteUrl = remote.url;
                const match = remoteUrl.match(/^https:\/\/slotcode\.in\/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)$/);
                const repoName = match ? match[1] : null;

                if (!repoName) {
                    throw new Error("Invalid repository name format.");
                }

                const params = {
                    Bucket: S3_BUCKET,
                    Key: `commits/${repoName}/${commitDir}/${file}`, // Use the full repoName (username/repositoryName)
                    Body: fileContent,
                };

                // Upload the file to S3
                await s3.upload(params).promise();
            }
        }

        console.log("Pushed successfully");
    } catch (err) {
        console.error("Error during pushing commits: ", err.message);
    }
}

module.exports = {
    pushRepo,
};
