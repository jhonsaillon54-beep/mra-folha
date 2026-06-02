const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

router.get('/', async (req, res) => {
  try {
    const { funcionario_id } = req.query;
    let sql = `SELECT f.*, func.nome as funcionario_nome
               FROM faltas f JOIN funcionarios func ON func.id = f.funcionario_id`;
    const params = [];
    if (funcionario_id) { sql += ' WHERE f.funcionario_id = $1'; params.push(funcionario_id); }
    sql += ' ORDER BY f.data DESC';
    const { rows } = await db.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch(e) { res.status(500).json({ ok: false, erro: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { funcionario_id, data, tipo, justificativa, foto_atestado } = req.body;
    if (!funcionario_id || !data || !tipo || !justificativa)
      return res.status(400).json({ ok: false, erro: 'Preencha todos os campos.' });

    const { rows: f } = await db.query('SELECT id FROM funcionarios WHERE id = $1', [funcionario_id]);
    if (!f.length) return res.status(404).json({ ok: false, erro: 'Funcionário não encontrado.' });

    const { rows } = await db.query(
      'INSERT INTO faltas (funcionario_id, data, tipo, justificativa, foto_atestado) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [funcionario_id, data, tipo, justificativa, foto_atestado||'']
    );
    const { rows: nova } = await db.query(
      `SELECT f.*, func.nome as funcionario_nome
       FROM faltas f JOIN funcionarios func ON func.id = f.funcionario_id WHERE f.id = $1`,
      [rows[0].id]
    );
    res.json({ ok: true, data: nova[0] });
  } catch(e) { res.status(500).json({ ok: false, erro: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id FROM faltas WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ ok: false, erro: 'Falta não encontrada.' });
    await db.query('DELETE FROM faltas WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ ok: false, erro: e.message }); }
});

module.exports = router;