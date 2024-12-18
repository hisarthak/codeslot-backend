import React, { useState, useEffect } from "react";
import axios from "axios";
import { formatDistanceToNow } from "date-fns";
import "./RepoList.css";

const RepoList = () => {
  const [data, setData] = useState([]); // Current view
  const [originalData, setOriginalData] = useState(null); // Full response data
  const [currentPath, setCurrentPath] = useState(""); // Current folder path
  const [isLoading, setIsLoading] = useState(true);

  // Fetch data when the component mounts and re-fetch every 10 seconds
  useEffect(() => {
    const fetchData = async () => {
      try {
        const repoName = encodeURIComponent("codeslot/codeslot");
        const response = await axios.get(
          `https://gitspace.duckdns.org:3002/repo/user/details/${repoName}`
        );

        setOriginalData(response.data); // Update full data
        updateView(currentPath || ""); // Update view based on current path
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch data initially
    fetchData();

    // Set up periodic polling to refresh data every 10 seconds
    const intervalId = setInterval(fetchData, 10000);

    return () => clearInterval(intervalId); // Cleanup interval on unmount
  }, []); // Empty dependency array to run this only once initially

  // Function to update the view based on the current path
  const updateView = (path) => {
    if (!originalData) return;

    const filteredData = Object.values(originalData)
      .filter(
        (item) =>
          item.path.startsWith(path) &&
          item.path.split("\\").length === (path ? path.split("\\").length + 1 : 1)
      )
      .sort((a, b) => b.droppable - a.droppable); // Sort folders first

    setData(filteredData);
    setCurrentPath(path);
  };

  // Re-run updateView when `originalData` or `currentPath` changes
  useEffect(() => {
    if (originalData) {
      updateView(currentPath || ""); // Trigger updateView when data or path changes
    }
  }, [originalData, currentPath]);

  // Handle folder click
  const handleFolderClick = (folderPath) => {
    updateView(folderPath);
  };

  // Handle going back to the parent folder
  const handleGoBack = () => {
    const parentPath = currentPath.split("\\").slice(0, -1).join("\\");
    updateView(parentPath);
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="repo-list">
      <div className="repo-header">
        <p>
          <i>File Explorer</i>
        </p>
      </div>

      {/* Go Back Button */}
      {currentPath && (
        <button onClick={handleGoBack} style={{ marginBottom: "10px" }}>
          ⬅ Go Back
        </button>
      )}

      <div className="repo-files">
        {data.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Text</th>
                <th>Message</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {data.map((value, index) => (
                <tr key={index}>
                  <td className="repo-item"
                    onClick={() =>
                      value.droppable ? handleFolderClick(value.path) : null
                    }
                    style={{
                      cursor: value.droppable ? "pointer" : "default",
                    }}
                  >
                    <i
                      className={
                        value.droppable
                          ? "fa-solid fa-folder"
                          : "fa-regular fa-file"
                      }
                      style={{ marginRight: "8px" }}
                    ></i>
                    {value.text}
                  </td>
                  <td className="repo-item">{value.message}</td>
                  <td className="repo-item">
                    {value.date
                      ? formatDistanceToNow(new Date(value.date), {
                          addSuffix: true,
                        })
                      : "Date not available"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No files or folders available</p>
        )}
      </div>
    </div>
  );
};

export default RepoList;
