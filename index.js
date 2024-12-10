#!/usr/bin/env node


// Suppress AWS SDK v2 maintenance mode warning
const originalEmitWarning = process.emitWarning;

process.emitWarning = (warning, ...args) => {
    if (warning.includes("The AWS SDK for JavaScript (v2) is in maintenance mode")) {
        return; // Suppress this specific warning
    }
    originalEmitWarning(warning, ...args); // Allow other warnings
};


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
const { addFileToRepo, addModifiedOrLogs } = require("./controllers/addController");
const { commitRepo } = require("./controllers/commit.js");
const { pushRepo } = require("./controllers/push");
const { pullRepo } = require("./controllers/pull");
const { revertRepo } = require("./controllers/revert");
const {addRemote, removeRemote, listRemote} = require("./controllers/remote.js");
const {authenticateUser} = require("./controllers/authenticate.js");

const agent = new https.Agent({  
  rejectUnauthorized: false
});

dotenv.config();

yargs(hideBin(process.argv))
.command("start", "Start a new server", {}, startServer)
.command("init", "Initialise a new repository", {}, initRepo)
  .command(
    "add <file>",
    "Add a file or all modified/new PM2 logs to the repository",
    (yargs) => {
      yargs.positional("file", {
        describe: "File to add to the staging area. Use '.' to add all PM2 logs.",
        type: "string",
      });
    },
    async (argv) => {
      if (argv.file === ".") {
        await addModifiedOrLogs(); 
      } else {
        await addFileToRepo(argv.file); // Add a specific file
      }
    }
  )
    .command(
        "commit",
        "Commit the staged files",
        (yargs) => {
            yargs.option("m", {
                alias: "message",
                describe: "Commit message",
                type: "string",
                demandOption: true, // Makes the -m flag mandatory
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
    (yargs) => {f
        yargs.positional("commitID", {
            describe: "Commit ID to revert to",
            type: "string",
        });
    },
    (argv) => {
        revertRepo(argv.commitID);
    }
)
.command(
    "remote <action> [url]",
    "Manage remotes",
    (yargs) => {
        yargs
            .positional("action", {
                describe: "Action to perform (add, remove, list)",
                type: "string",
                choices: ["add", "remove", "list"],
            })
            .option("url", {
                describe: "URL of the remote repository (required for add)",
                type: "string",
            });
    },
    (argv) => {
        const { action, url } = argv;

        // Handle subcommands based on `action`
        if (action === "add") {
            if (!url) {
                console.error("Error: --url is required for the 'add' action.");
                process.exit(1);
            }
            addRemote(url);
        } else if (action === "remove") {
            removeRemote();
        } else if (action === "list") {
            listRemote();
        } else {
            console.error(`Unknown action: ${action}`);
            process.exit(1);
        }
    }
)
.command(
    "auth",
    "Authenticate with your username and password",
    {},
    async () => {
        try {
            await authenticateUser();
        } catch (err) {
            console.error("Authentication failed.");
            process.exit(1);
        }
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
    key: fs.readFileSync('./privkey.pem'),   // Path to your SSL key
    cert: fs.readFileSync('./fullchain.pem'),  // Path to your SSL certificate
};

// Middleware
app.use(bodyParser.json());
app.use(express.json());
  
app.use(cors({origin: "*", methods: "*"}));

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
httpServer.listen(port, '0.0.0.0', () => {
    console.log(`HTTPS Server is running on PORT ${port}`);
});

}
