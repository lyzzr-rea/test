// === PWA Service Worker ===
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}

document.addEventListener("DOMContentLoaded", () => {
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

  // View toggle elements
  const viewBtns = document.querySelectorAll(".view-btn");
  const listView = document.getElementById("list-view");
  const calendarView = document.getElementById("calendar-view");
  const prevMonthBtn = document.getElementById("prev-month");
  const nextMonthBtn = document.getElementById("next-month");
  const currentMonthSpan = document.getElementById("current-month");
  const calendarGrid = document.getElementById("calendar-grid");
  const selectedDateSpan = document.getElementById("selected-date");
  const taskListDate = document.getElementById("task-list-date");

  // Statistik elements
  const statsBtn = document.getElementById("stats-btn");
  const statsModal = document.getElementById("stats-modal");
  const closeStats = document.getElementById("close-stats");
  const statsBody = document.getElementById("stats-body");

  let currentFilter = "All";
  let tasks = [];
  let currentView = "list";
  let currentMonth = new Date();

  // 🔓 Unlock audio on first click
  document.addEventListener(
    "click",
    () => {
      const s = document.getElementById("delete-sound");
      if (s) {
        s.play()
          .then(() => {
            s.pause();
            s.currentTime = 0;
          })
          .catch(() => {});
      }
    },
    { once: true },
  );

  // 🌙 Dark Mode
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      document.body.classList.toggle("dark");
    });
  }

  // 🔔 Notification permission
  if ("Notification" in window) {
    Notification.requestPermission();
  }

  // ===== Local Storage =====
  function saveTasks() {
    localStorage.setItem("tasks", JSON.stringify(tasks));
  }

  function loadTasks() {
    const data = localStorage.getItem("tasks");
    if (data) {
      tasks = JSON.parse(data).map((t) => {
        t.date = new Date(t.date);
        return t;
      });
    }
  }

  loadTasks();
  renderTasks();

  // ===== FILTER =====
  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      renderTasks();
    });
  });

  // ===== ADD TASK =====
  addBtn.addEventListener("click", () => {
    const taskText = taskInput.value.trim();
    const dateValue = dateInput.value;
    const hours = parseInt(hoursInput.value) || 0;
    const minutes = parseInt(minutesInput.value) || 0;
    const seconds = parseInt(secondsInput.value) || 0;

    if (!taskText || !dateValue) return alert("Isi task & tanggal!");

    const reminderDate = new Date(dateValue);
    reminderDate.setHours(hours, minutes, seconds, 0);
    const timeDiff = reminderDate.getTime() - Date.now();

    if (timeDiff <= 0) return alert("Waktu harus di masa depan!");

    const task = {
      id: Date.now(),
      text: taskText,
      category: categoryInput.value,
      date: reminderDate,
      time: timeDiff,
      timeoutId: null,
      done: false,
    };

    tasks.push(task);
    saveTasks();
    renderTasks();
    startTimer(task);

    taskInput.value = "";
    dateInput.value = "";
    hoursInput.value = "";
    minutesInput.value = "";
    secondsInput.value = "";

    if (currentView === "calendar") {
      renderCalendar();
    }
  });

  // ===== RENDER TASKS (LIST VIEW) =====
  function renderTasks() {
    taskList.innerHTML = "";

    const filtered =
      currentFilter === "All"
        ? tasks
        : tasks.filter((t) => t.category === currentFilter);

    filtered.forEach((task) => {
      const li = document.createElement("li");
      li.className = "task-item";
      if (task.done) li.classList.add("completed");
      li.dataset.id = task.id;

      li.innerHTML = `
        <span>
          <input type="checkbox" ${task.done ? "checked" : ""} onchange="toggleDone(${task.id})">
          <strong>${task.text}</strong>
          <small>
            <span class="badge ${task.category}">${task.category}</span>
            ${task.date.toLocaleDateString()} • ${task.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </small>
        </span>
        <div class="actions">
          <button onclick="editTask(${task.id})">Edit</button>
          <button onclick="deleteTask(${task.id})">Delete</button>
        </div>
      `;

      taskList.appendChild(li);
    });
  }

  // ===== TIMER + BACKGROUND NOTIFICATION =====
  function startTimer(task) {
    task.timeoutId = setTimeout(() => {
      if (Notification.permission === "granted") {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification("Task Reminder", {
            body: task.text,
            icon: "icon-192.png",
            badge: "icon-192.png",
          });
        });
      }

      deleteTask(task.id);
    }, task.time);
  }

  // ===== DELETE + SOUND =====
  window.deleteTask = (id) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    clearTimeout(task.timeoutId);
    tasks = tasks.filter((t) => t.id !== id);
    saveTasks();

    const sound = document.getElementById("delete-sound");
    if (sound) {
      sound.currentTime = 0;
      sound.play().catch(() => {});
    }

    if (navigator.vibrate) navigator.vibrate(80);

    renderTasks();
    if (currentView === "calendar") {
      renderCalendar();
    }
  };

  window.toggleDone = (id) => {
    const task = tasks.find((t) => t.id === id);
    if (task) {
      task.done = !task.done;
      saveTasks();
      renderTasks();
      if (currentView === "calendar") {
        renderCalendar();
      }
    }
  };

  window.editTask = (id) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const newText = prompt("Edit task:", task.text);
    if (newText) {
      task.text = newText.trim();
      saveTasks();
      renderTasks();
      if (currentView === "calendar") {
        renderCalendar();
      }
    }
  };

  // ===== SWIPE DELETE (MOBILE) =====
  let touchStartX = 0;

  taskList.addEventListener("touchstart", (e) => {
    const li = e.target.closest(".task-item");
    if (!li) return;
    touchStartX = e.touches[0].clientX;
    li.dataset.startX = touchStartX;
  });

  taskList.addEventListener("touchmove", (e) => {
    const li = e.target.closest(".task-item");
    if (!li) return;
    const moveX = e.touches[0].clientX - li.dataset.startX;
    li.style.transform = `translateX(${moveX}px)`;
  });

  taskList.addEventListener("touchend", (e) => {
    const li = e.target.closest(".task-item");
    if (!li) return;
    const moveX = e.changedTouches[0].clientX - li.dataset.startX;

    if (moveX < -100) {
      deleteTask(Number(li.dataset.id));
    } else {
      li.style.transform = "translateX(0)";
    }
  });

  // ===== VIEW TOGGLE =====
  viewBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      viewBtns.forEach((b) => b.classList.remove("active"));
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

  // ===== RENDER CALENDAR =====
  function renderCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay(); // 0 = Minggu
    const totalDays = lastDay.getDate();

    currentMonthSpan.textContent = currentMonth.toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric",
    });

    let gridHTML = "";

    // Hari dari bulan sebelumnya
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
      const hasTask = tasks.some((task) => {
        const taskDate = new Date(task.date);
        return (
          taskDate.getFullYear() === year &&
          taskDate.getMonth() === month &&
          taskDate.getDate() === d
        );
      });
      const className = `calendar-day ${hasTask ? "has-task" : ""}`;
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      gridHTML += `<div class="${className}" data-date="${dateStr}">${d}</div>`;
    }

    // Hari bulan depan
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

    document.querySelectorAll(".calendar-day").forEach((day) => {
      day.addEventListener("click", () => {
        const dateStr = day.dataset.date;
        if (!dateStr) return;
        const [y, m, d] = dateStr.split("-").map(Number);
        const selectedDate = new Date(y, m - 1, d);

        const tasksOnDate = tasks.filter((task) => {
          const taskDate = new Date(task.date);
          return (
            taskDate.getFullYear() === y &&
            taskDate.getMonth() === m - 1 &&
            taskDate.getDate() === d
          );
        });

        selectedDateSpan.textContent = selectedDate.toLocaleDateString("id-ID");
        taskListDate.innerHTML = tasksOnDate
          .map(
            (task) => `<li>${task.text} <small>(${task.category})</small></li>`,
          )
          .join("");

        if (tasksOnDate.length === 0) {
          taskListDate.innerHTML = "<li>Tidak ada task pada tanggal ini</li>";
        }
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

  listView.classList.remove("hidden");
  calendarView.classList.add("hidden");

  // ===== STATISTIK / RINGKASAN =====
  function calculateStats() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.done).length;
    const incomplete = total - completed;
    
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

    return { total, completed, incomplete, categoryCount, categoryCompleted, todayTasks, tomorrowTasks };
  }

  function renderStats() {
    const stats = calculateStats();
    
    let html = `
      <div class="stat-total">
        Total Tugas: ${stats.total}
      </div>
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
    
    const categories = ['Tugas', 'Personal', 'Acara', 'Janjian'];
    categories.forEach(cat => {
      const totalCat = stats.categoryCount[cat] || 0;
      const doneCat = stats.categoryCompleted[cat] || 0;
      const percentage = totalCat ? Math.round(doneCat/totalCat*100) : 0;
      
      html += `
        <div class="stat-row">
          <span>
            <span class="stat-badge ${cat}">${cat}</span>
            ${totalCat} tugas
          </span>
          <span>${doneCat} selesai (${percentage}%)</span>
        </div>
      `;
    });
    
    html += `
      <h4>Ringkasan Waktu</h4>
      <div class="stat-row">
        <span>📅 Hari ini</span>
        <span>${stats.todayTasks} tugas</span>
      </div>
      <div class="stat-row">
        <span>📆 Besok</span>
        <span>${stats.tomorrowTasks} tugas</span>
      </div>
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
    if (e.target === statsModal) {
      statsModal.classList.add("hidden");
    }
  });

  // ===== VOICE INPUT DEEP PARSING =====
  function parseAdvanced(transcript) {
    const lower = transcript.toLowerCase();
    const now = new Date();
    let targetDate = null;
    let hours = null;
    let minutes = 0;
    let seconds = 0;
    let detectedCategory = null;

    // 1. Deteksi kategori
    const categoryKeywords = {
      Tugas: ['tugas', 'pr', 'belajar', 'ujian', 'kuis', 'mengerjakan'],
      Personal: ['pribadi', 'olahraga', 'gym', 'meditasi', 'baca', 'tidur'],
      Acara: ['acara', 'event', 'konser', 'pesta', 'ulang tahun', 'pernikahan'],
      Janjian: ['janji', 'janjian', 'ketemu', 'meeting', 'temu', 'kopdar', 'date']
    };

    for (const [cat, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(kw => lower.includes(kw))) {
        detectedCategory = cat;
        break;
      }
    }

    // 2. Deteksi tanggal
    if (lower.includes('besok')) {
      targetDate = new Date(now);
      targetDate.setDate(now.getDate() + 1);
    } else if (lower.includes('lusa')) {
      targetDate = new Date(now);
      targetDate.setDate(now.getDate() + 2);
    } else if (lower.includes('hari ini')) {
      targetDate = new Date(now);
    } else {
      const days = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
      for (let i = 0; i < days.length; i++) {
        if (lower.includes(days[i])) {
          const targetDay = i;
          const currentDay = now.getDay();
          let diff = targetDay - currentDay;
          if (diff <= 0) diff += 7;
          targetDate = new Date(now);
          targetDate.setDate(now.getDate() + diff);
          break;
        }
      }
      if (!targetDate) {
        const monthMap = {
          januari:0, februari:1, maret:2, april:3, mei:4, juni:5,
          juli:6, agustus:7, september:8, oktober:9, november:10, desember:11
        };
        const dateMatch = lower.match(/(\d{1,2})\s*(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)/i);
        if (dateMatch) {
          const day = parseInt(dateMatch[1]);
          const month = monthMap[dateMatch[2].toLowerCase()];
          targetDate = new Date(now.getFullYear(), month, day);
          if (targetDate < now) targetDate.setFullYear(now.getFullYear() + 1);
        }
      }
    }
    if (!targetDate) targetDate = new Date(now);

    // 3. Deteksi waktu
    const timePatterns = [
      { regex: /(?:jam|pukul)?\s*setengah\s*(\d{1,2})/i, handler: (matches) => {
          let h = parseInt(matches[1]) - 1;
          return { h, m: 30 };
      }},
      { regex: /(?:jam|pukul)?\s*(\d{1,2})\s*lewat\s*(\d{1,2})/i, handler: (matches) => {
          return { h: parseInt(matches[1]), m: parseInt(matches[2]) };
      }},
      { regex: /(?:jam|pukul)?\s*(\d{1,2})\s*kurang\s*(\d{1,2})/i, handler: (matches) => {
          let h = parseInt(matches[1]) - 1;
          let m = 60 - parseInt(matches[2]);
          return { h, m };
      }},
      { regex: /(?:jam|pukul)?\s*(\d{1,2})(?:\s*(\d{1,2}))?\s*(pagi|siang|sore|malam)?/i, handler: (matches) => {
          let h = parseInt(matches[1]);
          let m = matches[2] ? parseInt(matches[2]) : 0;
          const modifier = matches[3] ? matches[3].toLowerCase() : '';
          if (modifier === 'pagi' && h === 12) h = 0;
          else if ((modifier === 'siang' || modifier === 'sore' || modifier === 'malam') && h < 12) h += 12;
          return { h, m };
      }},
      { regex: /(\d{1,2})\s*(pagi|siang|sore|malam)/i, handler: (matches) => {
          let h = parseInt(matches[1]);
          const modifier = matches[2].toLowerCase();
          if (modifier === 'pagi' && h === 12) h = 0;
          else if (modifier !== 'pagi' && h < 12) h += 12;
          return { h, m: 0 };
      }}
    ];

    for (let pattern of timePatterns) {
      const match = lower.match(pattern.regex);
      if (match) {
        const result = pattern.handler(match);
        hours = result.h;
        minutes = result.m;
        break;
      }
    }

    return {
      text: transcript,
      category: detectedCategory,
      date: targetDate,
      hours: hours,
      minutes: minutes,
      seconds: 0
    };
  }

  const voiceBtn = document.getElementById("voice-btn");
  let recognition = null;
  let isListening = false;

  if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = "id-ID";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isListening = true;
      voiceBtn.classList.add("listening");
      voiceBtn.textContent = "⏹️";
    };

    recognition.onend = () => {
      isListening = false;
      voiceBtn.classList.remove("listening");
      voiceBtn.textContent = "🎤";
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const parsed = parseAdvanced(transcript);
      
      taskInput.value = parsed.text;
      
      if (parsed.category) {
        const options = Array.from(categoryInput.options);
        const option = options.find(opt => opt.value === parsed.category);
        if (option) categoryInput.value = parsed.category;
      }
      
      if (parsed.date) {
        const year = parsed.date.getFullYear();
        const month = String(parsed.date.getMonth() + 1).padStart(2, '0');
        const day = String(parsed.date.getDate()).padStart(2, '0');
        dateInput.value = `${year}-${month}-${day}`;
      }
      
      if (parsed.hours !== null) hoursInput.value = parsed.hours;
      if (parsed.minutes !== null) minutesInput.value = parsed.minutes;
      secondsInput.value = 0;
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      alert("Gagal mengenali suara: " + event.error);
      recognition.stop();
    };

    voiceBtn.addEventListener("click", () => {
      if (isListening) {
        recognition.stop();
      } else {
        try {
          recognition.start();
        } catch (e) {
          alert("Tidak dapat mengakses mikrofon. Pastikan izin diberikan.");
        }
      }
    });
  } else {
    voiceBtn.disabled = true;
    voiceBtn.title = "Browser tidak mendukung input suara";
    voiceBtn.style.opacity = 0.5;
  }
});
