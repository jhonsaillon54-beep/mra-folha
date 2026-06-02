const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 5432,
  database: process.env.DB_NAME     || 'folhapay',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '@Jhon2008',
});

async function iniciarBanco() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS funcionarios (
        id           SERIAL PRIMARY KEY,
        nome         TEXT NOT NULL,
        cpf          TEXT NOT NULL UNIQUE,
        cargo        TEXT NOT NULL,
        departamento TEXT DEFAULT '',
        salario      NUMERIC(10,2) NOT NULL,
        admissao     TEXT DEFAULT '',
        rescisao     TEXT DEFAULT '',
        observacoes  TEXT DEFAULT '',
        grat_fixa    INTEGER DEFAULT 1,
        criado_em    TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS gratificacoes (
        id             SERIAL PRIMARY KEY,
        funcionario_id INTEGER NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
        nome           TEXT NOT NULL,
        valor          NUMERIC(10,2) NOT NULL
      );
      CREATE TABLE IF NOT EXISTS faltas (
        id             SERIAL PRIMARY KEY,
        funcionario_id INTEGER NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
        data           TEXT NOT NULL,
        tipo           TEXT NOT NULL DEFAULT 'simples',
        justificativa  TEXT NOT NULL,
        foto_atestado  TEXT DEFAULT '',
        criado_em      TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS vales (
        id             SERIAL PRIMARY KEY,
        funcionario_id INTEGER NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
        mes            TEXT NOT NULL,
        valor          NUMERIC(10,2) NOT NULL,
        observacao     TEXT DEFAULT '',
        data_vale      TEXT DEFAULT '',
        criado_em      TIMESTAMP DEFAULT NOW(),
        UNIQUE(funcionario_id, mes)
      );
    `);
    // Migrações para colunas novas
    await client.query(`ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS rescisao TEXT DEFAULT '';`);
    await client.query(`ALTER TABLE faltas ADD COLUMN IF NOT EXISTS foto_atestado TEXT DEFAULT '';`);
    await client.query(`ALTER TABLE vales ADD COLUMN IF NOT EXISTS data_vale TEXT DEFAULT '';`);

    console.log('  ✅  Banco de dados PostgreSQL conectado!');
  } finally {
    client.release();
  }
}

iniciarBanco().catch(err => {
  console.error('  ❌  Erro ao conectar no banco:', err.message);
  process.exit(1);
});

module.exports = pool;