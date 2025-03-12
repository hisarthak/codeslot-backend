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
const autoLoginName = process.env.AUTO_LOGIN_NAME;
const autoLoginCode = process.env.AUTO_LOGIN_CODE;

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
  let {username, password, email } = req.body;
   // **Trim username to remove accidental spaces**
   username = username?.trim().toLowerCase();
   password = password?.trim();
   email = email?.trim().toLowerCase();

   // **Check if any field is missing**
   if (!username || !password || !email) {
     return res.status(400).json({ message: "Username, email, and password are required!" });
   }
 
   // **Check if username contains spaces**
   if (username.includes(" ")) {
     return res.status(400).json({ message: "Username cannot contain spaces!" });
   }
    // **Check if username contains spaces**
    if (password.includes(" ")) {
      return res.status(400).json({ message: "Password cannot contain spaces!" });
    }
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
  let { username, password } = req.body; // Replace email with username
  username = username?.trim().toLowerCase();
  password = password?.trim();


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
      const tokenExpiration = isCLI ? '30d' : '7d'; // 30 days for CLI, 7 days ford frontend

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
    const { type, userId } = req.query; // Extract the type (star, following, etc.) and userId from query params
  
    console.log("Received request for user profile");
    console.log("Username from Params:", username)
    console.log("Query Type:", type);
    console.log("UserID from Query:", userId);
  
    try {
      // Verify the userId
      if (!userId) {
        return res.status(400).json({ message: "userId is required" });
      }
  
      // Fetch the user based on userId
      const currentUser = await User.findById(userId); // Assuming `User` is your Mongoose model
  
      if (!currentUser) {
        console.log("Current user not found.");
        return res.status(404).json({ message: "User not found with the given userId" });
      }
  
      const currentUsername = currentUser.username; // Extract the username from the found user
      console.log("Username from userId:", currentUsername);
  
      // Fetch the target user by username
      const targetUser = await User.findOne({ username });
  
      console.log("Fetched Target User:", targetUser);
  
      if (!targetUser) {
        console.log("Target user not found.");
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
          starRepos = targetUser.starRepos; // All starred repositories
        } else {
          // If it's another user's profile, filter by visibility
          starRepos = targetUser.starRepos.filter((repo) => repo.visibility === "true");
        }
  
        // Populate repository details using populate() for starred repositories
        const populatedStarRepos = await User.findOne({ username })
          .populate({
            path: "starRepos", // Field to populate
            match: isOwnProfile ? {} : { visibility: "true" }, // Filter starred repositories by visibility for non-own profiles
            select: "name description visibility starredBy", // Fields to select for populated repositories
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
      await targetUser.populate("followers", "username email");
      await targetUser.populate("followedUsers", "username email"); 
      res.json(targetUser);
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

    try {
        // Connect to the database
        await connectClient();
        const db = client.db("githubclone");
        const usersCollection = db.collection("users");
        const repositoriesCollection = db.collection("repositories");

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        const userId = decoded.id;

        // Find the user by username
        const user = await usersCollection.findOne({ username });
        if (!user) {
            return res.status(404).json({ message: "User not found!" });
        }

        // Check if the repository exists
        const repo = await repositoriesCollection.findOne({ name: decodedRepoName });
        if (!repo) {
            return res.status(404).json({ message: "Repository not found!" });
        }

        // Ensure the user making the request is authorized
        if (String(userId) !== String(user._id)) {
            return res.status(403).json({ message: "You are not authorized to star repositories for this user!" });
        }

        // Check if repository is already starred by the user
        const isAlreadyStarred = user.starRepos.some(id => id.toString() === repo._id.toString());

        // If `check` query is present and its value is `starCheck`, return the star status
        if (check === "starCheck") {
            return res.status(200).json({
                isStarred: isAlreadyStarred,
                repo_id: repo._id,
                visibility: repo.visibility,
                owner: repo.owner,
            });
        }

        // Proceed with starring or unstarring logic
        if (isAlreadyStarred) {
            // Unstar repository
            await usersCollection.updateOne(
                { username },
                { $pull: { starRepos: repo._id } }
            );
            await repositoriesCollection.updateOne(
                { name: decodedRepoName },
                { $pull: { starredBy: username } } // Remove username from `starredBy` array
            );
            return res.status(200).json({ message: "Repository unstarred successfully!" });
        }

        // Star repository
        await usersCollection.updateOne(
            { username },
            { $push: { starRepos: repo._id } }
        );
        await repositoriesCollection.updateOne(
            { name: decodedRepoName },
            { $push: { starredBy: username } } // Add username to `starredBy` array
        );

        res.status(200).json({ message: "Repository starred successfully!" });
    } catch (err) {
        if (err.name === "JsonWebTokenError") {
            return res.status(401).json({ message: "Invalid token!" });
        }

        res.status(500).json({ message: "Server error!" });
    }
}

async function followOrUnfollowUser(req, res) {
    const { id } = req.params; // Extract userId from the params
    const { followUsername } = req.query; // Extract followUsername from the query
  
    try {
      // Check if `followUsername` is provided
      if (!followUsername) {
        return res.status(400).json({ message: "followUsername is required!" });
      }
  
      // Fetch the user initiating the follow/unfollow action
      const currentUser = await User.findById(id);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found!" });
      }
  
      // Fetch the user to be followed/unfollowed
      const userToFollow = await User.findOne({ username: followUsername });
      if (!userToFollow) {
        return res.status(404).json({ message: "User to follow not found!" });
      }

      if(currentUser._id.toString() === userToFollow._id.toString()){
        return res.status(404).json({message: "Not allowed"});
      }
  
      // Check if the user is already following
      const alreadyFollowing = currentUser.followedUsers.some(
        (id) => id.toString() === userToFollow._id.toString()
      );
  
      if (alreadyFollowing) {
        // Unfollow logic: Remove `userToFollow` from `currentUser.followedUsers`
        currentUser.followedUsers = currentUser.followedUsers.filter(
          (id) => id.toString() !== userToFollow._id.toString()
        );
  
        // Remove `currentUser` from `userToFollow.followers`
        userToFollow.followers = userToFollow.followers.filter(
          (id) => id.toString() !== currentUser._id.toString()
        );
  
        // Save changes to both users
        await currentUser.save();
        await userToFollow.save();
  
        return res.status(200).json({
          message: "Successfully unfollowed the user!",
          currentUser: currentUser.username,
          unfollowedUser: userToFollow.username,
        });
      }
  
      // Follow logic: Add `userToFollow` to `currentUser.followedUsers`
      currentUser.followedUsers.push(userToFollow._id);
  
      // Add `currentUser` to `userToFollow.followers`
      userToFollow.followers.push(currentUser._id);
  
      // Save changes to both users
      await currentUser.save();
      await userToFollow.save();
  
      res.status(200).json({
        message: "Successfully followed the user!",
        currentUser: currentUser.username,
        followedUser: userToFollow.username,
      });
    } catch (err) {
      console.error("Error in followOrUnfollowUser:", err.message);
      res.status(500).json({ message: "Server error!" });
    }
  }


async function verifyToken(req, res) {
  try {
      const { token } = req.body; // Extract token from body
      if (!token) {
          return res.status(400).json({ valid: false, message: "Token is required!" });
      }

      // Verify JWT
      jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
          if (err) {
              return res.status(401).json({ valid: false, message: "Invalid or expired token!" });
          }
          return res.status(200).json({ valid: true, userId: decoded.id });
      });

  } catch (error) {
      console.error("Error verifying token:", error);
      res.status(500).json({ valid: false, message: "Server error!" });
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
    followOrUnfollowUser,
    verifyToken,
};
