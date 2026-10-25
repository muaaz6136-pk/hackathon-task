import { supabase } from './supabase.js';
export const $ = s => document.querySelector(s);
export const esc = v => String(v??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const pages = { admin:'admin.html', hr:'hr.html', employee:'employee.html' };
export const todayStr = () => new Date().toLocaleDateString('en-CA');
export async function getProfile(){ const {data:{session}} = await supabase.auth.getSession(); if(!session) return null; const {data} = await supabase.from('profiles').select('*').eq('id', session.user.id).single(); return data; }
export async function requireRole(allowed){ const p = await getProfile(); if(!p){ location.href='login.html'; return null; } if(!allowed.includes(p.role)){ location.href=pages[p.role] || 'login.html'; return null; } const el = $('#who'); if(el) el.textContent = `${p.name||p.email} (${p.role})`; return p; }
export async function logout(){ await supabase.auth.signOut(); location.href='login.html'; }
export function toast(msg, err=false){ const t=$('#toast'); if(!t){ alert(msg); return; } t.textContent=msg; t.className=err?'err':''; t.style.display='block'; setTimeout(()=>t.style.display='none',3500); }
export function failed(error){ if(error){ toast(error.message,true); return true; } return false; }
export function initTabs(){ const btns=document.querySelectorAll('.sidebar nav button[data-tab], nav.tabs button'); const tabs=document.querySelectorAll('.tab'); const show=name=>{ btns.forEach(b=>b.classList.toggle('active', b.dataset.tab===name)); tabs.forEach(t=>t.classList.toggle('active', t.id===name)); }; btns.forEach(b=>b.onclick=()=>show(b.dataset.tab)); if(btns.length) show(btns[0].dataset.tab); }