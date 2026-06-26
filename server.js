const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const credsPath = path.join(__dirname, 'credentials.json');
const dbPath = path.join(__dirname, 'database.sqlite');

// create credentials.json if missing
if (!fs.existsSync(credsPath)) {
  fs.writeFileSync(credsPath, JSON.stringify([{ username: 'admin', password: 'password' }], null, 2), 'utf8');
}

const db = new sqlite3.Database(dbPath); // creates db if missing

// initialize db
db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, widgets TEXT)");
  
  // seed initial data if state is empty
  db.get("SELECT count(*) as count FROM state", (err, row) => {
    if (row && row.count === 0) {
      const stmt = db.prepare("INSERT INTO state (id, widgets) VALUES (1, ?)");
      stmt.run(JSON.stringify([]));
      stmt.finalize();
    }
  });
});

// read credentials
function readCredentials() {
  try {
    const data = fs.readFileSync(credsPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    // fallback if file missing or invalid
    return [];
  }
}

// save credentials
function saveCredentials(users) {
  fs.writeFileSync(credsPath, JSON.stringify(users, null, 2), 'utf8');
}

// login api
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = readCredentials();

  if (readCredentials().length === 0) return res.status(400).json({ success: false, message: 'No users found, please create one first' });

  const userMatch = users.find(u => u.username === username && u.password === password);
  if (userMatch) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'invalid credentials' });
  }
});

// get widgets
app.get('/api/widgets', (req, res) => {
  db.get("SELECT widgets FROM state WHERE id = 1", (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    try {
      res.json(row && row.widgets ? JSON.parse(row.widgets) : []);
    } catch (e) {
      res.json([]);
    }
  });
});

// save widgets
app.post('/api/widgets', (req, res) => {
  const widgets = req.body;
  const stmt = db.prepare("UPDATE state SET widgets = ? WHERE id = 1");
  stmt.run(JSON.stringify(widgets), function(err) {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
      return;
    }
    if (this.changes === 0) {
        db.run("INSERT INTO state (id, widgets) VALUES (1, ?)", JSON.stringify(widgets), err => {
            if(err) {
                res.status(500).json({ success: false, error: err.message });
            } else {
                res.json({ success: true });
            }
        });
    } else {
        res.json({ success: true });
    }
  });
  stmt.finalize();
});

// get members (users)
app.get('/api/members', (req, res) => {
  const users = readCredentials();
  // only send usernames, not passwords
  const members = users.map(u => ({ username: u.username }));
  res.json(members);
});

// add member (user)
app.post('/api/members', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "username and password required" });

  const users = readCredentials();
  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: "user already exists" });
  }

  users.push({ username, password });
  saveCredentials(users);
  
  res.json({ success: true, username });
});

// delete member (user)
app.delete('/api/members/:username', (req, res) => {
  const username = req.params.username;
  let users = readCredentials();
  
  // ensure at least one user remains
  if (users.length <= 1) {
    return res.status(400).json({ error: "cannot delete the last user" });
  }

  users = users.filter(u => u.username !== username);
  saveCredentials(users);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`server running on port ${PORT}`);
});
