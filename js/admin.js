import { supabase, tempClient } from './supabase.js';
import { $, esc, requireRole, logout, toast, failed, initTabs } from './auth.js';

const me = await requireRole(['admin']);
if(me) start();
let depts=[];

async function start(){
  initTabs();
  $('#logout').onclick=logout;
  await Promise.all([loadCompany(), loadDepts(), loadLeaveTypes(), loadHR()]);
  loadDesigs();
}

async function loadCompany(){
  const {data} = await supabase.from('company').select('*').eq('id',1).maybeSingle();
  if(data){
    $('#cName').value=data.name||''; $('#cAddr').value=data.address||'';
    $('#cStart').value=(data.work_start||'09:00').slice(0,5);
    $('#cEnd').value=(data.work_end||'17:00').slice(0,5);
  }
}
$('#companyForm').onsubmit=async(e)=>{
  e.preventDefault();
  const {error} = await supabase.from('company').upsert({id:1,name:$('#cName').value.trim(),address:$('#cAddr').value.trim(),work_start:$('#cStart').value,work_end:$('#cEnd').value});
  if(!failed(error)) toast('Company save ho gayi');
};

async function loadDepts(){
  const {data} = await supabase.from('departments').select('*').order('name');
  depts=data||[];
  $('#deptList').innerHTML=depts.map(d=>`<tr><td>${esc(d.name)}</td><td><button class="btn sm danger" data-del="${d.id}">Delete</button></td></tr>`).join('')||'<tr><td colspan=2 class=muted>No departments yet</td></tr>';
  $('#gDept').innerHTML='<option value="">-- No Department --</option>'+depts.map(d=>`<option value="${d.id}">${esc(d.name)}</option>`).join('');
}
$('#deptForm').onsubmit=async(e)=>{
  e.preventDefault();
  const {error}=await supabase.from('departments').insert({name:$('#dName').value.trim()});
  if(failed(error)) return; e.target.reset(); toast('Department added'); loadDepts();
};
$('#deptList').onclick=async(e)=>{
  const id=e.target.dataset.del; if(!id||!confirm('Delete?')) return;
  if(failed((await supabase.from('departments').delete().eq('id',id)).error)) return;
  loadDepts(); loadDesigs();
};

async function loadDesigs(){
  const {data}=await supabase.from('designations').select('*, departments(name)').order('title');
  $('#desigList').innerHTML=(data||[]).map(g=>`<tr><td>${esc(g.title)}</td><td>${esc(g.departments?.name||'-')}</td><td><button class="btn sm danger" data-del="${g.id}">Delete</button></td></tr>`).join('')||'<tr><td colspan=3 class=muted>No designations yet</td></tr>';
}
$('#desigForm').onsubmit=async(e)=>{
  e.preventDefault();
  const {error}=await supabase.from('designations').insert({title:$('#gTitle').value.trim(),department_id:$('#gDept').value||null});
  if(failed(error)) return; e.target.reset(); toast('Designation added'); loadDesigs();
};
$('#desigList').onclick=async(e)=>{
  const id=e.target.dataset.del; if(!id||!confirm('Delete?')) return;
  if(failed((await supabase.from('designations').delete().eq('id',id)).error)) return; loadDesigs();
};

async function loadLeaveTypes(){
  const {data}=await supabase.from('leave_types').select('*').order('name');
  $('#ltList').innerHTML=(data||[]).map(t=>`<tr><td>${esc(t.name)}</td><td>${t.days_per_year}</td><td><button class="btn sm danger" data-del="${t.id}">Delete</button></td></tr>`).join('')||'<tr><td colspan=3 class=muted>No leave types yet</td></tr>';
}
$('#ltForm').onsubmit=async(e)=>{
  e.preventDefault();
  const {error}=await supabase.from('leave_types').insert({name:$('#lName').value.trim(),days_per_year:Number($('#lDays').value)});
  if(failed(error)) return; e.target.reset(); $('#lDays').value=10; toast('Leave type added'); loadLeaveTypes();
};
$('#ltList').onclick=async(e)=>{
  const id=e.target.dataset.del; if(!id||!confirm('Delete?')) return;
  if(failed((await supabase.from('leave_types').delete().eq('id',id)).error)) return; loadLeaveTypes();
};

async function loadHR(){
  const {data}=await supabase.from('profiles').select('*').in('role',['hr','admin']).order('created_at');
  $('#hrList').innerHTML=(data||[]).map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(p.email)}</td><td><span class="badge approved">${esc(p.role)}</span></td></tr>`).join('');
}
$('#hrForm').onsubmit=async(e)=>{
  e.preventDefault();
  const name=$('#hName').value.trim(); const email=$('#hEmail').value.trim();
  const {data,error}=await tempClient().auth.signUp({email,password:$('#hPass').value,options:{data:{name}}});
  if(error) return toast(error.message,true);
  if(!data.user||data.user.identities?.length===0) return toast('Ye email pehle se registered hai',true);
  const {error:upErr}=await supabase.from('profiles').update({role:'hr',name}).eq('id',data.user.id);
  if(failed(upErr)) return; e.target.reset(); toast('HR user ban gaya'); loadHR();
};