const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('fragmented_narratives.db');

console.log('\n=== USERS ===');
db.all('SELECT id, username, created_at FROM users', [], (err, rows) => {
  if (err) {
    console.error(err);
    return;
  }
  if (rows.length === 0) {
    console.log('No users found in database');
  } else {
    rows.forEach(row => {
      console.log(`ID: ${row.id}, Username: ${row.username}, Created: ${row.created_at}`);
    });
  }
  
  console.log('\n=== STORIES ===');
  db.all('SELECT id, title, object, creator_id, is_complete FROM stories', [], (err, rows) => {
    if (err) {
      console.error(err);
      return;
    }
    if (rows.length === 0) {
      console.log('No stories found in database');
    } else {
      rows.forEach(row => {
        console.log(`ID: ${row.id}, Title: ${row.title || 'Untitled'}, Object: ${row.object}, Creator: ${row.creator_id}, Complete: ${row.is_complete}`);
      });
    }
    
    db.close();
  });
});
