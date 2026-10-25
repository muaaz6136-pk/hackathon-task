// js/hr.js - CLEAN FINAL - SIDE PANEL
import { supabase, tempClient } from './supabase.js';
import { $, esc, requireRole, logout, toast, failed, initTabs, todayStr } from './auth.js';

let depts = [];
let desigs = [];
let emps = [];
let types = [];

const me = await requireRole(['hr', 'admin']);
if (me) start();

async function start() {
  initTabs();
  $('#logout').onclick = logout;
  if (me.role === 'admin') {
    const link = $('#adminLink');
    if (link) link.style.display = '';
  }
  await loadRef();
  await loadEmps();
  loadDashboard();
  initAttendance();
  initLeaves();
  initAI();
}

const opts = (arr, k) => arr.map(x => `<option value="${x.id}">${esc(x[k])}</option>`).join('');
const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5) + 1;

async function loadRef() {
  const [d, g, t] = await Promise.all([
    supabase.from('departments').select('*').order('name'),
    supabase.from('designations').select('*').order('title'),
    supabase.from('leave_types').select('*')
  ]);
  depts = d.data || [];
  desigs = g.data || [];
  types = t.data || [];
  $('#eDept').innerHTML = '<option value="">-- Select --</option>' + opts(depts, 'name');
  fillDesig();
}

function fillDesig() {
  const dept = $('#eDept').value;
  const list = desigs.filter(g => !dept || g.department_id === dept);
  $('#eDesig').innerHTML = '<option value="">-- Select --</option>' + opts(list, 'title');
}
$('#eDept').onchange = fillDesig;

async function loadDashboard() {
  const t = todayStr();
  const [att, pend, onLeave] = await Promise.all([
    supabase.from('attendance').select('status').eq('date', t),
    supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'approved').lte('from_date', t).gte('to_date', t)
  ]);
  const active = emps.filter(e => e.status === 'active').length;
  const rows = att.data || [];
  const c = s => rows.filter(a => a.status === s).length;

  $('#stats').innerHTML = [
    ['Total Employees', emps.length],
    ['Active', active],
    ['Present today', c('present')],
    ['Absent today', c('absent')],
    ['Pending leaves', pend.count ?? 0],
    ['On leave', onLeave.count ?? 0]
  ].map(([l, v]) => `<div class="stat"><b>${v}</b><small>${l}</small></div>`).join('');

  const lines = depts.map(d => [d.name, emps.filter(e => e.status === 'active' && e.department_id === d.id).length]);
  $('#deptStats').innerHTML = lines.map(([n, v]) => `<tr><td>${esc(n)}</td><td>${v}</td></tr>`).join('') || '<tr><td colspan=2 class=muted>No data</td></tr>';
}

async function loadEmps() {
  const { data, error } = await supabase.from('employees').select('*, departments(name), designations(title)').order('name');
  if (failed(error)) return;
  emps = data || [];
  renderEmps();
}

function renderEmps() {
  const q = $('#empSearch').value.trim().toLowerCase();
  const list = emps.filter(e => e.name.toLowerCase().includes(q));
  $('#empList').innerHTML = list.map(e => `
    <tr>
      <td>${esc(e.name)}<br><small class="muted">${esc(e.email || '')}</small></td>
      <td>${esc(e.departments?.name || '-')}</td>
      <td>${esc(e.designations?.title || '-')}</td>
      <td>${e.salary ?? '-'}</td>
      <td>${esc(e.join_date || '')}</td>
      <td><span class="badge ${e.status}">${e.status}</span></td>
      <td><button class="btn sm" data-edit="${e.id}">Edit</button> <button class="btn sm danger" data-del="${e.id}">Del</button></td>
    </tr>
  `).join('') || '<tr><td colspan=7 class=muted>Abhi koi employee nahi</td></tr>';
}
$('#empSearch').oninput = renderEmps;

function resetForm() {
  $('#empForm').reset();
  $('#eId').value = '';
  $('#empFormTitle').textContent = 'Register Employee';
  $('#passWrap').style.display = '';
  $('#eCancel').style.display = 'none';
  fillDesig();
}
$('#eCancel').onclick = resetForm;

$('#empList').onclick = async (e) => {
  const edit = e.target.dataset.edit;
  const del = e.target.dataset.del;
  if (edit) {
    const emp = emps.find(x => x.id === edit);
    $('#eId').value = emp.id;
    $('#eName').value = emp.name;
    $('#eEmail').value = emp.email || '';
    $('#ePhone').value = emp.phone || '';
    $('#eDept').value = emp.department_id || '';
    fillDesig();
    $('#eDesig').value = emp.designation_id || '';
    $('#eSalary').value = emp.salary ?? '';
    $('#eJoin').value = emp.join_date || '';
    $('#eStatus').value = emp.status;
    $('#passWrap').style.display = 'none';
    $('#empFormTitle').textContent = 'Edit Employee';
    $('#eCancel').style.display = '';
  }
  if (del && confirm('Delete karna hai?')) {
    const { error } = await supabase.from('employees').delete().eq('id', del);
    if (failed(error)) return;
    toast('Deleted');
    await loadEmps();
    loadDashboard();
    loadAtt();
  }
};

$('#empForm').onsubmit = async (e) => {
  e.preventDefault();
  const id = $('#eId').value;
  const rec = {
    name: $('#eName').value.trim(),
    email: $('#eEmail').value.trim() || null,
    phone: $('#ePhone').value.trim() || null,
    department_id: $('#eDept').value || null,
    designation_id: $('#eDesig').value || null,
    salary: $('#eSalary').value || null,
    join_date: $('#eJoin').value || todayStr(),
    status: $('#eStatus').value
  };
  $('#eSave').disabled = true;
  try {
    if (id) {
      const { error } = await supabase.from('employees').update(rec).eq('id', id);
      if (failed(error)) return;
      toast('Updated');
    } else {
      const pw = $('#ePass').value;
      if (pw) {
        if (!rec.email) return toast('Email zaroori hai', true);
        if (pw.length < 6) return toast('Password 6 chars', true);
        const { data, error } = await tempClient().auth.signUp({ email: rec.email, password: pw, options: { data: { name: rec.name } } });
        if (error) return toast(error.message, true);
        if (!data.user || data.user.identities?.length === 0) return toast('Email already exists', true);
        rec.user_id = data.user.id;
      }
      const { error } = await supabase.from('employees').insert(rec);
      if (failed(error)) return;
      toast('Employee added');
    }
    resetForm();
    await loadEmps();
    loadDashboard();
    loadAtt();
  } finally {
    $('#eSave').disabled = false;
  }
};

function initAttendance() {
  $('#attDate').value = todayStr();
  $('#attDate').onchange = loadAtt;
  $('#markAll').onclick = () => document.querySelectorAll('#attBody .st').forEach(s => { if (!s.value) s.value = 'present'; });
  $('#saveAtt').onclick = saveAtt;
  loadAtt();
}

async function loadAtt() {
  const date = $('#attDate').value;
  const { data } = await supabase.from('attendance').select('*').eq('date', date);
  const map = Object.fromEntries((data || []).map(a => [a.employee_id, a]));
  const active = emps.filter(e => e.status === 'active');
  $('#attBody').innerHTML = active.map(e => {
    const a = map[e.id] || {};
    const options = ['present', 'late', 'absent'].map(s => `<option value="${s}" ${a.status === s ? 'selected' : ''}>${s}</option>`).join('');
    return `<tr data-id="${e.id}"><td>${esc(e.name)}</td><td>${esc(e.departments?.name || '-')}</td><td><select class="st"><option value="">Not marked</option>${options}</select></td><td><input type="time" class="ci" value="${a.check_in ? a.check_in.slice(0,5) : ''}"></td><td><input type="time" class="co" value="${a.check_out ? a.check_out.slice(0,5) : ''}"></td></tr>`;
  }).join('') || '<tr><td colspan=5 class=muted>No employees</td></tr>';
}

async function saveAtt() {
  const date = $('#attDate').value;
  const rows = [...document.querySelectorAll('#attBody tr[data-id]')].filter(tr => tr.querySelector('.st').value).map(tr => ({
    employee_id: tr.dataset.id,
    date,
    status: tr.querySelector('.st').value,
    check_in: tr.querySelector('.ci').value || null,
    check_out: tr.querySelector('.co').value || null
  }));
  if (!rows.length) return toast('Select status first', true);
  const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'employee_id,date' });
  if (failed(error)) return;
  toast(`${rows.length} saved`);
  loadDashboard();
}

function initLeaves() {
  $('#leaveFilter').onchange = loadLeaves;
  $('#leaveList').onclick = async (e) => {
    const id = e.target.dataset.id;
    const act = e.target.dataset.act;
    if (!id) return;
    const { error } = await supabase.from('leave_requests').update({ status: act }).eq('id', id);
    if (failed(error)) return;
    toast(`Leave ${act}`);
    loadLeaves();
    loadDashboard();
  };
  loadLeaves();
}

async function loadLeaves() {
  const f = $('#leaveFilter').value;
  let q = supabase.from('leave_requests').select('*, employees(name), leave_types(name)').order('created_at', { ascending: false });
  if (f) q = q.eq('status', f);
  const { data, error } = await q;
  if (failed(error)) return;
  $('#leaveList').innerHTML = (data || []).map(l => `
    <tr>
      <td>${esc(l.employees?.name)}</td>
      <td>${esc(l.leave_types?.name || '-')}</td>
      <td>${l.from_date}</td>
      <td>${l.to_date}</td>
      <td>${days(l.from_date, l.to_date)}</td>
      <td>${esc(l.reason || '')}</td>
      <td><span class="badge ${l.status}">${l.status}</span></td>
      <td>${l.status === 'pending' ? `<button class="btn sm ok" data-act="approved" data-id="${l.id}">Approve</button> <button class="btn sm danger" data-act="rejected" data-id="${l.id}">Reject</button>` : ''}</td>
    </tr>
  `).join('') || '<tr><td colspan=8 class=muted>No leaves</td></tr>';
}

function initAI() {
  const chat = $('#chat');
  const add = (who, text) => {
    const d = document.createElement('div');
    d.className = 'msg ' + who;
    d.textContent = text;
    chat.appendChild(d);
    chat.scrollTop = chat.scrollHeight;
    return d;
  };
  add('bot', 'Real data se pucho!');
  async function ask(question) {
    add('user', question);
    const wait = add('bot', 'Soch raha hoon...');
    try {
      const { data, error } = await supabase.functions.invoke('ask-ai', { body: { question } });
      if (error) throw error;
      wait.textContent = data?.answer || 'No answer';
    } catch (err) {
      wait.textContent = 'AI error: ' + err.message;
    }
  }
  $('#chatForm').onsubmit = (e) => {
    e.preventDefault();
    const q = $('#chatInput').value.trim();
    if (!q) return;
    $('#chatInput').value = '';
    ask(q);
  };
  $('#chips').onclick = (e) => {
    if (e.target.tagName === 'BUTTON') ask(e.target.textContent);
  };
}