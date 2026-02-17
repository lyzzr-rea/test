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

  let currentFilter = "All";
  let tasks = [];
  let currentView = "list"; // 'list' atau 'calendar'
  let currentMonth = new Date(); // bulan yang ditampilkan di kalender

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

    // Jika sedang di kalender, render ulang
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

    // Tampilkan bulan dan tahun
    currentMonthSpan.textContent = currentMonth.toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric",
    });

    let gridHTML = "";

    // Hari dari bulan sebelumnya
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDay; i > 0; i--) {
      const day = prevMonthLastDay - i + 1;
      const monthPrev = month; // bulan sebelumnya (masih 0-index)
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

    // Hari bulan depan untuk memenuhi 42 sel (6 baris x 7 hari)
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

    // Tambahkan event listener untuk setiap hari
    document.querySelectorAll(".calendar-day").forEach((day) => {
      day.addEventListener("click", () => {
        const dateStr = day.dataset.date;
        if (!dateStr) return;
        const [y, m, d] = dateStr.split("-").map(Number);
        const selectedDate = new Date(y, m - 1, d);

        // Filter task pada tanggal tersebut
        const tasksOnDate = tasks.filter((task) => {
          const taskDate = new Date(task.date);
          return (
            taskDate.getFullYear() === y &&
            taskDate.getMonth() === m - 1 &&
            taskDate.getDate() === d
          );
        });

        // Tampilkan di area bawah
        selectedDateSpan.textContent = selectedDate.toLocaleDateString("id-ID");
        taskListDate.innerHTML = tasksOnDate
          .map(
            (task) => `<li>${task.text} <small>(${task.category})</small></li>`,
          )
          .join("");

        // Jika tidak ada task
        if (tasksOnDate.length === 0) {
          taskListDate.innerHTML = "<li>Tidak ada task pada tanggal ini</li>";
        }
      });
    });
  }

  // Navigasi bulan
  prevMonthBtn.addEventListener("click", () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    renderCalendar();
  });

  nextMonthBtn.addEventListener("click", () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    renderCalendar();
  });

  // Inisialisasi: pastikan list-view aktif, calendar-view tersembunyi
  listView.classList.remove("hidden");
  calendarView.classList.add("hidden");

  // ===== VOICE INPUT =====
  const voiceBtn = document.getElementById("voice-btn");
  let recognition = null;
  let isListening = false;

  // Cek dukungan browser
  if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = "id-ID"; // Bisa diganti "en-US" jika perlu
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isListening = true;
      voiceBtn.classList.add("listening");
      voiceBtn.textContent = "⏹️"; // Ubah ikon jadi stop
    };

    recognition.onend = () => {
      isListening = false;
      voiceBtn.classList.remove("listening");
      voiceBtn.textContent = "🎤";
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      taskInput.value = transcript; // Isi otomatis ke field tugas
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
        // Minta izin mikrofon (browser akan otomatis minta)
        try {
          recognition.start();
        } catch (e) {
          alert("Tidak dapat mengakses mikrofon. Pastikan izin diberikan.");
        }
      }
    });
  } else {
    // Browser tidak mendukung
    voiceBtn.disabled = true;
    voiceBtn.title = "Browser tidak mendukung input suara";
    voiceBtn.style.opacity = 0.5;
  }
});
