const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/funcionarios', require('./routes/funcionarios'));
app.use('/api/faltas',       require('./routes/faltas'));
app.use('/api/folha',        require('./routes/folha'));
app.use('/api/vales',        require('./routes/vales'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('');
  console.log('  ██████╗ MRA Mochilas e Bolsas ██████╗');
  console.log('');
  console.log(`  ✅  Servidor rodando em: http://localhost:${PORT}`);
  console.log(`  🗄️  Banco: ${process.env.DATABASE_URL ? 'PostgreSQL (Railway)' : 'PostgreSQL (local)'}`);
  console.log('');
});