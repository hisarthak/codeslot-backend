const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { MongoClient } = require("mongodb");
const dotenv = require("dotenv");
var ObjectId = require("mongodb").ObjectId;
const mongoose = require ('mongoose');
const Repository = require("../models/repoModel");

const User = require("../models/userModel");


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

async function signup (req,res){
  const {username, password, email } = req.body;
  try{
    await connectClient();
    const db = client.db("githubclone");
    const usersCollection = db.collection("users");

    const user = await usersCollection.findOne({username});
    if (user){
        return res.status(400).json({message: "User already exists!"})
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = {
        username,
        password: hashedPassword,
        email,
        repositories: [],
        followedUsers: [],
        starRepos: []
    }

    const result = await usersCollection.insertOne(newUser);

    const token = jwt.sign({id: result.insertedId}, process.env.JWT_SECRET_KEY, {expiresIn:"7d" });

    res.json({token: token, userId: result.insertedId});

  }catch(err){
   console.error("Error during signup : ", err.message);
   res.status(500).send("Server error");
  }

};

async function login(req, res) {
    const { username, password } = req.body; // Replace email with username
    try {
        await connectClient();
        const db = client.db("githubclone");
        const usersCollection = db.collection("users");

        // Find the user by username instead of email
        const user = await usersCollection.findOne({ username });
        if (!user) {
            return res.status(400).json({ message: "Invalid credentials!" });
        }

        // Compare the provided password with the hashed password in the database
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials!" });
        }

        // Check the request source (CLI or frontend)
        const isCLI = req.headers['x-request-source'] === 'cli'; // Check if it's a CLI request

        // Set different expiration times based on the source
        const tokenExpiration = isCLI ? '30d' : '7d'; // 30 days for CLI, 1 hour for frontend

        // Generate a JWT token with the user's ID
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY, { expiresIn: tokenExpiration });

        // Respond with the token and user ID
        res.json({ token: token, userId: user._id });
    } catch (err) {
        console.error("Error during login: ", err.message);
        res.status(500).send("Server error!");
    }
}




async function getAllUsers (req,res){
    try{
        await connectClient();
        const db = client.db("githubclone");
        const usersCollection = db.collection("users");

        const users = await usersCollection.find({}).toArray();

        res.json(users);

    }catch(err){
        console.error("Error during fetching : ", err.message);
        res.status(500).send("Server error!");
    }
};




async function getUserProfile(req, res) {
    const { username } = req.params; // Get the username from the params
    const { type, token } = req.query; // Extract the type (star, following, etc.) and token from query params
  
    console.log("Received request for user profile");
    console.log("Username from Params:", username);
    console.log("Query Type:", type);
  
    try {
      // Verify the token
      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }
  
      // Decode the token to get the current user's username
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET_KEY); // Replace with your JWT secret
      } catch (err) {
        console.error("Token verification failed:", err.message);
        return res.status(401).json({ message: "Invalid or expired token" });
      }
  
      const currentUsername = decoded.username; // Extract the username from the token
  
      console.log("Decoded Username from Token:", currentUsername);
  
      // Fetch the user by username
      const user = await User.findOne({ username });
  
      console.log("Fetched User:", user);
  
      if (!user) {
        console.log("User not found.");
        return res.status(404).json({ message: "User not found" });
      }
  
      // Check if the current user is the one requesting their profile
      const isOwnProfile = currentUsername === username;
  
      // Handle query for starred repositories
      if (type === "star") {
        console.log("Fetching starred repositories...");
  
        let starRepos = [];
  
        // If it's the user's own profile, send all starred repos
        if (isOwnProfile) {
          starRepos = user.starRepos; // All starred repositories
        } else {
          // If it's another user's profile, filter by visibility
          starRepos = user.starRepos.filter((repo) => repo.visibility === "true");
        }
  
        // Populate repository details using populate() for starred repositories
        const populatedStarRepos = await User.findOne({ username })
          .populate({
            path: "starRepos", // Field to populate
            match: isOwnProfile ? {} : { visibility: "true" }, // Filter starred repositories by visibility for non-own profiles
            select: "name description visibility", // Fields to select for populated repositories
          })
          .select("starRepos"); // Select the starRepos field only
  
        console.log("Populated Starred Repositories:", populatedStarRepos.starRepos);
        return res.json(populatedStarRepos.starRepos); // Return populated or filtered star repositories
      }
  
      // Handle query for followed users
      if (type === "following") {
        console.log("Fetching followed users...");
        const followedUsers = await User.findOne({ username })
          .populate("followedUsers") // Populate the followedUsers field
          .select("followedUsers");
  
        console.log("Followed Users:", followedUsers.followedUsers);
        return res.json(followedUsers.followedUsers); // Return followed users
      }
  
      // Handle query for followers
      if (type === "followers") {
        console.log("Fetching followers...");
        const followers = await User.findOne({ username })
          .populate("followers") // Populate the followers field
          .select("followers");
  
        console.log("Followers:", followers.followers);
        return res.json(followers.followers); // Return followers
      }
  
      // Default behavior: Return the entire user object
      console.log("Returning full user object.");
      res.json(user);
    } catch (err) {
      console.error("Error during fetching:", err.message);
      res.status(500).send("Server error!");
    }
  }

async function updateUserProfile(req,res){
    const currentID = req.params.id;
    const {email, password} = req.body;

    try {
        await connectClient();
    const db = client.db("githubclone");
    const usersCollection = db.collection("users");

        let updateFields = {email};
        if(password){
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            updateFields.password = hashedPassword;
        }

        const result = await usersCollection.findOneAndUpdate(
            {
            _id: new ObjectId(currentID)
        },
        { $set: updateFields },
        {returnDocument: "after"}
    );

    console.log(result.value);
    console.log(result);

if(!result){
    return res.status(404).json({message: "User not found"})

}

res.send(result);

    } catch (err){
        console.error("Error during updating : ", err.message);
        res.status(500).send("Server error!");
    }
};

async function deleteUserProfile(req,res){
    const currentID = req.params.id;

    try{
        await connectClient();
        const db = client.db("githubclone");
        const usersCollection = db.collection("users");
    
 const result = await usersCollection.deleteOne({
    _id: new ObjectId(currentID)
 });

 if(!result.deleteCount==0){
    return res.status(404).json({message: "User not found"})

}

res.json({message: "User Profile Deleted!"});

    }catch(err){
        console.error("Error during updating : ", err.message);
        res.status(500).send("Server error!");
    }

};

async function starOrFollow(req, res) {
    const { username, reponame } = req.params; // Extract username and reponame from params
    const { token, check } = req.query; // Extract token and check query from query params

    // Decode the repository name
    const decodedRepoName = decodeURIComponent(reponame);

    // console.log("Received request to star repository:", { username, decodedRepoName, token, check });

    try {
        // Connect to the database
        // console.log("Connecting to database...");
        await connectClient();
        // console.log("Connected to database successfully.");
        const db = client.db("githubclone");
        const usersCollection = db.collection("users");
        const repositoriesCollection = db.collection("repositories");

        // Verify JWT token
        // console.log("Verifying JWT token...");
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        const userId = decoded.id;
        // console.log("Decoded user ID from JWT:", userId);

        // Find the user by username
        // console.log("Finding user by username:", username);
        const user = await usersCollection.findOne({ username });
        if (!user) {
            // console.log("User not found in database.");
            return res.status(404).json({ message: "User not found!" });
        }
        // console.log("User found:", user);

        // Check if the repository exists
        // console.log("Checking if repository exists:", decodedRepoName);
        const repo = await repositoriesCollection.findOne({ name: decodedRepoName });
        if (!repo) {
            // console.log("Repository not found in database.");
            return res.status(404).json({ message: "Repository not found!" });
        }
        // console.log("Repository found:", repo);

        // Ensure the user making the request is authorized
        // console.log("Checking user authorization...");
        if (String(userId) !== String(user._id)) {
            // console.log("User is not authorized to star this repository.");
            return res.status(403).json({ message: "You are not authorized to star repositories for this user!" });
        }
        // console.log("User is authorized to star the repository.");

        // Check if repository is already starred
        // console.log("Checking if repository is already starred...");
        const isAlreadyStarred = user.starRepos.some(id => id.toString() === repo._id.toString());
        // console.log("Is repository already starred:", isAlreadyStarred);

        // If `check` query is present and its value is `starCheck`, return the star status
        if (check === "starCheck") {
            // console.log("Check query received, responding with star status.");
            return res.status(200).json({ isStarred: isAlreadyStarred });
        }

        // Proceed with starring or unstarring logic
        if (isAlreadyStarred) {
            // console.log("Repository is already starred. Removing from starRepos...");
            await usersCollection.updateOne(
                { username },
                { $pull: { starRepos: repo._id } }
            );
            // console.log("Repository successfully removed from starRepos.");
            return res.status(200).json({ message: "Repository unstarred successfully!" });
        }

        // console.log("Starring the repository...");
        await usersCollection.updateOne(
            { username },
            { $push: { starRepos: repo._id } }
        );
        // console.log("Repository starred successfully.");

        res.status(200).json({ message: "Repository starred successfully!" });
    } catch (err) {
        // console.error("Error starring repository:", err.message);

        if (err.name === "JsonWebTokenError") {
            // console.log("Invalid JWT token provided.");
            return res.status(401).json({ message: "Invalid token!" });
        }

        // console.log("Unexpected error occurred.");
        res.status(500).json({ message: "Server error!" });
    }
}


module.exports = {
    getAllUsers,
    signup,
    login,
    getUserProfile,
    updateUserProfile,
    deleteUserProfile,
    starOrFollow,
};
