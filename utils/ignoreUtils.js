const fs = require('fs').promises;
const path = require('path');

// Function to load .slotignore file
const loadSlotIgnore = async (ignoreFilePath) => {
  try {
    const data = await fs.readFile(ignoreFilePath, 'utf-8');
    return data
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#')); // Remove empty lines and comments
  } catch (err) {
    console.error('Error reading .slotignore file', err);
    return [];
  }
};

module.exports = { loadSlotIgnore };
