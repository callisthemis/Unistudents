// MyStudies+ PWA
// - Δεδομένα αποθηκεύονται σε localStorage (key: "mystudies-data")
// - PIN αποθηκεύεται ως SHA-256 hash (key: "mystudies-pin")
// - Κρυφός editor: τριπλό tap στο Α.Μ.

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const DEFAULT_DATA = {
  student: {
    firstName: "ΘΕΜΙΣΤΟΚΛΗΣ ΜΑΡΙΟΣ",
    lastName: "ΕΥΣΤΑΘΙΑΔΗΣ",
    university: "ΤΜΗΜΑ ΕΠΙΣΤΗΜΗΣ ΦΥΣΙΚΗΣ ΑΓΩΓΗΣ ΚΑΙ ΑΘΛΗΤΙΣΜΟΥ",
    studentId: "9980202400024",
  },
  semesters: [
    {
      name: "Α’ Εξάμηνο",
      courses: [
        { title: "Διδακτική και Προπονητική Χειροσφαίρισης", grade: 1, ects: 6, code: "" },
        { title: "Διδακτική και Προπονητική Ποδοσφαίρου", grade: 7, ects: 6, code: "" },
        { title: "Ιστορία Φυσικής Αγωγής και Αθλητισμού", grade: 7, ects: 4, code: "" },
        { title: "Διδακτική και Προπονητική Βασικής Γυμναστικής", grade: 8.5, ects: 6, code: "" },
        { title: "Διδακτική και Προπονητική Δρόμων", grade: 7, ects: 6, code: "" },
        { title: "Λειτουργική και Ανατομική του Ανθρώπου", grade: 4, ects: 6, code: "" }
      ]
    },
    {
      name: "Β’ Εξάμηνο",
      courses: [
        { title: "Οργάνωση και Διοίκηση του Αθλητισμού", grade: 8, ects: 4, code: "" },
        { title: "Φυσιολογία του Ανθρώπου", grade: 7.5, ects: 6, code: "" }
      ]
    }
  ]
};

const STORAGE_KEY = "mystudies-data";
const PIN_KEY = "mystudies-pin";

// --- Utilities
const toFixed2 = (n) => (n == null || isNaN(n) ? "—" : Number(n).toFixed(2));
async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : structuredClone(DEFAULT_DATA);
}
function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
async function ensureDefaultPin() {
  // Αν δεν υπάρχει PIN, θέσε προεπιλεγμένο 1234
  if (!localStorage.getItem(PIN_KEY)) {
    localStorage.setItem(PIN_KEY, await sha256("1234"));
  }
}

// --- Rendering
function render() {
  const data = loadData();
  $("#fullName").textContent = `${data.student.firstName} ${data.student.lastName}`;
  $("#university").textContent = data.student.university;
  $("#studentId").textContent = `Α.Μ.: ${data.student.studentId}`;

  // GPA + total ECTS
  const { gpa, totalECTS } = computeWeightedGPA(data);
  $("#weightedGPA").textContent = toFixed2(gpa);
  $("#totalECTS").textContent = totalECTS ?? "—";

  // semesters
  const container = $("#semesters");
  container.innerHTML = "";
  data.semesters.forEach((sem) => {
    const sec = document.createElement("section");
    sec.className = "card semester";
    sec.innerHTML = `<h2>${sem.name}</h2>`;
    sem.courses.forEach((c) => {
      const row = document.createElement("div");
      row.className = "course";
      row.innerHTML = `
        <div>
          <div>${c.title}</div>
          <div class="meta">${c.code || ""}</div>
        </div>
        <div class="right">${toFixed2(c.grade)} • ${c.ects ?? "—"} ECTS</div>
      `;
      sec.appendChild(row);
    });
    container.appendChild(sec);
  });
}

function computeWeightedGPA(data) {
  let wsum = 0, ectsSum = 0;
  data.semesters.forEach(s => s.courses.forEach(c => {
    if (typeof c.grade === "number" && typeof c.ects === "number") {
      wsum += c.grade * c.ects;
      ectsSum += c.ects;
    }
  }));
  return { gpa: ectsSum ? wsum / ectsSum : null, totalECTS: ectsSum };
}

// --- Secret editor trigger (triple tap)
function setupTripleTap() {
  const target = $("#studentId");
  let taps = 0;
  let timer = null;
  target.addEventListener("touchend", () => handleTap());
  target.addEventListener("click", () => handleTap());

  function handleTap() {
    taps++;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (taps >= 3) openPinDialog();
      taps = 0;
    }, 350);
  }
}

// --- PIN dialog & editor
async function openPinDialog() {
  await ensureDefaultPin();
  const dlg = $("#pinDialog");
  const input = $("#pinInput");
  input.value = "";
  dlg.showModal();
  input.focus();

  dlg.addEventListener("close", async function onClose() {
    dlg.removeEventListener("close", onClose);
    if (dlg.returnValue === "ok") {
      const entered = await sha256(input.value);
      const saved = localStorage.getItem(PIN_KEY);
      if (entered === saved) {
        openEditor();
      } else {
        alert("Λάθος PIN.");
      }
    }
  });
}

function openEditor() {
  const data = loadData();
  // Pre-fill student fields
  $("#firstName").value = data.student.firstName;
  $("#lastName").value = data.student.lastName;
  $("#universityInput").value = data.student.university;
  $("#studentIdInput").value = data.student.studentId;

  // Semesters UI
  const container = $("#editorSemesters");
  container.innerHTML = "";
  data.semesters.forEach((sem, si) => container.appendChild(renderSemesterBox(sem, si)));

  $("#editorDialog").showModal();

  $("#addSemesterBtn").onclick = () => {
    data.semesters.push({ name: "Νέο Εξάμηνο", courses: [] });
    container.appendChild(renderSemesterBox(data.semesters.at(-1), data.semesters.length - 1));
  };

  $("#saveBtn").onclick = async () => {
    // collect student
    data.student.firstName = $("#firstName").value.trim();
    data.student.lastName = $("#lastName").value.trim();
    data.student.university = $("#universityInput").value.trim();
    data.student.studentId = $("#studentIdInput").value.trim();

    // collect semesters
    data.semesters = collectSemestersFromUI();

    // new PIN?
    const newPinVal = $("#newPin").value.trim();
    if (newPinVal) {
      localStorage.setItem(PIN_KEY, await sha256(newPinVal));
    }

    saveData(data);
    $("#editorDialog").close();
    render();
  };
}

function renderSemesterBox(sem, si) {
  const box = document.createElement("div");
  box.className = "semester-box";
  box.dataset.index = si;

  box.innerHTML = `
    <div class="semester-head">
      <input class="sem-name" value="${sem.name}" />
      <button type="button" class="ghost remove">Διαγραφή</button>
    </div>
    <div class="courses"></div>
    <div class="small">
      <button type="button" class="ghost add-course">+ Προσθήκη Μαθήματος</button>
    </div>
  `;

  const coursesEl = box.querySelector(".courses");
  sem.courses.forEach((c, ci) => coursesEl.appendChild(renderCourseRow(c, ci)));

  box.querySelector(".add-course").onclick = () => {
    coursesEl.appendChild(renderCourseRow({ title: "Νέο Μάθημα", code: "", grade: null, ects: null }, coursesEl.children.length));
  };

  box.querySelector(".remove").onclick = () => {
    box.remove();
  };

  return box;
}

function renderCourseRow(course, ci) {
  const row = document.createElement("div");
  row.className = "inline-grid";
  row.innerHTML = `
    <input class="c-title" value="${course.title || ""}" placeholder="Τίτλος" />
    <input class="c-code" value="${course.code || ""}" placeholder="Κωδ." />
    <input class="c-grade" type="number" step="0.1" inputmode="decimal" value="${course.grade ?? ""}" placeholder="Βαθμός" />
    <input class="c-ects" type="number" step="1" inputmode="numeric" value="${course.ects ?? ""}" placeholder="ECTS" />
    <button type="button" class="ghost remove">✕</button>
  `;
  row.querySelector(".remove").onclick = () => row.remove();
  return row;
}

function collectSemestersFromUI() {
  const list = [];
  $$("#editorSemesters .semester-box").forEach((box) => {
    const name = box.querySelector(".sem-name").value.trim() || "Εξάμηνο";
    const courses = [];
    box.querySelectorAll(".courses .inline-grid").forEach((row) => {
      const title = row.querySelector(".c-title").value.trim();
      const code = row.querySelector(".c-code").value.trim();
      const gradeRaw = row.querySelector(".c-grade").value.trim();
      const ectsRaw = row.querySelector(".c-ects").value.trim();
      const grade = gradeRaw === "" ? null : Number(gradeRaw);
      const ects = ectsRaw === "" ? null : Number(ectsRaw);
      if (title) courses.push({ title, code, grade, ects });
    });
    list.push({ name, courses });
  });
  return list;
}

// --- PWA bits (install & service worker)
let deferredPrompt = null;
const installBtn = $("#installBtn");
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});
installBtn?.addEventListener("click", async () => {
  installBtn.hidden = true;
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}

// --- boot
render();
setupTripleTap();
ensureDefaultPin();
