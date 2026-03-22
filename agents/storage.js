const fs = require('fs');
const path = require('path');

const LEARNINGS_FILE = path.join(__dirname, '..', 'learnings.json');

function readLearnings() {
  try {
    if (!fs.existsSync(LEARNINGS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(LEARNINGS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading learnings:', error);
    return [];
  }
}

function saveLearning(learning) {
  try {
    const learnings = readLearnings();
    // Avoid duplicates if possible (simple string check)
    if (!learnings.includes(learning)) {
      learnings.push(learning);
      fs.writeFileSync(LEARNINGS_FILE, JSON.stringify(learnings, null, 2));
    }
  } catch (error) {
    console.error('Error saving learning:', error);
  }
}

module.exports = {
  readLearnings,
  saveLearning
};
