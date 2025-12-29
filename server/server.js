const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Initialize database
const db = new sqlite3.Database('fragmented_narratives.db', (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Connected to database');
  }
});

// Create tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS stories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      object TEXT NOT NULL,
      creator_id INTEGER NOT NULL,
      is_complete BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (creator_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS contributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      story_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      sentence_text TEXT NOT NULL,
      hints TEXT,
      order_num INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (story_id) REFERENCES stories(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pictures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      story_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (story_id) REFERENCES stories(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS story_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      story_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      is_current_turn BOOLEAN DEFAULT 0,
      turn_order INTEGER,
      FOREIGN KEY (story_id) REFERENCES stories(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(story_id, user_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS opening_sentences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sentence_text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert opening sentences if table is empty
  db.get('SELECT COUNT(*) as count FROM opening_sentences', [], (err, row) => {
    if (!err && row.count === 0) {
      const openingSentences = [
        "During the meeting, someone changed the agenda without telling anyone.",
        "A mug appeared on the desk that nobody remembered bringing.",
        "Someone clapped once in the library and then froze.",
        "A sticky note was found on the door with no signature.",
        "A message was sent to the group chat and immediately deleted.",
        "Everyone realized at the same time that they had misunderstood the plan.",
        "A name was called out that didn't belong to anyone present.",
        "The apology came too late to fix anything.",
        "An announcement played twice, each time slightly different.",
        "The instructions contradicted themselves halfway through.",
        "The lights flickered once and then behaved normally again.",
        "A sound repeated itself every few minutes.",
        "The note said the same thing it always did, but it felt wrong this time.",
        "The room felt smaller after the door closed.",
        "A warning was issued without any details.",
        "The clock was correct, but nobody trusted it."
      ];

      const stmt = db.prepare('INSERT INTO opening_sentences (sentence_text) VALUES (?)');
      openingSentences.forEach(sentence => stmt.run(sentence));
      stmt.finalize();
      console.log('Opening sentences initialized');
    }
  });
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../')));

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    // Check if user exists
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, existingUser) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
      }

      // Hash password
      const password_hash = await bcrypt.hash(password, 10);

      // Insert user
      db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, password_hash], function(err) {
        if (err) {
          return res.status(500).json({ message: 'Error creating user' });
        }
        
        res.status(201).json({ 
          message: 'User registered successfully',
          userId: this.lastID 
        });
      });
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    // Find user
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Check password
      const validPassword = await bcrypt.compare(password, user.password_hash);

      if (!validPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Generate token
      const token = jwt.sign(
        { userId: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        message: 'Login successful',
        userId: user.id,
        username: user.username,
        token
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Story Routes
app.post('/api/stories', authenticateToken, (req, res) => {
  const { object, sentence } = req.body;
  const userId = req.user.userId;

  // Create story
  db.run('INSERT INTO stories (object, creator_id) VALUES (?, ?)', [object, userId], function(err) {
    if (err) {
      return res.status(500).json({ message: 'Error creating story' });
    }
    
    const storyId = this.lastID;

    // Add first contribution
    db.run('INSERT INTO contributions (story_id, user_id, sentence_text, order_num) VALUES (?, ?, ?, ?)', 
      [storyId, userId, sentence, 1], (err) => {
      if (err) {
        return res.status(500).json({ message: 'Error adding contribution' });
      }

      // Add creator as participant
      db.run('INSERT INTO story_participants (story_id, user_id, turn_order) VALUES (?, ?, ?)', 
        [storyId, userId, 1], (err) => {
        if (err) {
          return res.status(500).json({ message: 'Error adding participant' });
        }

        res.status(201).json({
          message: 'Story created successfully',
          storyId
        });
      });
    });
  });
});

app.get('/api/stories/available', authenticateToken, (req, res) => {
  const userId = req.user.userId;

  // Get stories where user is a participant but not complete
  db.all(`
    SELECT s.*, u.username as creator_username,
           COUNT(c.id) as contribution_count
    FROM stories s
    JOIN users u ON s.creator_id = u.id
    JOIN story_participants sp ON s.id = sp.story_id
    LEFT JOIN contributions c ON s.id = c.story_id
    WHERE sp.user_id = ? AND s.is_complete = 0
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `, [userId], (err, stories) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching stories' });
    }
    res.json({ stories });
  });
});

app.get('/api/stories/:id', authenticateToken, (req, res) => {
  const storyId = req.params.id;

  db.get(`
    SELECT s.*, u.username as creator_username
    FROM stories s
    JOIN users u ON s.creator_id = u.id
    WHERE s.id = ?
  `, [storyId], (err, story) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching story' });
    }

    if (!story) {
      return res.status(404).json({ message: 'Story not found' });
    }

    db.all(`
      SELECT c.*, u.username
      FROM contributions c
      JOIN users u ON c.user_id = u.id
      WHERE c.story_id = ?
      ORDER BY c.order_num ASC
    `, [storyId], (err, contributions) => {
      if (err) {
        return res.status(500).json({ message: 'Error fetching contributions' });
      }

      res.json({ story, contributions });
    });
  });
});

app.get('/api/users/history', authenticateToken, (req, res) => {
  const userId = req.user.userId;

  db.all(`
    SELECT DISTINCT s.*, u.username as creator_username,
           COUNT(c.id) as contribution_count
    FROM stories s
    JOIN users u ON s.creator_id = u.id
    JOIN contributions c ON s.id = c.story_id
    WHERE s.is_complete = 1 
      AND (s.creator_id = ? OR c.user_id = ?)
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `, [userId, userId], (err, stories) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching history' });
    }
    res.json({ stories });
  });
});

app.get('/api/users', authenticateToken, (req, res) => {
  db.all('SELECT id, username FROM users ORDER BY username', [], (err, users) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching users' });
    }
    res.json({ users });
  });
});

app.get('/api/opening-sentence/random', authenticateToken, (req, res) => {
  db.get('SELECT * FROM opening_sentences ORDER BY RANDOM() LIMIT 1', [], (err, sentence) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching opening sentence' });
    }
    if (!sentence) {
      return res.status(404).json({ message: 'No opening sentences available' });
    }
    res.json({ sentence: sentence.sentence_text });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
