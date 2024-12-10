const fs = require('fs').promises;
const path = require('path');

// Function to load a snapshot from a file
const loadSnapshot = async (snapshotFilePath) => {
  try {
    const data = await fs.readFile(snapshotFilePath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading snapshot file', err);
    return {};
  }
};

// Function to save snapshot to a file
const saveSnapshot = async (snapshot, snapshotFilePath) => {
  try {
    await fs.writeFile(snapshotFilePath, JSON.stringify(snapshot, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving snapshot file', err);
  }
};

module.exports = { loadSnapshot, saveSnapshot };

