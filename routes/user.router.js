const express = require("express");
const userController = require("../controllers/userController");

const userRouter = express.Router();

userRouter.get("/allUsers", userController.getAllUsers);
userRouter.post("/signup", userController.signup);
userRouter.post("/login", userController.login);
userRouter.post("/verifyToken", userController.verifyToken);
userRouter.get("/userProfile/:username", userController.getUserProfile);
userRouter.put("/updateProfile/:id", userController.updateUserProfile);
userRouter.delete("/deleteProfile/:id", userController.deleteUserProfile);

// New route for starring or following repositories or users
userRouter.get("/starProfile/:username/:reponame", userController.starOrFollow);
userRouter.get("/followProfile/:id", userController.followOrUnfollowUser);


module.exports = userRouter;
