const handleFileClick = async (filePath, commitID) => {
  try {
    setIsFileClicked(true); // Mark that a file was clicked
    setIsFileLoading(true); // Start loading file content
    setFilePath(filePath);

    const fixedPath = filePath.replace(/\\/g, "/"); // Replace all backslashes with forward slashes
    let encodedPath = encodeURIComponent(fixedPath); // Encode the path

    // If commitID is provided, find the file and append query params
    if (commitID && originalData) {
      const dataArray = Object.values(originalData);
      const fileDetails = dataArray.find(
        (item) => item.path === filePath && item.commit_id === commitID
      );

      if (fileDetails) {
        const { id: inode } = fileDetails;
        encodedPath = `${encodedPath}/?commit=${encodeURIComponent(commitID)}&inode=${encodeURIComponent(inode)}`;
      } else {
        console.error("File with the specified commitID not found");
      }
    }

    const response = await axios.get(
      `https://gitspace.duckdns.org:3002/repo/user/details/codeslot%2Fcodeslot/file/${encodedPath}`
    );

    setIsFileLoading(false); // Stop loading
    console.log(response);
    setFileContent(response.data.content || "File is empty");
  } catch (error) {
    console.error("Error fetching file content:", error);
    setIsFileLoading(false);
    setFileContent("");
  }
};
