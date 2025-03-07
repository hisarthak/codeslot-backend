const express = require("express");
const repoController = require("../controllers/repoController");

const repoRouter = express.Router();

// General repository routes
repoRouter.post("/repo/create", repoController.createRepository);
repoRouter.get("/repo/all", repoController.getAllRepositories);
repoRouter.get("/repo/search", repoController.findUsersAndRepositories);

// Specific repository routes
repoRouter.get("/repo/name/:name", repoController.fetchRepositoryByName);
repoRouter.get("/repo/user/:username", repoController.fetchRepositoriesForCurrentUser);
repoRouter.post("/repo/user/dashboard/:userId", repoController.fetchRepositoriesByUserId);

repoRouter.post("/repo/user/url/generate-urls", repoController.generateMultiplePresignedUrls);
repoRouter.post("/repo/user/download/get-url", repoController.generateDownloadUrls);
repoRouter.post("/repo/checkRepositoryAccess", repoController.checkVisibilityByName);
// Details for a specific repository
repoRouter.get("/repo/user/details/:reponame/logs", repoController.fetchLogsFromS3);
repoRouter.get("/repo/user/details/:reponame/file/:filePath", repoController.fetchFileContent); // Changed to explicitly use 'file'
repoRouter.post("/repo/user/details/:reponame", repoController.repoFolderStructure);


// Repository operations by ID
repoRouter.get("/repo/:id", repoController.fetchRepositoryById);
repoRouter.put("/repo/update/:repoName", repoController.updateRepositoryByRepoName);
repoRouter.delete("/repo/delete/:id", repoController.deleteRepositoryById);
repoRouter.patch("/repo/toggle/:id", repoController.toggleVisibilityById);

module.exports = repoRouter;
