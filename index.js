const express = require('express');
const dotenv = require("dotenv");
const cors = require("cors");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const https = require("https"); // Change from http to https
const fs = require("fs"); // File system module to read SSL files
const { Server } = require("socket.io");
const mainRouter = require("./routes/main.router.js");

const yargs = require('yargs');
const { hideBin } = require("yargs/helpers");

const { initRepo } = require("./controllers/init.js");
const { addRepo } = require("./controllers/add.js");
const { commitRepo } = require("./controllers/commit.js");
const { pushRepo } = require("./controllers/push");
const { pullRepo } = require("./controllers/pull");
const { revertRepo } = require("./controllers/revert");

const agent = new https.Agent({  
  rejectUnauthorized: false
});

dotenv.config();

yargs(hideBin(process.argv))
.command("start", "Start a new server", {}, startServer)
.command("init", "Initialise a new repository", {}, initRepo)
.command("add <file>", "Add a file to the repository", (yargs) => {
    yargs.positional("file", {
        describe: "File to add to the staging area",
        type: "string",
    });
},
    (argv) => {
        addRepo(argv.file);
    })
.command(
    "commit <message>",
    "Commit the staged files",
    (yargs) => {
        yargs.positional("message", {
            describe: "Commit message",
            type: "string",
        });
    },
    (argv) => {
        commitRepo(argv.message);
    }
)
.command("push", "Push commits to S3", {}, pushRepo)
.command("pull", "Pull commits from S3", {}, pullRepo)
.command(
    "revert <commitID>",
    "Revert to a specific commit",
    (yargs) => {
        yargs.positional("commitID", {
            describe: "Commit ID to revert to",
            type: "string",
        });
    },
    (argv) => {
        revertRepo(argv.commitID);
    }
)
.demandCommand(1, "You need at least one command")
.help().argv;

// startServer function 
function startServer() {
   

const app = express();
const port = process.env.PORT || 3002;

// Load SSL certificates
const options = {
    key: fs.readFileSync('/home/ec2-user/aws-backend-demo/ssl.key'),   // Path to your SSL key
    cert: fs.readFileSync('/home/ec2-user/aws-backend-demo/ssl.crt'),  // Path to your SSL certificate
};

// Middleware
app.use(bodyParser.json());
app.use(express.json());
const allowedOrigins = [
    'https://main.dftpg4j3j5yw6.amplifyapp.com', // replace with your actual frontend domain
    // Add other domains if needed
];

app.use(cors({
    origin: allowedOrigins, // Specify the allowed origins
    credentials: true, // If you need to pass cookies or authorization headers
}));

// MongoDB connection
const mongoURI = process.env.MONGODB_URI;
mongoose.connect(mongoURI)
    .then(() => console.log("MongoDB connected!"))
    .catch((err) => console.error("Unable to connect: ", err));

// Route handling
app.use("/", mainRouter);

// Socket.io connection handling
let user = "test";
const httpServer = https.createServer(options, app); // Use HTTPS server instead of HTTP
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    }
});

// Socket.io event handling
io.on("connection", (socket) => {
    socket.on("joinRoom", (userID) => {
        user = userID;
        console.log("====");
        console.log(user);
        console.log("=====");
        socket.join(userID);
    });
});

// MongoDB CRUD operations
const db = mongoose.connection;
db.once("open", async () => {
    console.log("CRUD operations called");
});

// Start the HTTPS server
httpServer.listen(port, () => {
    console.log(`HTTPS Server is running on PORT ${port}`);
});

}
