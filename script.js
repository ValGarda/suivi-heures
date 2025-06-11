// script.js

// ----------------------------------------------------
// Parcourt localStorage, colore la cellule et injecte les heures nettes
function renderAllDates() {
  for (let i = 0; i < localStorage.length; i++) {
    const dateKey = localStorage.key(i);
    let data;
    try { data = JSON.parse(localStorage.getItem(dateKey)); }
    catch { continue; }
    const cell = document.querySelector(`.fc-daygrid-day[data-date="${dateKey}"]`);
    if (!cell) continue;

    // Couleur d’arrière-plan selon tâches ou congé
    cell.style.removeProperty('background-color');
    cell.style.removeProperty('background-image');
    const cols = [];
    if (data.checkPAB)         cols.push('#cfe2ff'); // bleu pâle
    if (data.checkLoi90)       cols.push('#f8d7da'); // rose pâle
    if (data.checkOrientation) cols.push('#d4edda'); // vert pâle
    if (data.checkFormation)   cols.push('#fff3cd'); // jaune pâle

    if (cols.length === 1) {
      cell.style.setProperty('background-color', cols[0], 'important');
    } else if (cols.length === 2) {
      cell.style.setProperty(
        'background-image',
        `linear-gradient(135deg, ${cols[0]} 50%, ${cols[1]} 50%)`,
        'important'
      );
    } else if (data.timeIn && data.timeOut) {
      cell.style.setProperty('background-color', '#f8d7da', 'important');
    } else if (data.leaveType) {
      cell.style.setProperty('background-color', '#e2e3e5', 'important');
    }

    // Supprime l’ancien affichage d’heures
    const old = cell.querySelector('.hours-text');
    if (old) old.remove();

    // Injecte les heures nettes
    if (data.timeIn && data.timeOut) {
      const [hi, mi] = data.timeIn.split(':').map(Number);
      const [ho, mo] = data.timeOut.split(':').map(Number);
      const diffH = (new Date(0,0,0,ho,mo) - new Date(0,0,0,hi,mi)) / 36e5;
      const breaks = Math.floor(diffH / 8);         // pause 0.5h par tranche de 8h
      const net    = diffH - breaks * 0.5;
      const frame  = cell.querySelector('.fc-daygrid-day-frame');
      if (frame) {
        const d = document.createElement('div');
        d.className   = 'hours-text';
        d.textContent = `${net.toFixed(2)} h`;
        frame.appendChild(d);
      }
    }
  }
}

// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // 1) Initialisation de FullCalendar
  const calendar = new FullCalendar.Calendar(
    document.getElementById('calendar'), {
      initialView: 'dayGridMonth',
      locale: 'fr',
      customButtons: {
        myLabel: { text: 'Mes heures de travail' }
      },
      headerToolbar: {
        left: 'myLabel',
        center: 'title',
        right: 'prev,next'
      },
      dateClick: info => openDayModal(info.dateStr)
    }
  );
  calendar.render();

  // 2) Premier rendu et totaux
  renderAllDates();
  calculateWeeklyTotals(calendar.getDate());

  // 3) Vérification de l’espace de stockage utilisé
  navigator.storage.estimate().then(({ usage, quota }) => {
    const usedKB  = (usage  / 1024).toFixed(2);
    const limitKB = (quota  / 1024).toFixed(2);
    const pct     = ((usage/quota)*100).toFixed(1);
    console.log(`Stockage utilisé : ${usedKB} Ko sur ${limitKB} Ko (${pct}%).`);
    if (usage/quota > 0.8) {
      alert("⚠️ Vous avez dépassé 80 % du quota de stockage disponible.");
    }
  });

  // 4) À chaque changement de mois/année
  calendar.on('datesSet', () => {
    renderAllDates();
    calculateWeeklyTotals(calendar.getDate());
  });

  // --- Modal & Formulaire ---
  const modal      = document.getElementById('dayModal');
  const closeBtn   = document.getElementById('closeModal');
  const form       = document.getElementById('dayForm');
  const deleteBtn  = document.getElementById('deleteBtn');
  const dateLabel  = document.getElementById('modalDateLabel');
  const inputIn    = document.getElementById('timeIn');
  const inputOut   = document.getElementById('timeOut');
  const leaveConge = document.getElementById('leaveConge');
  const leaveArr   = document.getElementById('leaveArret');
  const chkPAB     = document.getElementById('chkPAB');
  const chkLoi90   = document.getElementById('chkLoi90');
  const chkOrient  = document.getElementById('chkOrientation');
  const chkForm    = document.getElementById('chkFormation');
  const notesField = document.getElementById('notes');
  let currentDate  = null;

  function openDayModal(dateStr) {
    currentDate = dateStr;
    dateLabel.textContent = dateStr;
    let data = {};
    const raw = localStorage.getItem(dateStr);
    if (raw) {
      try { data = JSON.parse(raw); } catch {}
    }
    inputIn.value      = data.timeIn  || '';
    inputOut.value     = data.timeOut || '';
    leaveConge.checked = data.leaveType === 'conge';
    leaveArr.checked   = data.leaveType === 'arret';
    chkPAB.checked     = !!data.checkPAB;
    chkLoi90.checked   = !!data.checkLoi90;
    chkOrient.checked  = !!data.checkOrientation;
    chkForm.checked    = !!data.checkFormation;
    notesField.value   = data.notes    || '';
    modal.style.display = 'block';
  }

  closeBtn.onclick = () => modal.style.display = 'none';
  window.onclick   = e => { if (e.target === modal) modal.style.display = 'none'; };

  form.addEventListener('submit', e => {
    e.preventDefault();
    const ti = inputIn.value, to = inputOut.value;
    const lt = leaveConge.checked ? 'conge' : leaveArr.checked ? 'arret' : '';
    const nt = notesField.value.trim();
    if (!ti && !to && !lt) return alert("Si pas d’heures, cochez Congé ou Arrêt.");
    if ((ti||to) && lt)    return alert("Pas d’heures et congé simultanés.");
    if ((ti&&!to)||(to&&!ti)) return alert("Entrée ET sortie obligatoires.");

    const save = {
      timeIn: ti, timeOut: to,
      leaveType: lt,
      checkPAB:         chkPAB.checked,
      checkLoi90:       chkLoi90.checked,
      checkOrientation: chkOrient.checked,
      checkFormation:   chkForm.checked,
      notes:            nt
    };
    localStorage.setItem(currentDate, JSON.stringify(save));
    modal.style.display = 'none';

    // Mise à jour "live" de la cellule
    const cell = document.querySelector(`.fc-daygrid-day[data-date="${currentDate}"]`);
    if (cell) {
      cell.style.removeProperty('background-color');
      cell.style.removeProperty('background-image');
      const old = cell.querySelector('.hours-text');
      if (old) old.remove();

      // Couleurs prioritaires
      const cols = [];
      if (save.checkPAB)        cols.push('#cfe2ff');
      if (save.checkLoi90)      cols.push('#f8d7da');
      if (save.checkOrientation)cols.push('#d4edda');
      if (save.checkFormation)  cols.push('#fff3cd');

      if (cols.length === 1) {
        cell.style.setProperty('background-color', cols[0], 'important');
      } else if (cols.length === 2) {
        cell.style.setProperty(
          'background-image',
          `linear-gradient(135deg, ${cols[0]} 50%, ${cols[1]} 50%)`,
          'important'
        );
      } else if (save.timeIn && save.timeOut) {
        cell.style.setProperty('background-color', '#f8d7da', 'important');
      } else if (save.leaveType) {
        cell.style.setProperty('background-color', '#e2e3e5', 'important');
      }

      // Réinjection des heures
      if (save.timeIn && save.timeOut) {
        const [hi,mi] = save.timeIn.split(':').map(Number);
        const [ho,mo] = save.timeOut.split(':').map(Number);
        const diffH = (new Date(0,0,0,ho,mo) - new Date(0,0,0,hi,mi)) / 36e5;
        const breaks = Math.floor(diffH / 8);
        const net    = diffH - breaks * 0.5;
        const frame  = cell.querySelector('.fc-daygrid-day-frame');
        if (frame) {
          const d = document.createElement('div');
          d.className   = 'hours-text';
          d.textContent = `${net.toFixed(2)} h`;
          frame.appendChild(d);
        }
      }
    }

    calculateWeeklyTotals(calendar.getDate());
  });

  deleteBtn.addEventListener('click', () => {
    if (!currentDate) return;
    localStorage.removeItem(currentDate);
    const cell = document.querySelector(`.fc-daygrid-day[data-date="${currentDate}"]`);
    if (cell) {
      cell.style.removeProperty('background-color');
      cell.style.removeProperty('background-image');
      const old = cell.querySelector('.hours-text');
      if (old) old.remove();
    }
    modal.style.display = 'none';
    calculateWeeklyTotals(calendar.getDate());
  });

  // ----------------------------------------------------
  // Calcul des totaux hebdomadaires (dimanche→samedi),
  // pause de 0.5h par tranche de 8h travaillées
  function calculateWeeklyTotals(viewDate) {
    const year = viewDate.getFullYear(), month = viewDate.getMonth();
    const first = new Date(year, month, 1), last = new Date(year, month+1, 0);
    const firstSunday = new Date(first);
    firstSunday.setDate(firstSunday.getDate() - firstSunday.getDay());

    const weekList = document.getElementById('weekList');
    weekList.innerHTML = '';

    for (let ws = new Date(firstSunday); ; ws.setDate(ws.getDate()+7)) {
      const we = new Date(ws); we.setDate(we.getDate()+6);
      if (ws > last) break;
      if (we < first) continue;

      let total = 0;
      for (let dd = new Date(ws); dd <= we; dd.setDate(dd.getDate()+1)) {
        const key = dd.toISOString().slice(0,10);
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        let data; try { data = JSON.parse(raw); } catch { continue; }
        if (data.timeIn && data.timeOut) {
          const [hi,mi] = data.timeIn.split(':').map(Number);
          const [ho,mo] = data.timeOut.split(':').map(Number);
          let h = (new Date(dd.getFullYear(),dd.getMonth(),dd.getDate(),ho,mo)
                 - new Date(dd.getFullYear(),dd.getMonth(),dd.getDate(),hi,mi)) / 36e5;
          const breaks = Math.floor(h / 8);
          total += h - breaks * 0.5;
        }
      }

      const fmt = d => String(d.getDate()).padStart(2,'0')
                     + '/' + String(d.getMonth()+1).padStart(2,'0');
      const li = document.createElement('li');
      li.textContent = `Semaine du ${fmt(ws)} au ${fmt(we)} : ${total.toFixed(2)} h`;
      weekList.appendChild(li);
    }
  }
});
