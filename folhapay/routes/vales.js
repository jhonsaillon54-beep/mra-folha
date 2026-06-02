const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

router.get('/', async (req, res) => {
  try {
    const { mes } = req.query;
    let sql = `SELECT v.*, f.nome as funcionario_nome, f.cargo
               FROM vales v JOIN funcionarios f ON f.id = v.funcionario_id`;
    const params = [];
    if (mes) { sql += ' WHERE v.mes = $1'; params.push(mes); }
    sql += ' ORDER BY f.nome';
    const { rows } = await db.query(sql, params);
    rows.forEach(r => { r.valor = parseFloat(r.valor); });
    res.json({ ok: true, data: rows });
  } catch(e) { res.status(500).json({ ok: false, erro: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { funcionario_id, mes, valor, observacao, data_vale } = req.body;
    if (!funcionario_id || !mes || !valor || valor <= 0)
      return res.status(400).json({ ok: false, erro: 'Campos obrigatórios: funcionario_id, mes, valor.' });

    const { rows: f } = await db.query('SELECT id FROM funcionarios WHERE id = $1', [funcionario_id]);
    if (!f.length) return res.status(404).json({ ok: false, erro: 'Funcionário não encontrado.' });

    const { rows: existe } = await db.query(
      'SELECT id FROM vales WHERE funcionario_id = $1 AND mes = $2', [funcionario_id, mes]
    );

    let atualizado = false;
    if (existe.length) {
      await db.query(
        'UPDATE vales SET valor = $1, observacao = $2, data_vale = $3 WHERE funcionario_id = $4 AND mes = $5',
        [valor, observacao||'', data_vale||'', funcionario_id, mes]
      );
      atualizado = true;
    } else {
      await db.query(
        'INSERT INTO vales (funcionario_id, mes, valor, observacao, data_vale) VALUES ($1,$2,$3,$4,$5)',
        [funcionario_id, mes, valor, observacao||'', data_vale||'']
      );
    }

    const { rows: vale } = await db.query(
      `SELECT v.*, f.nome as funcionario_nome, f.cargo
       FROM vales v JOIN funcionarios f ON f.id = v.funcionario_id
       WHERE v.funcionario_id = $1 AND v.mes = $2`, [funcionario_id, mes]
    );
    vale[0].valor = parseFloat(vale[0].valor);
    res.json({ ok: true, data: vale[0], atualizado });
  } catch(e) { res.status(500).json({ ok: false, erro: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id FROM vales WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ ok: false, erro: 'Vale não encontrado.' });
    await db.query('DELETE FROM vales WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ ok: false, erro: e.message }); }
});

module.exports = router;