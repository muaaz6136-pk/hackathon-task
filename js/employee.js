import { supabase } from './supabase.js';
import { requireRole, toast } from './auth.js';

await requireRole(['employee','hr','admin']);
const { data:{user} } = await supabase.auth.getUser();
if(!user) location.href='login.html';

let empId = null;

async function load(){
  const { data: emp } = await supabase.from('employees').select('*, departments(name)').eq('user_id', user.id).single();
  const profileEl = document.getElementById('profile');
  if(profileEl) profileEl.innerHTML = emp ? `Name: ${emp.name}<br>Email: ${emp.email}<br>Dept: ${emp.departments?.name||''}<br>Salary: ${emp.salary||'-'}` : 'HR has not created your employee record yet.';
  const { data: types } = await supabase.from('leave_types').select('*');
  const typeEl = document.getElementById('lType');
  if(typeEl) typeEl.innerHTML = types?.map(t=>`<option value="${t.id}">${t.name} (${t.total_days} days)</option>`).join('') || '';
  if(emp){
    empId = emp.id;
    const { data: leaves } = await supabase.from('leave_requests').select('*, leave_types(name)').eq('employee_id', emp.id).order('created_at',{ascending:false});
    const leavesEl = document.getElementById('myLeaves');
    if(leavesEl) leavesEl.innerHTML = leaves?.map(l=>`<tr><td>${l.from_date} to ${l.to_date}</td><td>${l.leave_types?.name||''}<br><small>${l.reason||''}</small></td><td><span class="badge ${l.status}">${l.status}</span></td></tr>`).join('') || '<tr><td colspan=3>No leaves</td></tr>';
  }
}
load();

document.getElementById('applyBtn')?.addEventListener('click', async()=>{
  const leave_type_id=document.getElementById('lType').value;
  const from_date=document.getElementById('from').value;
  const to_date=document.getElementById('to').value;
  const reason=document.getElementById('reason').value;
  if(!from_date||!to_date) return toast('Select dates',true);
  if(!empId) return toast('Employee record not found', true);
  const {error}=await supabase.from('leave_requests').insert({employee_id:empId, leave_type_id, from_date, to_date, reason, status:'pending'});
  const msg = document.getElementById('lMsg');
  if(msg) msg.innerText=error?error.message:'Leave Applied!';
  if(!error) toast('Leave applied'); load();
});

document.getElementById('logout')?.addEventListener('click', async()=>{
  await supabase.auth.signOut();
  localStorage.clear(); sessionStorage.clear();
  location.href='login.html';
});