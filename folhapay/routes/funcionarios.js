const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

router.get('/', async (req, res) => {
  try {
    const { rows: funcs } = await db.query('SELECT * FROM funcionarios ORDER BY nome');
    for (const f of funcs) {
      const { rows } = await db.query('SELECT * FROM gratificacoes WHERE funcionario_id = $1', [f.id]);
      f.grats          = rows.map(g => ({ ...g, valor: parseFloat(g.valor) }));
      f.grat_fixa      = parseInt(f.grat_fixa);
      f.salario        = parseFloat(f.salario);
      f.vale_transporte = parseInt(f.vale_transporte) || 0;
    }
    res.json({ ok: true, data: funcs });
  } catch(e) { res.status(500).json({ ok: false, erro: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM funcionarios WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ ok: false, erro: 'Funcionário não encontrado.' });
    const f = rows[0];
    const { rows: grats } = await db.query('SELECT * FROM gratificacoes WHERE funcionario_id = $1', [f.id]);
    f.grats          = grats.map(g => ({ ...g, valor: parseFloat(g.valor) }));
    f.grat_fixa      = parseInt(f.grat_fixa);
    f.salario        = parseFloat(f.salario);
    f.vale_transporte = parseInt(f.vale_transporte) || 0;
    res.json({ ok: true, data: f });
  } catch(e) { res.status(500).json({ ok: false, erro: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { nome, cpf, cargo, departamento, salario, admissao, observacoes, grat_fixa, grats, vale_transporte } = req.body;
    if (!nome || !cpf || !cargo || !salario)
      return res.status(400).json({ ok: false, erro: 'Campos obrigatórios: nome, cpf, cargo, salario.' });

    const { rows } = await db.query(
      `INSERT INTO funcionarios (nome, cpf, cargo, departamento, salario, admissao, observacoes, grat_fixa, vale_transporte)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [nome, cpf, cargo, departamento||'', salario, admissao||'', observacoes||'', grat_fixa ? 1 : 0, vale_transporte ? 1 : 0]
    );
    const func = rows[0];
    if (Array.isArray(grats) && grats.length) {
      for (const g of grats)
        await db.query('INSERT INTO gratificacoes (funcionario_id, nome, valor) VALUES ($1,$2,$3)', [func.id, g.nome, g.valor]);
    }
    const { rows: gratsRows } = await db.query('SELECT * FROM gratificacoes WHERE funcionario_id = $1', [func.id]);
    func.grats          = gratsRows.map(g => ({ ...g, valor: parseFloat(g.valor) }));
    func.grat_fixa      = parseInt(func.grat_fixa);
    func.salario        = parseFloat(func.salario);
    func.vale_transporte = parseInt(func.vale_transporte) || 0;
    res.json({ ok: true, data: func });
  } catch(e) {
    if (e.code === '23505') return res.status(400).json({ ok: false, erro: 'CPF já cadastrado.' });
    res.status(500).json({ ok: false, erro: e.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { nome, cpf, cargo, departamento, salario, admissao, observacoes, grat_fixa, rescisao, grat_aux, vale_transporte } = req.body;
    if (!nome || !cpf || !cargo || !salario)
      return res.status(400).json({ ok: false, erro: 'Campos obrigatórios: nome, cpf, cargo, salario.' });

    const { rows } = await db.query('SELECT id FROM funcionarios WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ ok: false, erro: 'Funcionário não encontrado.' });

    await db.query(
      `UPDATE funcionarios SET nome=$1, cpf=$2, cargo=$3, departamento=$4, salario=$5,
       admissao=$6, observacoes=$7, grat_fixa=$8, rescisao=$9, vale_transporte=$10 WHERE id=$11`,
      [nome, cpf, cargo, departamento||'', salario, admissao||'', observacoes||'', grat_fixa ? 1 : 0, rescisao||'', vale_transporte ? 1 : 0, req.params.id]
    );

    const gratExiste = await db.query(
      "SELECT id FROM gratificacoes WHERE funcionario_id = $1 AND nome = 'Gratificação Auxiliar'",
      [req.params.id]
    );
    if (grat_aux && !gratExiste.rows.length) {
      await db.query("INSERT INTO gratificacoes (funcionario_id, nome, valor) VALUES ($1, 'Gratificação Auxiliar', 200)", [req.params.id]);
    } else if (!grat_aux && gratExiste.rows.length) {
      await db.query("DELETE FROM gratificacoes WHERE funcionario_id = $1 AND nome = 'Gratificação Auxiliar'", [req.params.id]);
    }

    const { rows: updated } = await db.query('SELECT * FROM funcionarios WHERE id = $1', [req.params.id]);
    const f = updated[0];
    const { rows: grats } = await db.query('SELECT * FROM gratificacoes WHERE funcionario_id = $1', [f.id]);
    f.grats          = grats.map(g => ({ ...g, valor: parseFloat(g.valor) }));
    f.grat_fixa      = parseInt(f.grat_fixa);
    f.salario        = parseFloat(f.salario);
    f.vale_transporte = parseInt(f.vale_transporte) || 0;
    res.json({ ok: true, data: f });
  } catch(e) {
    if (e.code === '23505') return res.status(400).json({ ok: false, erro: 'CPF já cadastrado.' });
    res.status(500).json({ ok: false, erro: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id FROM funcionarios WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ ok: false, erro: 'Funcionário não encontrado.' });
    await db.query('DELETE FROM funcionarios WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ ok: false, erro: e.message }); }
});

module.exports = router;