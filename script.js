// ==================== FIREBASE CONFIG ====================
// GANTI DENGAN KONFIGURASI PROYEK ANDA!
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ==================== SERVICE WORKER ====================
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}

// ==================== GLOBAL VARIABLES ====================
let currentUser = null;
let tasks = [];
let currentFilter = "All";
let currentView = "list";
let currentMonth = new Date();
let snoozeTaskId = null; // Untuk menyimpan ID task yang ditunda

// Elemen DOM
const taskInput = document.getElementById("task-input");
const dateInput = document.getElementById("date-input");
const hoursInput = document.getElementById("hours-input");
const minutesInput = document.getElementById("minutes-input");
const secondsInput = document.getElementById("seconds-input");
const addBtn = document.getElementById("add-btn");
const taskList = document.getElementById("task-list");
const categoryInput = document.getElementById("category-input");
const filterButtons = document.querySelectorAll(".filter-btn");
const themeToggle = document.getElementById("theme-toggle");
const viewBtns = document.querySelectorAll(".view-btn");
const listView = document.getElementById("list-view");
const calendarView = document.getElementById("calendar-view");
const prevMonthBtn = document.getElementById("prev-month");
const nextMonthBtn = document.getElementById("next-month");
const currentMonthSpan = document.getElementById("current-month");
const calendarGrid = document.getElementById("calendar-grid");
const selectedDateSpan = document.getElementById("selected-date");
const taskListDate = document.getElementById("task-list-date");
const statsBtn = document.getElementById("stats-btn");
const statsModal = document.getElementById("stats-modal");
const closeStats = document.getElementById("close-stats");
const statsBody = document.getElementById("stats-body");
const voiceBtn = document.getElementById("voice-btn");

// Elemen Auth
const authSection = document.getElementById("auth-section");
const userInfo = document.getElementById("user-info");
const userEmail = document.getElementById("user-email");
const logoutBtn = document.getElementById("logout-btn");
const loginForm = document.getElementById("login-form");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginBtn = document.getElementById("login-btn");
const registerBtn = document.getElementById("register-btn");

// Elemen Snooze
const snoozeModal = document.getElementById("snooze-modal");
const closeSnooze = document.getElementById("close-snooze");
const snoozeTaskText = document.getElementById("snooze-task-text");
const snoozeOptions = document.querySelectorAll(".snooze-options button");

// ==================== DARK MODE ====================
themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
});

// ==================== AUTH STATE OBSERVER ====================
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    userEmail.textContent = user.email;
    userInfo.classList.remove("hidden");
    loginForm.classList.add("hidden");
    await loadTasksFromFirestore();
    renderTasks();
    if (currentView === "calendar") renderCalendar();
  } else {
    currentUser = null;
    userInfo.classList.add("hidden");
    loginForm.classList.remove("hidden");
    tasks = [];
    renderTasks();
    if (currentView === "calendar") renderCalendar();
  }
});

// ==================== LOGIN / REGISTER ====================
loginBtn.addEventListener("click", () => {
  const email = loginEmail.value;
  const pass = loginPassword.value;
  if (!email || !pass) return alert("Isi email dan password!");
  auth.signInWithEmailAndPassword(email, pass).catch(err => alert(err.message));
});

registerBtn.addEventListener("click", () => {
  const email = loginEmail.value;
  const pass = loginPassword.value;
  if (!email || !pass) return alert("Isi email dan password!");
  auth.createUserWithEmailAndPassword(email, pass).catch(err => alert(err.message));
});

logoutBtn.addEventListener("click", () => {
  auth.signOut();
});

// ==================== FIRESTORE ====================
async function loadTasksFromFirestore() {
  if (!currentUser) return;
  const snapshot = await db.collection("users").doc(currentUser.uid).collection("tasks").get();
  tasks = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      date: data.date.toDate() // konversi Firestore Timestamp ke Date
    };
  });
  // Set timeout untuk setiap task
  tasks.forEach(task => startTimer(task));
}

async function saveTaskToFirestore(task) {
  if (!currentUser) return;
  const taskData = {
    text: task.text,
    category: task.category,
    date: task.date, // Firestore akan otomatis menyimpan sebagai Timestamp
    done: task.done
  };
  if (task.id) {
    await db.collection("users").doc(currentUser.uid).collection("tasks").doc(task.id).set(taskData);
  } else {
    const docRef = await db.collection("users").doc(currentUser.uid).collection("tasks").add(taskData);
    task.id = docRef.id; // set ID dari Firestore
  }
}

async function deleteTaskFromFirestore(taskId) {
  if (!currentUser) return;
  await db.collection("users").doc(currentUser.uid).collection("tasks").doc(taskId).delete();
}

// ==================== TASK OPERATIONS ====================
function startTimer(task) {
  if (task.done) return;
  const now = Date.now();
  const taskTime = task.date.getTime();
  const delay = taskTime - now;
  if (delay <= 0) {
    // Waktu sudah lewat, langsung notifikasi?
    showNotification(task);
    return;
  }
  task.timeoutId = setTimeout(() => {
    showNotification(task);
  }, delay);
}

function showNotification(task) {
  if (Notification.permission === "granted") {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification("Task Reminder", {
        body: task.text,
        icon: "icon-192.png",
        badge: "icon-192.png",
        tag: task.id, // agar bisa menangani aksi notifikasi
        data: { taskId: task.id }
      });
    });
  }
  // Buka modal snooze
  snoozeTaskId = task.id;
  snoozeTaskText.textContent = task.text;
  snoozeModal.classList.remove("hidden");
}

// Snooze handler
snoozeOptions.forEach(btn => {
  btn.addEventListener("click", (e) => {
    const minutes = parseInt(e.target.dataset.minutes);
    if (!snoozeTaskId) return;
    const task = tasks.find(t => t.id === snoozeTaskId);
    if (!task) return;
    // Pindahkan waktu task ke depan
    const newDate = new Date(task.date.getTime() + minutes * 60000);
    task.date = newDate;
    // Hapus timeout lama
    clearTimeout(task.timeoutId);
    // Simpan ke Firestore
    if (currentUser) saveTaskToFirestore(task);
    // Mulai timer baru
    startTimer(task);
    // Tutup modal
    snoozeModal.classList.add("hidden");
    snoozeTaskId = null;
    renderTasks();
    if (currentView === "calendar") renderCalendar();
  });
});

closeSnooze.addEventListener("click", () => {
  snoozeModal.classList.add("hidden");
  snoozeTaskId = null;
});

// Notifikasi klik (dari service worker) akan membuka aplikasi
navigator.serviceWorker.addEventListener("message", (event) => {
  if (event.data.type === "SNOOZE") {
    snoozeTaskId = event.data.taskId;
    const task = tasks.find(t => t.id === snoozeTaskId);
    if (task) {
      snoozeTaskText.textContent = task.text;
      snoozeModal.classList.remove("hidden");
    }
  }
});

// ==================== TAMBAH TASK ====================
addBtn.addEventListener("click", async () => {
  if (!currentUser) return alert("Anda harus login terlebih dahulu!");

  const taskText = taskInput.value.trim();
  const dateValue = dateInput.value;
  const hours = parseInt(hoursInput.value) || 0;
  const minutes = parseInt(minutesInput.value) || 0;
  const seconds = parseInt(secondsInput.value) || 0;

  if (!taskText || !dateValue) return alert("Isi task & tanggal!");

  const reminderDate = new Date(dateValue);
  reminderDate.setHours(hours, minutes, seconds, 0);

  const task = {
    id: null, // akan diisi Firestore nanti
    text: taskText,
    category: categoryInput.value,
    date: reminderDate,
    done: false,
    timeoutId: null
  };

  await saveTaskToFirestore(task);
  tasks.push(task);
  startTimer(task);

  // Reset input
  taskInput.value = "";
  dateInput.value = "";
  hoursInput.value = "";
  minutesInput.value = "";
  secondsInput.value = "";

  renderTasks();
  if (currentView === "calendar") renderCalendar();
});

// ==================== DELETE TASK ====================
window.deleteTask = async (id) => {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  clearTimeout(task.timeoutId);
  tasks = tasks.filter(t => t.id !== id);
  await deleteTaskFromFirestore(id);

  const sound = document.getElementById("delete-sound");
  if (sound) {
    sound.currentTime = 0;
    sound.play().catch(() => {});
  }
  if (navigator.vibrate) navigator.vibrate(80);

  renderTasks();
  if (currentView === "calendar") renderCalendar();
};

window.toggleDone = async (id) => {
  const task = tasks.find(t => t.id === id);
  if (task) {
    task.done = !task.done;
    await saveTaskToFirestore(task);
    renderTasks();
    if (currentView === "calendar") renderCalendar();
  }
};

window.editTask = async (id) => {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const newText = prompt("Edit task:", task.text);
  if (newText) {
    task.text = newText.trim();
    await saveTaskToFirestore(task);
    renderTasks();
    if (currentView === "calendar") renderCalendar();
  }
};

// ==================== RENDER TASKS ====================
function renderTasks() {
  taskList.innerHTML = "";

  const filtered = currentFilter === "All" ? tasks : tasks.filter(t => t.category === currentFilter);

  filtered.forEach(task => {
    const li = document.createElement("li");
    li.className = "task-item";
    if (task.done) li.classList.add("completed");
    li.dataset.id = task.id;

    li.innerHTML = `
      <span>
        <input type="checkbox" ${task.done ? "checked" : ""} onchange="toggleDone('${task.id}')">
        <strong>${task.text}</strong>
        <small>
          <span class="badge ${task.category}">${task.category}</span>
          ${task.date.toLocaleDateString()} • ${task.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </small>
      </span>
      <div class="actions">
        <button onclick="editTask('${task.id}')">Edit</button>
        <button onclick="deleteTask('${task.id}')">Delete</button>
      </div>
    `;
    taskList.appendChild(li);
  });
}

// ==================== FILTER ====================
filterButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    filterButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    renderTasks();
  });
});

// ==================== VIEW TOGGLE & CALENDAR ====================
viewBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    viewBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentView = btn.dataset.view;
    if (currentView === "list") {
      listView.classList.remove("hidden");
      calendarView.classList.add("hidden");
    } else {
      listView.classList.add("hidden");
      calendarView.classList.remove("hidden");
      renderCalendar();
    }
  });
});

function renderCalendar() {
  // (fungsi renderCalendar sama seperti sebelumnya, tetapi menggunakan tasks global)
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay(); // 0 Minggu
  const totalDays = lastDay.getDate();

  currentMonthSpan.textContent = currentMonth.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  let gridHTML = "";

  // Hari sebelumnya
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDay; i > 0; i--) {
    const day = prevMonthLastDay - i + 1;
    const monthPrev = month;
    const yearPrev = month === 0 ? year - 1 : year;
    const monthPrevCorrect = month === 0 ? 11 : month - 1;
    const dateStrCorrect = `${yearPrev}-${String(monthPrevCorrect + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    gridHTML += `<div class="calendar-day other-month" data-date="${dateStrCorrect}">${day}</div>`;
  }

  // Hari bulan ini
  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(year, month, d);
    const hasTask = tasks.some(task => {
      const taskDate = new Date(task.date);
      return taskDate.getFullYear() === year && taskDate.getMonth() === month && taskDate.getDate() === d;
    });
    const className = `calendar-day ${hasTask ? "has-task" : ""}`;
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    gridHTML += `<div class="${className}" data-date="${dateStr}">${d}</div>`;
  }

  // Hari depan
  const nextDays = 42 - (startDay + totalDays);
  for (let i = 1; i <= nextDays; i++) {
    const day = i;
    const monthNext = month + 1;
    const yearNext = monthNext === 12 ? year + 1 : year;
    const monthNextCorrect = monthNext === 12 ? 0 : monthNext;
    const dateStr = `${yearNext}-${String(monthNextCorrect + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    gridHTML += `<div class="calendar-day other-month" data-date="${dateStr}">${day}</div>`;
  }

  calendarGrid.innerHTML = gridHTML;

  document.querySelectorAll(".calendar-day").forEach(day => {
    day.addEventListener("click", () => {
      const dateStr = day.dataset.date;
      if (!dateStr) return;
      const [y, m, d] = dateStr.split("-").map(Number);
      const selectedDate = new Date(y, m - 1, d);

      const tasksOnDate = tasks.filter(task => {
        const taskDate = new Date(task.date);
        return taskDate.getFullYear() === y && taskDate.getMonth() === m - 1 && taskDate.getDate() === d;
      });

      selectedDateSpan.textContent = selectedDate.toLocaleDateString("id-ID");
      taskListDate.innerHTML = tasksOnDate.length
        ? tasksOnDate.map(task => `<li>${task.text} <small>(${task.category})</small></li>`).join("")
        : "<li>Tidak ada task pada tanggal ini</li>";
    });
  });
}

prevMonthBtn.addEventListener("click", () => {
  currentMonth.setMonth(currentMonth.getMonth() - 1);
  renderCalendar();
});

nextMonthBtn.addEventListener("click", () => {
  currentMonth.setMonth(currentMonth.getMonth() + 1);
  renderCalendar();
});

// ==================== STATISTIK ====================
function calculateStats() {
  const total = tasks.length;
  const completed = tasks.filter(t => t.done).length;
  const categories = ['Tugas', 'Personal', 'Acara', 'Janjian'];
  const categoryCount = {};
  const categoryCompleted = {};
  categories.forEach(cat => {
    categoryCount[cat] = tasks.filter(t => t.category === cat).length;
    categoryCompleted[cat] = tasks.filter(t => t.category === cat && t.done).length;
  });

  const today = new Date();
  today.setHours(0,0,0,0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayTasks = tasks.filter(t => {
    const d = new Date(t.date);
    d.setHours(0,0,0,0);
    return d.getTime() === today.getTime();
  }).length;

  const tomorrowTasks = tasks.filter(t => {
    const d = new Date(t.date);
    d.setHours(0,0,0,0);
    return d.getTime() === tomorrow.getTime();
  }).length;

  return { total, completed, categoryCount, categoryCompleted, todayTasks, tomorrowTasks };
}

function renderStats() {
  const stats = calculateStats();
  let html = `
    <div class="stat-total">Total Tugas: ${stats.total}</div>
    <div class="stat-item">
      <div class="stat-label">
        <span>Progress</span>
        <span>${stats.completed} / ${stats.total} (${stats.total ? Math.round(stats.completed/stats.total*100) : 0}%)</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${stats.total ? (stats.completed/stats.total*100) : 0}%"></div>
      </div>
    </div>
    <h4>Per Kategori</h4>
  `;
  ['Tugas', 'Personal', 'Acara', 'Janjian'].forEach(cat => {
    const totalCat = stats.categoryCount[cat] || 0;
    const doneCat = stats.categoryCompleted[cat] || 0;
    const percentage = totalCat ? Math.round(doneCat/totalCat*100) : 0;
    html += `
      <div class="stat-row">
        <span><span class="stat-badge ${cat}">${cat}</span> ${totalCat} tugas</span>
        <span>${doneCat} selesai (${percentage}%)</span>
      </div>
    `;
  });
  html += `
    <h4>Ringkasan Waktu</h4>
    <div class="stat-row"><span>📅 Hari ini</span><span>${stats.todayTasks} tugas</span></div>
    <div class="stat-row"><span>📆 Besok</span><span>${stats.tomorrowTasks} tugas</span></div>
  `;
  statsBody.innerHTML = html;
}

statsBtn.addEventListener("click", () => {
  renderStats();
  statsModal.classList.remove("hidden");
});

closeStats.addEventListener("click", () => {
  statsModal.classList.add("hidden");
});

window.addEventListener("click", (e) => {
  if (e.target === statsModal) statsModal.classList.add("hidden");
  if (e.target === snoozeModal) snoozeModal.classList.add("hidden");
});

// ==================== VOICE INPUT (sederhana) ====================
if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = "id-ID";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    taskInput.value = event.results[0][0].transcript;
  };

  voiceBtn.addEventListener("click", () => {
    recognition.start();
  });
} else {
  voiceBtn.disabled = true;
  voiceBtn.title = "Tidak didukung";
}
