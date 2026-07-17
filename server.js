const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 5000;

// Configurazione Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rendi pubblica l'intera cartella principale o 'public' per mostrare la TUA app originale
app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, 'public')));

// Inizializzazione Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY; // service_role key

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Errore: SUPABASE_URL o SUPABASE_KEY non configurate su Render.");
}
const supabase = createClient(supabaseUrl, supabaseKey);

// Configurazione caricamento immagini (Multer)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Helper per ottenere l'intero blocco dei dati (come faceva data.json)
async function getFullApplicationData() {
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
    console.error("Errore recupero dati da Supabase:", err);
    return { matches: [], news: [], roster: [], standings: [], stats: [] };
  }
}

// --- ROTTE FRONTEND ---

// Serve la tua vera applicazione (index.html originale)
app.get('/', (req, res) => {
  const publicIndexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(publicIndexPath)) {
    return res.sendFile(publicIndexPath);
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// --- API ENDPOINTS PER IL TUO FRONTEND ---

// Ottieni tutti i dati
app.get('/api/data', async (req, res) => {
  const data = await getFullApplicationData();
  res.json(data);
});

// Gestione Partite (Matches)
app.post('/api/admin/match', async (req, res) => {
  await supabase.from('matches').insert([req.body]);
  const data = await getFullApplicationData();
  res.json({ success: true, matches: data.matches });
});

app.delete('/api/admin/match/:id', async (req, res) => {
  await supabase.from('matches').delete().eq('id', req.params.id);
  const data = await getFullApplicationData();
  res.json({ success: true, matches: data.matches });
});

// Gestione Notizie (News)
app.post('/api/admin/news', upload.single('image'), async (req, res) => {
  const newArticle = {
    title: req.body.title,
    content: req.body.content,
    tag: req.body.tag,
    date: req.body.date || new Date().toISOString().split('T')[0],
    imageUrl: req.file ? `/uploads/${req.file.filename}` : req.body.imageUrl || ''
  };
  await supabase.from('news').insert([newArticle]);
  const data = await getFullApplicationData();
  res.json({ success: true, news: data.news });
});

app.delete('/api/admin/news/:id', async (req, res) => {
  await supabase.from('news').delete().eq('id', req.params.id);
  const data = await getFullApplicationData();
  res.json({ success: true, news: data.news });
});

// Gestione Classifica (Standings)
app.post('/api/admin/standings', async (req, res) => {
  const entry = { team: req.body.team, points: parseInt(req.body.points) || 0 };
  await supabase.from('standings').insert([entry]);
  const data = await getFullApplicationData();
  res.json({ success: true, standings: data.standings });
});

app.delete('/api/admin/standings/:id', async (req, res) => {
  await supabase.from('standings').delete().eq('id', req.params.id);
  const data = await getFullApplicationData();
  res.json({ success: true, standings: data.standings });
});

// Gestione Roster
app.post('/api/admin/roster', upload.single('image'), async (req, res) => {
  const player = {
    name: req.body.name,
    role: req.body.role,
    number: req.body.number,
    category: req.body.category,
    imageUrl: req.file ? `/uploads/${req.file.filename}` : req.body.imageUrl || ''
  };
  await supabase.from('roster').insert([player]);
  const data = await getFullApplicationData();
  res.json({ success: true, roster: data.roster });
});

app.delete('/api/admin/roster/:id', async (req, res) => {
  await supabase.from('roster').delete().eq('id', req.params.id);
  const data = await getFullApplicationData();
  res.json({ success: true, roster: data.roster });
});

// Gestione Statistiche (Stats)
app.post('/api/admin/stats', async (req, res) => {
  const stat = {
    name: req.body.name,
    games: parseInt(req.body.games) || 0,
    totalPoints: parseInt(req.body.totalPoints) || 0
  };
  await supabase.from('stats').insert([stat]);
  const data = await getFullApplicationData();
  res.json({ success: true, stats: data.stats });
});

app.delete('/api/admin/stats/:id', async (req, res) => {
  await supabase.from('stats').delete().eq('id', req.params.id);
  const data = await getFullApplicationData();
  res.json({ success: true, stats: data.stats });
});

// Fallback per qualsiasi rotta frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server in ascolto sulla porta ${PORT}`);
});