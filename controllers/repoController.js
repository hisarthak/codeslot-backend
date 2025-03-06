const mongoose = require ('mongoose');
const Repository = require("../models/repoModel");

const User = require("../models/userModel");
const Issue = require("../models/issueModel");
const axios = require('axios');
const { s3, S3_BUCKET } = require("../config/aws-config");
const path = require('path');
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, '../.env') });
process.env.AWS_SDK_LOAD_CONFIG = "1";
const apiUrl = process.env.API_URL;
const jwt = require('jsonwebtoken');
const { MongoClient } = require("mongodb");
var ObjectId = require("mongodb").ObjectId;



dotenv.config();
const uri = process.env.MONGODB_URI;

let client;

async function connectClient() {
    if(!client) {
        client = new MongoClient(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        await client.connect();
    }
}

async function createRepository(req, res) {
  const { username, owner, name, issues, content, description, visibility } = req.body;
console.log("hi",description);
console.log(username);
  try {
      console.log("Received repository creation request for:", { username, owner, name, description });

      // Normalize and trim repository name
      let trimmedName = name.trim().replace(/\s+/g, ' '); // Removes extra spaces and ensures single spaces between words

      if (/\s/.test(name)) {
          console.log("Repository name contains spaces.");
          return res.status(400).json({ error: "No spaces allowed in repository name." });
      }

      if (!trimmedName) {
          console.log("Repository name is empty.");
          return res.status(400).json({ error: "Repository name is required!" });
      }

      // Validate the repository name
      const repoNameRegex = /^(?!-)[a-zA-Z0-9-_ ]*(?<!-)$/; // No hyphen at start or end
      const hasLetter = /[a-zA-Z]/.test(trimmedName); // Must contain at least one letter

      if (!repoNameRegex.test(trimmedName) || !hasLetter) {
          console.log("Invalid repository name format.");
          return res.status(400).json({
              error: "Repository name must contain at least one letter, and hyphens cannot be at the start or end."
          });
      }

      // Append the username to the trimmed repository name
      trimmedName = `${username}/${trimmedName}`;

      if (!mongoose.Types.ObjectId.isValid(owner)) {
          console.log("Invalid User ID.");
          return res.status(400).json({ error: "Invalid User ID!" });
      }

      console.log("Checking if user exists...");
      const user = await User.findById(owner);
      if (!user) {
          console.log("User not found.");
          return res.status(404).json({ error: "User not found!" });
      }

      
      console.log("User found:", { userId: user._id, username: user.username });
      const repoDescription = description && description.trim() ? description.trim() : "No description provided";
      // Create the new repository object
      const newRepository = new Repository({
          name: trimmedName,
          description: repoDescription, 
          visibility,
          owner,
          content,
          issues,
      });

      console.log("Saving repository...");
      const savedRepo = await newRepository.save();
      console.log("Repository saved:", { repoId: savedRepo._id, name: savedRepo.name, description: savedRepo.description });

      // Add the new repository ID to the user's repositories array
      user.repositories.push(savedRepo._id);
      console.log("Updating user with new repository...");
      await user.save();
      console.log("User updated with new repository:", { userId: user._id, repoId: savedRepo._id });

      res.status(201).json({
          message: "Repository created!",
          repositoryID: savedRepo._id,
      });
  } catch (err) {
      if (err.code === 11000 && err.keyValue && err.keyValue.name) {
          console.log("Repository name already exists.");
          return res.status(400).json({ err: "Repository name already exists" });
      }

      console.error("Error creating repository:", err.message);
      return res.status(500).json({
          err: "An unexpected error occurred. Please try again.",
          details: err.message,
      });
  }
}




async function getAllRepositories(req, res){
  try {
    await Repository.deleteMany({});
    console.log("Success: All repositories deleted.");
  } catch (error) {
    console.error("Error deleting repositories:", error);
  }
  return;
  
   try{

    const repositories = await Repository.find({})
    .populate("owner")
    .populate("issues");

    res.json(repositories);

   }catch(err){
    console.error("Error during fetching repositories : ", err.message);
    res.status(500).send("Server error");
   }
};

async function fetchRepositoryById(req, res){
   const {id }= req.params;
   try{
const repository = await Repository.find({_id: id})
.populate("owner")
.populate("issues");


if (!repository){
    return res.status(400).json({message: "Invalid credentials!"});
}

res.json(repository);
   }catch(err){
    console.error("Error during fetching repository : ", err.message);
    res.status(500).send("Server error");
   }
};

async function fetchRepositoryByName(req, res){
    const {name} = req.params;
    try{
 const repository = await Repository.find({name: name})
 .populate("owner")
 .populate("issues");
 
 if (!repository){
     return res.status(400).json({message: "Invalid credentials!"});
 }
 
 res.json(repository);
    }catch(err){
     console.error("Error during fetching repository : ", err.message);
     res.status(500).send("Server error");
    }
};

async function fetchRepositoriesForCurrentUser(req, res) {
  const { username } = req.params; // Get the username from the route parameter
  const { userId } = req.query; // Get the userId from the query parameters

  // console.log("Fetching repositories for username:", username);
  // console.log("Querying as userId:", userId);

  try {
    // Find the user by username to get their ownerId
    const user = await User.findOne({ username }).lean(); // Using lean() to get a plain JavaScript object
    if (!user) {
      console.log("User not found.");
      return res.status(404).json({ message: "User not found" });
    }

    // console.log("Fetched User:", user);

    // Determine if the requesting user is the same as the profile owner
    const isOwner = user._id.toString() === userId;

    // console.log("Is Requesting User the Owner?:", isOwner);

    // Fetch repositories based on ownership or visibility
    const query = isOwner
      ? { owner: user._id } // Fetch all repositories for the owner
      : { owner: user._id, visibility: true }; // Fetch only visible repositories for others

    // Fetch repositories and populate the owner field with user details
    const repositories = await Repository.find(query).populate('owner'); // Populate the 'owner' field

    console.log("Fetched Repositories:", repositories);

    // Return the repositories
    if (!repositories || repositories.length === 0) {
      return res.status(200).json({ message: "No repositories found!", repositories: [] });
    }

    res.json({ message: "Repositories found!", repositories });
  } catch (err) {
    console.error("Error during fetching user repositories:", err.message);
    res.status(500).send("Server error");
  }
}




async function updateRepositoryByRepoName(req, res) {
  const { repoName } = req.params; // Extract repoName from params
  const { description } = req.body; // Extract description from body
  const { userId } = req.query; // Extract userId from query
  const decodedRepoName = decodeURIComponent(repoName);

  try {
    // Find the repository by its name
    const repository = await Repository.findOne({ name: decodedRepoName });
    if (!repository) {
      return res.status(404).json({ error: "Repository not found" });
    }

    // If userId is not provided, return the current description
    if (!userId) {
      return res.json({
        message: "User ID not provided. Returning current description.",
        description: repository.description,
      });
    }

    // Verify that the userId matches the repository's owner
    if (repository.owner.toString() !== userId) {
      return res.status(403).json({ error: "Unauthorized: You do not own this repository" });
    }

    // Check if description exceeds 130 characters
    if (description.length > 200) {
      return res.status(400).json({ error: "Description cannot exceed 130 characters." });
    }

    // Update the description
    repository.description = description;

    // Save the updated repository
    const updatedRepository = await repository.save();

    res.json({
      message: "Repository updated successfully!",
      repository: updatedRepository.description,
    });
  } catch (err) {
    console.error("Error during updating repository: ", err.message);
    res.status(500).send("Server error");
  }
}


async function toggleVisibilityById(req, res) {
 
  const { id } = req.params;
  const { userId } = req.query; // Extract userId from query

  try {
    const repository = await Repository.findById(id);
    

    // Check if repository exists
    if (!repository) {
      return res.status(404).json({ error: "Repository not found" });
    }

    // Verify if the repository belongs to the user
    if (repository.owner.toString() !== userId) {
      return res.status(403).json({ error: "Unauthorized: You do not own this repository" });
    }

    // Toggle visibility
    repository.visibility = !repository.visibility;

    const updatedRepository = await repository.save();

    // Send success response
    res.json({
      message: "Repository visibility toggled successfully",
      visibility: updatedRepository.visibility,
    });
  } catch (err) {
    console.error("Error during toggling visibility: ", err.message);
    res.status(500).send("Server error");
  }
}

async function deleteRepositoryById(req, res) {
  const { id } = req.params;
  const { userId } = req.query;  // Extract userId from the query parameters

  try {
      // Find the repository by ID
      const repository = await Repository.findById(id);
      if (!repository) {
          return res.status(404).json({ error: "Repository not found" });
      }
      console.log(`Repository found: ${repository.name}`);

      // Check if the userId matches the owner of the repository
      if (repository.owner.toString() !== userId) { // Assuming `owner` is the field that stores the userId
          return res.status(403).json({ error: "You do not have permission to delete this repository" });
      }

      // Extract repository name
      const repoName = repository.name;
      console.log(`Repository name: ${repoName}`);

      // S3 key to point to the folder
      const repoS3Key = `commits/${repoName}/`; // Folder inside 'commits'
      console.log(`S3 key: ${repoS3Key}`);

      // List objects in the folder
      const listParams = {
          Bucket: "apninewbucket",
          Prefix: repoS3Key, // All objects starting with this prefix
      };

      try {
          // List all objects inside the folder
          const listedObjects = await s3.listObjectsV2(listParams).promise();
          console.log(`Listed objects in S3: ${listedObjects.Contents.length} items found.`);

          // If there are objects, delete them
          if (listedObjects.Contents.length > 0) {
              const deleteParams = {
                  Bucket: "apninewbucket",
                  Delete: {
                      Objects: listedObjects.Contents.map(object => ({ Key: object.Key })),
                  },
              };

              // Delete all objects in the folder
              await s3.deleteObjects(deleteParams).promise();
              console.log(`Deleted ${listedObjects.Contents.length} objects inside ${repoS3Key}`);
          } else {
              console.log("No objects found in S3 to delete.");
          }
      } catch (s3Error) {
          // Handle error for S3 deletion (in case repository exists in MongoDB but not in S3)
          console.error("Error during S3 deletion:", s3Error.message);
          // Proceed even if S3 deletion fails
      }

      // Remove the repository from the 'starRepos' field of users who have starred it
      if (repository.starredBy && repository.starredBy.length > 0) {
          console.log("Removing repository from users' starred repos...");
          for (let username of repository.starredBy) {
              const user = await User.findOne({ username });
              if (user) {
                  user.starRepos = user.starRepos.filter(repoId => repoId.toString() !== id);  // Remove repoId from starRepos
                  await user.save();
                  console.log(`Removed repository ${repoName} from user ${username}'s starred repositories.`);
              }
          }
      } else {
          console.log("No users have starred this repository.");
      }

      // Delete the repository from the database
      await Repository.findByIdAndDelete(id);
      console.log(`Repository ${repoName} deleted from MongoDB.`);

      res.json({ message: "Repository and associated data deleted successfully!" });
  } catch (err) {
      console.error("Error during deleting repository:", err.message);
      res.status(500).send("Server error");
  }
}





// Function to get the commit with the highest count from logs.json
async function getHighestCountCommitFromS3(repoName) {
  try {
    const logsKey = `commits/${repoName}/logs.json`;
    console.log(logsKey);
    const logsData = await s3.getObject({ Bucket: "apninewbucket", Key: logsKey }).promise();
    const logs = JSON.parse(logsData.Body.toString());

    let highestCountCommit = null;
    let maxCount = 0;

    // Loop through logs to find the commit with the highest count
    for (const commit of logs) {
      if (commit.count > maxCount) {
        maxCount = commit.count;
        highestCountCommit = commit;
      }
    }

    if (highestCountCommit) {
      return {
        commitID: highestCountCommit.commitID,
        message: highestCountCommit.message,
        date: highestCountCommit.date,
        count: maxCount
      };
    } else {
      throw new Error("No commits found in logs.json");
    }
  } catch (error) {
    console.error("Error fetching or processing logs.json from S3:", error.message);
    return null;
  }
}

// Function to fetch commitData.json and return it exactly
async function fetchAndProcessCommitDataFromS3(repoName, commitID) {
  try {
    const commitDataKey = `commits/${repoName}/${commitID}/commitData.json`;
    const commitData = await s3.getObject({ Bucket: "apninewbucket", Key: commitDataKey }).promise();
    const commitDataJson = JSON.parse(commitData.Body.toString());

    // Return the commitDataJson exactly as it is
    return commitDataJson;
  } catch (error) {
    console.error("Error fetching or processing commitData.json from S3:", error.message);
    return {}; // Return an empty object if there's an error
  }
}


// Route to handle requests for file system generation
async function repoFolderStructure(req, res) {
  try {
  const { reponame } = req.params; // Extract reponame from params
 const { token, username } = req.body; // Extract token and username from query params
 const decodedRepoName = decodeURIComponent(reponame); // Decode reponame
 const { commitID: queryCommitID, check  } = req.query; // Extract commitID from query params

 console.log("Processing request for repository folder structure:", {
   reponame: decodedRepoName,
   username,
   queryCommitID,
   check
 });

 // Ensure all required parameters are present
 if (!username || !token || !reponame) {
   return res.status(400).json({ message: "Missing query parameters" });
 }

 // Verify JWT token
 console.log("Verifying token...");
 let decoded;
 try {
   decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
 } catch (err) {
   console.error("Invalid token:", err.message);
   return res.status(401).json({ message: "Invalid token!" });
 }
 const userId = decoded.id;

 // Connect to the database
 console.log("Connecting to database...");
 await connectClient();
 console.log("Connected to database successfully.");
 const db = client.db("githubclone");
 const usersCollection = db.collection("users");
 const repositoriesCollection = db.collection("repositories");

 // Validate the repository and user
 console.log("Validating repository and user...");
 const repo = await repositoriesCollection.findOne({ name: decodedRepoName });
 if (!repo) {
   console.log("Repository not found.");
   return res.status(404).json({ message: "Repository not found!" });
 }
 const [repoOwner] = decodedRepoName.split("/");
 console.log(repoOwner);
 const user = await usersCollection.findOne({ username: repoOwner });
 if (!user) {
   console.log("User not found.");
   return res.status(404).json({ message: "User not found!" });
 }

 // If the "check" query is present and its value is "access"
 if (check === "access") {
  const isAccessible = repo.visibility || String(userId) === String(user._id);
  console.log("Repository visibility check:", isAccessible);
  return res.status(200).json({ isAccessible });
}

 // Check repository visibility and authorization
 if (!repo.visibility && String(userId) !== String(user._id)) {
   console.log("Repository is private, and user is not authorized.");
   return res.status(403).json({ message: "You are not authorized to access this repository!" });
 }



    let commitID, message = "", date = "", count = "";

    if (queryCommitID) {
      // Use commitID from the query if provided
      commitID = queryCommitID;
      console.log(`Using provided commitID: ${commitID}`);
    } else {
      // Fetch the commit ID with the highest count from logs.json
      const highestCommitData = await getHighestCountCommitFromS3(decodedRepoName);
      if (!highestCommitData) {
        return res.status(404).json({ error: 'No valid commit found.' });
      }
      // Extract details from the highest commit data
      ({ commitID, message, date, count } = highestCommitData);
    }

    // Fetch and return commitData.json exactly as it is
    const commitDataJson = await fetchAndProcessCommitDataFromS3(decodedRepoName, commitID);

    const response = {
      commitID,
      message,
      date,
      count,
      commitData: commitDataJson
    };

    // Return the enriched response
    return res.json(response);

  } catch (error) {
    console.error("Error processing request:", error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

// Function to fetch file content from S3
async function fetchFileContentFromS3(repoName, commitID, filePath) {
  try {
    const fileKey = `commits/${repoName}/${commitID}/${filePath}`;
    const fileData = await s3.getObject({ Bucket: "apninewbucket", Key: fileKey }).promise();
    return fileData.Body.toString(); // Return file content as a string
  } catch (error) {
    console.error("Error fetching file content from S3:", error.message);
    return null;
  }
}

// Function to fetch file content from S3 based on repoName, commitID, and inode
async function fetchFileContentByInode(repoName, commitID, inode) {
  try {
    // Step 1: Fetch the commitData file
    const commitDataKey = `commits/${repoName}/${commitID}/commitData.json`;
    const commitData = await s3.getObject({ Bucket: "apninewbucket", Key: commitDataKey }).promise();

    // Parse the commitData content
    const commitDataContent = JSON.parse(commitData.Body.toString());
    // console.log("Parsed Commit Data:", commitDataContent);

    // Extract all values from the commitDataContent object
    const filesArray = Object.values(commitDataContent);
    // console.log(filesArray);
    const inodeNumber = Number(inode);
    if (isNaN(inodeNumber)) {
      console.error(`Invalid inode: ${inode}`);
      return null;
    }
    // Step 2: Search for the file with the same inode
    const targetFile = filesArray.find((file) => file.id === inodeNumber); // Assuming `id` corresponds to `inode`
    if (!targetFile) {
      console.error(`File with the specified inode (${inode}) not found in commitData`);
      return null;
    }

  
    // Step 3: Extract the file path from the target file
    let filePath = targetFile.path; // Assuming the file object has a `path` property
    console.log(filePath);
     const updatedPath = filePath.replace(/\\/g, "/");
    console.log(filePath);

    // Step 4: Fetch the file content using the file path
    const fileKey = `commits/${repoName}/${commitID}/${updatedPath}`;
    const fileData = await s3.getObject({ Bucket: "apninewbucket", Key: fileKey }).promise();

    // Return the file content as a string
    return fileData.Body.toString();
  } catch (error) {
    console.error("Error fetching file content from S3:", error.message);
    return null;
  }
}


async function fetchFileContent(req, res) {
  try {
    const { reponame, filePath } = req.params; // Extract reponame and filePath from request params
    const { inode, commit } = req.query; // Extract inode and commit from request query

    const decodedRepoName = decodeURIComponent(reponame);
    const decodedFilePath = filePath ? decodeURIComponent(filePath) : null;

    const decodedInode = decodeURIComponent(inode);
    const decodedCommit = decodeURIComponent(commit)

    // console.log("Repository Name:", decodedRepoName);
    // if (decodedFilePath) console.log("File Path:", decodedFilePath);
    // if (inode) console.log("Inode:", inode);
    // if (commit) console.log("Commit:", commit);

    let fileContent;

    if (inode && commit) {
      // Use fetchFileByInode when inode and commit are provided
      fileContent = await fetchFileContentByInode(decodedRepoName, decodedCommit, decodedInode);
      if (!fileContent) {
        return res.status(404).json({ error: 'Unable to fetch file content by inode.' });
      }
    } else if (decodedFilePath) {
      const highestCommitData = await getHighestCountCommitFromS3(decodedRepoName);
    if (!highestCommitData) {
      return res.status(404).json({ error: 'No valid commit found.' });
    }
    const { commitID, message, date, count } = highestCommitData;


      fileContent = await fetchFileContentFromS3(decodedRepoName, commitID, decodedFilePath);
      if (!fileContent) {
        return res.status(404).json({ error: 'Unable to fetch file content by file path.' });
      }
    } else {
      return res.status(400).json({ error: 'Invalid request. Provide either inode and commit, or filePath.' });
    }

    // Send the file content as a response
    return res.json({ content: fileContent });
  } catch (error) {
    console.error("Error processing request:", error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

// Function to fetch logs file from S3 bucket and send it as a response
async function fetchLogsFromS3(req, res) {
  try {
    const { reponame } = req.params; // Extract repoName from URL
    const decodedRepoName = decodeURIComponent(reponame); // Decode URL-encoded repoName

    // Define the S3 key for the logs file
    const logsKey = `commits/${decodedRepoName}/logs.json`;

    // Fetch the logs file from S3
    const logsData = await s3.getObject({ Bucket: "apninewbucket", Key: logsKey }).promise();

    // Parse the logs data to JSON
    const logsJson = JSON.parse(logsData.Body.toString());

    // Send the logs data as the response
    return res.json(logsJson);

  } catch (error) {
    console.error("Error fetching logs from S3:", error.message);

    // Return an appropriate error response
    if (error.code === 'NoSuchKey') {
      return res.status(404).json({ error: 'Logs file not found.' });
    }

    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

async function findUsersAndRepositories(req, res) {
  try {
    const { query } = req.query; // Extract query from request query parameters

    if (!query || query.trim() === "") {
      return res.status(400).json({ error: "Search query cannot be empty" });
    }

    // Search for users matching the query
    const matchedUsers = await User.find({
      username: { $regex: query, $options: "i" }, // Case-insensitive search in username
    });

    // Search for repositories matching the query in the portion after "/"
    const matchedRepositories = await Repository.find({
      visibility: true, // Only visible repositories
      $or: [
        { 
          name: { $regex: `(?<=/).*${query}.*`, $options: "i" }
        },
        { 
          description: { 
            $regex: query, $options: "i" // Matches the query anywhere in the description
          } 
        },
      ],
    }).populate("owner", "username email"); // Populate owner details

    // Send the response with matched users and repositories
    return res.json({ users: matchedUsers, repositories: matchedRepositories });
  } catch (error) {
    console.error("Error while searching for users and repositories:", error.message);

    // Return an appropriate error response
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
function isTokenValid(token) {
  try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      return true; // Token is valid
  } catch (error) {
      return false; // Token is expired or invalid
  }
}

async function generateMultiplePresignedUrls(req, res) {
  try {
    console.log("Received request body:"); // Log entire request body

    const { keyNames, theToken, ourRepoName, thePushNumber } = req.body; // keyNames should be an array
    let Pushing= false;
    // Check if keyNames is an array
    if (!Array.isArray(keyNames)) {
      // console.error("Error: keyNames is not an array", keyNames);
      return res.status(400).json({ error: "keyNames must be an array" });
    }

    // Check if theToken exists
    if (!theToken) {
      // console.error("Error: Missing theToken");
      return res.status(400).json({ error: "Missing token" });
    }

    // Validate the token once
    if (!isTokenValid(theToken)) {
      // console.error("Error: Token is invalid or expired", theToken);
      return res.status(401).json({ error: "Unauthorized: Token is expired or invalid" });
    }

    // console.log("Token is valid. Fetching repository data...");
    const repository = await Repository.findOne({ name: ourRepoName });

    if (!repository) {
      // console.error("Error: Repository not found", ourRepoName);
      return res.status(404).json({ error: "Repository not found" });
    }
     // **Check if pushTime is within the last 5 minutes**
     const currentTime = new Date();
     if (repository.pushTime) {
       const pushTime = new Date(repository.pushTime);
       const timeDifference = (currentTime - pushTime) / (1000 * 60); // Convert milliseconds to minutes
 
       if (timeDifference <= 1) {
         Pushing = true;
       }
     }

     
    
      if (!Pushing && repository.pushNumber !== thePushNumber) {
              console.error("Push conflict: repository.pushNumber does NOT match thePushNumber");
              return res.status(403).json({ error: "Access denied", pushNumber: repository.pushNumber });
          }
       
             
      

    console.log("Local repository ID and pushNumber verified. Generating pre-signed URLs...");

    // Generate all URLs in parallel
    const urlPromises = keyNames.map((keyName) => {
      // console.log(`Generating URL for: ${keyName}`);

      const params = {
        Bucket: S3_BUCKET,
        Key: keyName,
        Expires: 300,
      };

      return s3.getSignedUrlPromise("putObject", params);
    });

    // Wait for all URLs to be generated
    const uploadUrls = await Promise.all(urlPromises);

    // console.log("Generated URLs:", uploadUrls);

    repository.pushTime = new Date();
    repository.pushNumber += 1; // Increment pushNumber

    await repository.save(); // Save changes to the database

    console.log("Updated repository:", {
      localSystemId: repository.localSystemId,
      pushNumber: repository.pushNumber,
    });

    return res.json({ uploadUrls, pushNumber: repository.pushNumber });

  } catch (error) {
    console.error("Error generating pre-signed URLs:", error);
    return res.status(500).json({ error: "Failed to generate pre-signed URLs" });
  }
}

  

async function generateDownloadUrls(req, res) {
  try {
    console.log("Received request body:", req.body);

    const { keyNames, theToken, ourRepoName, thePushNumber, clone } = req.body;

    if (!Array.isArray(keyNames)) {
      console.error("Error: keyNames is not an array", keyNames);
      return res.status(400).json({ error: "keyNames must be an array" });
    }

    if (!theToken) {
      console.error("Error: Missing theToken");
      return res.status(400).json({ error: "Missing token" });
    }

    if (!isTokenValid(theToken)) {
      console.error("Error: Token is invalid or expired", theToken);
      return res.status(401).json({ error: "Unauthorized: Token is expired or invalid" });
    }

    console.log("Token is valid. Generating pre-signed URLs...");
let repository;
if(!clone){
       repository = await Repository.findOne({ name: ourRepoName });
  
      if (!repository) {
          return res.status(404).json({ error: "Repository not found" });
      }
  
      if (repository.pushNumber == thePushNumber) {
          return res.status(200).json({ message: "not required" });
      }}
  
  
    const urlPromises = keyNames.map((keyName) => {
      console.log(`Generating download URL for: ${keyName}`);

      const params = {
        Bucket: S3_BUCKET,
        Key: keyName,
        Expires: 300,
      };

      return s3.getSignedUrlPromise("getObject", params);
    });

    const uploadUrls = await Promise.all(urlPromises); // <- Renamed to match frontend expectation

    console.log("Generated Download URLs:", uploadUrls);
    const pushNumberResponse = clone ? 0 : repository.pushNumber;
    res.json({ uploadUrls, pushNumber: pushNumberResponse }); // <- Changed from downloadUrls to uploadUrls
  } catch (error) {
    console.error("Error generating pre-signed URLs:", error);
    res.status(500).json({ error: "Failed to generate pre-signed URLs" });
  }
}

async function checkVisibilityByName(req, res) {
  const { name, username } = req.body; // Extract repository name & username from request body

  try {
    const repository = await Repository.findOne({ name });

    // Extract repository owner from name (before "/")
    const repoOwner = name.split("/")[0];

    // If username matches repo owner, grant access
    if (username === repoOwner) {
      return res.json({ message: "Access" });
    }

    // If repository does not exist OR visibility is false, return "Not found"
    if (!repository || !repository.visibility) {
      return res.status(404).json({ message: "Not found" });
    }

    // If repository exists and is visible, return "Access"
    res.json({ message: "Access" });

  } catch (err) {
    console.error("Error retrieving repository visibility:", err.message);
    res.status(500).send("Server error");
  }
}



module.exports = {
    repoFolderStructure,
    fetchFileContent,
    createRepository,
    getAllRepositories,
    fetchRepositoryById,
    fetchRepositoryByName,
    fetchRepositoriesForCurrentUser,
    updateRepositoryByRepoName,
    toggleVisibilityById,
    deleteRepositoryById,
    fetchLogsFromS3,
    findUsersAndRepositories,
    generateMultiplePresignedUrls,
    generateDownloadUrls,
    checkVisibilityByName,
}

