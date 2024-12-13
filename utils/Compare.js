async function addModifiedOrLogs() {
  const slotIgnoreFile = path.join(process.cwd(), ".slotignore");
  const repoPath = path.resolve(process.cwd(), ".slot");
  const snapshotFile = path.join(repoPath, "oldSnapshot.json");
  const stagingDir = path.join(repoPath, "staging");


  kfjdf
  try {
    



    const ignorePatterns = await loadSlotIgnore(slotIgnoreFile);
    const snapshot = JSON.parse(await fs.readFile(snapshotFile, "utf-8"));

    await handleDeletedFiles(snapshot, stagingDir, slotIgnoreFile);

    async function processDirectory(currentDir) {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.resolve(currentDir, entry.name);

 // Skip ignored directories early
 if (entry.isDirectory() && await isFileIgnored(entryPath, ignorePatterns)) {
  continue; // Skip further processing for this directory
}
        if (await isFileIgnored(entryPath, ignorePatterns)) {
          continue;
        }

        const relativePath = path.relative(process.cwd(), entryPath);
        const uniqueId = generateUniqueId(relativePath);

        if (entry.isDirectory()) {
          const stagingDirPath = path.join(stagingDir, relativePath);
          await fs.mkdir(stagingDirPath, { recursive: true });
          snapshot[relativePath] = { id: uniqueId, name: entry.name, type: "folder" };

          await processDirectory(entryPath);
        } else {
          const fileHash = await calculateFileHash(entryPath);
          const oldFileSnapshot = snapshot[relativePath];

          if (oldFileSnapshot && oldFileSnapshot.id === uniqueId && oldFileSnapshot.hash === fileHash) {
            continue;
          }

          const stagingFilePath = path.join(stagingDir, relativePath);
          await fs.copyFile(entryPath, stagingFilePath);

          snapshot[relativePath] = { id: uniqueId, name: entry.name, hash: fileHash, type: "file" };
        }
      }
    }

    await processDirectory(process.cwd());

    await fs.writeFile(path.join(repoPath, "newSnapshot.json"), JSON.stringify(snapshot, null, 2));
    await fs.writeFile(snapshotFile, JSON.stringify(snapshot, null, 2));

    console.log("Operation complete");
  } catch (err) {
    // console.error("Error adding files or folders to repo", err);
    console.error("Error");
  }
}