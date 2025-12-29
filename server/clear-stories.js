const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'fragmented_narratives.db');
const db = new sqlite3.Database(dbPath);

console.log('Clearing stories, contributions, and story_participants tables...');

db.serialize(() => {
  // Clear contributions first (foreign key dependency)
  db.run('DELETE FROM contributions', (err) => {
    if (err) {
      console.error('Error clearing contributions:', err);
    } else {
      console.log('✓ Contributions table cleared');
    }
  });

  // Clear story_participants
  db.run('DELETE FROM story_participants', (err) => {
    if (err) {
      console.error('Error clearing story_participants:', err);
    } else {
      console.log('✓ Story participants table cleared');
    }
  });

  // Clear stories
  db.run('DELETE FROM stories', (err) => {
    if (err) {
      console.error('Error clearing stories:', err);
    } else {
      console.log('✓ Stories table cleared');
    }
  });

  // Close database
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('\nDatabase cleared successfully! Users and opening sentences preserved.');
    }
  });
});
