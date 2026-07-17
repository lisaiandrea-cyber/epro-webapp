const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'adminpassword';

const DB_FILE = path.join(__dirname, 'db.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Inizializza db.json con i nuovi campi per classifica e statistiche
if (!fs.existsSync(DB_FILE)) {
  const initialData = {
    matches: [],
    news: [],
    roster: [],
    standings: [
      { id: 1, team: 'AREA PRO', points: 24 },
      { id: 2, team: 'Olimpia Milano', points: 22 },
      { id: 3, team: 'Varese Basket', points: 18 }
    ],
    stats: [
      { id: 1, name: 'M. Rossi', games: 10, totalPoints: 150 }
    ],
    themeColor: '#e11d48' // Rosso (dal logo)
  };
  fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
}

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

const storage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, 'uploads/'); },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

function readDatabase() {
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDatabase(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Caricamento del logo (salva l'immagine caricata come 'logo.png' fissa)
app.post('/api/admin/upload-logo', upload.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nessun file' });
  // Sposta/rinomina il file in public/logo.png per renderlo definitivo
  const targetPath = path.join(__dirname, 'public', 'logo.png');
  fs.renameSync(req.file.path, targetPath);
  res.json({ success: true, logoUrl: '/logo.png' });
});

// GET DATI
app.get('/api/data', (req, res) => {
  const db = readDatabase();
  // Se mancano i nuovi array, li inizializziamo al volo
  if (!db.standings) db.standings = [];
  if (!db.stats) db.stats = [];
  res.json(db);
});

// LOGIN
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if ((email === 'admin@epro.com' || email === 'admin@epro.it') && password === ADMIN_PASSWORD) {
    return res.json({ email, isAdmin: true, notifications: false });
  }
  res.status(401).json({ error: 'Credenziali non valide' });
});

app.post('/api/user/notifications', (req, res) => { res.json({ success: true }); });

// UPLOAD IMMAGINI GENERICO
app.post('/api/admin/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nessun file' });
  res.json({ imageUrl: `/uploads/${req.file.filename}` });
});

// GESTIONE PARTITE
app.post('/api/admin/match', (req, res) => {
  const data = readDatabase();
  const newMatch = { id: Date.now(), ...req.body };
  data.matches.push(newMatch);
  writeDatabase(data);
  res.json({ success: true, matches: data.matches });
});

// GESTIONE ROSTER
app.post('/api/admin/roster', (req, res) => {
  const data = readDatabase();
  const newMember = { id: Date.now(), ...req.body };
  data.roster.push(newMember);
  writeDatabase(data);
  res.json({ success: true, roster: data.roster });
});

app.delete('/api/admin/roster/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const data = readDatabase();
  data.roster = data.roster.filter(m => m.id !== id);
  writeDatabase(data);
  res.json({ success: true, roster: data.roster });
});

// GESTIONE NEWS
app.post('/api/admin/news', (req, res) => {
  const data = readDatabase();
  const newNews = { 
    id: Date.now(), 
    date: new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }), 
    ...req.body 
  };
  data.news.unshift(newNews);
  writeDatabase(data);
  res.json({ success: true, news: data.news });
});

// GESTIONE CLASSIFICA (STANDINGS)
app.post('/api/admin/standings', (req, res) => {
  const data = readDatabase();
  if (!data.standings) data.standings = [];
  const newTeam = { id: Date.now(), team: req.body.team, points: parseInt(req.body.points) };
  data.standings.push(newTeam);
  writeDatabase(data);
  res.json({ success: true, standings: data.standings });
});

app.delete('/api/admin/standings/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const data = readDatabase();
  data.standings = data.standings.filter(t => t.id !== id);
  writeDatabase(data);
  res.json({ success: true, standings: data.standings });
});

// GESTIONE STATISTICHE (STATS)
app.post('/api/admin/stats', (req, res) => {
  const data = readDatabase();
  if (!data.stats) data.stats = [];
  const newStat = { 
    id: Date.now(), 
    name: req.body.name, 
    games: parseInt(req.body.games) || 0, 
    totalPoints: parseInt(req.body.totalPoints) || 0 
  };
  data.stats.push(newStat);
  writeDatabase(data);
  res.json({ success: true, stats: data.stats });
});

app.delete('/api/admin/stats/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const data = readDatabase();
  data.stats = data.stats.filter(s => s.id !== id);
  writeDatabase(data);
  res.json({ success: true, stats: data.stats });
});

// TEMA
app.post('/api/admin/theme', (req, res) => {
  const { color } = req.body;
  const data = readDatabase();
  data.themeColor = color;
  writeDatabase(data);
  res.json({ success: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server ePRO Basket attivo sulla porta ${PORT}`);
});