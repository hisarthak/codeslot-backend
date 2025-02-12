const fs = require("fs").promises;
const path = require("path");

async function commitLogs() {
  const chalk = await import("chalk"); // Dynamically import chalk
  const repoPath = path.resolve(process.cwd(), ".myGit", "commitLogs.json");

  try {
    const data = await fs.readFile(repoPath, "utf-8");
    const commits = JSON.parse(data);

    console.log(chalk.default.yellow("Commit IDs:")); // Use `chalk.default`
    commits.forEach((commit) => console.log(chalk.default.yellow(commit.commitID)));
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error(chalk.default.red("No commitLogs.json found. Make a commit first."));
    } else {
      console.error(chalk.default.red("Error reading commitLogs.json:", err.message));
    }
  }
}

module.exports = { commitLogs };
