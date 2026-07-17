const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Inizializzazione Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️ Attenzione: SUPABASE_URL o SUPABASE_KEY non configurate su Render.");
}
const supabase = createClient(supabaseUrl, supabaseKey);

// --- GESTIONE AUTOMATICA DEL FRONTEND (index.html) ---

// 1. Rendi accessibili i file statici (CSS, JS, immagini) sia dalla radice che da 'public'
app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, 'public')));

// 2. Rotta principale: Cerca l'index.html e lo mostra all'utente
app.get('/', (req, res) => {
  // Controlla se index.html è dentro la cartella 'public'
  const publicIndexPath = path.join(__dirname, 'public', 'index.html');
  if (require('fs').existsSync(publicIndexPath)) {
    return res.sendFile(publicIndexPath);
  }
  // Altrimenti lo cerca nella cartella principale
  res.sendFile(path.join(__dirname, 'index.html'));
});

// --- API ENDPOINTS (Adattali alle tue tabelle di Supabase) ---

// Esempio Login Admin
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const { data, error } = await supabase
      .from('utenti') // Assicurati che questa tabella esista su Supabase!
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .single();

    if (error || !data) {
      return res.status(401).json({ success: false, message: 'Credenziali non valide' });
    }
    res.json({ success: true, user: data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Errore del server' });
  }
});

// Avvio Server
app.listen(PORT, () => {
  console.log(`🚀 Server attivo sulla porta ${PORT}`);
});