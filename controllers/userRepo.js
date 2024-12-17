const express = require('express');
const { s3, S3_BUCKET } = require("../config/aws-config");
const path = require('path');
;
const mongoose = require('mongoose');
const Repository = require("../models/repoModel");
const User = require("../models/userModel");
const Issue = require("../models/issueModel");
const axios = require('axios');
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const S3_BUCKETT = process.env.S3_BUCKET;





// Create an array to store the commit data
let commitDataArray = [];

// Function to get the commit with the highest count from logs.json
async function getHighestCountCommitFromS3(repoName) {
  try {
    const logsKey = `commits/${repoName}/logs.json`;
    const logsData = await s3.getObject({ Bucket: "apninewbucket", Key: logsKey }).promise();
    const logs = JSON.parse(logsData.Body.toString());

    let highestCountCommit = null;
    let maxCount = 0;

    // Loop through logs and find the commit with the highest count
    for (const commit of logs) {
      if (commit.count > maxCount) {
        maxCount = commit.count;
        highestCountCommit = commit;
      }
    }

    if (highestCountCommit) {
      return highestCountCommit.commitID; // Return the commitID with the highest count
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

    // Save the commitDataJson into the array
    commitDataArray.push(commitDataJson);

    // Return the commitDataJson
    return commitDataJson;
  } catch (error) {
    console.error("Error fetching or processing commitData.json from S3:", error.message);
    return {}; // Return an empty object if there's an error
  }
}

// Function to fetch the commit data and store it in the array (without returning a response)
async function repoFolderStructure() {
  const repoNames = "codeslot%2Fcodeslot"; // Hardcoded for testing
  const repoName = decodeURIComponent(repoNames);
  console.log(repoName);
  try {
    // Step 1: Fetch the commit ID with the highest count from logs.json
    const commitID = await getHighestCountCommitFromS3(repoName);
    if (!commitID) {
      console.error("No valid commit found.");
      return;
    }

    // Step 2: Fetch and store commitData.json in the array
    const commitDataJson = await fetchAndProcessCommitDataFromS3(repoName, commitID);

    // You can check the array contents here, or handle it further
    console.log(commitDataArray); // Print the array with all the fetched commit data
    // console.log(S3_BUCKETT);

  } catch (error) {
    console.error("Error processing request:", error.message);
  }
}

// Call the function to test it locally
repoFolderStructure();
