const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// 1. Configurazione della porta e della password sicura
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'adminpassword';

const DB_FILE = path.join(__dirname, 'db.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// 2. Inizializza il file db.json se non esiste ancora
if (!fs.existsSync(DB_FILE)) {
  const initialData = {
    matches: [],
    news: [],
    roster: [],
    themeColor: '#f97316'
  };
  fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
}

// 3. Assicurati che la cartella 'uploads' esista per salvare le immagini
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

// 4. Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR)); // Serve pubblicamente le immagini caricate

// 5. Configurazione Multer per il salvataggio dei file immagine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Helper per leggere e scrivere sul file db.json
function readDatabase() {
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDatabase(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ================= ROTTE API =================

// Carica tutti i dati all'avvio dell'app
app.get('/api/data', (req, res) => {
  res.json(readDatabase());
});

// Rotta per il Login dell'Amministratore (Verifica Sicura)
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (email === 'admin@epro.com' && password === ADMIN_PASSWORD) {
    return res.json({ email, isAdmin: true, notifications: false });
  }
  
  res.status(401).json({ error: 'Credenziali non valide' });
});

// Mock per il toggle delle notifiche
app.post('/api/user/notifications', (req, res) => {
  res.json({ success: true });
});

// Rotta Admin: Caricamento Immagine (Roster o News)
app.post('/api/admin/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nessun file caricato' });
  }
  res.json({ imageUrl: `/uploads/${req.file.filename}` });
});

// Rotta Admin: Salva Partita
app.post('/api/admin/match', (req, res) => {
  const data = readDatabase();
  const newMatch = { id: Date.now(), ...req.body };
  data.matches.push(newMatch);
  writeDatabase(data);
  res.json({ success: true, matches: data.matches });
});

// Rotta Admin: Salva Membro del Roster
app.post('/api/admin/roster', (req, res) => {
  const data = readDatabase();
  const newMember = { id: Date.now(), ...req.body };
  data.roster.push(newMember);
  writeDatabase(data);
  res.json({ success: true, roster: data.roster });
});

// Rotta Admin: Elimina Membro del Roster
app.delete('/api/admin/roster/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const data = readDatabase();
  data.roster = data.roster.filter(member => member.id !== id);
  writeDatabase(data);
  res.json({ success: true, roster: data.roster });
});

// Rotta Admin: Pubblica Notizia
app.post('/api/admin/news', (req, res) => {
  const data = readDatabase();
  const newNews = { 
    id: Date.now(), 
    date: new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }), 
    ...req.body 
  };
  data.news.unshift(newNews); // Aggiunge la news in cima alla lista
  writeDatabase(data);
  res.json({ success: true, news: data.news });
});

// Rotta Admin: Salva colore del Tema
app.post('/api/admin/theme', (req, res) => {
  const { color } = req.body;
  const data = readDatabase();
  data.themeColor = color;
  writeDatabase(data);
  res.json({ success: true });
});

// Rotta catch-all per servire l'index.html in caso di ricaricamento pagina
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Avvio del server
app.listen(PORT, () => {
  console.log(`Server ePRO Basket attivo sulla porta ${PORT}`);
});