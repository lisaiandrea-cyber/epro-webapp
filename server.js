const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer'); // Per gestire l'upload di immagini
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Cartella pubblica per le immagini

// Crea la cartella uploads se non esiste
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

// Configurazione salvataggio Immagini
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

const DB_FILE = path.join(__dirname, 'db.json');

const defaultData = {
  themeColor: '#f97316', // Arancione di default (HEX)
  users: [
    { email: "admin@epro.com", password: "adminpassword", notifications: true, isAdmin: true }
  ],
  matches: [],
  news: [],
  roster: []
};

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// API: Ottieni configurazione e dati
app.get('/api/data', (req, res) => {
  res.json(readDB());
});

// API: Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const db = readDB();
  let user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (user && user.password !== password) return res.status(401).json({ error: "Password errata" });
  if (!user) {
    user = { email: email.toLowerCase(), password, notifications: false, isAdmin: false };
    db.users.push(user);
    writeDB(db);
  }
  res.json(user);
});

// API: Aggiorna Colore Tema (Stile)
app.post('/api/admin/theme', (req, res) => {
  const { color } = req.body;
  const db = readDB();
  db.themeColor = color;
  writeDB(db);
  res.json({ success: true, themeColor: db.themeColor });
});

// API: Carica Immagine (Ritorna l'URL dell'immagine caricata)
app.post('/api/admin/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Nessun file caricato" });
  res.json({ imageUrl: `/uploads/${req.file.filename}` });
});

// API: Aggiungi Giocatore/Staff al Roster
app.post('/api/admin/roster', (req, res) => {
  const { name, role, number, category, imageUrl } = req.body;
  const db = readDB();
  const newItem = { id: Date.now(), name, role, number: number || null, category, imageUrl: imageUrl || null };
  db.roster.push(newItem);
  writeDB(db);
  res.json({ success: true, roster: db.roster });
});

// API: Elimina elemento Roster
app.delete('/api/admin/roster/:id', (req, res) => {
  const db = readDB();
  db.roster = db.roster.filter(r => r.id !== parseInt(req.params.id));
  writeDB(db);
  res.json({ success: true, roster: db.roster });
});

// API: Aggiungi News
app.post('/api/admin/news', (req, res) => {
  const { title, content, tag, imageUrl } = req.body;
  const db = readDB();
  const newNews = {
    id: Date.now(),
    title, content, tag, imageUrl,
    date: new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
  };
  db.news.unshift(newNews);
  writeDB(db);
  res.json({ success: true, news: db.news });
});

app.listen(PORT, () => console.log(`Server pronto su http://localhost:${PORT}`));