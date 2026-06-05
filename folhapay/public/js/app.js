const API = '';

// ─── UTILS ──────────────────────────────────────────────────

var mn = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function fmt(v) {
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function fmtData(d) {
  if (!d) return '';
  if (d.includes('-')) return d.split('-').reverse().join('/');
  return d;
}

function toISO(d) {
  if (!d) return '';
  if (d.includes('-')) return d;
  var p = d.split('/');
  if (p.length !== 3) return '';
  return p[2] + '-' + p[1].padStart(2,'0') + '-' + p[0].padStart(2,'0');
}

function diasDoMes(mesStr) {
  if (!mesStr) {
    var h = new Date();
    return new Date(h.getFullYear(), h.getMonth()+1, 0).getDate();
  }
  var p = mesStr.split('-');
  return new Date(parseInt(p[0]), parseInt(p[1]), 0).getDate();
}

function atualizarDiasMes() {
  var mes = document.getElementById('folha-mes').value;
  var fd = document.getElementById('folha-dias');
  if (fd) fd.value = diasDoMes(mes);
}

function toast(msg, tipo) {
  tipo = tipo || 'ok';
  var el = document.createElement('div');
  el.className = 'toast toast-' + tipo;
  var icons = {ok:'✓', err:'✕', info:'◉'};
  el.innerHTML = '<span>' + (icons[tipo]||'◉') + '</span> ' + msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(function() { el.classList.add('hide'); setTimeout(function(){el.remove();},300); }, 3200);
}

function confirmar(msg) {
  return new Promise(function(resolve) {
    var ov = document.createElement('div');
    ov.id = 'modal-overlay';
    ov.innerHTML = '<div class="modal-box animate-scale"><div class="modal-icon">⚠</div><div class="modal-msg">' + msg + '</div><div class="modal-actions"><button class="btn btn-ghost" id="mc">Cancelar</button><button class="btn btn-primary" id="mok">Confirmar</button></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e){if(e.target===ov){ov.remove();resolve(false);}});
    document.getElementById('mc').onclick = function(){ov.remove();resolve(false);};
    document.getElementById('mok').onclick = function(){ov.remove();resolve(true);};
  });
}

async function api(method, path, body) {
  try {
    var opts = {method:method, headers:{'Content-Type':'application/json'}};
    if (body) opts.body = JSON.stringify(body);
    var res = await fetch(API + '/api' + path, opts);
    var data = await res.json();
    if (!data.ok) throw new Error(data.erro || 'Erro desconhecido');
    return data;
  } catch(e) { toast(e.message, 'err'); throw e; }
}

function showSkeleton(id, n) {
  var el = document.getElementById(id);
  if (el) el.innerHTML = Array(n||3).fill('<div class="skeleton"></div>').join('');
}

function maskCPF(el) {
  var v = el.value.replace(/\D/g,'');
  v = v.replace(/(\d{3})(\d)/,'$1.$2');
  v = v.replace(/(\d{3})(\d)/,'$1.$2');
  v = v.replace(/(\d{3})(\d{1,2})$/,'$1-$2');
  el.value = v;
}

function maskData(el) {
  var v = el.value.replace(/\D/g,'');
  if (v.length>2) v = v.slice(0,2)+'/'+v.slice(2);
  if (v.length>5) v = v.slice(0,5)+'/'+v.slice(5);
  if (v.length>10) v = v.slice(0,10);
  el.value = v;
}

function abrirCalendario(inputId) {
  var input = document.getElementById(inputId);
  if (!input) return;
  var antigo = document.getElementById('hidden-date-picker');
  if (antigo) antigo.remove();
  var rect = input.getBoundingClientRect();
  var picker = document.createElement('input');
  picker.type = 'date';
  picker.id = 'hidden-date-picker';
  picker.style.cssText = [
    'position:fixed','opacity:0','pointer-events:none',
    'top:' + rect.bottom + 'px','left:' + rect.left + 'px',
    'width:' + rect.width + 'px','height:1px','z-index:9999',
    'border:none','padding:0','background:transparent'
  ].join(';');
  document.body.appendChild(picker);
  var atual = toISO(input.value);
  if (atual) picker.value = atual;
  picker.onchange = function() {
    if (picker.value) {
      var p = picker.value.split('-');
      input.value = p[2]+'/'+p[1]+'/'+p[0];
    }
    setTimeout(function(){ picker.remove(); }, 100);
  };
  picker.addEventListener('blur', function() {
    setTimeout(function(){ if(document.getElementById('hidden-date-picker')) picker.remove(); }, 300);
  });
  setTimeout(function() {
    try { if (picker.showPicker) picker.showPicker(); else picker.click(); }
    catch(e) { picker.click(); }
  }, 30);
}

// ─── NAVEGAÇÃO ───────────────────────────────────────────────

function showPage(name, btn) {
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  document.querySelectorAll('.nav-btn').forEach(function(b){b.classList.remove('active');});
  document.getElementById('page-'+name).classList.add('active');
  if (btn) btn.classList.add('active');
  _pg(name);
}

function showPageMobile(name) {
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  document.querySelectorAll('.bottom-btn').forEach(function(b){b.classList.remove('active');});
  document.getElementById('page-'+name).classList.add('active');
  var bb = document.getElementById('bnav-'+name); if (bb) bb.classList.add('active');
  _pg(name);
  window.scrollTo({top:0,behavior:'smooth'});
}

function _pg(name) {
  if (name==='funcionarios') carregarFuncionarios();
  if (name==='faltas')       { carregarSelectFuncs(); carregarFaltas(); }
  if (name==='vales')        { carregarSelectFuncs(); carregarVales(); }
  if (name==='folha')        carregarSelectFuncs();
  if (name==='vt')           calcularVT();
}

// ─── CADASTRO ───────────────────────────────────────────────

var gratsTemp = [];
var tipoFalta = 'simples';

function addGrat() {
  var n = document.getElementById('g-nome').value.trim();
  var v = parseFloat(document.getElementById('g-valor').value);
  if (!n||isNaN(v)||v<=0){toast('Informe nome e valor.','err');return;}
  gratsTemp.push({nome:n,valor:v}); renderGratsTemp();
  document.getElementById('g-nome').value=''; document.getElementById('g-valor').value='';
}

function removeGrat(i) { gratsTemp.splice(i,1); renderGratsTemp(); }

function renderGratsTemp() {
  var el = document.getElementById('grat-lista'); if (!el) return;
  el.innerHTML = gratsTemp.length
    ? gratsTemp.map(function(g,i){return '<span class="tag-grat">'+g.nome+': '+fmt(g.valor)+' <span class="rm" onclick="removeGrat('+i+')">×</span></span>';}).join('')
    : '<span style="font-size:13px;color:var(--dim)">Nenhuma extra adicionada.</span>';
}

async function cadastrar() {
  var btn = document.getElementById('btn-cadastrar');
  var nome = document.getElementById('c-nome').value.trim();
  var cpf  = document.getElementById('c-cpf').value.trim();
  var cargo= document.getElementById('c-cargo').value.trim();
  var depto= document.getElementById('c-depto').value.trim();
  var sal  = parseFloat(document.getElementById('c-salario').value);
  var adm  = toISO(document.getElementById('c-admissao').value);
  var obs  = document.getElementById('c-obs').value.trim();
  var gf   = document.getElementById('c-grat-fixa');
  var grat_fixa = gf ? gf.checked : false;
  var ga   = document.getElementById('c-grat-aux');
  var grat_aux = ga ? ga.checked : false;
  if (!nome||!cpf||!cargo||isNaN(sal)||sal<=0){toast('Preencha Nome, CPF, Cargo e Salário.','err');return;}
  btn.classList.add('loading'); btn.disabled=true;
  try {
    var gratsEnviar = [...gratsTemp];
    if (grat_aux && !gratsEnviar.find(function(g){return g.nome==='Gratificação Auxiliar';})) {
      gratsEnviar.unshift({nome:'Gratificação Auxiliar', valor:200});
    }
    var vt_cad = document.getElementById('c-vale-transporte'); var vale_transporte_cad = vt_cad ? vt_cad.checked : false;
    await api('POST','/funcionarios',{nome,cpf,cargo,departamento:depto,salario:sal,admissao:adm,observacoes:obs,grat_fixa,grats:gratsEnviar,vale_transporte:vale_transporte_cad});
    toast('Funcionário "'+nome+'" cadastrado!','ok'); limparForm(); atualizarBadgeFuncs();
  } catch(e){} finally { btn.classList.remove('loading'); btn.disabled=false; }
}

function limparForm() {
  ['c-nome','c-cpf','c-cargo','c-depto','c-salario','c-admissao','c-obs','g-nome','g-valor'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.value='';
  });
  var gf=document.getElementById('c-grat-fixa'); if(gf) gf.checked=true;
  gratsTemp=[]; renderGratsTemp();
}

// ─── FUNCIONÁRIOS ───────────────────────────────────────────

async function carregarFuncionarios() {
  showSkeleton('lista-funcionarios');
  try {
    var data = await api('GET','/funcionarios');
    renderFuncionarios(data.data);
  } catch(e) {
    var el=document.getElementById('lista-funcionarios');
    if(el) el.innerHTML='<div class="empty"><div class="empty-icon">!</div>Erro ao carregar.</div>';
  }
}

function renderFuncionarios(lista) {
  var busca = (document.getElementById('busca')?document.getElementById('busca').value:'').toLowerCase();
  var el = document.getElementById('lista-funcionarios'); if(!el) return;
  var filtrado = lista.filter(function(f){return f.nome.toLowerCase().includes(busca);});
  if (!filtrado.length) { el.innerHTML='<div class="empty"><div class="empty-icon">◈</div>Nenhum encontrado.</div>'; return; }
  var html = '<div class="stagger">';
  filtrado.forEach(function(f) {
    var sal = parseFloat(f.salario);
    var totalGrats = (f.grat_fixa?300:0) + (f.grats||[]).reduce(function(s,g){return s+parseFloat(g.valor);},0);
    var gratsHtml = '';
    if (f.grat_fixa) gratsHtml += '<span class="badge badge-ok">✓ Grat. fixa R$ 300,00</span>';
    if (f.vale_transporte) gratsHtml += '<span class="badge badge-info">🚌 Vale Transporte</span>';
    (f.grats||[]).forEach(function(g){ gratsHtml+='<span class="badge badge-info">'+g.nome+': '+fmt(parseFloat(g.valor))+'</span>'; });
    html += '<div class="emp-card animate-in" id="func-'+f.id+'">' +
      '<div class="row r-btw">' +
        '<div style="flex:1;min-width:0">' +
          '<div class="emp-name">'+f.nome+'</div>' +
          '<div class="emp-sub">'+f.cargo+(f.departamento?' — '+f.departamento:'')+' &nbsp;|&nbsp; CPF: '+f.cpf+(f.admissao?' &nbsp;|&nbsp; Admissão: '+fmtData(f.admissao):'')+'</div>' +
          '<div class="row" style="margin-top:8px;gap:8px;flex-wrap:wrap"><span class="emp-salary">'+fmt(sal)+'</span>'+gratsHtml+'</div>' +
          '<div style="font-size:12px;color:var(--muted);margin-top:5px">Total com gratificações: <strong style="color:var(--red-l)">'+fmt(sal+totalGrats)+'</strong></div>' +
          (f.rescisao?'<div style="margin-top:6px"><span class="badge badge-red">⚠ Rescisão: '+fmtData(f.rescisao)+'</span></div>':'') +
          (f.observacoes?'<div class="emp-sub" style="margin-top:4px;font-style:italic">Obs: '+f.observacoes+'</div>':'') +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">' +
          '<button class="btn btn-sm" onclick="abrirEdicao('+f.id+')">✎ Editar</button>' +
          '<button class="btn btn-sm btn-del" onclick="excluirFunc('+f.id+',\''+f.nome.replace(/'/g,"\\'")+'\')">>✕ Excluir</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

async function excluirFunc(id, nome) {
  var ok = await confirmar('Excluir <strong>'+nome+'</strong>?<br><span style="font-size:13px;color:var(--muted)">Faltas e vales também serão removidos.</span>');
  if (!ok) return;
  try {
    await api('DELETE','/funcionarios/'+id);
    var card=document.getElementById('func-'+id);
    if(card){card.style.transition='opacity .3s,transform .3s';card.style.opacity='0';card.style.transform='translateX(20px)';setTimeout(function(){carregarFuncionarios();},320);}
    toast('Funcionário "'+nome+'" removido.','info'); atualizarBadgeFuncs();
  } catch(e){}
}

async function atualizarBadgeFuncs() {
  try {
    var data=await api('GET','/funcionarios');
    var n=data.data.length;
    var b=document.querySelector('.badge-count[data-page="funcionarios"]');
    if(b){b.textContent=n;b.classList.toggle('show',n>0);}
    var d=document.getElementById('dot-funcs'); if(d) d.classList.toggle('show',n>0);
  } catch(e){}
}

// ─── EDIÇÃO ─────────────────────────────────────────────────

async function abrirEdicao(id) {
  try {
    var data = await api('GET','/funcionarios/'+id);
    var f = data.data;
    var ov = document.createElement('div');
    ov.id = 'modal-edicao';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.82);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:9998;padding:1rem;overflow-y:auto;';
    ov.innerHTML =
      '<div class="modal-edicao-box animate-scale">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem;padding-bottom:.75rem;border-bottom:1px solid var(--border)">' +
          '<div style="font-family:Rajdhani,sans-serif;font-size:18px;font-weight:700;text-transform:uppercase;color:var(--gray-l);display:flex;align-items:center;gap:8px">' +
            '<span style="width:3px;height:18px;background:var(--red);border-radius:2px;display:inline-block"></span> Editar Funcionário' +
          '</div>' +
          '<button class="btn btn-sm btn-ghost" onclick="fecharEdicao()">✕</button>' +
        '</div>' +
        '<div class="form-grid">' +
          '<div class="form-group"><label>Nome *</label><input type="text" id="e-nome" value="'+f.nome+'"></div>' +
          '<div class="form-group"><label>CPF *</label><input type="text" id="e-cpf" value="'+f.cpf+'" maxlength="14" oninput="maskCPF(this)"></div>' +
          '<div class="form-group"><label>Cargo *</label><input type="text" id="e-cargo" value="'+(f.cargo||'')+'"></div>' +
          '<div class="form-group"><label>Departamento</label><input type="text" id="e-depto" value="'+(f.departamento||'')+'"></div>' +
          '<div class="form-group"><label>Salário (R$) *</label><input type="number" id="e-salario" value="'+f.salario+'" step="0.01" min="0"></div>' +
          '<div class="form-group"><label>Data admissão</label><div class="data-wrapper"><input type="text" id="e-admissao" value="'+fmtData(f.admissao)+'" placeholder="dd/mm/aaaa" maxlength="10" oninput="maskData(this)"><button class="cal-btn" type="button" onclick="abrirCalendario(\'e-admissao\')">📅</button></div></div>' +
          '<div class="form-group full" style="background:rgba(204,34,34,0.06);border:1px solid rgba(204,34,34,0.2);border-radius:6px;padding:14px">' +
            '<label style="color:var(--red-l)">⚠ Data de rescisão (somente se foi desligado)</label>' +
            '<div class="data-wrapper" style="margin-top:6px"><input type="text" id="e-rescisao" value="'+fmtData(f.rescisao||'')+'" placeholder="dd/mm/aaaa" maxlength="10" oninput="maskData(this)"><button class="cal-btn" type="button" onclick="abrirCalendario(\'e-rescisao\')">📅</button></div>' +
            '<div style="font-size:12px;color:var(--muted);margin-top:6px">O sistema calculará o salário proporcional até esta data na folha.</div>' +
          '</div>' +
          '<div class="form-group full"><label>Observações</label><textarea id="e-obs">'+(f.observacoes||'')+'</textarea></div>' +
          '<div class="form-group full">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg2);border:1px solid var(--border2);border-radius:6px;padding:14px;gap:12px;flex-wrap:wrap">' +
              '<div><div style="font-size:14px;font-weight:500;color:var(--text)">Gratificação fixa de <span style="color:var(--red-l)">R$ 300,00</span></div><div style="font-size:12px;color:var(--muted)">Ative se tem direito à gratificação fixa</div></div>' +
              '<label class="toggle-switch"><input type="checkbox" id="e-grat-fixa" '+(f.grat_fixa?'checked':'')+'>  <span class="toggle-slider"></span></label>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg2);border:1px solid var(--border2);border-radius:6px;padding:14px;gap:12px;flex-wrap:wrap;margin-top:8px">' +
            '<div><div style="font-size:14px;font-weight:500;color:var(--text)">Gratificação auxiliar de <span style="color:var(--red-l)">R$ 200,00</span></div>' +
            '<div style="font-size:12px;color:var(--muted)">Ative se tem direito à gratificação dos auxiliares</div></div>' +
            '<label class="toggle-switch"><input type="checkbox" id="e-grat-aux" '+((f.grats&&f.grats.find(function(g){return g.nome==='Gratificação Auxiliar';}))?'checked':'')+'>  <span class="toggle-slider"></span></label>' +
          '</div>' +
          '<div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg2);border:1px solid var(--border2);border-radius:6px;padding:14px;gap:12px;flex-wrap:wrap;margin-top:8px">' +
            '<div><div style="font-size:14px;font-weight:500;color:var(--text)">Vale Transporte <span style="color:var(--red-l)">🚌</span></div>' +
            '<div style="font-size:12px;color:var(--muted)">Ative se este funcionário recebe vale transporte</div></div>' +
            '<label class="toggle-switch"><input type="checkbox" id="e-vale-transporte" '+(f.vale_transporte?'checked':'')+'>  <span class="toggle-slider"></span></label>' +
          '</div>' +
        '</div>' +
        '<div class="row r-end" style="margin-top:1.25rem;gap:10px">' +
          '<button class="btn btn-ghost" onclick="fecharEdicao()">Cancelar</button>' +
          '<button class="btn btn-primary" id="btn-salvar-ed" onclick="salvarEdicao('+f.id+')">' +
            '<span class="btn-text">✓ Salvar</span><span class="spinner"></span>' +
          '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e){if(e.target===ov) fecharEdicao();});
  } catch(e){ toast('Erro ao carregar funcionário.','err'); }
}

function fecharEdicao() { var el=document.getElementById('modal-edicao'); if(el) el.remove(); }

async function salvarEdicao(id) {
  var btn = document.getElementById('btn-salvar-ed');
  var nome    = document.getElementById('e-nome').value.trim();
  var cpf     = document.getElementById('e-cpf').value.trim();
  var cargo   = document.getElementById('e-cargo').value.trim();
  var depto   = document.getElementById('e-depto').value.trim();
  var sal     = parseFloat(document.getElementById('e-salario').value);
  var adm     = toISO(document.getElementById('e-admissao').value);
  var resc    = toISO(document.getElementById('e-rescisao').value);
  var obs     = document.getElementById('e-obs').value.trim();
  var grat_fixa = document.getElementById('e-grat-fixa').checked;
  var gaEdit = document.getElementById('e-grat-aux');
  var grat_aux_edit = gaEdit ? gaEdit.checked : false;
  var vtEdit = document.getElementById('e-vale-transporte');
  var vale_transporte_edit = vtEdit ? vtEdit.checked : false;
  if (!nome||!cpf||!cargo||isNaN(sal)||sal<=0){toast('Preencha Nome, CPF, Cargo e Salário.','err');return;}
  btn.classList.add('loading'); btn.disabled=true;
  try {
    await api('PUT','/funcionarios/'+id,{nome,cpf,cargo,departamento:depto,salario:sal,admissao:adm,rescisao:resc,observacoes:obs,grat_fixa,grat_aux:grat_aux_edit,vale_transporte:vale_transporte_edit});
    toast('Funcionário atualizado!','ok'); fecharEdicao(); carregarFuncionarios();
  } catch(e){} finally { btn.classList.remove('loading'); btn.disabled=false; }
}

// ─── SELECTS ────────────────────────────────────────────────

var _todosFunc = [];

async function carregarSelectFuncs() {
  try {
    var data = await api('GET','/funcionarios');
    _todosFunc = data.data;
    var opts = data.data.map(function(f){return '<option value="'+f.id+'">'+f.nome+'</option>';}).join('');
    ['f-func','folha-func','filtro-faltas'].forEach(function(id){
      var el=document.getElementById(id); if(!el) return;
      el.innerHTML = (id==='f-func'?'<option value="">Selecione...</option>':'<option value="">Todos os funcionários</option>') + opts;
    });
    renderValeFunc('');
  } catch(e){}
}

// ─── VALES — SELEÇÃO ────────────────────────────────────────

function renderValeFunc(busca) {
  var el = document.getElementById('v-func-lista'); if (!el) return;
  var lista = _todosFunc.filter(function(f){ return f.nome.toLowerCase().includes((busca||'').toLowerCase()); });
  if (!lista.length) { el.innerHTML='<div style="text-align:center;padding:1rem;color:var(--dim);font-size:13px">Nenhum funcionário encontrado.</div>'; return; }
  el.innerHTML = lista.map(function(f) {
    return '<div id="vfi-'+f.id+'" style="display:flex;align-items:center;gap:12px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:12px 14px;transition:border-color .2s">' +
      '<div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;cursor:pointer" onclick="onValeCheck('+f.id+')">' +
        '<input type="checkbox" id="vfc-'+f.id+'" style="width:20px;height:20px;accent-color:#cc2222;cursor:pointer;flex-shrink:0;pointer-events:none">' +
        '<div style="min-width:0">' +
          '<div style="font-family:Rajdhani,sans-serif;font-size:15px;font-weight:700;color:var(--text)">'+f.nome+'</div>' +
          '<div style="font-size:12px;color:var(--muted)">'+f.cargo+(f.departamento?' — '+f.departamento:'')+'</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">' +
        '<span style="font-size:12px;color:var(--muted)">R$</span>' +
        '<input type="number" id="vfv-'+f.id+'" placeholder="0,00" step="0.01" min="0" ' +
          'style="width:100px;opacity:.4;background:var(--bg2);border:1px solid var(--border2);border-radius:var(--r);padding:8px;color:var(--text);font-size:14px" ' +
          'disabled>' +
      '</div>' +
    '</div>';
  }).join('');
}

function onValeCheck(id) {
  var cb = document.getElementById('vfc-'+id);
  var input = document.getElementById('vfv-'+id);
  var item = document.getElementById('vfi-'+id);
  if (!cb||!input||!item) return;
  cb.checked = !cb.checked;
  input.disabled = !cb.checked;
  input.style.opacity = cb.checked ? '1' : '.4';
  item.style.borderColor = cb.checked ? 'var(--red)' : 'var(--border)';
  if (cb.checked) setTimeout(function(){ input.focus(); }, 50);
}

function aplicarValorUnico() {
  var el = document.getElementById('v-valor-unico');
  var val = parseFloat(el ? el.value : 0);
  if (isNaN(val) || val <= 0) { toast('Informe um valor válido no campo acima.', 'err'); return; }
  var temSelecionado = _todosFunc.some(function(f) {
    var cb = document.getElementById('vfc-'+f.id);
    return cb && cb.checked;
  });
  if (!temSelecionado) {
    _todosFunc.forEach(function(f) {
      var cb=document.getElementById('vfc-'+f.id);
      if (cb && !cb.checked) onValeCheck(f.id);
    });
  }
  var aplicados = 0;
  _todosFunc.forEach(function(f) {
    var cb = document.getElementById('vfc-'+f.id);
    var vinput = document.getElementById('vfv-'+f.id);
    if (cb && cb.checked && vinput) { vinput.value = val.toFixed(2); aplicados++; }
  });
  if (aplicados === 0) toast('Nenhum funcionário disponível.', 'err');
  else toast(fmt(val) + ' aplicado para ' + aplicados + ' funcionário(s)!', 'ok');
}

function filtrarValeFunc() {
  var busca = document.getElementById('v-busca-func') ? document.getElementById('v-busca-func').value : '';
  renderValeFunc(busca);
}

function selecionarTodosVale() {
  _todosFunc.forEach(function(f) {
    var cb=document.getElementById('vfc-'+f.id);
    if (cb&&!cb.checked) onValeCheck(f.id);
  });
}

function deselecionarTodosVale() {
  _todosFunc.forEach(function(f) {
    var cb=document.getElementById('vfc-'+f.id);
    if (cb&&cb.checked) onValeCheck(f.id);
  });
}

// ─── FALTAS ──────────────────────────────────────────────────

function setTipo(tipo) {
  tipoFalta = tipo;
  document.querySelectorAll('.tipo-btn').forEach(function(b){b.classList.remove('sel');});
  var el=document.getElementById('tipo-'+tipo); if(el) el.classList.add('sel');
  var campoFoto = document.getElementById('campo-foto-atestado');
  if (campoFoto) campoFoto.style.display = tipo==='atestado' ? 'flex' : 'none';
  if (tipo !== 'atestado') removerFoto();
}

function previewFoto(input) {
  if (!input.files || !input.files[0]) return;
  var file = input.files[0];
  var reader = new FileReader();
  reader.onload = function(e) {
    var prev = document.getElementById('upload-preview');
    var placeholder = document.getElementById('upload-placeholder');
    var img = document.getElementById('preview-img');
    if (file.type === 'application/pdf') {
      img.src = ''; img.style.display = 'none';
      prev.innerHTML = '<div style="padding:20px;text-align:center"><div style="font-size:40px">📄</div><div style="font-size:13px;color:var(--warn);margin-top:8px">'+file.name+'</div><div style="font-size:11px;color:var(--muted)">PDF selecionado</div><button onclick="event.stopPropagation();removerFoto()" style="margin-top:8px;background:#cc2222;color:#fff;border:none;border-radius:4px;padding:4px 12px;cursor:pointer">✕ Remover</button></div>';
    } else { img.src = e.target.result; img.style.display = 'block'; }
    if (prev) prev.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
    window._fotoAtestado = e.target.result;
  };
  reader.readAsDataURL(file);
}

function removerFoto() {
  window._fotoAtestado = null;
  var input = document.getElementById('f-foto'); if (input) input.value = '';
  var prev = document.getElementById('upload-preview');
  var placeholder = document.getElementById('upload-placeholder');
  if (prev) { prev.style.display='none'; prev.innerHTML='<img id="preview-img" style="max-width:100%;max-height:200px;border-radius:4px;object-fit:contain"><button onclick="event.stopPropagation();removerFoto()" style="position:absolute;top:4px;right:4px;background:#cc2222;color:#fff;border:none;border-radius:50%;width:24px;height:24px;cursor:pointer;font-size:14px;line-height:1">✕</button>'; }
  if (placeholder) placeholder.style.display = 'block';
}

function handleDrop(event) {
  event.preventDefault();
  var files = event.dataTransfer.files;
  if (files && files[0]) {
    var input = document.getElementById('f-foto');
    if (input) {
      try {
        var dt = new DataTransfer(); dt.items.add(files[0]); input.files = dt.files; previewFoto(input);
      } catch(e) { toast('Arraste não suportado. Use o botão para selecionar.', 'info'); }
    }
  }
}

async function registrarFalta() {
  var btn=document.getElementById('btn-falta');
  var funcId=document.getElementById('f-func').value;
  var dataRaw=document.getElementById('f-data').value;
  var just=document.getElementById('f-just').value.trim();
  var dataISO=toISO(dataRaw);
  if (!funcId||!dataISO||!just){toast('Preencha todos os campos.','err');return;}
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataISO)){toast('Data inválida. Use dd/mm/aaaa.','err');return;}
  btn.classList.add('loading'); btn.disabled=true;
  try {
    var foto = window._fotoAtestado || '';
    await api('POST','/faltas',{funcionario_id:funcId,data:dataISO,tipo:tipoFalta,justificativa:just,foto_atestado:foto});
    toast('Falta registrada!','ok');
    document.getElementById('f-data').value=''; document.getElementById('f-just').value='';
    removerFoto(); setTipo('simples'); carregarFaltas();
  } catch(e){} finally { btn.classList.remove('loading'); btn.disabled=false; }
}

async function carregarFaltas() {
  showSkeleton('lista-faltas',4);
  try {
    var filtro=document.getElementById('filtro-faltas')?document.getElementById('filtro-faltas').value:'';
    var data=await api('GET',filtro?'/faltas?funcionario_id='+filtro:'/faltas');
    renderFaltas(data.data);
  } catch(e){ var el=document.getElementById('lista-faltas'); if(el) el.innerHTML='<div class="empty">Erro ao carregar.</div>'; }
}

function renderFaltas(lista) {
  var el=document.getElementById('lista-faltas'); if(!el) return;
  if (!lista.length){el.innerHTML='<div class="empty"><div class="empty-icon">✓</div>Nenhuma falta.</div>';return;}
  var tl={simples:'Falta simples',atestado:'Atestado médico',outro:'Motivo justificado'};
  var tb={simples:'badge-red',atestado:'badge-warn',outro:'badge-warn'};
  var html='<div class="stagger">';
  lista.forEach(function(f){
    html+='<div class="falta-card animate-in" id="falta-'+f.id+'">'+
      '<div style="flex:1;min-width:0">'+
        '<div class="row" style="gap:8px;margin-bottom:4px;flex-wrap:wrap">'+
          '<span class="falta-date">'+fmtData(f.data)+'</span>'+
          '<span style="font-weight:500;color:var(--text)">'+f.funcionario_nome+'</span>'+
          '<span class="badge '+(tb[f.tipo]||'badge-warn')+'">'+(tl[f.tipo]||f.tipo)+'</span>'+
        '</div>'+
        '<div class="falta-just">'+f.justificativa+'</div>'+
        (f.foto_atestado ? '<div style="margin-top:8px;display:flex;align-items:center;gap:8px">' +
          '<img id="imgf'+f.id+'" src="'+f.foto_atestado+'" style="width:60px;height:60px;border-radius:6px;border:1px solid var(--border);cursor:pointer;object-fit:cover" onclick="verFoto(this.src)" title="Ver atestado">' +
          '<button class="btn btn-sm" onclick="verFoto(document.getElementById(String(\'imgf'+f.id+'\')).src)" style="font-size:12px">🔍 Ver atestado</button>' +
          '</div>' : '') +
      '</div>'+
      '<button class="btn btn-sm btn-del" style="flex-shrink:0" onclick="excluirFalta('+f.id+')">✕</button>'+
    '</div>';
  });
  el.innerHTML=html+'</div>';
}

async function excluirFalta(id) {
  var ok=await confirmar('Remover esta falta?'); if(!ok) return;
  try {
    await api('DELETE','/faltas/'+id);
    var c=document.getElementById('falta-'+id);
    if(c){c.style.transition='opacity .25s,transform .25s';c.style.opacity='0';c.style.transform='translateX(20px)';setTimeout(function(){carregarFaltas();},280);}
    toast('Falta removida.','info');
  } catch(e){}
}

function verFoto(src) {
  var ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;padding:20px';
  ov.innerHTML = '<img src="'+src+'" style="max-width:95vw;max-height:95vh;border-radius:8px;object-fit:contain;box-shadow:0 0 40px rgba(0,0,0,0.8)">';
  ov.onclick = function(){ ov.remove(); };
  document.body.appendChild(ov);
}

// ─── VALES — REGISTRAR ───────────────────────────────────────

async function registrarVales() {
  var btn=document.getElementById('btn-vale');
  var mes=document.getElementById('v-mes').value;
  var dataRaw=document.getElementById('v-data')?document.getElementById('v-data').value:'';
  var hoje=new Date();
  var data_vale = dataRaw ? toISO(dataRaw) : hoje.getFullYear()+'-'+String(hoje.getMonth()+1).padStart(2,'0')+'-'+String(hoje.getDate()).padStart(2,'0');
  var obs=document.getElementById('v-obs').value.trim();
  if (!mes){toast('Selecione o mês de referência.','err');return;}
  var selecionados = [];
  _todosFunc.forEach(function(f){
    var cb=document.getElementById('vfc-'+f.id);
    var vinput=document.getElementById('vfv-'+f.id);
    if (cb&&cb.checked) {
      var val=parseFloat(vinput?vinput.value:0);
      if (isNaN(val)||val<=0) { toast('Informe o valor do vale para '+f.nome+'.','err'); return; }
      selecionados.push({id:f.id, nome:f.nome, valor:val});
    }
  });
  if (!selecionados.length){toast('Selecione pelo menos um funcionário.','err');return;}
  btn.classList.add('loading'); btn.disabled=true;
  try {
    var erros=0, ok=0;
    for (var i=0;i<selecionados.length;i++) {
      try { await api('POST','/vales',{funcionario_id:selecionados[i].id,mes,valor:selecionados[i].valor,observacao:obs,data_vale}); ok++; }
      catch(e){ erros++; }
    }
    if (ok>0) toast(ok+' vale(s) registrado(s) com sucesso!','ok');
    if (erros>0) toast(erros+' vale(s) com erro.','err');
    document.getElementById('v-obs').value='';
    var vd=document.getElementById('v-data'); if(vd) vd.value='';
    deselecionarTodosVale(); carregarVales();
  } catch(e){} finally { btn.classList.remove('loading'); btn.disabled=false; }
}

async function carregarVales() {
  showSkeleton('lista-vales',3);
  try {
    var fm=document.getElementById('filtro-mes-vale')?document.getElementById('filtro-mes-vale').value:'';
    var data=await api('GET',fm?'/vales?mes='+fm:'/vales');
    renderVales(data.data);
  } catch(e){ var el=document.getElementById('lista-vales'); if(el) el.innerHTML='<div class="empty">Erro ao carregar.</div>'; }
}

function renderVales(lista) {
  var el=document.getElementById('lista-vales'); if(!el) return;
  if (!lista.length){el.innerHTML='<div class="empty"><div class="empty-icon">💵</div>Nenhum vale.</div>';return;}
  var html='<div class="stagger">';
  lista.forEach(function(v){
    var p=v.mes.split('-'); var mesNome=mn[parseInt(p[1])]+'/'+p[0];
    var dataFormatada = '';
    if (v.data_vale && v.data_vale.trim() !== '') { dataFormatada = fmtData(v.data_vale.trim()); }
    html+='<div class="vale-card animate-in" id="vale-'+v.id+'">'+
      '<div style="flex:1;min-width:0">'+
        '<div class="row" style="gap:10px;margin-bottom:6px;flex-wrap:wrap;align-items:center">'+
          '<span class="vale-nome">'+v.funcionario_nome+'</span>'+
          '<span class="badge badge-info">'+v.cargo+'</span>'+
          '<span class="badge badge-warn">💵 '+mesNome+'</span>'+
        '</div>'+
        '<div class="row" style="gap:10px;flex-wrap:wrap;align-items:center">'+
          '<span class="vale-valor">- '+fmt(parseFloat(v.valor))+'</span>'+
          (dataFormatada?'<span class="badge badge-info" style="font-size:12px">📅 '+dataFormatada+'</span>':'')+
          (v.observacao&&v.observacao.trim()?'<span style="font-size:13px;color:var(--muted)">— '+v.observacao+'</span>':'')+
        '</div>'+
      '</div>'+
      '<button class="btn btn-sm btn-del" style="flex-shrink:0;align-self:center" onclick="excluirVale('+v.id+')">✕</button>'+
    '</div>';
  });
  el.innerHTML=html+'</div>';
}

async function excluirVale(id) {
  var ok=await confirmar('Remover este vale?'); if(!ok) return;
  try {
    await api('DELETE','/vales/'+id);
    var c=document.getElementById('vale-'+id);
    if(c){c.style.transition='opacity .25s,transform .25s';c.style.opacity='0';c.style.transform='translateX(20px)';setTimeout(function(){carregarVales();},280);}
    toast('Vale removido.','info');
  } catch(e){}
}

// ─── FOLHA ───────────────────────────────────────────────────

var _dadosFolha = null;

function filtrarFolha() {
  if (!_dadosFolha) return;
  var busca = (document.getElementById('folha-busca')?document.getElementById('folha-busca').value:'').toLowerCase();
  var filtrado = { ok:_dadosFolha.ok, total_geral:_dadosFolha.total_geral, mes:_dadosFolha.mes, diasMes:_dadosFolha.diasMes, data:_dadosFolha.data.filter(function(r){ return r.funcionario.nome.toLowerCase().includes(busca); }) };
  renderFolhaHTML(filtrado);
}

async function gerarFolha() {
  var btn=document.getElementById('btn-folha');
  var mes=document.getElementById('folha-mes').value;
  var dias=diasDoMes(mes);
  var funcId=document.getElementById('folha-func').value;
  var el=document.getElementById('folha-resultado');
  btn.classList.add('loading'); btn.disabled=true;
  el.innerHTML='<div class="stagger">'+Array(3).fill('<div class="skeleton" style="height:120px;margin-bottom:12px"></div>').join('')+'</div>';
  try {
    var path='/folha?dias_mes='+dias;
    if (mes)    path+='&mes='+mes;
    if (funcId) path+='&funcionario_id='+funcId;
    var data=await api('GET',path);
    _dadosFolha = data;
    if (!data.data.length){ el.innerHTML='<div class="empty"><div class="empty-icon">◈</div>Nenhum funcionário.</div>'; return; }
    renderFolhaHTML(data);
  } catch(e) {
    el.innerHTML='<div class="empty"><div class="empty-icon">!</div>Erro ao gerar folha.</div>';
  } finally { btn.classList.remove('loading'); btn.disabled=false; }
}

function renderFolhaHTML(data) {
  var el=document.getElementById('folha-resultado'); if(!el) return;
  var mes=document.getElementById('folha-mes').value;
  var dias=diasDoMes(mes);
  if (!data.data.length){ el.innerHTML='<div class="empty"><div class="empty-icon">◈</div>Nenhum funcionário encontrado.</div>'; return; }
  var mesNome='', ano='';
  if (mes){ var mp=mes.split('-'); ano=mp[0]; mesNome=mn[parseInt(mp[1])]; }
  var tl={simples:'Falta simples',atestado:'Atestado médico',outro:'Motivo justificado'};
  var html='';
  if (mes) {
    html+='<div style="text-align:center;margin-bottom:1.5rem;animation:fadeIn .3s ease">'+
      '<div style="font-family:Rajdhani,sans-serif;font-size:24px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--gray-l)">'+mesNome+' '+ano+'</div>'+
      '<div style="font-size:13px;color:var(--dim);margin-top:2px">'+dias+' dias no mês</div>'+
    '</div>';
  }
  data.data.forEach(function(r, idx) {
    var f = r.funcionario;
    var sal = parseFloat(f.salario);
    var sb='';
    if (r.temRescisao) sb='<span class="badge badge-red">⚠ Rescisão '+fmtData(r.dataRescisao)+'</span>';
    else if (r.faltasMes.length===0) sb='<span class="badge badge-ok">✓ Sem faltas</span>';
    else if (r.faltasSimples.length>0) sb='<span class="badge badge-red">✕ '+r.faltasSimples.length+' falta(s)</span>'+(r.faltasJust.length?' <span class="badge badge-warn">✦ '+r.faltasJust.length+' justif.</span>':'');
    else sb='<span class="badge badge-warn">✦ '+r.faltasJust.length+' justif.</span>';
    var salProp = r.salarioProporcional !== undefined ? parseFloat(r.salarioProporcional) : sal;
    var lblSal = r.temRescisao ? 'Salário proporcional ('+r.diasTrabalhados+'/'+r.diasMes+' dias)' : 'Salário base ('+r.diasMes+' dias)';
    var gfHtml='';
    if (r.temDireitoGratFixa) {
      gfHtml='<div class="folha-row"><span class="lbl">Gratificação fixa R$ 300,00</span><span class="val '+(r.gratFixa>0?'pos':'cut')+'">'+(r.gratFixa>0?fmt(300):'R$ 300,00 — cancelada')+'</span></div>';
    }
    var geHtml='';
    (f.grats||[]).forEach(function(g){
      var cancelada = r.temFalta||r.temRescisao;
      geHtml+='<div class="folha-row"><span class="lbl">'+g.nome+'</span><span class="val '+(cancelada?'cut':'pos')+'">'+fmt(parseFloat(g.valor))+(cancelada?' — cancelada':'')+'</span></div>';
    });
    var descHtml='';
    if (r.faltasSimples.length>0) {
      descHtml='<div class="folha-row"><span class="lbl">Desconto '+r.faltasSimples.length+' falta(s) simples <span style="font-size:11px;opacity:.55">('+fmt(sal)+' ÷ '+r.diasMes+' × '+r.faltasSimples.length+')</span></span><span class="val neg">- '+fmt(parseFloat(r.desconto))+'</span></div>';
    }
    var jHtml='';
    if (r.faltasJust.length>0) { jHtml='<div class="folha-row"><span class="lbl">Falta(s) justificada(s) — '+r.faltasJust.length+' dia(s)</span><span class="val warn">Sem desconto</span></div>'; }
    var vHtml='';
    if (r.valorVale>0) {
      var vObs=(r.vale&&r.vale.data_vale?' — '+fmtData(r.vale.data_vale):'')+(r.vale&&r.vale.observacao?' ('+r.vale.observacao+')':'');
      vHtml='<div class="folha-row"><span class="lbl">💵 Vale'+vObs+'</span><span class="val neg">- '+fmt(parseFloat(r.valorVale))+'</span></div>';
    }
    var dfHtml='';
    if (r.faltasMes&&r.faltasMes.length) {
      dfHtml='<div class="folha-faltas-detail"><div class="folha-falta-title">Detalhamento das faltas</div>'+
        r.faltasMes.map(function(fa){
          return '<div class="folha-falta-line"><span class="dt">'+fmtData(fa.data)+'</span><span class="tp '+(fa.tipo==='simples'?'s':'j')+'">'+(tl[fa.tipo]||fa.tipo)+'</span><span>'+fa.justificativa+'</span></div>';
        }).join('')+'</div>';
    }
    var rBanner='';
    if (r.temRescisao) {
      rBanner='<div style="background:rgba(204,34,34,0.1);border-left:3px solid var(--red);padding:10px 16px;margin:0;font-size:13px">'+
        '<span style="color:var(--red-l);font-weight:600">⚠ Rescisão em '+fmtData(r.dataRescisao)+'</span>'+
        ' &nbsp;|&nbsp; <span style="color:var(--muted)">Trabalhados: '+r.diasTrabalhados+' de '+r.diasMes+' dias</span></div>';
    }
    html+='<div class="folha-block" style="animation-delay:'+(idx*0.07)+'s">'+
      '<div class="folha-header">'+
        '<div><div class="folha-nome">'+f.nome+'</div><div class="folha-cargo">'+f.cargo+(f.departamento?' — '+f.departamento:'')+'</div></div>'+
        '<div class="row" style="gap:8px">'+sb+'<button class="btn btn-sm no-print" onclick="imprimirFuncionario('+f.id+')">⎙ Imprimir</button></div>'+
      '</div>'+
      rBanner+
      '<div class="folha-body">'+
        '<div class="folha-row"><span class="lbl">'+lblSal+'</span><span class="val">'+fmt(salProp)+'</span></div>'+
        gfHtml+geHtml+descHtml+jHtml+vHtml+
      '</div>'+
      '<div class="folha-total"><div class="lbl">Total líquido</div><div class="val">'+fmt(parseFloat(r.totalLiquido))+'</div></div>'+
      dfHtml+
    '</div>';
  });
  if (data.data.length>1) {
    var totalVales = data.data.reduce(function(s,r){ return s + (r.valorVale>0 ? parseFloat(r.valorVale) : 0); }, 0);
    var totalBruto = data.data.reduce(function(s,r){ return s + parseFloat(r.totalLiquido) + (r.valorVale>0 ? parseFloat(r.valorVale) : 0); }, 0);
    var totalRestante = parseFloat(data.total_geral);
    html+='<div class="total-geral" style="flex-direction:column;align-items:stretch;gap:8px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<div class="lbl">Total bruto da folha</div><div class="val">'+fmt(totalBruto)+'</div>' +
      '</div>' +
      (totalVales>0 ?
        '<div style="display:flex;justify-content:space-between;align-items:center;opacity:.85">' +
          '<div class="lbl">(-) Total de vales pagos</div><div class="val" style="font-size:18px">- '+fmt(totalVales)+'</div>' +
        '</div>' +
        '<div style="border-top:1px solid rgba(255,255,255,0.2);padding-top:8px;display:flex;justify-content:space-between;align-items:center">' +
          '<div class="lbl">Restante a pagar</div><div class="val">'+fmt(totalRestante)+'</div>' +
        '</div>'
      : '') +
    '</div>';
  }
  el.innerHTML=html;
}

// ─── IMPRESSÃO ───────────────────────────────────────────────

function _abrirJanela(htmlConteudo) {
  var w = window.open('', '_blank');
  if (!w) { toast('Permita pop-ups para este site nas configurações do Safari.', 'err'); return; }
  var barra =
    '<div id="__barra" style="position:fixed;top:0;left:0;right:0;z-index:99999;background:#111;border-bottom:2px solid #cc2222;display:flex;align-items:center;justify-content:space-between;padding:10px 16px;gap:10px;font-family:Arial,sans-serif">' +
      '<button onclick="window.close()" style="background:#2a2a2a;color:#f0f0f0;border:1px solid #3a3a3a;border-radius:6px;padding:8px 16px;font-size:14px;cursor:pointer">← Voltar</button>' +
      '<span style="color:#cc2222;font-family:Arial Black,Arial;font-weight:900;font-size:14px;letter-spacing:1px">MRA</span>' +
      '<button onclick="window.print()" style="background:#cc2222;color:#fff;border:none;border-radius:6px;padding:8px 16px;font-size:14px;cursor:pointer">⎙ Imprimir</button>' +
    '</div>' +
    '<div id="__espacador" style="height:56px"></div>';
  var html = htmlConteudo
    .replace('<body>', '<body>' + barra)
    .replace('</style>', '#__barra{display:flex!important}@media print{#__barra{display:none!important}#__espacador{display:none!important}}</style>');
  w.document.write(html);
  w.document.close();
  w.focus();
}

function imprimirFolha() {
  if (!_dadosFolha || !_dadosFolha.data.length) { toast('Gere a folha primeiro.', 'err'); return; }
  var mes = document.getElementById('folha-mes').value;
  var mesNome = '', ano = '';
  if (mes) { var mp = mes.split('-'); ano = mp[0]; mesNome = mn[parseInt(mp[1])]; }
  var dias = diasDoMes(mes);
  var html = '<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
    'body{font-family:Arial,sans-serif;font-size:11px;color:#000;margin:0;padding:20px}' +
    '.logo-box-print{display:inline-flex;flex-direction:column;align-items:center;border:2.5px solid #1a1a1a;border-radius:3px;padding:4px 14px;background:#fff;line-height:1;gap:1px;margin-bottom:8px}' +
    '.logo-sigla-print{font-family:Arial Black,Arial,sans-serif;font-size:28px;font-weight:900;color:#cc2222;letter-spacing:3px;line-height:1}' +
    '.logo-sub-print{font-size:8px;font-weight:700;color:#cc2222;letter-spacing:2.5px;text-transform:uppercase;white-space:nowrap}' +
    'h1{font-size:16px;text-align:center;margin:0 0 4px}h2{font-size:12px;text-align:center;color:#555;margin:0 0 16px;font-weight:normal}' +
    '.logo{text-align:center;font-size:20px;font-weight:700;letter-spacing:2px;color:#cc2222;margin-bottom:4px}' +
    'table{width:100%;border-collapse:collapse;margin-top:8px}' +
    'th{background:#cc2222;color:#fff;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase}' +
    'td{padding:5px 8px;border-bottom:1px solid #eee;font-size:11px;vertical-align:top}' +
    'tr:nth-child(even) td{background:#fafafa}.num{text-align:right}.neg{color:#cc2222;text-align:right}' +
    '.total-row td{font-weight:700;border-top:2px solid #cc2222;background:#fff0f0}' +
    '.rodape{margin-top:20px;text-align:center;font-size:10px;color:#999;border-top:1px solid #eee;padding-top:10px}' +
    '</style></head><body>';
  html += '<div class="logo"><div class="logo-box-print"><span class="logo-sigla-print">MRA</span><span class="logo-sub-print">MOCHILAS E BOLSAS</span></div></div>';
  html += '<h1>Resumo da Folha de Pagamento</h1>';
  html += '<h2>'+mesNome+(ano?' de '+ano:'')+' — '+dias+' dias no mês — Gerado em: '+new Date().toLocaleDateString('pt-BR')+'</h2>';
  html += '<table><thead><tr><th>Funcionário</th><th>Cargo</th><th class="num">Salário</th><th class="num">Grat. Fixa</th><th class="num">Grat. Extra</th><th class="num">Desconto Falta</th><th class="num">Vale</th><th class="num">Total Líquido</th></tr></thead><tbody>';
  var totalGeral = 0;
  _dadosFolha.data.forEach(function(r) {
    var f = r.funcionario;
    var salProp = r.salarioProporcional !== undefined ? parseFloat(r.salarioProporcional) : parseFloat(f.salario);
    totalGeral += parseFloat(r.totalLiquido);
    var obs = '';
    if (r.temRescisao) obs = ' ⚠ Rescisão '+fmtData(r.dataRescisao)+' ('+r.diasTrabalhados+'/'+r.diasMes+' dias)';
    else if (r.faltasSimples.length>0&&r.faltasJust.length>0) obs = ' ✕ '+r.faltasSimples.length+' não justificada(s) | ✦ '+r.faltasJust.length+' justificada(s)';
    else if (r.faltasSimples.length>0) obs = ' ✕ '+r.faltasSimples.length+' falta(s) não justificada(s)';
    else if (r.faltasJust.length>0) obs = ' ✦ '+r.faltasJust.length+' falta(s) justificada(s)';
    var gratsExtrasTotal = r.gratsExtras ? r.gratsExtras.reduce(function(s,g){return s+parseFloat(g.valor);},0) : 0;
    html += '<tr>'+
      '<td><strong>'+f.nome+'</strong>'+(obs?'<br><span style="font-size:10px;color:#888">'+obs+'</span>':'')+'</td>'+
      '<td>'+f.cargo+'</td>'+
      '<td class="num">'+fmt(salProp)+'</td>'+
      '<td class="num">'+(r.gratFixa>0?'<span style="color:green">'+fmt(r.gratFixa)+'</span>':'<span style="color:#aaa">—</span>')+'</td>'+
      '<td class="num">'+(gratsExtrasTotal>0?'<span style="color:green">'+fmt(gratsExtrasTotal)+'</span>':'<span style="color:#aaa">—</span>')+'</td>'+
      '<td class="neg" style="font-size:10px">'+(r.desconto>0?'- '+fmt(r.desconto)+(r.faltasJust.length>0?'<br><span style="color:#b8860b;font-size:9px">✦ '+r.faltasJust.length+' justif. s/ desconto</span>':''):'<span style="color:#aaa">—</span>')+'</td>'+
      '<td class="neg">'+(r.valorVale>0?'- '+fmt(r.valorVale):'<span style="color:#aaa">—</span>')+'</td>'+
      '<td class="num"><strong>'+fmt(parseFloat(r.totalLiquido))+'</strong></td>'+
    '</tr>';
  });
  var totalValesImp = _dadosFolha.data.reduce(function(s,r){ return s + (r.valorVale>0 ? parseFloat(r.valorVale) : 0); }, 0);
  var totalBrutoImp = totalGeral + totalValesImp;
  html += '<tr class="total-row"><td colspan="7">TOTAL BRUTO DA FOLHA</td><td class="num">'+fmt(totalBrutoImp)+'</td></tr>';
  if (totalValesImp > 0) {
    html += '<tr style="background:#fff8f0"><td colspan="7" style="color:#b8860b;font-weight:600">(-) Total de vales pagos</td><td class="num" style="color:#b8860b;font-weight:600">- '+fmt(totalValesImp)+'</td></tr>';
    html += '<tr class="total-row" style="background:#fff0f0"><td colspan="7">RESTANTE A PAGAR</td><td class="num">'+fmt(totalGeral)+'</td></tr>';
  }
  html += '</tbody></table><div class="rodape">MRA Mochilas e Bolsas — '+new Date().toLocaleString('pt-BR')+'</div></body></html>';
  _abrirJanela(html);
}

function imprimirFuncionario(funcId) {
  if (!_dadosFolha) { toast('Gere a folha primeiro.', 'err'); return; }
  var r = _dadosFolha.data.find(function(r){ return r.funcionario.id === funcId; });
  if (!r) { toast('Funcionário não encontrado na folha.', 'err'); return; }
  var f = r.funcionario;
  var mes = document.getElementById('folha-mes').value;
  var mesNome = '', ano = '';
  if (mes) { var mp = mes.split('-'); ano = mp[0]; mesNome = mn[parseInt(mp[1])]; }
  var salProp = r.salarioProporcional !== undefined ? parseFloat(r.salarioProporcional) : parseFloat(f.salario);
  var tl = {simples:'Falta simples', atestado:'Atestado médico', outro:'Justificado'};
  var linhas = '';
  linhas += '<tr><td>Salário base'+(r.temRescisao?' ('+r.diasTrabalhados+'/'+r.diasMes+' dias)':' ('+r.diasMes+' dias)')+'</td><td class="right">'+fmt(salProp)+'</td></tr>';
  if (r.temDireitoGratFixa) {
    linhas += '<tr><td>Gratificação fixa R$ 300,00</td><td class="right '+(r.gratFixa>0?'pos':'neg')+'">'+(r.gratFixa>0?fmt(300):'cancelada')+'</td></tr>';
  }
  (f.grats||[]).forEach(function(g){
    var cancelada = r.temFalta||r.temRescisao;
    linhas += '<tr><td>'+g.nome+'</td><td class="right '+(cancelada?'neg':'pos')+'">'+(cancelada?'cancelada':fmt(parseFloat(g.valor)))+'</td></tr>';
  });
  if (r.faltasSimples.length>0) linhas += '<tr><td>Desconto por '+r.faltasSimples.length+' falta(s) simples</td><td class="right neg">- '+fmt(parseFloat(r.desconto))+'</td></tr>';
  if (r.faltasJust.length>0) linhas += '<tr><td>Falta(s) justificada(s) — '+r.faltasJust.length+' dia(s)</td><td class="right" style="color:#b8860b">sem desconto</td></tr>';
  if (r.valorVale>0) {
    var valeObs = r.vale&&r.vale.data_vale ? ' — '+fmtData(r.vale.data_vale) : '';
    valeObs += r.vale&&r.vale.observacao ? ' ('+r.vale.observacao+')' : '';
    linhas += '<tr><td>Vale'+valeObs+'</td><td class="right neg">- '+fmt(parseFloat(r.valorVale))+'</td></tr>';
  }
var css =
    '*{box-sizing:border-box;margin:0;padding:0}' +
    'body{font-family:Arial,sans-serif;font-size:18px;color:#1a1a1a;background:#fff}' +
    '@page{size:A4;margin:0}' +
    '@media print{body{margin:0}html,body{height:100%}}' +
    '.pagina{width:210mm;height:297mm;display:flex;flex-direction:column;overflow:hidden;page-break-inside:avoid}' +
    '.recibo{width:210mm;height:139mm;padding:4mm 14mm;display:flex;flex-direction:column;overflow:hidden;flex-shrink:0}' +
    '.corte{display:flex;align-items:center;gap:6px;padding:0 14mm;height:19mm;flex-shrink:0}' +
    '.corte-linha{flex:1;border-top:2px dashed #999}' +
    '.corte-texto{font-size:12px;color:#999;letter-spacing:2px;white-space:nowrap;padding:0 6px}' +
    '.rec-header{display:flex;justify-content:space-between;align-items:center;padding-bottom:5px;border-bottom:3px solid #cc2222;margin-bottom:5px}' +
    '.rec-mra-box{display:inline-flex;flex-direction:column;align-items:center;border:2.5px solid #111;border-radius:2px;padding:4px 18px;line-height:1;gap:1px}' +
    '.rec-mra-sigla{font-size:34px;font-weight:900;color:#cc2222;letter-spacing:2px;line-height:1;font-family:Arial Black,Arial}' +
    '.rec-mra-sub{font-size:10px;font-weight:700;color:#cc2222;letter-spacing:1.5px;white-space:nowrap}' +
    '.rec-titulo{font-size:18px;font-weight:700;color:#333;text-align:right;text-transform:uppercase}' +
    '.rec-section{margin-bottom:4px;padding-bottom:2px;border-bottom:1px solid #ddd}' +
    '.rec-section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#cc2222;margin-bottom:2px;padding-bottom:2px;border-bottom:1px solid #ffcccc}' +
    '.rec-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}' +
    '.rec-field{display:flex;flex-direction:column}' +
    '.rec-label{font-size:10px;text-transform:uppercase;color:#999;letter-spacing:.3px}' +
    '.rec-value{font-size:16px;color:#1a1a1a}.bold{font-weight:700}.red{color:#cc2222}' +
    '.rec-rescisao{background:#fff0f0;border:1px solid #ffcccc;border-radius:3px;padding:3px 6px;font-size:12px;color:#cc2222;font-weight:600;margin-top:2px}' +
    '.rec-table{width:100%;border-collapse:collapse;margin-bottom:3px}' +
    '.rec-table thead th{background:#cc2222;color:#fff;padding:6px 10px;font-size:16px;text-transform:uppercase}' +
    '.rec-table tbody td{padding:5px 10px;border-bottom:1px solid #eee;font-size:17px}' +
    '.rec-table tbody tr:nth-child(even) td{background:#fafafa}.right{text-align:right}' +
    '.pos{color:#2e7d32;text-align:right}.neg{color:#cc2222;text-align:right}.cut{text-decoration:line-through;color:#aaa;text-align:right}' +
    '.rec-total td{font-weight:700;padding:7px 10px;border-top:2px solid #cc2222;background:#fff5f5;font-size:19px}' +
    '.rec-ocorrencia{font-size:12px;padding:2px 0;border-bottom:1px dashed #eee;color:#555}' +
    '.rec-tipo-falta{color:#cc2222;font-weight:600}.rec-tipo-just{color:#b8860b;font-weight:600}' +
    '.rec-assinatura{margin-top:auto;padding-top:2px;display:flex;flex-direction:column;justify-content:flex-end}' +
'.rec-ass-texto{font-size:13px;color:#333;margin-bottom:auto;margin-top:-40px;line-height:1.5;text-align:justify;font-weight:500}' +
    '.rec-ass-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:30px;margin-bottom:3px}' +
    '.rec-ass-item{text-align:center}' +
    '.rec-ass-linha{border-bottom:2px solid #333;height:60px;margin-bottom:3px}' +
    '.rec-ass-label{font-size:20px;font-weight:700;color:#222}' +
    '.rec-ass-sub{font-size:10px;color:#888}' +
    '.rec-rodape{text-align:center;font-size:9px;color:#bbb;margin-top:3px}';
  function blocoRecibo(titulo) {
    var cpf = f.cpf||'—', admissao = f.admissao?fmtData(f.admissao):'—', depto = f.departamento||'—';
    var geradoEm = new Date().toLocaleDateString('pt-BR');
    return '<div class="recibo">' +
      '<div class="rec-header">' +
        '<div class="rec-mra-box"><span class="rec-mra-sigla">MRA</span><span class="rec-mra-sub">MOCHILAS E BOLSAS</span></div>' +
        '<div class="rec-titulo">'+titulo+'</div>' +
      '</div>' +
      '<div class="rec-section"><div class="rec-section-title">DADOS DO FUNCIONÁRIO</div>' +
        '<div class="rec-grid">' +
          '<div class="rec-field"><span class="rec-label">Nome</span><span class="rec-value bold">'+f.nome+'</span></div>' +
          '<div class="rec-field"><span class="rec-label">CPF</span><span class="rec-value">'+cpf+'</span></div>' +
          '<div class="rec-field"><span class="rec-label">Cargo</span><span class="rec-value">'+f.cargo+'</span></div>' +
          '<div class="rec-field"><span class="rec-label">Departamento</span><span class="rec-value">'+depto+'</span></div>' +
          '<div class="rec-field"><span class="rec-label">Admissão</span><span class="rec-value">'+admissao+'</span></div>' +
          '<div class="rec-field"><span class="rec-label">Competência</span><span class="rec-value bold red">'+mesNome+(ano?' de '+ano:'')+'</span></div>' +
        '</div>' +
        (r.temRescisao?'<div class="rec-rescisao">⚠ Rescisão em '+fmtData(r.dataRescisao)+' — '+r.diasTrabalhados+' de '+r.diasMes+' dias</div>':'') +
      '</div>' +
      '<div class="rec-section"><div class="rec-section-title">DETALHAMENTO DE PAGAMENTO</div>' +
        '<table class="rec-table"><thead><tr><th>Descrição</th><th class="right">Valor</th></tr></thead>' +
        '<tbody>'+linhas+'</tbody>' +
        '<tfoot><tr class="rec-total"><td>TOTAL LÍQUIDO A RECEBER</td><td class="right red bold">'+fmt(parseFloat(r.totalLiquido))+'</td></tr></tfoot>' +
        '</table>' +
      '</div>' +
      (r.faltasMes&&r.faltasMes.length ?
        '<div class="rec-section"><div class="rec-section-title">OCORRÊNCIAS DO MÊS</div>' +
        r.faltasMes.map(function(fa){
          return '<div class="rec-ocorrencia"><span style="font-weight:600">'+fmtData(fa.data)+'</span> <span class="rec-tipo-'+(fa.tipo==='simples'?'falta':'just')+'">'+(tl[fa.tipo]||fa.tipo)+'</span> — '+fa.justificativa+'</div>';
        }).join('')+'</div>' : '') +
      '<div class="rec-assinatura">' +
        '<div class="rec-ass-texto">Declaro que recebi os valores acima discriminados, referentes à competência <strong>'+mesNome+(ano?' de '+ano:'')+'</strong>, estando de acordo com o presente recibo.</div>' +
        '<div class="rec-ass-grid">' +
          '<div class="rec-ass-item"><div class="rec-ass-linha"></div><div class="rec-ass-label">'+f.nome+'</div><div class="rec-ass-sub">Assinatura do Funcionário</div></div>' +
          '<div class="rec-ass-item"><div class="rec-ass-linha"></div><div class="rec-ass-label">Responsável pela Empresa</div><div class="rec-ass-sub">Assinatura e Carimbo</div></div>' +
          '<div class="rec-ass-item"><div class="rec-ass-linha"></div><div class="rec-ass-label">Data de recebimento</div><div class="rec-ass-sub">____/____/________</div></div>' +
        '</div>' +
        '<div class="rec-rodape">Gerado em '+geradoEm+' — MRA Mochilas e Bolsas | Documento sem valor fiscal</div>' +
      '</div>' +
    '</div>';
  }
  var html = '<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recibo — '+f.nome+'</title><style>'+css+'</style></head><body><div class="pagina">';
  html += blocoRecibo('RECIBO DE PAGAMENTO — VIA DA EMPRESA');
  html += '<div class="corte"><div class="corte-linha"></div><span class="corte-texto">✂ RECORTE AQUI ✂</span><div class="corte-linha"></div></div>';
  html += blocoRecibo('RECIBO DE PAGAMENTO — VIA DO FUNCIONÁRIO');
  html += '</div></body></html>';
  _abrirJanela(html);
}

// ─── VALE TRANSPORTE ─────────────────────────────────────────

var feriadosNacionais = [
  {d:1,  m:1,  n:'Confraternização Universal'},
  {d:21, m:4,  n:'Tiradentes'},
  {d:1,  m:5,  n:'Dia do Trabalho'},
  {d:7,  m:9,  n:'Independência do Brasil'},
  {d:12, m:10, n:'Nossa Sra. Aparecida'},
  {d:2,  m:11, n:'Finados'},
  {d:15, m:11, n:'Proclamação da República'},
  {d:20, m:11, n:'Consciência Negra'},
  {d:25, m:12, n:'Natal'},
];

var feriadosGoias = [
  {d:26, m:7,  n:'Aniversário de Goiânia'},
  {d:24, m:10, n:'Pedra Fundamental de Goiás'},
];

function calcularPascoa(ano) {
  var a=ano%19, b=Math.floor(ano/100), c=ano%100, d=Math.floor(b/4), e=b%4;
  var f=Math.floor((b+8)/25), g=Math.floor((b-f+1)/3);
  var h=(19*a+b-d-g+15)%30, i=Math.floor(c/4), k=c%4;
  var l=(32+2*e+2*i-h-k)%7, m=Math.floor((a+11*h+22*l)/451);
  var mes=Math.floor((h+l-7*m+114)/31), dia=((h+l-7*m+114)%31)+1;
  return new Date(ano, mes-1, dia);
}

function getFeriadosMoveis(ano) {
  var pascoa = calcularPascoa(ano), result = [];
  var carnaval = new Date(pascoa); carnaval.setDate(carnaval.getDate()-47);
  result.push({d:carnaval.getDate(), m:carnaval.getMonth()+1, n:'Carnaval'});
  var sextaSanta = new Date(pascoa); sextaSanta.setDate(sextaSanta.getDate()-2);
  result.push({d:sextaSanta.getDate(), m:sextaSanta.getMonth()+1, n:'Sexta-feira Santa'});
  result.push({d:pascoa.getDate(), m:pascoa.getMonth()+1, n:'Páscoa'});
  var corpus = new Date(pascoa); corpus.setDate(corpus.getDate()+60);
  result.push({d:corpus.getDate(), m:corpus.getMonth()+1, n:'Corpus Christi'});
  return result;
}

function fmtVT(v) {
  return 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}


function renderVTFuncs(semanas, valorDia, fmtDate) {
  var funcsVT = _todosFunc.filter(function(f){ return f.vale_transporte; });
  if (!funcsVT.length) return '';
  var html = '<div class="card animate-in" style="animation-delay:.15s"><div class="card-title">👥 Funcionários com Vale Transporte</div>';
  funcsVT.forEach(function(f) {
    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">' +
      '<div>' +
        '<div style="font-family:Rajdhani,sans-serif;font-size:15px;font-weight:700;color:var(--text)">'+f.nome+'</div>' +
        '<div style="font-size:12px;color:var(--muted)">'+f.cargo+(f.departamento?' — '+f.departamento:'')+'</div>' +
      '</div>' +
      '<div style="text-align:right">' +
        semanas.map(function(s,idx){
          var v = s.dias.length * valorDia;
          return '<div style="font-size:11px;color:var(--muted)">Sem '+(idx+1)+' ('+fmtDate(s.inicio)+'): <strong style="color:var(--red-l)">'+fmtVT(v)+'</strong></div>';
        }).join('') +
      '</div>' +
    '</div>';
  });
  html += '</div>';
  return html;
}

function calcularVT() {
  var mesInput = document.getElementById('vt-mes') ? document.getElementById('vt-mes').value : '';
  var passagem = parseFloat(document.getElementById('vt-passagem') ? document.getElementById('vt-passagem').value : 4.30) || 4.30;
  var passagensDia = parseInt(document.getElementById('vt-passagens-dia') ? document.getElementById('vt-passagens-dia').value : 2) || 2;
  var el = document.getElementById('vt-resultado');
  if (!el) return;
  if (!mesInput) { el.innerHTML = ''; return; }

  var partes = mesInput.split('-');
  var ano = parseInt(partes[0]);
  var mes = parseInt(partes[1]);
  var nomeMes = mn[mes] + ' de ' + ano;

  var moveis = getFeriadosMoveis(ano);
  var todosFeriados = feriadosNacionais.concat(feriadosGoias).concat(moveis);

  function ehFeriado(d) {
    return todosFeriados.find(function(f){ return f.d===d.getDate() && f.m===d.getMonth()+1; });
  }

  var primeiroDia = new Date(ano, mes-1, 1);
  var diaSemana = primeiroDia.getDay();
  var offset = diaSemana===0 ? -6 : -(diaSemana-1);
  var cursor = new Date(primeiroDia);
  cursor.setDate(cursor.getDate()+offset);

  var semanas = [];
  var encontrouMes = false;
  while (true) {
    var fimSemana = new Date(cursor); fimSemana.setDate(fimSemana.getDate()+4);
    var temDiaNoMes = false;
    for (var i=0; i<5; i++) {
      var d = new Date(cursor); d.setDate(d.getDate()+i);
      if (d.getMonth()+1===mes && d.getFullYear()===ano) { temDiaNoMes=true; break; }
    }
    if (temDiaNoMes) {
      encontrouMes = true;
      var semana = {dias:[], feriados:[], inicio:new Date(cursor), fim:new Date(fimSemana)};
      for (var i=0; i<5; i++) {
        var d = new Date(cursor); d.setDate(d.getDate()+i);
        var feriado = ehFeriado(d);
        if (feriado) semana.feriados.push({dia:d.getDate(), mes:d.getMonth()+1, nome:feriado.n, data:new Date(d)});
        else semana.dias.push(new Date(d));
      }
      semanas.push(semana);
    } else if (encontrouMes) {
      break;
    }
    cursor.setDate(cursor.getDate()+7);
  }

  var valorDia = passagem * passagensDia;
  var totalDiasUteis = semanas.reduce(function(s,sem){ return s+sem.dias.length; }, 0);
  var valorMes = totalDiasUteis * valorDia;
  var valor15dias = Math.ceil(totalDiasUteis/2) * valorDia;

  var fmtDate = function(d) {
    return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0');
  };

  var feriadosDoMes = [];
  semanas.forEach(function(s) {
    s.feriados.forEach(function(f) {
      if (f.mes===mes && f.data.getFullYear()===ano) feriadosDoMes.push(f);
    });
  });

  var html = '';

  // Cards resumo
  html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:1.25rem">';
  html += '<div class="card" style="text-align:center;margin-bottom:0">' +
    '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);margin-bottom:6px">Por semana</div>' +
    '<div style="font-family:Rajdhani,sans-serif;font-size:14px;color:var(--dim)">Varia por semana</div>' +
    '<div style="font-size:11px;color:var(--muted);margin-top:4px">'+passagensDia+'x R$ '+passagem.toFixed(2).replace('.',',')+'</div>' +
  '</div>';
  html += '<div class="card" style="text-align:center;margin-bottom:0">' +
    '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);margin-bottom:6px">15 dias</div>' +
    '<div style="font-family:Rajdhani,sans-serif;font-size:22px;font-weight:700;color:var(--red-l)">'+fmtVT(valor15dias)+'</div>' +
    '<div style="font-size:11px;color:var(--muted)">'+Math.ceil(totalDiasUteis/2)+' dias úteis</div>' +
  '</div>';
  html += '<div class="card" style="text-align:center;margin-bottom:0">' +
    '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);margin-bottom:6px">Mês completo</div>' +
    '<div style="font-family:Rajdhani,sans-serif;font-size:22px;font-weight:700;color:var(--red-l)">'+fmtVT(valorMes)+'</div>' +
    '<div style="font-size:11px;color:var(--muted)">'+totalDiasUteis+' dias úteis</div>' +
  '</div>';
  html += '</div>';

  // Feriados
  if (feriadosDoMes.length > 0) {
    var diasNome = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    html += '<div class="card animate-in" style="margin-bottom:1.25rem"><div class="card-title">🗓 Feriados em '+nomeMes+'</div>';
    feriadosDoMes.forEach(function(f) {
      html += '<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)">' +
        '<span style="font-family:Rajdhani,sans-serif;font-size:16px;font-weight:700;color:var(--warn);min-width:50px">'+String(f.dia).padStart(2,'0')+'/'+String(f.mes).padStart(2,'0')+'</span>' +
        '<span style="font-size:12px;color:var(--muted);min-width:28px">'+diasNome[f.data.getDay()]+'</span>' +
        '<span style="font-size:14px;color:var(--text)">'+f.nome+'</span>' +
        '<span class="badge badge-warn" style="margin-left:auto">Não trabalha</span>' +
      '</div>';
    });
    html += '</div>';
  }

  // Semanas
  html += '<div class="card animate-in" style="animation-delay:.1s"><div class="card-title">📅 Semanas — pagamento toda segunda-feira</div>';
  semanas.forEach(function(s, idx) {
    var diasUteisSem = s.dias.length;
    var valorSem = diasUteisSem * valorDia;
    var temFeriado = s.feriados.length > 0;
    var periodo = fmtDate(s.inicio)+' a '+fmtDate(s.fim);
    html += '<div style="background:var(--bg2);border:1px solid '+(temFeriado?'rgba(255,193,7,0.4)':'var(--border)')+';border-radius:var(--r);padding:12px 14px;margin-bottom:8px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:'+(temFeriado?'8':'0')+'px">' +
        '<div>' +
          '<span style="font-family:Rajdhani,sans-serif;font-size:15px;font-weight:700;color:var(--text)">Semana '+(idx+1)+'</span>' +
          '<span style="font-size:12px;color:var(--muted);margin-left:8px">'+periodo+'</span>' +
          '<span style="font-size:12px;color:var(--muted);margin-left:8px">('+diasUteisSem+' dias úteis)</span>' +
        '</div>' +
        '<span style="font-family:Rajdhani,sans-serif;font-size:18px;font-weight:700;color:'+(temFeriado?'var(--warn)':'var(--red-l)')+'">'+fmtVT(valorSem)+'</span>' +
      '</div>';
    if (temFeriado) {
      s.feriados.forEach(function(f) {
        html += '<div style="font-size:12px;color:var(--warn);display:flex;align-items:center;gap:6px;margin-top:2px"><span>⚠</span><span>Feriado '+fmtDate(f.data)+': '+f.nome+'</span></div>';
      });
    }
    html += '</div>';
  });
  html += '</div>';
  html += renderVTFuncs(semanas, valorDia, fmtDate);
  html += '<div style="font-size:12px;color:var(--dim);text-align:center;margin-bottom:1rem">Valor por dia: '+passagensDia+' passagem(ns) × R$ '+passagem.toFixed(2).replace('.',',')+' = R$ '+valorDia.toFixed(2).replace('.',',')+' &nbsp;|&nbsp; Feriados nacionais + Goiás incluídos</div>';

  el.innerHTML = html;
}

// ─── INIT ────────────────────────────────────────────────────

(function(){
  var hoje=new Date();
  var m=String(hoje.getMonth()+1).padStart(2,'0');
  var mesAtual=hoje.getFullYear()+'-'+m;
  var fm=document.getElementById('folha-mes'); if(fm) fm.value=mesAtual;
  var vm=document.getElementById('v-mes'); if(vm) vm.value=mesAtual;
  var fvm=document.getElementById('filtro-mes-vale'); if(fvm) fvm.value=mesAtual;
  var vtm=document.getElementById('vt-mes'); if(vtm) vtm.value=mesAtual;
  var fa=document.getElementById('c-admissao');
  if(fa) {
    var d=String(hoje.getDate()).padStart(2,'0');
    var mo=String(hoje.getMonth()+1).padStart(2,'0');
    fa.value = d+'/'+mo+'/'+hoje.getFullYear();
  }
  atualizarDiasMes();
  renderGratsTemp();
  atualizarBadgeFuncs();
  // Calcula VT ao carregar se a página VT estiver ativa
  setTimeout(function(){ calcularVT(); }, 200);
})();