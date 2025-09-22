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

// ======== 修改：升级数据库版本，新增 finance 存储 =========
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('DiaryDB', 2); // 升级版本号

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      db = event.target.result;

      // 原有 entries 表
      if (!db.objectStoreNames.contains('entries')) {
        const store = db.createObjectStore('entries', { keyPath: ['date', 'category'] });
        store.createIndex('date', 'date', { unique: false });
      }

      // 新增：记账类别表
      if (!db.objectStoreNames.contains('financeCategories')) {
        const catStore = db.createObjectStore('financeCategories', { keyPath: 'id', autoIncrement: true });
        catStore.add({ name: '餐饮' });
        catStore.add({ name: '交通' });
        catStore.add({ name: '工资' });
        catStore.add({ name: '娱乐' });
        catStore.add({ name: '购物' });
      }

      // 新增：记账记录表
      if (!db.objectStoreNames.contains('financeRecords')) {
        const recordStore = db.createObjectStore('financeRecords', { keyPath: 'id', autoIncrement: true });
        recordStore.createIndex('date', 'date', { unique: false });
      }
    };
  });
}
// ======== 记账类别操作 =========
async function loadFinanceCategories() {
  await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('financeCategories', 'readonly');
    const store = tx.objectStore('financeCategories');
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

async function addFinanceCategory(name) {
  if (!name || name.trim() === '') return;
  await openDB();
  const tx = db.transaction('financeCategories', 'readwrite');
  const store = tx.objectStore('financeCategories');
  store.add({ name: name.trim() });
  return tx.done;
}

async function deleteFinanceCategory(id) {
  await openDB();
  const tx = db.transaction('financeCategories', 'readwrite');
  const store = tx.objectStore('financeCategories');
  store.delete(id);
  return tx.done;
}
async function saveFinanceRecord(category, amount, note) {
  await openDB();
  const tx = db.transaction('financeRecords', 'readwrite');
  const store = tx.objectStore('financeRecords');

  const record = {
    date: getToday(),
    category,
    amount: parseFloat(amount),
    note: note || '',
    timestamp: Date.now()
  };

  store.add(record);
  return tx.done;
}

async function loadFinanceRecords(date) {
  await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('financeRecords', 'readonly');
    const store = tx.objectStore('financeRecords');
    const index = store.index('date');
    const request = index.getAll(date);

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

// ======== 标签页切换 ========
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

    btn.classList.add('active');
    const tab = btn.getAttribute('data-tab');
    document.getElementById(tab + '-panel').classList.add('active');
  });
});

// ======== 记账类别管理 ========
const financeCategorySelect = document.getElementById('financeCategory');
const addCategoryBtn = document.getElementById('addCategoryBtn');

async function renderFinanceCategories() {
  const cats = await loadFinanceCategories();
  financeCategorySelect.innerHTML = '';
  cats.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat.name;
    option.textContent = cat.name;
    financeCategorySelect.appendChild(option);
  });
}

// 初始化类别
openDB().then(() => {
  renderFinanceCategories();
}).catch(err => {
  showStatus('⚠️ 数据库打开失败：' + err.message, true);
});

// 添加新类别
addCategoryBtn.addEventListener('click', async () => {
  const name = prompt('请输入新的记账类别：');
  if (name) {
    await addFinanceCategory(name);
    renderFinanceCategories();
    showStatus(`✅ 已添加类别：${name}`);
  }
});

// ======== 保存记账 ========
document.getElementById('saveFinanceBtn').addEventListener('click', async () => {
  const category = document.getElementById('financeCategory').value;
  const amount = document.getElementById('amount').value;
  const note = document.getElementById('financeNote').value.trim();

  if (!amount || parseFloat(amount) <= 0) {
    showStatus('❌ 请输入正确的金额！', true);
    return;
  }

  try {
    await saveFinanceRecord(category, amount, note);
    document.getElementById('amount').value = '';
    document.getElementById('financeNote').value = '';
    showStatus('💰 记账成功！');
  } catch (err) {
    showStatus('❌ 记账失败：' + err.message, true);
  }
});

// ======== 导出记账数据 ========
document.getElementById('exportFinanceBtn').addEventListener('click', async () => {
  const date = getToday();
  const records = await loadFinanceRecords(date);

  if (records.length === 0) {
    showStatus('📭 今天还没有记账哦~', true);
    return;
  }

  let content = `# ${date} 记账明细\n\n`;
  let total = 0;

  records.forEach(r => {
    total += r.amount;
    content += `[${r.category}] ¥${r.amount.toFixed(2)}  ${r.note || ''}\n`;
  });

  content += `\n总计：¥${total.toFixed(2)}\n`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `记账_${date}.txt`;
  a.click();
  URL.revokeObjectURL(url);

  showStatus('📊 已导出今日记账！');
});




// ======== 语音输入金额 =========
function initVoiceInput() {
  const voiceBtn = document.getElementById('voiceBtn');
  const amountInput = document.getElementById('amount');

  // 检查浏览器是否支持 Web Speech API
  if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
    voiceBtn.disabled = true;
    voiceBtn.title = '浏览器不支持语音识别';
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = 'zh-CN';
  recognition.interimResults = false;

  let isListening = false;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    // 提取数字（支持“一百二十五”、“125”等）
    const number = extractNumberFromText(transcript);
    if (number !== null) {
      amountInput.value = number;
      showStatus(`✅ 识别金额：¥${number}`);
    } else {
      showStatus(`❌ 未识别到有效金额：${transcript}`, true);
    }
  };

  recognition.onerror = (event) => {
    showStatus(`❌ 语音识别错误：${event.error}`, true);
  };

  recognition.onend = () => {
    isListening = false;
    voiceBtn.textContent = '🎤';
  };

  voiceBtn.addEventListener('click', () => {
    if (isListening) {
      recognition.stop();
      return;
    }
    recognition.start();
    isListening = true;
    voiceBtn.textContent = '🛑';
  });
}

// 简单的中文数字识别（可扩展）
function extractNumberFromText(text) {
  // 先尝试直接匹配阿拉伯数字
  const numMatch = text.match(/(\d+(\.\d+)?)/);
  if (numMatch) return parseFloat(numMatch[1]);

  // 简单中文数字映射（可扩展）
  const chineseToNum = {
    '零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
  };

  // 示例：支持“一百二十五”
  let result = 0;
  if (text.includes('百')) {
    const bai = text.split('百')[0].replace(/.*?([一二三四五六七八九])/g, '$1');
    result += (chineseToNum[bai] || 1) * 100;
    text = text.split('百')[1];
  }
  if (text.includes('十')) {
    const shi = text.split('十')[0] || '';
    result += (chineseToNum[shi] || 1) * 10;
    text = text.split('十')[1] || '';
  }
  const ge = text.replace(/[^一二三四五六七八九]/g, '');
  if (ge && chineseToNum[ge]) result += chineseToNum[ge];

  return result || null;
}

// 初始化语音
initVoiceInput();

// ======== 统计与图表 =========
let financeChart = null;

async function renderChartAndStats() {
  const records = await loadAllFinanceRecords();
  const today = getToday();

  // 按日期分组
  const dailyData = {};
  records.forEach(r => {
    if (!dailyData[r.date]) dailyData[r.date] = 0;
    dailyData[r.date] += r.amount;
  });

  // 计算本周、本月
  const todayDate = new Date();
  const weekStart = new Date(todayDate);
  weekStart.setDate(todayDate.getDate() - todayDate.getDay()); // 周日开始
  const monthStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);

  let weekTotal = 0, monthTotal = 0;
  Object.keys(dailyData).forEach(date => {
    const dateObj = new Date(date);
    if (dateObj >= weekStart) weekTotal += dailyData[date];
    if (dateObj >= monthStart) monthTotal += dailyData[date];
  });

  // 更新统计
  document.getElementById('todayTotal').textContent = `¥${(dailyData[today] || 0).toFixed(2)}`;
  document.getElementById('weekTotal').textContent = `¥${weekTotal.toFixed(2)}`;
  document.getElementById('monthTotal').textContent = `¥${monthTotal.toFixed(2)}`;

  // 准备图表数据（最近7天）
  const labels = [];
  const data = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    labels.push(dateStr);
    data.push(dailyData[dateStr] || 0);
  }

  // 渲染图表
  const ctx = document.getElementById('financeChart').getContext('2d');
  if (financeChart) financeChart.destroy();

  financeChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '每日支出 (¥)',
        data: data,
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `¥${context.raw.toFixed(2)}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: '金额 (¥)' }
        }
      }
    }
  });
}

// 加载所有记账记录
async function loadAllFinanceRecords() {
  await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('financeRecords', 'readonly');
    const store = tx.objectStore('financeRecords');
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

// 在记账保存后刷新图表
document.getElementById('saveFinanceBtn').addEventListener('click', async () => {
  // ...原有保存逻辑...
  setTimeout(renderChartAndStats, 500); // 延迟刷新图表
});

// 页面加载完成后渲染图表
window.addEventListener('load', () => {
  setTimeout(renderChartAndStats, 1000);
});