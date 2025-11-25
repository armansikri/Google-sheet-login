const API_BASE = 'http://localhost:3000/api'; // new server lene par yaha address dalna hoga

const loginCard = document.getElementById('loginCard');
const editCard = document.getElementById('editCard');
const idInput = document.getElementById('idInput');
const loginBtn = document.getElementById('loginBtn');
const loginMsg = document.getElementById('loginMsg');
const fieldsDiv = document.getElementById('fields');
const editForm = document.getElementById('editForm');
const editMsg = document.getElementById('editMsg');
const logoutBtn = document.getElementById('logoutBtn');

let currentRowIndex = null;
let originalData = {};
let headers = [];

loginBtn.addEventListener('click', async () => {
  const userId = idInput.value.trim();
  loginMsg.textContent = '';

  if (!userId) {
    loginMsg.textContent = 'Enter Badge / Batch / Roll No'; // agar change krna ho to server.js se change hoge ye attributes//
    return;
  }

  try {
    loginBtn.disabled = true;
    const resp = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });

    const data = await resp.json();
    if (!resp.ok) {
      loginMsg.textContent = data.error || 'Login failed';
      return;
    }

    currentRowIndex = data.rowIndex;
    originalData = data.data || {};
    headers = data.headers || [];

    showForm(originalData, data.idColumnIndex);
    loginCard.classList.add('hidden');
    editCard.classList.remove('hidden');

  } catch {
    loginMsg.textContent = 'Network error';
  } finally {
    loginBtn.disabled = false;
  }
});

function showForm(data, idCol) {
  fieldsDiv.innerHTML = '';

  headers.forEach((key, idx) => {
    const row = document.createElement('div');
    row.className = 'field-row';

    const label = document.createElement('label');
    label.textContent = key;
    row.appendChild(label);

    const input = document.createElement('input');
    input.value = data[key] || '';

    if (idx === idCol) input.disabled = true;
    else input.name = key;

    row.appendChild(input);
    fieldsDiv.appendChild(row);
  });
}

editForm.addEventListener('submit', async e => {
  e.preventDefault();
  editMsg.textContent = '';

  const form = new FormData(editForm);
  const updates = {};
  form.forEach((val, key) => {
    if ((originalData[key] || '') !== val) updates[key] = val;
  });

  if (!Object.keys(updates).length) {
    editMsg.textContent = 'No changes to save';
    return;
  }

  try {
    document.getElementById('saveBtn').disabled = true;
    const resp = await fetch(`${API_BASE}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rowIndex: currentRowIndex,
        updates,
        userId: idInput.value
      })
    });

    const result = await resp.json();
    if (!resp.ok) {
      editMsg.textContent = result.error;
      return;
    }

    editMsg.style.color = "green";
    editMsg.textContent = 'Saved successfully';

    for (const x in updates) originalData[x] = updates[x];

    setTimeout(() => {
      editMsg.textContent = '';
      editMsg.style.color = "#ef4444";
    }, 2000);

  } catch {
    editMsg.textContent = 'Network error';
  } finally {
    document.getElementById('saveBtn').disabled = false;
  }
});

logoutBtn.addEventListener('click', () => {
  currentRowIndex = null;
  originalData = {};
  headers = [];
  editCard.classList.add('hidden');
  loginCard.classList.remove('hidden');
  idInput.value = '';
});
