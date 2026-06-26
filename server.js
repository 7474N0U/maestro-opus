const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const credsPath = path.join(__dirname, 'credentials.json');
const dbPath = path.join(__dirname, 'database.sqlite');

// create credentials.json if missing
if (!fs.existsSync(credsPath)) {
  const hash = bcrypt.hashSync('password', 10);
  fs.writeFileSync(credsPath, JSON.stringify([{ username: 'admin', password: hash }], null, 2), 'utf8');
}

const db = new sqlite3.Database(dbPath); // creates db if missing

// initialize db
db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, name TEXT DEFAULT 'Workspace 1', color TEXT DEFAULT '#111111', widgets TEXT)");
  
  // migrate existing table
  db.all("PRAGMA table_info(state)", (err, rows) => {
    if (rows) {
      if (!rows.find(r => r.name === 'name')) {
        db.run("ALTER TABLE state ADD COLUMN name TEXT DEFAULT 'Workspace 1'");
      }
      if (!rows.find(r => r.name === 'color')) {
        db.run("ALTER TABLE state ADD COLUMN color TEXT DEFAULT '#111111'");
      }
    }
  });
  
  // seed initial data if state is empty
  db.get("SELECT count(*) as count FROM state", (err, row) => {
    if (row && row.count === 0) {
      const stmt = db.prepare("INSERT INTO state (id, name, color, widgets) VALUES (1, 'Workspace 1', '#111111', ?)");
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

// migrate passwords on startup
(function migratePasswords() {
  const users = readCredentials();
  let modified = false;
  users.forEach(u => {
    if (!u.password.startsWith('$2b$') && !u.password.startsWith('$2a$')) {
      u.password = bcrypt.hashSync(u.password, 10);
      modified = true;
    }
  });
  if (modified) {
    saveCredentials(users);
  }
})();

// login api
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = readCredentials();

  if (users.length === 0) return res.status(400).json({ success: false, message: 'No users found, please create one first' });

  const userMatch = users.find(u => u.username === username);
  if (userMatch && bcrypt.compareSync(password, userMatch.password)) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'invalid credentials' });
  }
});

// get workspaces
app.get('/api/workspaces', (req, res) => {
  db.all("SELECT id, name, color FROM state", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// create workspace
app.post('/api/workspaces', (req, res) => {
  const name = req.body.name || "Nouveau espace";
  const color = req.body.color || "#111111";
  const stmt = db.prepare("INSERT INTO state (name, color, widgets) VALUES (?, ?, ?)");
  stmt.run(name, color, JSON.stringify([]), function(err) {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, id: this.lastID, name: name, color: color });
  });
  stmt.finalize();
});

// edit workspace
app.put('/api/workspaces/:id', (req, res) => {
  const id = req.params.id;
  const name = req.body.name;
  const color = req.body.color;
  
  if (!name && !color) return res.status(400).json({ error: "name or color is required" });
  
  let updates = [];
  let params = [];
  if (name) { updates.push("name = ?"); params.push(name); }
  if (color) { updates.push("color = ?"); params.push(color); }
  params.push(id);
  
  const stmt = db.prepare(`UPDATE state SET ${updates.join(', ')} WHERE id = ?`);
  stmt.run(...params, function(err) {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true });
  });
  stmt.finalize();
});

// get widgets for a workspace
app.get('/api/workspaces/:id/widgets', (req, res) => {
  const id = req.params.id;
  db.get("SELECT widgets FROM state WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    try {
      res.json(row && row.widgets ? JSON.parse(row.widgets) : []);
    } catch (e) {
      res.json([]);
    }
  });
});

// save widgets for a workspace
app.post('/api/workspaces/:id/widgets', (req, res) => {
  const id = req.params.id;
  const widgets = req.body;
  const stmt = db.prepare("UPDATE state SET widgets = ? WHERE id = ?");
  stmt.run(JSON.stringify(widgets), id, function(err) {
    if (err) return res.status(500).json({ success: false, error: err.message });
    if (this.changes === 0) {
       db.run("INSERT INTO state (id, name, color, widgets) VALUES (?, 'Workspace', '#111111', ?)", [id, JSON.stringify(widgets)], err => {
           if (err) res.status(500).json({ success: false, error: err.message });
           else res.json({ success: true });
       });
    } else {
        res.json({ success: true });
    }
  });
  stmt.finalize();
});

// reset workspace and backup
app.post('/api/workspaces/:id/reset', (req, res) => {
  const id = req.params.id;
  db.get("SELECT widgets FROM state WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Create backup
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(__dirname, `backup-workspace-${id}-${dateStr}.json`);
    fs.writeFileSync(backupPath, row && row.widgets ? row.widgets : "[]", 'utf8');
    
    // Reset DB
    const stmt = db.prepare("UPDATE state SET widgets = '[]' WHERE id = ?");
    stmt.run(id, function(err) {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true });
    });
    stmt.finalize();
  });
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

  const hash = bcrypt.hashSync(password, 10);
  users.push({ username, password: hash });
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
