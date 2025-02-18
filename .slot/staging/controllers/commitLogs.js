const fs = require("fs").promises;
const path = require("path");

async function commitLogs() {
  const chalk = await import("chalk"); // Dynamically import chalk
  const repoPath = path.resolve(process.cwd(), ".slot", "logs.json");

  try {
    const data = await fs.readFile(repoPath, "utf-8");
    const commits = JSON.parse(data);

    console.log(chalk.default.magenta.bold("Commit Logs(Newest to Oldest):")); // Use `chalk.default`
    commits.forEach((commit) => {
      const commitDate = new Date(commit.date);

const formattedDate = commitDate.toLocaleString("en-US", {
  weekday: "short",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  year: "numeric",
  timeZone: "Asia/Kolkata",
  hour12: false,
});


      console.log(chalk.default.yellow("commit ",commit.commitID))
      console.log(chalk.default.blueBright("Date:", formattedDate, "+0530"));
      console.log(chalk.default.blueBright("Message: ", commit.message));
      
    });
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error(chalk.default.red("No commitLogs.json found. Make a commit first."));
    } else {
      console.error(chalk.default.red("Error reading commitLogs.json:", err.message));
    }
  }
}

module.exports = { commitLogs };
