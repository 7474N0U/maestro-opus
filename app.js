// state
    const COLORS = ['#FF1A1A', '#111111', '#FF7F00', '#00FF00', '#00FFFF', '#0000FF', '#4B0082', '#9400D3'];
    let widgets = [];
    let appMembers = [];
    let workspaces = [];
    let currentWorkspaceId = parseInt(localStorage.getItem('opus_workspace')) || 1;
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
    let API_BASE = '/api';

    async function performLogin() {
      const user = document.getElementById('login-user').value;
      const pass = document.getElementById('login-pass').value;
      const remember = document.getElementById('login-remember').checked;
      const errEl = document.getElementById('login-error');

      try {
        const res = await fetch(API_BASE + '/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: user, password: pass })
        });
        const data = await res.json();
        if (data.success) {
          if (remember) {
            localStorage.setItem('opus_user', user);
          } else {
            sessionStorage.setItem('opus_user', user);
          }
          document.getElementById('login-overlay').style.display = 'none';
          loadFromServer();
          startPolling();
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
        await loadWorkspaces();
        const res = await fetch(API_BASE + '/workspaces/' + currentWorkspaceId + '/widgets');
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
          await fetch(API_BASE + '/workspaces/' + currentWorkspaceId + '/widgets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(widgets)
          });
        } catch (e) {
          console.error('Failed to save data', e);
        }
      }, 500);
    }

    // Polling logic
    let pollInterval = null;
    function startPolling() {
      if (pollInterval) clearInterval(pollInterval);
      pollInterval = setInterval(pollFromServer, 5000);
    }

    async function pollFromServer() {
      try {
        const res = await fetch(API_BASE + '/workspaces/' + currentWorkspaceId + '/widgets');
        const data = await res.json();
        
        const newDataString = JSON.stringify(data || []);
        const oldDataString = JSON.stringify(widgets || []);
        
        if (newDataString !== oldDataString) {
          const active = document.activeElement;
          const isEditing = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');
          
          if (!isEditing) {
            widgets = data || [];
            widgetCounter = widgets.reduce((max, w) => Math.max(max, w.id), 0);
            renderWidgets();
            renderCalendar();
            
            if (currentDetailWidget) {
               const updatedWidget = widgets.find(w => w.id === currentDetailWidget.id);
               if (updatedWidget) {
                   currentDetailWidget = JSON.parse(JSON.stringify(updatedWidget));
                   renderDetailPreview();
               } else {
                   closeDetailModal(false);
               }
            }
          }
        }
      } catch (e) {
        console.error('Failed to poll data', e);
      }
    }

    // workspaces logic
    async function loadWorkspaces() {
      try {
        const res = await fetch(API_BASE + '/workspaces');
        workspaces = await res.json();
        if (workspaces.length > 0) {
           if (!workspaces.find(w => w.id === currentWorkspaceId)) {
             currentWorkspaceId = workspaces[0].id;
             localStorage.setItem('opus_workspace', currentWorkspaceId);
           }
        }
        renderWorkspaceMenu();
      } catch (e) { console.error('Failed to load workspaces', e); }
    }

    function toggleWorkspaceMenu() {
      const menu = document.getElementById('workspace-menu');
      menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }

    function renderWorkspaceMenu() {
      const current = workspaces.find(w => w.id === currentWorkspaceId);
      if (current) {
        document.getElementById('current-workspace-name').textContent = current.name;
        const sName = document.getElementById('settings-workspace-name');
        if(sName) sName.textContent = current.name;
        const selectorBtn = document.getElementById('workspace-selector-btn');
        if (selectorBtn) selectorBtn.style.borderLeftColor = current.color || '#111111';
      }
      
      const list = document.getElementById('workspace-list');
      list.innerHTML = workspaces.map(w => `
        <div style="padding: 0.5rem 1rem; border-bottom: 1px solid rgba(0,0,0,0.1); display:flex; justify-content:space-between; align-items:center; border-left: 4px solid ${w.color || '#111111'}; background: white;">
          <span style="cursor:pointer; flex-grow:1; font-family:'IBM Plex Mono', monospace; font-size:14px; ${w.id === currentWorkspaceId ? 'font-weight:bold;' : ''} padding-left: 8px;" onclick="switchWorkspace(${w.id})">${w.name}</span>
          <div style="display:flex; align-items:center; gap: 8px; position: relative;">
            <i class="ti ti-pencil" style="cursor:pointer; color:#888;" onclick="event.stopPropagation(); editWorkspaceName(${w.id}, '${w.color}', this)"></i>
          </div>
        </div>
      `).join('');
    }



    async function switchWorkspace(id) {
      currentWorkspaceId = id;
      localStorage.setItem('opus_workspace', id);
      document.getElementById('workspace-menu').style.display = 'none';
      await loadFromServer();
    }

    function editWorkspaceName(id, color, iconEl) {
      const container = iconEl.parentElement.parentElement;
      const span = container.querySelector('span');
      const oldName = span.textContent;
      
      container.innerHTML = `
        <input type="color" value="${color || '#111111'}" id="edit-color-${id}" style="width: 28px; height: 28px; padding: 0; border: none; cursor: pointer; background: transparent; margin-right: 8px;" onclick="event.stopPropagation();">
        <input type="text" class="task-input" id="edit-name-${id}" value="${oldName}" style="flex-grow:1;" onclick="event.stopPropagation();" onkeydown="if(event.key==='Enter') { event.stopPropagation(); renameWorkspace(${id}, document.getElementById('edit-name-${id}').value, document.getElementById('edit-color-${id}').value) }">
        <button class="add-btn primary" style="padding: 2px 8px; margin-left: 8px;" onclick="event.stopPropagation(); renameWorkspace(${id}, document.getElementById('edit-name-${id}').value, document.getElementById('edit-color-${id}').value)">OK</button>
      `;
    }

    async function renameWorkspace(id, newName, newColor) {
      if(!newName.trim()) return loadWorkspaces();
      try {
        await fetch(API_BASE + '/workspaces/' + id, {
          method: 'PUT',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ name: newName.trim(), color: newColor })
        });
        await loadWorkspaces();
      } catch (e) { console.error(e); }
    }

    function showNewWorkspaceInput() {
      const inputDiv = document.getElementById('workspace-new-input');
      inputDiv.style.display = inputDiv.style.display === 'none' ? 'flex' : 'none';
      if (inputDiv.style.display === 'flex') {
        document.getElementById('new-workspace-name').focus();
      }
    }

    async function createWorkspace() {
      const input = document.getElementById('new-workspace-name');
      const name = input.value.trim();
      if(!name) return;
      const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
      
      try {
        const res = await fetch(API_BASE + '/workspaces', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ name: name, color: randomColor })
        });
        const data = await res.json();
        if(data.success) {
           input.value = '';
           document.getElementById('workspace-new-input').style.display = 'none';
           await switchWorkspace(data.id);
        }
      } catch (e) { console.error(e); }
    }

    // Data Management
    function exportData() {
      const dataStr = JSON.stringify(widgets, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `opus_workspace_${currentWorkspaceId}_backup.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    function importData(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedWidgets = JSON.parse(e.target.result);
          if (Array.isArray(importedWidgets)) {
            widgets = importedWidgets;
            widgetCounter = widgets.reduce((max, w) => Math.max(max, w.id), 0);
            renderWidgets();
            renderCalendar();
            saveToServer();
            alert("Import réussi !");
          } else {
            alert("Le fichier JSON n'a pas le bon format.");
          }
        } catch (err) {
          alert("Erreur lors de la lecture du fichier JSON.");
        }
        event.target.value = ''; // reset input
      };
      reader.readAsText(file);
    }

    function openResetModal() {
      document.getElementById('reset-confirm-input').value = '';
      document.getElementById('reset-confirm-btn').disabled = true;
      document.getElementById('reset-confirm-btn').style.background = '#ccc';
      document.getElementById('reset-confirm-btn').style.cursor = 'not-allowed';
      document.getElementById('reset-overlay').classList.add('open');
    }

    function closeResetModal() {
      document.getElementById('reset-overlay').classList.remove('open');
    }

    function checkResetConfirmation(val) {
      const btn = document.getElementById('reset-confirm-btn');
      if (val === "oui je confirme") {
        btn.disabled = false;
        btn.style.background = '#FF1A1A';
        btn.style.color = '#fff';
        btn.style.cursor = 'pointer';
      } else {
        btn.disabled = true;
        btn.style.background = '#ccc';
        btn.style.cursor = 'not-allowed';
      }
    }

    async function validateReset() {
      try {
        const res = await fetch(API_BASE + '/workspaces/' + currentWorkspaceId + '/reset', { method: 'POST' });
        const data = await res.json();
        if(data.success) {
           widgets = [];
           renderWidgets();
           renderCalendar();
           closeResetModal();
           alert("Espace de travail réinitialisé.");
        }
      } catch(e) { console.error(e); }
    }

    // check session on load
    window.addEventListener('DOMContentLoaded', () => {
      const storedUser = localStorage.getItem('opus_user') || sessionStorage.getItem('opus_user');
      if (storedUser) {
        document.getElementById('login-overlay').style.display = 'none';
        loadFromServer();
        startPolling();
      }
    });
