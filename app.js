/* GradeMate - shared logic. Data lives in the browser (localStorage / sessionStorage). */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const jget = (store, k, d) => { try { return JSON.parse(store.getItem(k)) ?? d } catch { return d } };
const jset = (store, k, v) => store.setItem(k, JSON.stringify(v));
const flow = () => jget(sessionStorage, 'flow', {});
const setFlow = v => jset(sessionStorage, 'flow', v);
const user = () => jget(localStorage, 'gm_user', null);
const go = u => location.href = u;
const r2 = n => Math.round(n * 100) / 100;
const page = document.body.dataset.page;

/* ---------- Layout ---------- */
function layout() {
  const u = user();
  const links = [['index.html','Home'],['dashboard.html','Dashboard'],['contact.html','Contact']]
    .map(([h,t]) => `<a href="${h}" class="${location.pathname.endsWith(h)?'on':''}">${t}</a>`).join('');
  const auth = u ? `<span>Hi, ${esc(u.name)}</span><a href="#" id="out">Log out</a>`
    : `<a href="login.html">Log in</a><a class="btn" href="signup.html">Sign up</a>`;
  $('#nav').outerHTML = `<nav><a class="logo" href="index.html">📐 GradeMate</a>${links}${auth}</nav>`;
  $('#foot').innerHTML = `© ${new Date().getFullYear()} GradeMate · Made for students and teachers`;
  const o = $('#out'); if (o) o.onclick = e => { e.preventDefault(); localStorage.removeItem('gm_user'); go('index.html'); };
}

/* ---------- Helpers ---------- */
function form(step, title, html, cb, back = true) {
  $('#main').innerHTML = `<div class="card"><p class="step">${step}</p><h2>${title}</h2><form id="f">${html}
    <p class="msg" id="err"></p><div class="row">${back?'<button type="button" class="btn ghost" onclick="history.back()">Back</button>':''}<button class="btn">Continue</button></div></form></div>`;
  $('#f').onsubmit = e => { e.preventDefault(); cb(new FormData(e.target), m => $('#err').textContent = m) };
}
const numField = (name, label, min, max, val = '') =>
  `<label for="${name}">${label}</label><input id="${name}" name="${name}" type="number" min="${min}" ${max?`max="${max}"`:''} step="any" value="${val}" required>`;
const textFields = (prefix, n, label, vals = []) =>
  Array.from({length: n}, (_, i) => `<label for="${prefix}${i}">${label} ${i+1}</label><input id="${prefix}${i}" name="${prefix}${i}" value="${esc(vals[i]||'')}" required>`).join('');
const collect = (fd, prefix, n) => Array.from({length: n}, (_, i) => String(fd.get(prefix + i)).trim());
const dupes = a => new Set(a.map(x => x.toLowerCase())).size !== a.length;
function stats(a) { const sum = a.reduce((x, y) => x + y, 0); return {sum: r2(sum), avg: r2(sum / a.length), min: Math.min(...a), max: Math.max(...a)} }
const grade = p => p >= 90 ? 'A' : p >= 80 ? 'B' : p >= 70 ? 'C' : p >= 60 ? 'D' : 'F';
const need = (cond, to) => { if (!cond) { go(to); return false } return true };

/* ---------- Student flow ---------- */
const pages = {
  s1() { form('Student mode · Step 1 of 4', 'How many subjects do you have?',
      numField('n','Number of subjects',1,20) + numField('max','Highest possible mark per subject',1,'',100),
      fd => { setFlow({mode:'student', n:+fd.get('n'), max:+fd.get('max')}); go('student-2.html') }, false) },
  s2() { const f = flow(); if (!need(f.mode==='student'&&f.n,'student-1.html')) return;
    form('Student mode · Step 2 of 4', 'Name your subjects', textFields('s',f.n,'Subject',f.subjects),
      (fd, err) => { const s = collect(fd,'s',f.n); if (dupes(s)) return err('Each subject needs a different name.'); f.subjects = s; setFlow(f); go('student-3.html') }) },
  s3() { const f = flow(); if (!need(f.subjects,'student-1.html')) return;
    form('Student mode · Step 3 of 4', 'Enter your mark for each subject',
      f.subjects.map((s,i) => numField('m'+i, esc(s), 0, f.max, f.marks?.[i] ?? '')).join(''),
      fd => { f.marks = f.subjects.map((_,i) => +fd.get('m'+i)); setFlow(f); go('student-4.html') }) },
  s4() { const f = flow(); if (!need(f.marks,'student-1.html')) return;
    const st = stats(f.marks), pct = r2(st.avg / f.max * 100);
    const best = f.subjects[f.marks.indexOf(st.max)], worst = f.subjects[f.marks.indexOf(st.min)];
    $('#main').innerHTML = `<div class="card wide"><p class="step">Student mode · Step 4 of 4</p><h2>Your results</h2>
      <div class="grid">${[['Average',st.avg],['Lowest',st.min],['Highest',st.max],['Total',st.sum+' / '+f.max*f.n],['Percentage',pct+'%'],['Grade',grade(pct)]]
        .map(([a,b]) => `<div class="stat"><span>${a}</span><b>${b}</b></div>`).join('')}</div>
      <p>Strongest: <b>${esc(best)}</b> · Needs work: <b>${esc(worst)}</b></p>
      <div class="tw"><table><tr><th>Subject</th><th>Mark</th><th>Progress</th></tr>${f.subjects.map((s,i) =>
        `<tr><td>${esc(s)}</td><td>${f.marks[i]}/${f.max}</td><td><div class="bar"><i style="width:${f.marks[i]/f.max*100}%"></i></div></td></tr>`).join('')}</table></div>
      ${actions()}</div>` } ,

/* ---------- Teacher flow ---------- */
  t1() { form('Teacher mode · Step 1 of 6', 'How many students do you have?', numField('n','Number of students',1,200),
      fd => { setFlow({mode:'teacher', n:+fd.get('n')}); go('teacher-2.html') }, false) },
  t2() { const f = flow(); if (!need(f.mode==='teacher'&&f.n,'teacher-1.html')) return;
    form('Teacher mode · Step 2 of 6', 'Enter each student\'s name', textFields('p',f.n,'Student',f.students),
      (fd, err) => { const s = collect(fd,'p',f.n); if (dupes(s)) return err('Each student needs a different name.'); f.students = s; setFlow(f); go('teacher-3.html') }) },
  t3() { const f = flow(); if (!need(f.students,'teacher-1.html')) return;
    form('Teacher mode · Step 3 of 6', 'How many subjects?', numField('k','Number of subjects',1,20,f.k||'') + numField('max','Highest possible mark',1,'',f.max||100),
      fd => { f.k = +fd.get('k'); f.max = +fd.get('max'); setFlow(f); go('teacher-4.html') }) },
  t4() { const f = flow(); if (!need(f.k,'teacher-1.html')) return;
    form('Teacher mode · Step 4 of 6', 'Name the subjects', textFields('s',f.k,'Subject',f.subjects),
      (fd, err) => { const s = collect(fd,'s',f.k); if (dupes(s)) return err('Each subject needs a different name.'); f.subjects = s; setFlow(f); go('teacher-5.html') }) },
  t5() { const f = flow(); if (!need(f.subjects,'teacher-1.html')) return;
    $('#main').innerHTML = `<div class="card wide"><p class="step">Teacher mode · Step 5 of 6</p><h2>Enter marks (0–${f.max})</h2>
      <form id="f"><div class="tw"><table><tr><th>Student</th>${f.subjects.map(s=>`<th>${esc(s)}</th>`).join('')}</tr>
      ${f.students.map((n,i) => `<tr><td>${esc(n)}</td>${f.subjects.map((_,j) =>
        `<td><input type="number" name="m${i}_${j}" min="0" max="${f.max}" step="any" value="${f.marks?.[i]?.[j] ?? ''}" required aria-label="${esc(n)} ${esc(f.subjects[j])}"></td>`).join('')}</tr>`).join('')}</table></div>
      <div class="row"><button type="button" class="btn ghost" onclick="history.back()">Back</button><button class="btn">See results</button></div></form></div>`;
    $('#f').onsubmit = e => { e.preventDefault(); const fd = new FormData(e.target);
      f.marks = f.students.map((_,i) => f.subjects.map((_,j) => +fd.get(`m${i}_${j}`))); setFlow(f); go('teacher-6.html') } },
  t6() { const f = flow(); if (!need(f.marks,'teacher-1.html')) return;
    const rows = f.students.map((n,i) => ({n, ...stats(f.marks[i]), m: f.marks[i]})).sort((a,b) => b.avg - a.avg);
    rows.forEach((r,i) => r.rank = i && r.avg === rows[i-1].avg ? rows[i-1].rank : i + 1);
    const cols = f.subjects.map((s,j) => ({s, ...stats(f.marks.map(m => m[j]))}));
    const all = stats(rows.map(r => r.avg));
    $('#main').innerHTML = `<div class="card wide"><p class="step">Teacher mode · Step 6 of 6</p><h2>Class results</h2>
      <div class="grid">${[['Class average',all.avg],['Top student',esc(rows[0].n)],['Highest average',all.max],['Lowest average',all.min]]
        .map(([a,b]) => `<div class="stat"><span>${a}</span><b>${b}</b></div>`).join('')}</div>
      <h3>Ranking</h3><div class="tw"><table><tr><th>Rank</th><th>Student</th>${f.subjects.map(s=>`<th>${esc(s)}</th>`).join('')}<th>Average</th><th>Min</th><th>Max</th></tr>
      ${rows.map(r => `<tr class="${r.rank===1?'rank1':''}"><td>${r.rank}</td><td>${esc(r.n)}</td>${r.m.map(x=>`<td>${x}</td>`).join('')}<td><b>${r.avg}</b></td><td>${r.min}</td><td>${r.max}</td></tr>`).join('')}</table></div>
      <h3>By subject</h3><div class="tw"><table><tr><th>Subject</th><th>Average</th><th>Min</th><th>Max</th></tr>
      ${cols.map(c => `<tr><td>${esc(c.s)}</td><td>${c.avg}</td><td>${c.min}</td><td>${c.max}</td></tr>`).join('')}</table></div>${actions()}</div>` },

/* ---------- Accounts ---------- */
  login() { const role = new URLSearchParams(location.search).get('role') || 'student';
    form('Welcome back', 'Log in', roleSelect(role) + `<label for="email">Email</label><input id="email" name="email" type="email" required>
      <label for="pw">Password</label><input id="pw" name="pw" type="password" required>`,
      (fd, err) => { const u = jget(localStorage,'gm_users',[]).find(x => x.email===fd.get('email').toLowerCase() && x.pw===btoa(fd.get('pw')) && x.role===fd.get('role'));
        if (!u) return err('Wrong email, password or role. Try again or sign up.'); jset(localStorage,'gm_user',{name:u.name,email:u.email,role:u.role}); go('dashboard.html') }, false);
    $('#f').insertAdjacentHTML('afterend','<p>New here? <a href="signup.html">Create an account</a></p>') },
  signup() { const role = new URLSearchParams(location.search).get('role') || 'student';
    form('Join GradeMate', 'Create your account', roleSelect(role) + `<label for="name">Full name</label><input id="name" name="name" required>
      <label for="email">Email</label><input id="email" name="email" type="email" required>
      <label for="pw">Password (6+ characters)</label><input id="pw" name="pw" type="password" minlength="6" required>`,
      (fd, err) => { const us = jget(localStorage,'gm_users',[]), email = fd.get('email').toLowerCase();
        if (us.some(x => x.email === email)) return err('That email already has an account. Log in instead.');
        us.push({name:fd.get('name').trim(), email, pw:btoa(fd.get('pw')), role:fd.get('role')}); jset(localStorage,'gm_users',us);
        jset(localStorage,'gm_user',{name:fd.get('name').trim(), email, role:fd.get('role')}); go('dashboard.html') }, false);
    $('#f').insertAdjacentHTML('afterend','<p>Already registered? <a href="login.html">Log in</a></p>') },
  dashboard() { const u = user(); if (!need(u,'login.html')) return;
    const key = 'gm_res_' + u.email, list = jget(localStorage, key, []);
    $('#main').innerHTML = `<div class="card wide"><h2>${esc(u.name)}'s dashboard <small>(${u.role})</small></h2>
      <div class="row"><a class="btn" href="${u.role==='teacher'?'teacher-1.html':'student-1.html'}">New ${u.role==='teacher'?'class':'calculation'}</a></div>
      <h3>Saved results</h3>${list.length ? `<div class="tw"><table><tr><th>Date</th><th>Type</th><th>Summary</th><th></th></tr>${list.map((r,i) =>
        `<tr><td>${esc(r.date)}</td><td>${r.data.mode}</td><td>${r.data.mode==='student'?r.data.subjects.length+' subjects':r.data.students.length+' students'}</td>
        <td><button class="btn ghost" data-v="${i}">Open</button> <button class="btn red" data-d="${i}">Delete</button></td></tr>`).join('')}</table></div>`
        : '<p>Nothing saved yet. Run a calculation and press “Save to dashboard”.</p>'}</div>`;
    document.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { const d = list[b.dataset.v].data; setFlow(d); go(d.mode==='student'?'student-4.html':'teacher-6.html') });
    document.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { list.splice(b.dataset.d,1); jset(localStorage,key,list); pages.dashboard() }) },
  contact() { form('We read every message', 'Contact us', `<label for="name">Name</label><input id="name" name="name" required>
      <label for="email">Email</label><input id="email" name="email" type="email" required>
      <label for="msg">Message</label><textarea id="msg" name="msg" rows="5" required></textarea>`,
      fd => { const m = jget(localStorage,'gm_msgs',[]); m.push(Object.fromEntries(fd)); jset(localStorage,'gm_msgs',m);
        $('#f').innerHTML = '<p class="ok">Thanks! Your message was received.</p>' }, false) }
};

function roleSelect(r) { return `<label for="role">I am a</label><select id="role" name="role"><option value="student" ${r==='student'?'selected':''}>Student</option><option value="teacher" ${r==='teacher'?'selected':''}>Teacher</option></select>` }
function actions() { return `<div class="row noprint"><button class="btn" id="save">Save to dashboard</button><button class="btn ghost" onclick="print()">Print</button><a class="btn ghost" href="index.html">Start over</a></div><p id="sv"></p>`; }
document.addEventListener('click', e => { if (e.target.id !== 'save') return; const u = user();
  if (!u) return $('#sv').innerHTML = '<span class="msg">Log in to save results: <a href="login.html">Log in</a></span>';
  const k = 'gm_res_' + u.email, l = jget(localStorage,k,[]); l.push({date:new Date().toLocaleString(), data:flow()}); jset(localStorage,k,l);
  $('#sv').innerHTML = '<span class="ok">Saved! Find it on your dashboard.</span>' });

layout();
if (pages[page]) pages[page]();
