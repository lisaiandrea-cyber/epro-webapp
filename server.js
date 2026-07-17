require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// 1. INIZIALIZZAZIONE FIREBASE ADMIN
// Usa le variabili d'ambiente per proteggere le chiavi segrete su Render
try {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Risolve il problema dei ritorni a capo (\n) nella chiave privata di Firebase
      privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
    })
  });
  console.log("Firebase Admin inizializzato correttamente.");
} catch (error) {
  console.error("Errore inizializzazione Firebase Admin. Controlla le variabili .env:", error.message);
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database dei token per le notifiche push (salvato in memoria per semplicità)
let pushTokens = [];

// Helper per leggere/scrivere il file data.json
const readData = () => {
  if (!fs.existsSync(DATA_FILE)) {
    // Dati di default se il file non esiste
    const defaultData = { themeColor: '#E61E2B', matches: [], news: [], roster: [], standings: [], stats: [] };
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
};

const writeData = (data) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
};

// Configurazione Caricamento Immagini (Multer)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// ================= API ROTTE UTENTI & DATI =================

// Ottieni tutti i dati pubblici dell'app
app.get('/api/data', (req, res) => {
  res.json(readData());
});

// Middleware per verificare se l'utente è autenticato tramite Firebase
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Accesso non autorizzato. Token mancante.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Token non valido o scaduto.' });
  }
}

// Verifica lo stato dell'utente e se è l'Admin
app.get('/api/auth/verify', verifyToken, (req, res) => {
  // Definisci qui l'email dell'amministratore principale dell'app
  const adminEmail = "admin@epro.com"; 
  const isAdmin = req.user.email === adminEmail;
  
  res.json({
    email: req.user.email,
    isAdmin: isAdmin,
    notifications: true
  });
});

// Registra un dispositivo per ricevere le notifiche push (Token FCM)
app.post('/api/user/subscribe', verifyToken, (req, res) => {
  const { pushToken } = req.body;
  if (pushToken && !pushTokens.includes(pushToken)) {
    pushTokens.push(pushToken);
    console.log(`Nuovo dispositivo registrato per le notifiche. Totale: ${pushTokens.length}`);
  }
  res.json({ success: true });
});

// Funzione Helper per inviare notifiche push a tutti i dispositivi registrati
function sendPushNotification(title, body) {
  if (pushTokens.length === 0) {
    console.log("Nessun dispositivo registrato. Notifica non inviata.");
    return;
  }

  const message = {
    notification: { title, body },
    tokens: pushTokens,
  };

  admin.messaging().sendEachForMulticast(message)
    .then((response) => {
      console.log(`Notifica inviata con successo a ${response.successCount} dispositivi.`);
    })
    .catch((error) => {
      console.error("Errore nell'invio delle notifiche push:", error);
    });
}

// ================= API PANNELLO ADMIN (Scrittura) =================

// Aggiorna Colore Tema
app.post('/api/admin/theme', (req, res) => {
  const { color } = req.body;
  const db = readData();
  db.themeColor = color;
  writeData(db);
  res.json({ success: true });
});

// Aggiungi Partita (Invia notifica automatica se terminata)
app.post('/api/admin/match', (req, res) => {
  const db = readData();
  const newMatch = { id: Date.now(), ...req.body };
  db.matches.push(newMatch);
  writeData(db);

  if (newMatch.status === 'Terminata') {
    sendPushNotification(
      'Risultato Finale! 🏀', 
      `U17 ePRO contro ${newMatch.opponent}. Punteggio: ${newMatch.score}`
    );
  } else {
    sendPushNotification(
      'Nuova partita in programma! 🗓️',
      `Saremo in campo contro ${newMatch.opponent} il ${newMatch.date} alle ore ${newMatch.time}`
    );
  }

  res.json({ success: true, matches: db.matches });
});

// Aggiungi Notizia (Invia notifica automatica)
app.post('/api/admin/news', (req, res) => {
  const db = readData();
  const newNews = { id: Date.now(), date: new Date().toLocaleDateString('it-IT'), ...req.body };
  db.news.unshift(newNews); // Metti l'ultima notizia in cima
  writeData(db);

  sendPushNotification(
    'Nuovo comunicato ePRO! 📢', 
    newNews.title
  );

  res.json({ success: true, news: db.news });
});

// Caricamento Immagine Roster/News
app.post('/api/admin/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nessun file caricato' });
  res.json({ imageUrl: `/uploads/${req.file.filename}` });
});

// Aggiungi al Roster
app.post('/api/admin/roster', (req, res) => {
  const db = readData();
  const newMember = { id: Date.now(), ...req.body };
  db.roster.push(newMember);
  writeData(db);
  res.json({ success: true, roster: db.roster });
});

// Rimuovi dal Roster
app.delete('/api/admin/roster/:id', (req, res) => {
  const db = readData();
  db.roster = db.roster.filter(r => r.id != req.params.id);
  writeData(db);
  res.json({ success: true, roster: db.roster });
});

// Aggiungi Squadra in Classifica
app.post('/api/admin/standings', (req, res) => {
  const db = readData();
  const newTeam = { id: Date.now(), ...req.body };
  db.standings.push(newTeam);
  writeData(db);
  res.json({ success: true, standings: db.standings });
});

// Rimuovi Squadra dalla Classifica
app.delete('/api/admin/standings/:id', (req, res) => {
  const db = readData();
  db.standings = db.standings.filter(s => s.id != req.params.id);
  writeData(db);
  res.json({ success: true, standings: db.standings });
});

// Salva Statistica Giocatore
app.post('/api/admin/stats', (req, res) => {
  const db = readData();
  const newStat = { id: Date.now(), ...req.body };
  db.stats.push(newStat);
  writeData(db);
  res.json({ success: true, stats: db.stats });
});

// Rimuovi Statistica Giocatore
app.delete('/api/admin/stats/:id', (req, res) => {
  const db = readData();
  db.stats = db.stats.filter(s => s.id != req.params.id);
  writeData(db);
  res.json({ success: true, stats: db.stats });
});

// Avvia il server
app.listen(PORT, () => {
  console.log(`Server attivo sulla porta http://localhost:${PORT}`);
});