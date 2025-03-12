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

const agent = new https.Agent({  
  rejectUnauthorized: false
});

dotenv.config();

yargs(hideBin(process.argv))
.scriptName("slot")
.command("start", "Start a new server", {}, startServer)
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
