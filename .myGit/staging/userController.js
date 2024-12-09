const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { MongoClient } = require("mongodb");
const dotenv = require("dotenv");
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

    const token = jwt.sign({id: result.insertedId}, process.env.JWT_SECRET_KEY, {expiresIn:"1h" });

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
        const tokenExpiration = isCLI ? '30d' : '1h'; // 30 days for CLI, 1 hour for frontend

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

async function getUserProfile(req,res){
   const currentID  = req.params.id;

   try{
    await connectClient();
    const db = client.db("githubclone");
    const usersCollection = db.collection("users");

    const user = await usersCollection.findOne({
        _id: new ObjectId(currentID)
    });

    if (!user){
        return res.status(404).json({message: "User not found"})
    }

    res.send(user);

   }catch(err){
        console.error("Error during fetching : ", err.message);
        res.status(500).send("Server error!");
    }

};

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

module.exports = {
    getAllUsers,
    signup,
    login,
    getUserProfile,
    updateUserProfile,
    deleteUserProfile,
};