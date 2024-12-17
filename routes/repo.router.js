const express = require("express");
const repoController = require("../controllers/repoController");

const repoRouter = express.Router();

repoRouter.post("/repo/create", repoController.createRepository);
repoRouter.get("/repo/all", repoController.getAllRepositories);

// Specific routes first
repoRouter.get("/repo/name/:name", repoController.fetchRepositoryByName);
repoRouter.get("/repo/user/details/:reponame", repoController.repoFolderStructure);
repoRouter.get("/repo/user/:userID", repoController.fetchRepositoriesForCurrentUser);

// General routes last
repoRouter.get("/repo/:id", repoController.fetchRepositoryById);

repoRouter.put("/repo/update/:id", repoController.updateRepositoryById);
repoRouter.delete("/repo/delete/:id", repoController.deleteRepositoryById);
repoRouter.patch("/repo/toggle/:id", repoController.toggleVisibilityById);




module.exports = repoRouter;
