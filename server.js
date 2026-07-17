const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurazione Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 1. INIZIALIZZAZIONE SUPABASE (con fallback)
// ==========================================
let supabase = null;
const useSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_KEY;

if (useSupabase) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  console.log('🔌 Connesso con successo a Supabase Database!');
} else {
  console.warn('⚠️ Attenzione: Variabili Supabase mancanti. Il server utilizzerà il file JSON locale (data.json).');
}

// Configurazione file locale di fallback (se Supabase non è configurato)
const LOCAL_DATA_FILE = path.join(__dirname, 'data.json');

// Helper per leggere il file locale se Supabase è disattivato
function readLocalData() {
  if (!fs.existsSync(LOCAL_DATA_FILE)) {
    const defaultStructure = { matches: [], news: [], roster: [], standings: [], stats: [] };
    fs.writeFileSync(LOCAL_DATA_FILE, JSON.stringify(defaultStructure, null, 2));
    return defaultStructure;
  }
  return JSON.parse(fs.readFileSync(LOCAL_DATA_FILE, 'utf-8'));
}

// Helper per scrivere sul file locale di fallback
function writeLocalData(data) {
  fs.writeFileSync(LOCAL_DATA_FILE, JSON.stringify(data, null, 2));
}

// ==========================================
// 2. GESTIONE IMMAGINI (MULTER)
// ==========================================
// Configura la cartella di destinazione delle immagini caricate
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
const upload = multer({ storage: storage });

// ==========================================
// 3. FUNZIONI HELPER PER IL RECUPERO DATI
// ==========================================
async function getAllData() {
  if (useSupabase) {
    try {
      const [matches, news, roster, standings, stats] = await Promise.all([
        supabase.from('matches').select('*').order('id', { ascending: true }),
        supabase.from('news').select('*').order('id', { ascending: false }),
        supabase.from('roster').select('*').order('id', { ascending: true }),
        supabase.from('standings').select('*').order('points', { ascending: false }),
        supabase.from('stats').select('*').order('totalPoints', { ascending: false })
      ]);
      
      return {
        matches: matches.data || [],
        news: news.data || [],
        roster: roster.data || [],
        standings: standings.data || [],
        stats: stats.data || []
      };
    } catch (err) {
      console.error('Errore nel caricamento dei dati da Supabase:', err);
      return readLocalData(); // Fallback d'emergenza
    }
  } else {
    return readLocalData();
  }
}

// ==========================================
// 4. API ENDPOINTS (GET ALL)
// ==========================================
app.get('/api/data', async (req, res) => {
  try {
    const data = await getAllData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Impossibile caricare i dati' });
  }
});

// ==========================================
// 5. ENDPOINTS PARTITE (MATCHES)
// ==========================================
app.post('/api/admin/match', async (req, res) => {
  const newMatch = req.body;
  if (useSupabase) {
    const { error } = await supabase.from('matches').insert([newMatch]);
    if (error) return res.status(500).json({ success: false, error: error.message });
  } else {
    const data = readLocalData();
    newMatch.id = Date.now();
    data.matches.push(newMatch);
    writeLocalData(data);
  }
  const updatedData = await getAllData();
  res.json({ success: true, matches: updatedData.matches });
});

app.delete('/api/admin/match/:id', async (req, res) => {
  const { id } = req.params;
  if (useSupabase) {
    const { error } = await supabase.from('matches').delete().eq('id', id);
    if (error) return res.status(500).json({ success: false, error: error.message });
  } else {
    const data = readLocalData();
    data.matches = data.matches.filter(m => m.id != id);
    writeLocalData(data);
  }
  const updatedData = await getAllData();
  res.json({ success: true, matches: updatedData.matches });
});

// ==========================================
// 6. ENDPOINTS NOTIZIE (NEWS)
// ==========================================
app.post('/api/admin/news', upload.single('image'), async (req, res) => {
  const newArticle = {
    title: req.body.title,
    content: req.body.content,
    tag: req.body.tag,
    date: req.body.date || new Date().toISOString().split('T')[0],
    imageUrl: req.file ? `/uploads/${req.file.filename}` : req.body.imageUrl || ''
  };

  if (useSupabase) {
    const { error } = await supabase.from('news').insert([newArticle]);
    if (error) return res.status(500).json({ success: false, error: error.message });
  } else {
    const data = readLocalData();
    newArticle.id = Date.now();
    data.news.push(newArticle);
    writeLocalData(data);
  }
  const updatedData = await getAllData();
  res.json({ success: true, news: updatedData.news });
});

app.delete('/api/admin/news/:id', async (req, res) => {
  const { id } = req.params;
  if (useSupabase) {
    const { error } = await supabase.from('news').delete().eq('id', id);
    if (error) return res.status(500).json({ success: false, error: error.message });
  } else {
    const data = readLocalData();
    data.news = data.news.filter(n => n.id != id);
    writeLocalData(data);
  }
  const updatedData = await getAllData();
  res.json({ success: true, news: updatedData.news });
});

// ==========================================
// 7. ENDPOINTS ROSTER (GIOCATORI)
// ==========================================
app.post('/api/admin/roster', upload.single('image'), async (req, res) => {
  const newPlayer = {
    name: req.body.name,
    role: req.body.role,
    number: req.body.number,
    category: req.body.category,
    imageUrl: req.file ? `/uploads/${req.file.filename}` : req.body.imageUrl || ''
  };

  if (useSupabase) {
    const { error } = await supabase.from('roster').insert([newPlayer]);
    if (error) return res.status(500).json({ success: false, error: error.message });
  } else {
    const data = readLocalData();
    newPlayer.id = Date.now();
    data.roster.push(newPlayer);
    writeLocalData(data);
  }
  const updatedData = await getAllData();
  res.json({ success: true, roster: updatedData.roster });
});

app.delete('/api/admin/roster/:id', async (req, res) => {
  const { id } = req.params;
  if (useSupabase) {
    const { error } = await supabase.from('roster').delete().eq('id', id);
    if (error) return res.status(500).json({ success: false, error: error.message });
  } else {
    const data = readLocalData();
    data.roster = data.roster.filter(p => p.id != id);
    writeLocalData(data);
  }
  const updatedData = await getAllData();
  res.json({ success: true, roster: updatedData.roster });
});

// ==========================================
// 8. ENDPOINTS CLASSIFICA (STANDINGS)
// ==========================================
app.post('/api/admin/standings', async (req, res) => {
  const newStanding = {
    team: req.body.team,
    points: parseInt(req.body.points) || 0
  };

  if (useSupabase) {
    const { error } = await supabase.from('standings').insert([newStanding]);
    if (error) return res.status(500).json({ success: false, error: error.message });
  } else {
    const data = readLocalData();
    newStanding.id = Date.now();
    data.standings.push(newStanding);
    writeLocalData(data);
  }
  const updatedData = await getAllData();
  res.json({ success: true, standings: updatedData.standings });
});

app.delete('/api/admin/standings/:id', async (req, res) => {
  const { id } = req.params;
  if (useSupabase) {
    const { error } = await supabase.from('standings').delete().eq('id', id);
    if (error) return res.status(500).json({ success: false, error: error.message });
  } else {
    const data = readLocalData();
    data.standings = data.standings.filter(s => s.id != id);
    writeLocalData(data);
  }
  const updatedData = await getAllData();
  res.json({ success: true, standings: updatedData.standings });
});

// ==========================================
// 9. ENDPOINTS STATISTICHE (STATS)
// ==========================================
app.post('/api/admin/stats', async (req, res) => {
  const newStat = {
    name: req.body.name,
    games: parseInt(req.body.games) || 0,
    totalPoints: parseInt(req.body.totalPoints) || 0
  };

  if (useSupabase) {
    const { error } = await supabase.from('stats').insert([newStat]);
    if (error) return res.status(500).json({ success: false, error: error.message });
  } else {
    const data = readLocalData();
    newStat.id = Date.now();
    data.stats.push(newStat);
    writeLocalData(data);
  }
  const updatedData = await getAllData();
  res.json({ success: true, stats: updatedData.stats });
});

app.delete('/api/admin/stats/:id', async (req, res) => {
  const { id } = req.params;
  if (useSupabase) {
    const { error } = await supabase.from('stats').delete().eq('id', id);
    if (error) return res.status(500).json({ success: false, error: error.message });
  } else {
    const data = readLocalData();
    data.stats = data.stats.filter(s => s.id != id);
    writeLocalData(data);
  }
  const updatedData = await getAllData();
  res.json({ success: true, stats: updatedData.stats });
});

// ==========================================
// 10. ROTTE FRONTEND GENERALI
// ==========================================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Avvio Server
app.listen(PORT, () => {
  console.log(`🚀 Server in esecuzione sulla porta ${PORT}`);
});