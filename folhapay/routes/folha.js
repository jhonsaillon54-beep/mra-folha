const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

router.get('/', async (req, res) => {
  try {
    const { mes, funcionario_id } = req.query;

    let funcSql = 'SELECT * FROM funcionarios';
    const funcParams = [];
    if (funcionario_id) { funcSql += ' WHERE id = $1'; funcParams.push(funcionario_id); }
    funcSql += ' ORDER BY nome';

    const { rows: funcionarios } = await db.query(funcSql, funcParams);
    if (!funcionarios.length) return res.json({ ok: true, data: [], total_geral: 0 });

    for (const f of funcionarios) {
      const { rows } = await db.query('SELECT * FROM gratificacoes WHERE funcionario_id = $1', [f.id]);
      f.grats     = rows.map(g => ({ ...g, valor: parseFloat(g.valor) }));
      f.grat_fixa = parseInt(f.grat_fixa);
      f.salario   = parseFloat(f.salario);
    }

    // Calcular dias do mês automaticamente
    let diasMes = 30;
    let rescisaoDias = null;
    if (mes) {
      const [ano, m] = mes.split('-');
      diasMes = new Date(parseInt(ano), parseInt(m), 0).getDate();
    }

    let faltasSql = 'SELECT * FROM faltas WHERE 1=1';
    const faltasParams = [];
    let pi = 1;
    if (mes)           { faltasSql += ` AND data LIKE $${pi++}`; faltasParams.push(mes + '%'); }
    if (funcionario_id){ faltasSql += ` AND funcionario_id = $${pi++}`; faltasParams.push(funcionario_id); }
    const { rows: todasFaltas } = await db.query(faltasSql, faltasParams);

    let valesSql = 'SELECT * FROM vales WHERE 1=1';
    const valesParams = [];
    let pj = 1;
    if (mes)           { valesSql += ` AND mes = $${pj++}`; valesParams.push(mes); }
    if (funcionario_id){ valesSql += ` AND funcionario_id = $${pj++}`; valesParams.push(funcionario_id); }
    const { rows: todosVales } = await db.query(valesSql, valesParams);
    todosVales.forEach(v => { v.valor = parseFloat(v.valor); });

    const resultado = funcionarios.map(func => {
      const faltasMes     = todasFaltas.filter(f => parseInt(f.funcionario_id) === func.id);
      const faltasSimples = faltasMes.filter(f => f.tipo === 'simples');
      const faltasJust    = faltasMes.filter(f => f.tipo !== 'simples');
      const temFalta      = faltasMes.length > 0;

      // Verificar rescisão no mês atual
      let diasTrabalhados = diasMes;
      let temRescisao = false;
      let dataRescisao = '';

      if (func.rescisao && mes) {
        const [anoMes, mMes] = mes.split('-');
        const rescisaoStr = func.rescisao; // formato yyyy-mm-dd
        const [anoR, mR] = rescisaoStr.split('-');
        // Verifica se a rescisão é no mesmo mês da folha
        if (anoR === anoMes && mR === mMes) {
          const diaRescisao = parseInt(rescisaoStr.split('-')[2]);
          diasTrabalhados = diaRescisao;
          temRescisao = true;
          dataRescisao = rescisaoStr;
        }
      }

      // Salário proporcional se houver rescisão no mês
      const salarioProporcional = temRescisao
        ? parseFloat(((func.salario / diasMes) * diasTrabalhados).toFixed(2))
        : func.salario;

      // Desconto por falta simples
      const desconto = faltasSimples.length > 0
        ? parseFloat(((func.salario / diasMes) * faltasSimples.length).toFixed(2)) : 0;

      // Gratificação: só recebe se não tiver falta E não tiver rescisão no mês
      const temDireitoGratFixa = func.grat_fixa === 1;
      const gratFixa    = (temDireitoGratFixa && !temFalta && !temRescisao) ? 300 : 0;
      const gratsExtras = (temFalta || temRescisao) ? [] : func.grats;
      const totalGratsExtras = gratsExtras.reduce((s, g) => s + g.valor, 0);

      const totalBruto   = salarioProporcional + gratFixa + totalGratsExtras;
      const totalSemVale = parseFloat((totalBruto - desconto).toFixed(2));

      const vale      = todosVales.find(v => parseInt(v.funcionario_id) === func.id) || null;
      const valorVale = vale ? vale.valor : 0;
      const totalLiquido = parseFloat((totalSemVale - valorVale).toFixed(2));

      return {
        funcionario: func, diasMes, diasTrabalhados, temRescisao, dataRescisao,
        faltasMes, faltasSimples, faltasJust, temFalta,
        salarioProporcional, desconto, gratFixa, temDireitoGratFixa,
        gratsExtras, totalGratsExtras,
        totalBruto, totalSemVale, vale, valorVale, totalLiquido
      };
    });

    const totalGeral = parseFloat(resultado.reduce((s, r) => s + r.totalLiquido, 0).toFixed(2));
    res.json({ ok: true, data: resultado, total_geral: totalGeral, mes, diasMes });
  } catch(e) { res.status(500).json({ ok: false, erro: e.message }); }
});

module.exports = router;