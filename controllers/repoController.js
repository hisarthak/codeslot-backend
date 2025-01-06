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


async function createRepository(req, res) {
   const { owner, name, issues, content, description, visibility } = req.body;

   try {
       // Normalize and trim repository name
       let trimmedName = name.trim().replace(/\s+/g, ' '); // Removes extra spaces and ensures single spaces between words

       if (!trimmedName) {
           return res.status(400).json({ error: "Repository name is required!" });
       }

        // Validate the repository name
        const repoNameRegex = /^(?!-)[a-zA-Z0-9-_ ]*(?<!-)$/; // Ensures no hyphen at the start or end
        const hasLetter = /[a-zA-Z]/.test(trimmedName); // Ensures at least one letter

        if (!repoNameRegex.test(trimmedName) || !hasLetter) {
            return res.status(400).json({
                error: "Repository name must contain at least one letter, and hyphens cannot be at the start or end."
            });
        }

       // Fetch the username using the owner ID
       let username;
       try {
           const response = await axios.get(`https://${apiUrl}/userProfile/${owner}`);
           username = response.data.username; // Set the username
       } catch (err) {
           console.error("Cannot fetch user details: ", err);
           return res.status(500).json({ error: "Unable to fetch user details." });
       }

       // Append the username to the trimmed repository name
       trimmedName = `${username}/${trimmedName}`;

       if (!mongoose.Types.ObjectId.isValid(owner)) {
           return res.status(400).json({ error: "Invalid User ID!" });
       }

       // Create the new repository object
       const newRepository = new Repository({
           name: trimmedName,
           description,
           visibility,
           owner,
           content,
           issues,
       });

       // Save the repository
       const result = await newRepository.save();

       res.status(201).json({
           message: "Repository created!",
           repositoryID: result._id,
       });
   } catch (err) {
       // Handle duplicate name error
       if (err.code === 11000 && err.keyValue && err.keyValue.name) {
           return res.status(400).json({ err: `Repository name already exists` });
       }

       // Catch-all for other errors
       console.error("Error creating repository:", err);
       return res.status(500).json({
           err: "An unexpected error occurred. Please try again.",
           details: err.message,
       });
   }
}



async function getAllRepositories(req, res){
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

async function fetchRepositoriesForCurrentUser(req, res){
   const userId= req.params.userID;
   try{
  const repositories = await Repository.find({owner: userId});
console.log(repositories);

if (!repositories || repositories.length === 0) {
   return res.status(200).json({ repositories: [] });  // Return an empty array if no repos are found
 }

res.json({message:"Repositories found!", repositories});

   }catch(err){
     console.error("Error during fetching user repositories : ", err.message);
     res.status(500).send("Server error");
    }
};

async function updateRepositoryById(req, res){
  const {id} = req.params;
  const {content, description} = req.body;

  try{
 const repository = await Repository.findById(id);
 if(!repository){
    return res.status(404).json({error: "Repository not found"})
 }

 repository.content.push(content);
 repository.description = description;

 const updatedRepository = await repository.save();

 res.json({
    message:"Repository updated successfully!", repository: updatedRepository,
 });
  }catch(err){
     console.error("Error during updating repository : ", err.message);
     res.status(500).send("Server error");
    }
};

async function toggleVisibilityById(req, res){
    const {id} = req.params;
    
    try{
   const repository = await Repository.findById(id);
   if(!repository){
      return res.status(404).json({error: "Repository not found"});
   }
  
  repository.visibility = !repository.visibility;
  
   const updatedRepository = await repository.save();
  
   res.json({
      message:"Repository visibility toggled successfully", repository: updatedRepository,
   });
    }catch(err){
       console.error("Error during toggling visibility : ", err.message);
       res.status(500).send("Server error");
      }
    };

async function deleteRepositoryById(req, res){
    const {id} = req.params;

    try{
const repository = await Repository.findByIdAndDelete(id);
if(!repository){
    return res.status(404).json({error: "Repository not found"});
 }
 res.json({message:"Repository deleted successfully!"});
    }catch(err){
       console.error("Error during deleting repository : ", err.message);
       res.status(500).send("Server error");
      }
};



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
    const { reponame } = req.params; // Extract repoName from URL
    const decodedRepoName = decodeURIComponent(reponame); // Decode URL-encoded repoName
    console.log(reponame);
    console.log(decodedRepoName);

    // Step 1: Fetch the commit ID with the highest count from logs.json
    const highestCommitData = await getHighestCountCommitFromS3(decodedRepoName);
    if (!commitID) {
      return res.status(404).json({ error: 'No valid commit found.' });
    }

    const { commitID, message, date, count } = highestCommitData;

    // Step 2: Fetch and return commitData.json exactly as it is
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
      // Use fetchFileContentFromS3 when inode and commit are not provided
      const commitID = await getHighestCountCommitFromS3(decodedRepoName);
      if (!commitID) {
        return res.status(404).json({ error: 'No valid commit found.' });
      }

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



module.exports = {
    repoFolderStructure,
    fetchFileContent,
    createRepository,
    getAllRepositories,
    fetchRepositoryById,
    fetchRepositoryByName,
    fetchRepositoriesForCurrentUser,
    updateRepositoryById,
    toggleVisibilityById,
    deleteRepositoryById,
}
