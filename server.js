const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Configurazione CORS (Permette al frontend di fare richieste al server su Render)
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Inizializzazione di Supabase tramite Variabili d'Ambiente
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY; // Usa sempre la chiave 'service_role' su Render

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ ERRORE: SUPABASE_URL o SUPABASE_KEY non configurate nelle variabili d'ambiente!");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 3. Esempio di Rotta: Login dell'Admin o verifica credenziali
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Sostituisci "utenti" con il nome esatto della tua tabella su Supabase
    const { data, error } = await supabase
      .from('utenti') 
      .select('*')
      .eq('username', username)
      .eq('password', password) // Se le password non sono criptate, altrimenti usa hash
      .eq('role', 'admin') // Verifica che sia admin
      .single();

    if (error || !data) {
      return res.status(401).json({ success: false, message: 'Credenziali non valide o utente non admin' });
    }

    return res.json({ success: true, user: data });
  } catch (err) {
    console.error("Errore durante il login:", err);
    return res.status(500).json({ success: false, message: 'Errore interno del server' });
  }
});

// 4. Esempio di Rotta: Recupero Dati da Supabase
app.get('/api/dati', async (req, res) => {
  try {
    // Cambia 'i_tuoi_dati' con la tua tabella effettiva
    const { data, error } = await supabase
      .from('i_tuoi_dati') 
      .select('*');

    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    console.error("Errore recupero dati:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Rotta di test iniziale per verificare se il backend risponde
app.get('/', (req, res) => {
  res.send('🚀 Il Server di Render è attivo e funzionante!');
});

// Avvio del server
app.listen(PORT, () => {
  console.log(`Server in ascolto sulla porta ${PORT}`);
});