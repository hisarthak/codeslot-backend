const fs = require("fs").promises;
const path = require("path");
const readline = require("readline");
const axios = require("axios");
require("dotenv").config();

const apiUrl = process.env.API_URL;


// Function to prompt user for username and password
function authenticateUser() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve, reject) => {
        console.log("Authentication will be valid for 30 days.");
        
        
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

                    // Save token to .slot/config.json
                    const token = res.data.token;

                    const userConfig = {
                        token: token,
                        username: username,
                    };

                    // Save config file
                    const configDir = path.join(process.cwd(), ".slot");
                    const configPath = path.join(configDir, "config.json");

                    // Check if the directory exists, create it if not
                    try {
                        await fs.access(configDir);
                    } catch {
                        await fs.mkdir(configDir, { recursive: true });
                    }

                    // Write to the config file
                    await fs.writeFile(
                        configPath,
                        JSON.stringify(userConfig, null, 2)
                    );

                    console.log("Authentication successful!");
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

module.exports = {
    authenticateUser,
};
