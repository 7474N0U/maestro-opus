// state
    const COLORS = ['#FF1A1A', '#111111', '#FF7F00', '#00FF00', '#00FFFF', '#0000FF', '#4B0082', '#9400D3'];
    let widgets = [];
    let appMembers = [];
    let calYear = new Date().getFullYear();
    let calMonth = new Date().getMonth();
    let widgetCounter = 0;

    let currentModalWidget = null;

    // utilitaires
    function getAllTasks() {
      const tasks = [];
      widgets.forEach(w => {
        if (w.type === 'table') {
          w.rows.forEach(r => {
            if (r.date && r.task) {
              tasks.push({ task: r.task, date: r.date, done: r.done, color: w.color, member: r.member });
            }
          });
        }
      });
      return tasks;
    }

    function resizeTextarea(el) {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }

    // modale / overlay
    function openAddModal() {
      const id = widgetCounter + 1;
      const color = COLORS[(id - 1) % COLORS.length];

      currentModalWidget = {
        id: id,
        type: 'table',
        color: color,
        title: 'TABLEAU ' + id,
        rows: [{ task: '', desc: '', member: '', date: '', done: false }]
      };

      document.getElementById('widget-overlay').classList.add('open');
      renderModalPreview();
    }

    function changeModalWidgetType(type) {
      if (!currentModalWidget || currentModalWidget.type === type) return;

      currentModalWidget.type = type;
      currentModalWidget.title = type === 'table' ? 'TABLEAU ' + currentModalWidget.id : 'NOTE ' + currentModalWidget.id;

      if (type === 'table') {
        currentModalWidget.rows = [{ task: '', desc: '', member: '', date: '', done: false }];
        delete currentModalWidget.text;
      } else {
        currentModalWidget.text = '';
        delete currentModalWidget.rows;
      }

      renderModalPreview();
    }

    function renderModalPreview() {
      const container = document.getElementById('modal-widget-preview');
      const btnTable = document.getElementById('modal-toggle-table');
      const btnText = document.getElementById('modal-toggle-text');

      if (currentModalWidget.type === 'table') {
        btnTable.classList.add('primary');
        btnText.classList.remove('primary');
      } else {
        btnText.classList.add('primary');
        btnTable.classList.remove('primary');
      }

      container.innerHTML = '';

      const card = document.createElement('div');
      card.className = 'widget-card';
      card.style.boxShadow = 'none';
      card.innerHTML = buildWidgetHTML(currentModalWidget, true);
      container.appendChild(card);

      const textarea = card.querySelector('.text-widget-area');
      if (textarea) {
        setTimeout(() => resizeTextarea(textarea), 0);
      }
    }

    function closeModal(save) {
      if (save && currentModalWidget) {
        widgetCounter++;
        widgets.push(currentModalWidget);
        renderWidgets();
        renderCalendar();
        saveToServer();
      }
      currentModalWidget = null;
      document.getElementById('widget-overlay').classList.remove('open');
    }

    // widgets
    function removeWidget(id) {
      widgets = widgets.filter(w => w.id !== id);
      renderWidgets();
      renderCalendar();
      saveToServer();
    }

    function renderWidgets() {
      const grid = document.getElementById('widget-grid');
      const hint = document.getElementById('empty-hint');

      widgets.forEach(w => {
        let el = document.querySelector(`[data-id="${w.id}"]`);
        if (!el) {
          el = document.createElement('div');
          el.className = 'widget-card';
          el.dataset.id = w.id;
          grid.appendChild(el);
        }

        el.innerHTML = buildWidgetHTML(w, 'grid');

        el.onclick = (e) => {
          if (e.target.closest('input, textarea, button, .widget-color-dot, .color-picker-pop')) return;
          openDetailOverlay(w.id);
        };

        const textarea = el.querySelector('.text-widget-area');
        if (textarea) {
          setTimeout(() => resizeTextarea(textarea), 0);
        }
      });

      [...grid.querySelectorAll('.widget-card')].forEach(el => {
        if (!widgets.find(w => w.id == el.dataset.id)) el.remove();
      });

      hint.style.display = widgets.length ? 'none' : 'flex';
    }

    function buildWidgetHTML(w, mode = 'grid') {
      if (mode === true) mode = 'modal';
      if (mode === false) mode = 'grid';
      const suffix = mode === 'grid' ? '' : `-${mode}`;

      const changeTitleAction = mode === 'modal' ? `updateModalTitle(this.value)` :
        mode === 'detail' ? `updateDetailTitle(this.value)` :
          `setTitle(${w.id},this.value)`;

      const removeAction = (mode === 'modal' || mode === 'detail') ? ` ` :
        `<button class="widget-btn" onclick="removeWidget(${w.id})"><i class="ti ti-x" aria-hidden="true"></i></button>`;

      const maximizeAction = mode === 'grid' ? `<button class="widget-btn" onclick="openDetailOverlay(${w.id})"><i class="ti ti-maximize" aria-hidden="true"></i></button>` : ``;

      const header = `<div class="widget-header">
    <div class="widget-color-dot" style="background:${w.color}" onclick="toggleColorPicker('${w.id}${suffix}')"></div>
    <div class="color-picker-pop" id="cp-${w.id}${suffix}">${COLORS.map(c => `<div class="color-swatch" style="background:${c}" onclick="setWidgetColor('${w.id}', '${c}', '${mode}')"></div>`).join('')}</div>
    <input class="widget-title" value="${w.title}" onchange="${changeTitleAction}" />
    <div class="widget-actions">
      ${maximizeAction}
      ${removeAction}
    </div>
  </div>`;

      if (w.type === 'table') {
        const rows = w.rows.map((r, i) => `<tr>
      <td><input type="checkbox" class="task-checkbox" ${r.done ? 'checked' : ''} onchange="updateRowData(${w.id},${i},'done',this.checked, '${mode}')"></td>
      <td><input class="task-input" value="${r.task || ''}" placeholder="Tâche" onchange="updateRowData(${w.id},${i},'task',this.value, '${mode}')"></td>
      <td><input class="task-input" value="${r.desc || ''}" placeholder="Description" onchange="updateRowData(${w.id},${i},'desc',this.value, '${mode}')"></td>
      <td>
        <select class="task-input" onchange="updateRowData(${w.id},${i},'member',this.value, '${mode}')">
          <option value="">--</option>
          ${appMembers.map(m => `<option value="${m.username}" ${r.member === m.username ? 'selected' : ''}>${m.username}</option>`).join('')}
        </select>
      </td>
      <td><input class="task-input" type="date" value="${r.date || ''}" style="width:110px" onchange="updateRowData(${w.id},${i},'date',this.value, '${mode}')"></td>
    </tr>`).join('');
        return `${header}<div class="widget-body">
      <table class="task-table">
        <tbody id="rows-${w.id}${suffix}">${rows}</tbody>
      </table>
      <button class="add-row-btn" onclick="addNewRow(${w.id}, '${mode}')">+ Ligne</button>
    </div>`;
      } else {
        const updateTextAction = mode === 'modal' ? `updateModalText(this.value)` :
          mode === 'detail' ? `updateDetailText(this.value)` :
            `updateText(${w.id},this.value)`;
        return `${header}<div class="widget-body">
      <textarea class="text-widget-area" placeholder="Texte..." oninput="resizeTextarea(this); ${updateTextAction}">${w.text || ''}</textarea>
    </div>`;
      }
    }

    // interactive styles
    function updateWidgetStyle(w) {
      const dot = document.querySelector(`[data-id="${w.id}"] .widget-color-dot`);
      if (dot) dot.style.background = w.color;
    }

    function setWidgetColor(id, color, mode) {
      if (mode === true || mode === 'modal') {
        currentModalWidget.color = color;
        renderModalPreview();
      } else if (mode === 'detail') {
        currentDetailWidget.color = color;
        renderDetailPreview();
      } else {
        const w = widgets.find(x => x.id == id);
        if (w) { w.color = color; updateWidgetStyle(w); renderCalendar(); saveToServer(); }
        toggleColorPicker(id);
      }
    }

    function toggleColorPicker(idStr) {
      const el = document.getElementById('cp-' + idStr);
      if (!el) return;
      const isOpen = el.classList.contains('open');
      document.querySelectorAll('.color-picker-pop.open').forEach(e => e.classList.remove('open'));
      if (!isOpen) el.classList.add('open');
    }

    document.addEventListener('click', e => {
      if (!e.target.closest('.widget-color-dot') && !e.target.closest('.color-picker-pop')) {
        document.querySelectorAll('.color-picker-pop.open').forEach(el => el.classList.remove('open'));
      }
    });

    // update data
    function setTitle(id, val) {
      const w = widgets.find(x => x.id === id);
      if (w) { w.title = val.toUpperCase(); saveToServer(); }
    }

    function updateModalTitle(val) {
      if (currentModalWidget) currentModalWidget.title = val.toUpperCase();
    }

    function updateRowData(id, i, field, val, mode) {
      const target = (mode === true || mode === 'modal') ? currentModalWidget :
        (mode === 'detail') ? currentDetailWidget :
          widgets.find(x => x.id === id);
      if (target && target.rows[i]) target.rows[i][field] = val;
      if (mode === 'grid' || mode === false || !mode) { renderCalendar(); saveToServer(); }
    }

    function addNewRow(id, mode) {
      const target = (mode === true || mode === 'modal') ? currentModalWidget :
        (mode === 'detail') ? currentDetailWidget :
          widgets.find(x => x.id === id);
      if (!target) return;

      target.rows.push({ task: '', desc: '', member: '', date: '', done: false });
      const suffix = (mode === true || mode === 'modal') ? '-modal' :
        (mode === 'detail') ? '-detail' : '';
      const tbody = document.getElementById(`rows-${id}${suffix}`);
      if (!tbody) return;

      const i = target.rows.length - 1;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><input type="checkbox" class="task-checkbox" onchange="updateRowData(${id},${i},'done',this.checked, '${mode}')"></td>
    <td><input class="task-input" value="" placeholder="Tâche" onchange="updateRowData(${id},${i},'task',this.value, '${mode}')"></td>
    <td><input class="task-input" value="" placeholder="Description" onchange="updateRowData(${id},${i},'desc',this.value, '${mode}')"></td>
    <td>
      <select class="task-input" onchange="updateRowData(${id},${i},'member',this.value, '${mode}')">
        <option value="">--</option>
        ${appMembers.map(m => `<option value="${m.username}">${m.username}</option>`).join('')}
      </select>
    </td>
    <td><input class="task-input" type="date" style="width:110px" onchange="updateRowData(${id},${i},'date',this.value, '${mode}')"></td>`;
      tbody.appendChild(tr);
      if (mode === 'grid' || mode === false || !mode) saveToServer();
    }

    function updateText(id, val) {
      const w = widgets.find(x => x.id === id);
      if (w) { w.text = val; saveToServer(); }
    }

    function updateModalText(val) {
      if (currentModalWidget) currentModalWidget.text = val;
    }

    function updateDetailTitle(val) {
      if (currentDetailWidget) currentDetailWidget.title = val.toUpperCase();
    }

    function updateDetailText(val) {
      if (currentDetailWidget) currentDetailWidget.text = val;
    }

    // detail overlay functions
    let currentDetailWidget = null;

    function openDetailOverlay(id) {
      const w = widgets.find(x => x.id === id);
      if (!w) return;

      currentDetailWidget = JSON.parse(JSON.stringify(w));

      document.getElementById('detail-overlay').classList.add('open');
      renderDetailPreview();
    }

    function renderDetailPreview() {
      if (!currentDetailWidget) return;
      const container = document.getElementById('detail-widget-preview');
      container.innerHTML = '';

      const card = document.createElement('div');
      card.className = 'widget-card';
      card.style.boxShadow = 'none';
      card.style.cursor = 'default';
      card.innerHTML = buildWidgetHTML(currentDetailWidget, 'detail');
      container.appendChild(card);

      const textarea = card.querySelector('.text-widget-area');
      if (textarea) {
        setTimeout(() => resizeTextarea(textarea), 0);
      }
    }

    function closeDetailModal(save) {
      if (save && currentDetailWidget) {
        const idx = widgets.findIndex(w => w.id === currentDetailWidget.id);
        if (idx !== -1) {
          widgets[idx] = currentDetailWidget;
          renderWidgets();
          renderCalendar();
          saveToServer();
        }
      }
      currentDetailWidget = null;
      document.getElementById('detail-overlay').classList.remove('open');
    }

    // close overlays on clicking background
    document.getElementById('widget-overlay').addEventListener('click', e => {
      if (e.target === document.getElementById('widget-overlay')) closeModal(false);
    });
    document.getElementById('detail-overlay').addEventListener('click', e => {
      if (e.target === document.getElementById('detail-overlay')) closeDetailModal(false);
    });

    // navigation
    function switchTab(tab, el) {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      el.classList.add('active');
      document.getElementById('view-dashboard').classList.toggle('hidden', tab !== 'dashboard');
      document.getElementById('view-calendar').classList.toggle('hidden', tab !== 'calendar');
      document.getElementById('view-settings').classList.toggle('hidden', tab !== 'settings');
      if (tab === 'calendar') renderCalendar();
      if (tab === 'settings') renderMembers();
      
      const tb = document.querySelector('.toolbar');
      if(tb) tb.style.display = tab === 'dashboard' ? 'flex' : 'none';
    }

    function shiftMonth(delta) {
      calMonth += delta;
      if (calMonth > 11) { calMonth = 0; calYear++; }
      if (calMonth < 0) { calMonth = 11; calYear--; }
      renderCalendar();
    }

    function goToToday() {
      calYear = new Date().getFullYear();
      calMonth = new Date().getMonth();
      renderCalendar();
    }

    // calendar
    function renderCalendar() {
      const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
      const MONTHS = ['JANVIER', 'FÉVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN', 'JUILLET', 'AOÛT', 'SEPTEMBRE', 'OCTOBRE', 'NEMBRE', 'DÉCEMBRE'];
      document.getElementById('cal-title').textContent = MONTHS[calMonth] + ' ' + calYear;
      const grid = document.getElementById('cal-grid');
      const today = new Date();
      const tasks = getAllTasks();

      const first = new Date(calYear, calMonth, 1);
      let startDow = first.getDay();
      startDow = startDow === 0 ? 6 : startDow - 1;
      const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
      const daysInPrev = new Date(calYear, calMonth, 0).getDate();

      let html = DAYS.map(d => `<div class="cal-day-name">${d}</div>`).join('');

      for (let i = 0; i < startDow; i++) {
        const day = daysInPrev - startDow + 1 + i;
        html += `<div class="cal-day other-month"><div class="cal-day-num">${day}</div></div>`;
      }

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isToday = today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === d;
        const dayTasks = tasks.filter(t => t.date === dateStr);

        const chips = dayTasks.slice(0, 3).map(t => `<div class="cal-task-chip" style="border-left-color:${t.color};">${t.task || '—'}</div>`).join('');
        const more = dayTasks.length > 3 ? `<div style="font-size:11px;font-weight:bold;margin-top:4px">+${dayTasks.length - 3}</div>` : '';

        html += `<div class="cal-day${isToday ? ' today' : ''}"><div class="cal-day-num">${d}</div>${chips}${more}</div>`;
      }

      const total = startDow + daysInMonth;
      const remain = total % 7 === 0 ? 0 : 7 - (total % 7);
      for (let i = 1; i <= remain; i++) {
        html += `<div class="cal-day other-month"><div class="cal-day-num">${i}</div></div>`;
      }

      grid.innerHTML = html;
    }

    // backend api
    let API_BASE = 'https://api.maestroai.company/api';

    // determine api base dynamically
    (async function determineApiBase() {
      if (window.location.protocol !== 'file:') {
        API_BASE = '/api';
        console.log("Using relative API:", API_BASE);
        return;
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000);
        const res = await fetch('http://localhost:3000/api/widgets', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          API_BASE = 'http://localhost:3000/api';
          console.log("Using local API:", API_BASE);
        }
      } catch (e) {
        console.log("Local API not responding, using remote:", API_BASE);
      }
    })();

    async function performLogin() {
      const user = document.getElementById('login-user').value;
      const pass = document.getElementById('login-pass').value;
      const errEl = document.getElementById('login-error');

      try {
        const res = await fetch(API_BASE + '/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: user, password: pass })
        });
        const data = await res.json();
        if (data.success) {
          document.getElementById('login-overlay').style.display = 'none';
          loadFromServer();
        } else {
          errEl.style.display = 'block';
          errEl.textContent = 'Invalid credentials';
        }
      } catch (e) {
        errEl.style.display = 'block';
        errEl.textContent = 'Error connecting to server';
      }
    }

    // members
    async function loadMembers() {
      try {
        const res = await fetch(API_BASE + '/members');
        appMembers = await res.json();
        renderMembers();
      } catch (e) { console.error('Failed to load members', e); }
    }

    async function addMember() {
      const userEl = document.getElementById('new-member-name');
      const passEl = document.getElementById('new-member-pass');
      const username = userEl.value.trim();
      const password = passEl.value.trim();
      if (!username || !password) return;
      try {
        const res = await fetch(API_BASE + '/members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success) {
          appMembers.push({ username });
          userEl.value = '';
          passEl.value = '';
          renderMembers();
          renderWidgets();
        } else {
          alert('Error: ' + (data.error || 'unknown'));
        }
      } catch (e) { console.error('failed to add member', e); }
    }

    async function deleteMember(username) {
      try {
        const res = await fetch(API_BASE + '/members/' + encodeURIComponent(username), { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          appMembers = appMembers.filter(m => m.username !== username);
          renderMembers();
          renderWidgets();
        } else {
          alert('Error: ' + (data.error || 'unknown'));
        }
      } catch (e) { console.error('failed to delete member', e); }
    }

    function renderMembers() {
      const list = document.getElementById('members-list');
      if (!list) return;
      list.innerHTML = appMembers.map(m => `
        <tr>
          <td style="font-size:16px;">${m.username}</td>
          <td style="text-align:right;">
            <button class="widget-btn" onclick="deleteMember('${m.username}')"><i class="ti ti-x" aria-hidden="true"></i></button>
          </td>
        </tr>
      `).join('');
    }

    async function loadFromServer() {
      try {
        await loadMembers();
        const res = await fetch(API_BASE + '/widgets');
        const data = await res.json();
        widgets = data || [];
        widgetCounter = widgets.reduce((max, w) => Math.max(max, w.id), 0);
        renderWidgets();
        renderCalendar();
      } catch (e) {
        console.error('Failed to load data', e);
      }
    }

    let saveTimeout;
    function saveToServer() {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        try {
          await fetch(API_BASE + '/widgets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(widgets)
          });
        } catch (e) {
          console.error('Failed to save data', e);
        }
      }, 500);
    }
