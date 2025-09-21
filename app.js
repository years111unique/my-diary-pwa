// ========== 初始化 ==========
const contentInput = document.getElementById('content');
const categorySelect = document.getElementById('category');
const saveBtn = document.getElementById('saveBtn');
const exportBtn = document.getElementById('exportBtn');
const statusEl = document.getElementById('status');

// 获取当前日期字符串：YYYY-MM-DD
function getToday() {
  const now = new Date();
  return now.toISOString().split('T')[0]; // 如 "2025-09-21"
}

// 显示状态消息
function showStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.display = 'block';
  statusEl.style.background = isError ? '#f8d7da' : '#d4edda';
  statusEl.style.color = isError ? '#721c24' : '#155724';
  setTimeout(() => {
    statusEl.style.display = 'none';
  }, 3000);
}

// ========== IndexedDB 操作 ==========
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('DiaryDB', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      db = event.target.result;
      if (!db.objectStoreNames.contains('entries')) {
        const store = db.createObjectStore('entries', { keyPath: ['date', 'category'] });
        store.createIndex('date', 'date', { unique: false });
      }
    };
  });
}

async function saveEntry(date, category, text) {
  await openDB();
  const tx = db.transaction('entries', 'readwrite');
  const store = tx.objectStore('entries');

  const item = { date, category, text, timestamp: Date.now() };
  store.put(item);
  return tx.done;
}

async function loadEntries(date) {
  await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('entries', 'readonly');
    const store = tx.objectStore('entries');
    const index = store.index('date');
    const request = index.getAll(date);

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

// ========== 保存功能 ==========
saveBtn.addEventListener('click', async () => {
  const text = contentInput.value.trim();
  const category = categorySelect.value;
  const date = getToday();

  if (!text) {
    showStatus('内容不能为空！', true);
    return;
  }

  try {
    await saveEntry(date, category, text);
    showStatus('✅ 保存成功！');
    contentInput.value = '';
  } catch (err) {
    showStatus('❌ 保存失败：' + err.message, true);
  }
});

// ========== 导出功能 ==========
exportBtn.addEventListener('click', async () => {
  const date = getToday();
  const entries = await loadEntries(date);

  if (entries.length === 0) {
    showStatus('📭 今天还没有内容哦~', true);
    return;
  }

  let zipContent = '';

  // 按分类分组
  const grouped = {};
  entries.forEach(entry => {
    if (!grouped[entry.category]) grouped[entry.category] = [];
    grouped[entry.category].push(`[${new Date(entry.timestamp).toLocaleTimeString()}]\n${entry.text}\n`);
  });

  // 生成文本文件内容
  for (const cat in grouped) {
    const content = `# ${date} ${cat}\n\n` + grouped[cat].join('\n');
    zipContent += `\n--- ${cat}.txt ---\n\n${content}\n`;
  }

  // 下载为文本文件（简单版，可用 JSZip 支持 ZIP）
  const blob = new Blob([zipContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `日记本_${date}.txt`;
  a.click();
  URL.revokeObjectURL(url);

  showStatus('📤 已导出今日内容！');
});

// 初始化
openDB().then(() => {
  console.log('数据库已打开');
}).catch(err => {
  showStatus('⚠️ 数据库打开失败：' + err.message, true);
});