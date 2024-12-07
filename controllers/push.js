const fs = require("fs").promises;
const path = require('path');
const readline = require('readline');
const jwt = require('jsonwebtoken');
const { s3, S3_BUCKET } = require("../config/aws-config");
const axios = require('axios');

// Helper function to check if the user is logged in (checks the .myGit/config.json)
async function isLoggedIn() {
  try {
    const configPath = path.join(process.cwd(), '.myGit', 'config.json');
    const config = await fs.readFile(configPath, 'utf8');
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


// Function to prompt user for username and password
function promptLogin() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  
    return new Promise((resolve, reject) => {
      rl.question('Enter your username: ', (username) => {
        rl.question('Enter your password: ', async (password) => {
          try {
            // Send login request to your backend
            const res = await axios.post("https://gitspace.duckdns.org:3002/login", {
              username: username,
              password: password,
            },{
                headers: { 'x-request-source': 'cli' }  // Custom header to indicate CLI
            });
          
  
            // Save token to .myGit/config.json
            const token = res.data.token;
            const userConfig = {
              token: token,
              username: username,
            };
  
            // No need to log folder creation, only the config file
            await fs.writeFile(path.join(process.cwd(), '.myGit', 'config.json'), JSON.stringify(userConfig, null, 2));
            resolve(token); // Return token after successful login
          } catch (err) {
            console.error('Error during authentication: ', err.response?.data?.message || err.message);
            reject(err);
          } finally {
            rl.close();
          }
        });
      });
    });
  }
  

// The main pushRepo function which combines login and pushing to S3
async function pushRepo() {
    const loggedIn = await isLoggedIn();
  
    let token;
    if (!loggedIn) {
      console.log('Authentication required, valid for 30 days.');
      token = await promptLogin(); // Prompt for login if not logged in
      console.log('Authentication successful.');
      console.log('Pushing...')
    } else {
     console.log ("Pushing...")
    }
  
    // Now you can proceed with the pushRepo functionality (upload files to S3)
    const repoPath = path.resolve(process.cwd(), '.myGit');
    const commitsPath = path.join(repoPath, 'commits');
  
    try {
      const commitDirs = await fs.readdir(commitsPath);
      for (const commitDir of commitDirs) {
        const commitPath = path.join(commitsPath, commitDir);
        const files = await fs.readdir(commitPath);
  
        for (const file of files) {
          const filePath = path.join(commitPath, file);
          const fileContent = await fs.readFile(filePath);
          const params = {
            Bucket: S3_BUCKET,
            Key: `commits/${commitDir}/${file}`,
            Body: fileContent,
          };
  
          await s3.upload(params).promise();
        }
      }
  
      console.log('Pushed successfully');
    } catch (err) {
      console.error('Error during pushing commits: ', err.message);
    }
  }
  

module.exports = {
  pushRepo,
};
