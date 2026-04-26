// Supabase Configuration
const SUPABASE_URL = 'https://oxmfekmsxeehfrjmhnvp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_sa8iU80gAdlOl4KLGjlQ2A_FSK9zYle';
let supabaseClient = null;
try {
    if (typeof supabase !== 'undefined' && supabase.createClient) {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
} catch (e) {
    console.error("Supabase load error:", e);
}

const defaultFixedTasks = [
    { id: 'f0', name: 'Sveglia', type: 'fixed', completed: false },
    { id: 'f1', name: 'Meditazione', type: 'fixed', completed: false },
    { id: 'f2', name: 'Colazione', type: 'fixed', completed: false },
    { id: 'f3', name: 'Pranzo', type: 'fixed', completed: false },
    { id: 'f6', name: 'Nuoto', type: 'fixed', completed: false },
    { id: 'f4', name: 'Cena', type: 'fixed', completed: false },
    { id: 'f5', name: 'Yoga', type: 'fixed', completed: false },
    { id: 'f10', name: 'Nanna', type: 'fixed', completed: false }
];

let tasks = [];
let historyData = {};
let weightData = {};
let stepsData = {};
let dailyDistanceData = {};
let waterData = {};
let measurementsData = {}; // { date: { waist, hips, chest } }
let dailyNotesData = {}; // { date: "string" }
let currentTaskToComplete = null;
let isAddingNewTask = false;
let currentEditingDate = '';
let todayISO = '';

let weightChartInstance = null;
let stepsChartInstance = null;
let swimChartInstance = null;
let swimPerfChartInstance = null;
let dietPieChartInstance = null;
let waterChartInstance = null;
let measurementsChartInstance = null;
let currentUser = null;
let weeklyGoals = { steps: 70000, swimMeters: 5000, workouts: 4, waterLiters: 3.0 };

const viewToday = document.getElementById('view-today');
const viewHistory = document.getElementById('view-history');
const viewAnalysis = document.getElementById('view-analysis');
const tabBtns = document.querySelectorAll('.tab-btn');
const editingDateInput = document.getElementById('editing-date');
const fixedTasksList = document.getElementById('fixed-tasks-list');
const completionModal = document.getElementById('completion-modal');
const addTaskModal = document.getElementById('add-task-modal');
const goalsModal = document.getElementById('goals-modal');
const completionForm = document.getElementById('completion-form');
const addTaskForm = document.getElementById('add-task-form');
const modalTaskTitle = document.getElementById('modal-task-title');
const historyDate = document.getElementById('history-date');
const dailyWeightInput = document.getElementById('daily-weight');
const dailyStepsInput = document.getElementById('daily-steps');
const dailyDistanceInput = document.getElementById('daily-distance');
const measureWaistInput = document.getElementById('measure-waist');
const measureHipsInput = document.getElementById('measure-hips');
const measureChestInput = document.getElementById('measure-chest');
const dailyNotesInput = document.getElementById('daily-notes-text');

function init() {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    todayISO = (new Date(Date.now() - tzoffset)).toISOString().split('T')[0];
    currentEditingDate = todayISO;

    const savedWeight = localStorage.getItem('diario-weight');
    if (savedWeight) weightData = JSON.parse(savedWeight);
    const savedSteps = localStorage.getItem('diario-steps');
    if (savedSteps) stepsData = JSON.parse(savedSteps);
    const savedDailyDistance = localStorage.getItem('diario-daily-distance');
    if (savedDailyDistance) dailyDistanceData = JSON.parse(savedDailyDistance);
    const savedMeasurements = localStorage.getItem('diario-measurements');
    if (savedMeasurements) measurementsData = JSON.parse(savedMeasurements);
    const savedNotes = localStorage.getItem('diario-daily-notes');
    if (savedNotes) dailyNotesData = JSON.parse(savedNotes);

    const savedGoals = localStorage.getItem('diario-goals');
    if (savedGoals) {
        weeklyGoals = JSON.parse(savedGoals);
        if (!weeklyGoals.waterLiters || weeklyGoals.waterLiters === 2.0) {
            weeklyGoals.waterLiters = 3.0;
            localStorage.setItem('diario-goals', JSON.stringify(weeklyGoals));
        }
    }

    if (editingDateInput) {
        editingDateInput.value = todayISO;
        editingDateInput.max = todayISO;
    }

    initAuth();
    loadTasks();
    updateDateNavButtons();
    setupEventListeners();
    updateInputsForDate();
    renderTasks();
    renderWaterTracker();
    checkMeasurementReminder();
    checkDailyCompletion(true); // silent check on load
}

function loadTasks() {
    const savedHistory = localStorage.getItem('diario-history');
    if (savedHistory) historyData = JSON.parse(savedHistory);

    const saved = localStorage.getItem('diario-tasks');
    const lastDate = localStorage.getItem('diario-date');

    waterData = JSON.parse(localStorage.getItem('diario-water') || '{}');

    if (saved && lastDate === todayISO) {
        tasks = JSON.parse(saved);
        const optionalTasks = tasks.filter(t => t.type === 'optional');
        const savedFixedTasks = tasks.filter(t => t.type === 'fixed');
        const updatedFixedTasks = defaultFixedTasks.map(defaultTask => {
            const existing = savedFixedTasks.find(t => t.name === defaultTask.name);
            return existing ? { ...defaultTask, ...existing } : defaultTask;
        });
        tasks = [...updatedFixedTasks, ...optionalTasks];
    } else {
        tasks = JSON.parse(JSON.stringify(defaultFixedTasks));
    }
    renderTasks();
}

function changeEditingDate(newDateStr) {
    currentEditingDate = newDateStr;
    if (currentEditingDate === todayISO) {
        loadTasks();
    } else {
        if (historyData[currentEditingDate]) {
            const loaded = JSON.parse(JSON.stringify(historyData[currentEditingDate]));
            const optionalTasks = loaded.filter(t => t.type === 'optional');
            const savedFixedTasks = loaded.filter(t => t.type === 'fixed');
            const updatedFixedTasks = defaultFixedTasks.map(defaultTask => {
                const existing = savedFixedTasks.find(t => t.name === defaultTask.name);
                return existing ? { ...defaultTask, ...existing } : defaultTask;
            });
            tasks = [...updatedFixedTasks, ...optionalTasks];
        } else {
            tasks = JSON.parse(JSON.stringify(defaultFixedTasks));
        }
    }

    if (editingDateInput) editingDateInput.value = currentEditingDate;

    updateInputsForDate();
    renderTasks();
    renderWaterTracker();
    checkMeasurementReminder();
    updateDateNavButtons();
}

function changeDateBy(days) {
    const current = new Date(currentEditingDate + 'T12:00:00Z');
    current.setDate(current.getDate() + days);
    const today = new Date(todayISO + 'T12:00:00Z');
    if (current > today) return;
    const newDateStr = current.toISOString().split('T')[0];
    if (editingDateInput) editingDateInput.value = newDateStr;
    changeEditingDate(newDateStr);
}

function updateDateNavButtons() {
    const nextBtn = document.getElementById('next-day-btn');
    if (nextBtn) nextBtn.disabled = (currentEditingDate >= todayISO);
}

function saveTasks() {
    if (currentEditingDate === todayISO) {
        localStorage.setItem('diario-tasks', JSON.stringify(tasks));
        localStorage.setItem('diario-date', todayISO);
    }
    historyData[currentEditingDate] = JSON.parse(JSON.stringify(tasks));
    localStorage.setItem('diario-history', JSON.stringify(historyData));
    syncDataToCloud();
}

function updateInputsForDate() {
    if (dailyWeightInput) dailyWeightInput.value = weightData[currentEditingDate] || '';
    if (dailyStepsInput) dailyStepsInput.value = stepsData[currentEditingDate] || '';
    if (dailyDistanceInput) dailyDistanceInput.value = dailyDistanceData[currentEditingDate] || '';

    const m = measurementsData[currentEditingDate] || {};
    if (measureWaistInput) measureWaistInput.value = m.waist || '';
    if (measureHipsInput) measureHipsInput.value = m.hips || '';
    if (measureChestInput) measureChestInput.value = m.chest || '';

    if (dailyNotesInput) dailyNotesInput.value = dailyNotesData[currentEditingDate] || '';
}

function setupEventListeners() {
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const tab = e.target.dataset.tab;
            viewToday.classList.toggle('hidden', tab !== 'today');
            viewHistory.classList.toggle('hidden', tab !== 'history');
            viewAnalysis.classList.toggle('hidden', tab !== 'analysis');
            if (tab === 'today') renderTasks();
            if (tab === 'history') renderHistory();
            if (tab === 'analysis') renderAnalysis();
        });
    });

    if (editingDateInput) {
        editingDateInput.addEventListener('change', (e) => {
            if (e.target.value) changeEditingDate(e.target.value);
        });
    }

    const prevDayBtn = document.getElementById('prev-day-btn');
    if (prevDayBtn) prevDayBtn.addEventListener('click', () => changeDateBy(-1));
    const nextDayBtn = document.getElementById('next-day-btn');
    if (nextDayBtn) nextDayBtn.addEventListener('click', () => changeDateBy(1));

    if (dailyWeightInput) {
        dailyWeightInput.addEventListener('input', (e) => {
            weightData[currentEditingDate] = e.target.value;
            localStorage.setItem('diario-weight', JSON.stringify(weightData));
            syncDataToCloud();
            renderAnalysis();
        });
    }

    if (dailyStepsInput && dailyDistanceInput) {
        dailyStepsInput.addEventListener('input', (e) => {
            const steps = parseInt(e.target.value) || 0;
            stepsData[currentEditingDate] = steps.toString();
            localStorage.setItem('diario-steps', JSON.stringify(stepsData));

            const calculatedDistance = Math.round(steps * 0.7);
            dailyDistanceInput.value = calculatedDistance;
            dailyDistanceData[currentEditingDate] = calculatedDistance.toString();
            localStorage.setItem('diario-daily-distance', JSON.stringify(dailyDistanceData));
            syncDataToCloud();
            renderAnalysis();
        });
    }

    // Measurements Listeners
    [measureWaistInput, measureHipsInput, measureChestInput].forEach(inp => {
        if (inp) {
            inp.addEventListener('input', () => {
                if (!measurementsData[currentEditingDate]) measurementsData[currentEditingDate] = {};
                measurementsData[currentEditingDate].waist = measureWaistInput.value;
                measurementsData[currentEditingDate].hips = measureHipsInput.value;
                measurementsData[currentEditingDate].chest = measureChestInput.value;
                localStorage.setItem('diario-measurements', JSON.stringify(measurementsData));
                syncDataToCloud();
            });
        }
    });

    if (dailyNotesInput) {
        dailyNotesInput.addEventListener('input', (e) => {
            dailyNotesData[currentEditingDate] = e.target.value;
            localStorage.setItem('diario-daily-notes', JSON.stringify(dailyNotesData));
            syncDataToCloud();
        });
    }

    if (completionForm) completionForm.addEventListener('submit', handleTaskCompletion);
    if (addTaskForm) addTaskForm.addEventListener('submit', handleAddTask);

    // Export/Import - Safe listeners
    const exportBtn = document.getElementById('export-btn');
    const exportBtnBig = document.getElementById('export-btn-big');
    if (exportBtn) exportBtn.addEventListener('click', exportData);
    if (exportBtnBig) exportBtnBig.addEventListener('click', exportData);

    const importBtn = document.getElementById('import-btn');
    const importBtnBig = document.getElementById('import-btn-big');
    const importFile = document.getElementById('import-file');
    if (importBtn && importFile) {
        importBtn.addEventListener('click', () => importFile.click());
        importFile.addEventListener('change', importData);
    }
    if (importBtnBig && importFile) {
        importBtnBig.addEventListener('click', () => importFile.click());
    }

    // Cloud Auth Listeners
    const authBtn = document.getElementById('auth-btn');
    const authModal = document.getElementById('auth-modal');
    const closeAuthModal = document.getElementById('close-auth-modal');

    if (authBtn && authModal) {
        authBtn.addEventListener('click', (e) => {
            e.preventDefault();
            authModal.classList.remove('hidden');
        });
    }
    if (closeAuthModal && authModal) {
        closeAuthModal.addEventListener('click', () => authModal.classList.add('hidden'));
    }

    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const syncNowBtn = document.getElementById('sync-now-btn');

    if (loginBtn) loginBtn.addEventListener('click', handleLogin);
    if (signupBtn) signupBtn.addEventListener('click', handleSignup);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (syncNowBtn) syncNowBtn.addEventListener('click', () => {
        syncNowBtn.textContent = '⌛ Sincronizzazione...';
        syncDataToCloud().then(() => {
            fetchDataFromCloud().then(() => {
                syncNowBtn.textContent = '✅ Sincronizzato!';
                setTimeout(() => syncNowBtn.textContent = '🔄 Sincronizza Ora', 2000);
            });
        });
    });

    // Goals - Safe listeners
    const editGoalsBtn = document.getElementById('edit-goals-btn');
    if (editGoalsBtn) {
        editGoalsBtn.addEventListener('click', () => {
            const stepsInput = document.getElementById('goal-steps-input');
            const swimInput = document.getElementById('goal-swim-input');
            const workoutsInput = document.getElementById('goal-workouts-input');
            if (stepsInput) stepsInput.value = weeklyGoals.steps;
            if (swimInput) swimInput.value = weeklyGoals.swimMeters;
            if (workoutsInput) workoutsInput.value = weeklyGoals.workouts;
            const waterGoalInput = document.getElementById('goal-water-input');
            if (waterGoalInput) waterGoalInput.value = weeklyGoals.waterLiters || 3.0;

            // Weight Goals
            const wFinal = document.getElementById('goal-weight-final');
            const wInt1 = document.getElementById('goal-weight-int1');
            const dInt1 = document.getElementById('goal-date-int1');
            const wInt2 = document.getElementById('goal-weight-int2');
            const dInt2 = document.getElementById('goal-date-int2');

            if (wFinal) wFinal.value = weeklyGoals.weightFinal || '';
            if (wInt1) wInt1.value = weeklyGoals.weightInt1 || '';
            if (dInt1) dInt1.value = weeklyGoals.dateInt1 || '';
            if (wInt2) wInt2.value = weeklyGoals.weightInt2 || '';
            if (dInt2) dInt2.value = weeklyGoals.dateInt2 || '';

            if (goalsModal) goalsModal.classList.remove('hidden');
        });
    }

    const goalsForm = document.getElementById('goals-form');
    if (goalsForm) {
        goalsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const stepsInput = document.getElementById('goal-steps-input');
            const swimInput = document.getElementById('goal-swim-input');
            const workoutsInput = document.getElementById('goal-workouts-input');
            if (stepsInput) weeklyGoals.steps = parseInt(stepsInput.value) || 0;
            if (swimInput) weeklyGoals.swimMeters = parseInt(swimInput.value) || 0;
            if (workoutsInput) weeklyGoals.workouts = parseInt(workoutsInput.value) || 0;
            const waterGoalInput = document.getElementById('goal-water-input');
            if (waterGoalInput) weeklyGoals.waterLiters = parseFloat(waterGoalInput.value) || 3.0;

            // Weight Goals Save
            weeklyGoals.weightFinal = parseFloat(document.getElementById('goal-weight-final').value) || null;
            weeklyGoals.weightInt1 = parseFloat(document.getElementById('goal-weight-int1').value) || null;
            weeklyGoals.dateInt1 = document.getElementById('goal-date-int1').value || null;
            weeklyGoals.weightInt2 = parseFloat(document.getElementById('goal-weight-int2').value) || null;
            weeklyGoals.dateInt2 = document.getElementById('goal-date-int2').value || null;

            localStorage.setItem('diario-goals', JSON.stringify(weeklyGoals));
            syncDataToCloud();
            if (goalsModal) goalsModal.classList.add('hidden');
            renderAnalysis();
        });
    }

    const addOptionalBtn = document.getElementById('add-optional-task-btn');
    if (addOptionalBtn) {
        addOptionalBtn.addEventListener('click', () => addTaskModal.classList.remove('hidden'));
    }

    // Water Tracker
    const addWaterBtn = document.getElementById('add-water-btn');
    const removeWaterBtn = document.getElementById('remove-water-btn');
    if (addWaterBtn) {
        addWaterBtn.addEventListener('click', () => updateWater(0.25));
    }
    if (removeWaterBtn) {
        removeWaterBtn.addEventListener('click', () => updateWater(-0.25));
    }

    const addSnackBtn = document.getElementById('add-snack-btn');
    if (addSnackBtn) {
        addSnackBtn.addEventListener('click', () => {
            const id = 'opt_' + Date.now();
            const newTask = { id, name: 'Snack', type: 'optional', completed: false };
            isAddingNewTask = true;
            openModalForTask(newTask);
        });
    }

    const addWalkBtn = document.getElementById('add-walk-btn');
    if (addWalkBtn) {
        addWalkBtn.addEventListener('click', () => {
            const id = 'opt_' + Date.now();
            const newTask = { id, name: 'Camminata', type: 'optional', completed: false };
            isAddingNewTask = true;
            openModalForTask(newTask);
        });
    }

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            completionModal.classList.add('hidden');
            addTaskModal.classList.add('hidden');
            if (goalsModal) goalsModal.classList.add('hidden');
        });
    });
}

function renderTasks() {
    fixedTasksList.innerHTML = '';
    const sortedTasks = [...tasks].sort((a, b) => {
        // 1. Priorità allo stato di completamento (completati prima)
        if (a.completed !== b.completed) {
            return a.completed ? -1 : 1;
        }

        // Entrambi hanno lo stesso stato (entrambi fatti o entrambi no)
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();

        // 2. Caso speciale "Nanna": deve essere sempre l'ultima del suo gruppo
        if (nameA.includes('nanna')) return 1;
        if (nameB.includes('nanna')) return -1;

        // 3. Ordinamento per orario per le attività completate
        if (a.completed && a.time && b.time) {
            return a.time.localeCompare(b.time);
        }

        return 0;
    });

    sortedTasks.forEach(task => {
        fixedTasksList.appendChild(createTaskElement(task));
    });
}

const iconMap = {
    'sveglia': '⏰', 'meditazione': '🧘', 'colazione': '☕', 'pranzo': '🍱',
    'yoga': '🧘‍♀️', 'nuoto': '🏊‍♂️', 'cena': '🌙', 'nanna': '😴',
    'snack': '🍎', 'camminata': '🚶‍♂️'
};

function createTaskElement(task, isReadOnly = false) {
    const div = document.createElement('div');
    div.className = `task-item ${task.completed ? 'completed' : ''} ${task.badDiet ? 'is-sgarro' : ''}`;
    const nameLower = task.name.toLowerCase();
    const taskIcon = iconMap[Object.keys(iconMap).find(k => nameLower.includes(k))] || '📝';

    let detailsHtml = '';
    if (task.completed) {
        let extra = '';
        if (nameLower.includes('nuoto')) {
            if (task.vasche) extra += `${task.vasche} vasche `;
            if (task.distanza) extra += `• ${task.distanza}m`;
        } else if (nameLower.includes('camminata')) {
            if (task.distanza) extra += `${task.distanza}m`;
        }
        const displayTime = task.time ? (task.time.startsWith('0') ? task.time.substring(1) : task.time) : '';

        detailsHtml = `
            <div class="task-details" style="display: flex; flex-direction: column; gap: 0.4rem; margin-top: 0.3rem;">
                <div class="task-time-row" style="display: flex; align-items: baseline; gap: 0.6rem;">
                    <span style="color: var(--accent-color); font-size: 1.1rem; font-weight: 800;">${displayTime}</span>
                </div>
                <div class="task-name" style="font-size: 1.2rem; font-weight: 700;">${task.name}</div>
                ${task.notes ? `<div class="task-notes-display" style="font-size: 1rem; font-style: italic; opacity: 0.85; white-space: pre-wrap; line-height: 1.5; border-left: 2px solid var(--accent-color); padding-left: 0.8rem; margin-top: 0.1rem; margin-bottom: 0.2rem;">${task.notes}</div>` : ''}
                <div class="task-extra-row" style="display: flex; flex-wrap: wrap; gap: 0.8rem; color: var(--text-secondary); font-size: 0.9rem; opacity: 0.9;">
                    ${task.duration ? `<span>🕒 ${task.duration} min</span>` : ''}
                    ${extra ? `<span style="color: var(--accent-color); font-weight: 600;">${extra}</span>` : ''}
                </div>
            </div>
        `;
    }

    div.innerHTML = `
        <div class="task-info">
            <div class="task-icon-container">${taskIcon}</div>
            <div style="display: flex; flex-direction: column; gap: 0.2rem;">
                ${!task.completed ? `<div class="task-name">${task.name}</div>` : detailsHtml}
            </div>
        </div>
        <div class="task-actions">
            ${!isReadOnly ? `
                ${task.completed ? `<button class="edit-btn" data-id="${task.id}">✏️</button>` : ''}
                ${task.type === 'optional' ? `<button class="delete-btn" data-id="${task.id}">🗑️</button>` : ''}
                <button class="check-btn" data-id="${task.id}">${task.completed ? '✅' : '⭕'}</button>
            ` : ''}
        </div>
    `;

    if (!isReadOnly) {
        div.querySelector('.check-btn').addEventListener('click', () => toggleTask(task.id));
        const del = div.querySelector('.delete-btn');
        if (del) del.addEventListener('click', () => deleteTask(task.id));
        const edit = div.querySelector('.edit-btn');
        if (edit) edit.addEventListener('click', () => editTask(task.id));
    }
    return div;
}

function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    if (task.completed) {
        task.completed = false;
        saveTasks();
        renderTasks();
    } else {
        isAddingNewTask = false;
        openModalForTask(task, false);
    }
}

function openModalForTask(task, isEdit = false) {
    currentTaskToComplete = task;
    if (isAddingNewTask) {
        modalTaskTitle.textContent = `Aggiungi: ${task.name}`;
    } else if (isEdit) {
        modalTaskTitle.textContent = `Modifica: ${task.name}`;
    } else {
        modalTaskTitle.textContent = `Completa: ${task.name}`;
    }

    const now = new Date();
    const defaultTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    document.getElementById('task-time').value = isEdit ? (task.time || '') : defaultTime;
    document.getElementById('task-duration').value = isEdit ? (task.duration || '') : '';
    document.getElementById('task-notes').value = isEdit ? (task.notes || '') : '';

    const nameLower = task.name.toLowerCase();
    const noDurationTasks = ['sveglia', 'colazione', 'pranzo', 'cena', 'snack', 'nanna'];
    const hideDuration = noDurationTasks.some(t => nameLower.includes(t));
    const dfg = document.getElementById('duration-field-group');
    if (dfg) dfg.classList.toggle('hidden', hideDuration);

    const nf = document.getElementById('extra-fields-nuoto');
    if (nf) nf.classList.toggle('hidden', !nameLower.includes('nuoto'));
    const cf = document.getElementById('extra-fields-camminata');
    if (cf) cf.classList.toggle('hidden', !nameLower.includes('camminata'));

    const dwg = document.getElementById('diet-warning-group');
    const mealTasks = ['colazione', 'pranzo', 'cena', 'snack'];
    const isMeal = mealTasks.some(t => nameLower.includes(t));
    if (dwg) {
        dwg.classList.toggle('hidden', !isMeal);
        document.getElementById('diet-warning-check').checked = task.badDiet || false;
    }

    completionModal.classList.remove('hidden');
    document.getElementById('task-time').focus();
}

function handleTaskCompletion(e) {
    e.preventDefault();
    if (!currentTaskToComplete) return;
    currentTaskToComplete.completed = true;
    currentTaskToComplete.time = document.getElementById('task-time').value;
    currentTaskToComplete.duration = document.getElementById('task-duration').value;
    currentTaskToComplete.notes = document.getElementById('task-notes').value;
    if (currentTaskToComplete.name.toLowerCase().includes('nuoto')) {
        currentTaskToComplete.vasche = document.getElementById('task-vasche').value;
        currentTaskToComplete.distanza = document.getElementById('task-distanza').value;
    }
    if (currentTaskToComplete.name.toLowerCase().includes('camminata')) {
        currentTaskToComplete.distanza = document.getElementById('task-distanza-camminata').value;
    }

    currentTaskToComplete.badDiet = document.getElementById('diet-warning-check').checked;

    if (isAddingNewTask) {
        tasks.push(currentTaskToComplete);
        isAddingNewTask = false;
    }

    saveTasks();
    renderTasks();
    completionModal.classList.add('hidden');
    checkDailyCompletion();
}

function checkDailyCompletion(silent = false) {
    if (currentEditingDate !== todayISO) return;
    const allCompleted = tasks.length > 0 && tasks.every(t => t.completed);
    if (allCompleted && !silent) {
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#6366f1', '#a855f7', '#10b981']
        });
    }
}

function editTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    isAddingNewTask = false;
    openModalForTask(task, true);
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    renderTasks();
    checkDailyCompletion();
}

function handleAddTask(e) {
    e.preventDefault();
    const nameInput = document.getElementById('new-task-name');
    const name = nameInput.value.trim();
    if (name) {
        const id = 'opt_' + Date.now();
        tasks.push({ id, name, type: 'optional', completed: false });
        nameInput.value = '';
        addTaskModal.classList.add('hidden');
        saveTasks();
        renderTasks();
        toggleTask(id);
    }
}

function renderHistory() {
    const headerRow = document.getElementById('habit-table-header');
    const tableBody = document.getElementById('habit-table-body');
    if (!headerRow || !tableBody) return;

    headerRow.innerHTML = '<th>Attività</th>';
    tableBody.innerHTML = '';

    // Prendi gli ultimi 7 giorni in cui ci sono dati
    const dates = Object.keys(historyData).sort().reverse().slice(0, 7);

    dates.forEach(d => {
        const dayName = new Date(d + 'T12:00:00Z').toLocaleDateString('it-IT', { weekday: 'short' });
        const th = document.createElement('th');
        th.innerHTML = `${dayName}<br>${d.split('-')[2]}/${d.split('-')[1]}`;
        headerRow.appendChild(th);
    });

    const habitRows = [...defaultFixedTasks, { name: 'Snack' }, { name: 'Camminata' }];
    habitRows.forEach(habit => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${habit.name}</td>`;

        dates.forEach(date => {
            const dayTasks = historyData[date] || [];
            const td = document.createElement('td');

            if (habit.name === 'Snack') {
                const snackTasks = dayTasks.filter(t => t.name.toLowerCase().includes('snack') && t.completed);
                const hasSgarro = snackTasks.some(t => t.badDiet);
                td.innerHTML = snackTasks.length > 0 ?
                    `<span class="habit-snack-count" style="${hasSgarro ? 'background: #f43f5e;' : ''}">${snackTasks.length}</span>`
                    : '-';
            } else {
                const task = dayTasks.find(t => t.name.toLowerCase().includes(habit.name.toLowerCase()) && t.completed);
                if (task) {
                    if (task.badDiet) {
                        td.innerHTML = '<span class="habit-status sgarro">✓</span>';
                    } else {
                        td.innerHTML = '<span class="habit-status done">✓</span>';
                    }
                } else {
                    td.innerHTML = '<span class="habit-cross">-</span>';
                }
            }
            tr.appendChild(td);
        });
        tableBody.appendChild(tr);
    });
}

function renderAnalysis() {
    const ctxW = document.getElementById('weightChart');
    const ctxS = document.getElementById('stepsChart');
    const ctxSw = document.getElementById('swimChart');
    if (!ctxW || !ctxS || !ctxSw) return;

    renderWeeklyGoals();
    renderDietAnalysis();
    renderWaterAnalysis();
    renderMeasurementsAnalysis();
    renderSwimSummary();
    renderStreaks();

    const dates = Object.keys(historyData).sort();
    const labels = dates.map(d => d.split('-').reverse().slice(0, 2).join('/'));

    if (weightChartInstance) weightChartInstance.destroy();

    const weightDatasets = [{
        label: 'Peso (kg)',
        data: dates.map(d => weightData[d]),
        borderColor: '#6366f1',
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: '#6366f1'
    }];

    // Idea 2: Moving Average (7 days)
    const movingAverageData = dates.map((date, index) => {
        const start = Math.max(0, index - 6);
        const slice = dates.slice(start, index + 1);
        const weights = slice.map(d => weightData[d]).filter(w => w !== undefined && w !== null && w !== '');
        if (weights.length === 0) return null;
        const sum = weights.reduce((a, b) => a + parseFloat(b), 0);
        return (sum / weights.length).toFixed(2);
    });

    weightDatasets.push({
        label: 'Trend (Media 7gg)',
        data: movingAverageData,
        borderColor: 'rgba(167, 139, 250, 0.6)',
        backgroundColor: 'rgba(167, 139, 250, 0.05)',
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        tension: 0.4
    });

    // Add Final Goal Line
    if (weeklyGoals.weightFinal) {
        weightDatasets.push({
            label: 'Obiettivo Finale',
            data: dates.map(() => weeklyGoals.weightFinal),
            borderColor: 'rgba(251, 191, 36, 0.5)',
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
        });
    }

    // Add Intermediate Goals as Points
    const intGoals = [];
    if (weeklyGoals.weightInt1 && weeklyGoals.dateInt1) intGoals.push({ w: weeklyGoals.weightInt1, d: weeklyGoals.dateInt1 });
    if (weeklyGoals.weightInt2 && weeklyGoals.dateInt2) intGoals.push({ w: weeklyGoals.weightInt2, d: weeklyGoals.dateInt2 });

    intGoals.forEach((goal, idx) => {
        const goalData = dates.map(d => (d === goal.d) ? goal.w : null);
        if (goalData.some(v => v !== null)) {
            weightDatasets.push({
                label: `Milestone ${idx + 1}`,
                data: goalData,
                backgroundColor: '#fbbf24',
                borderColor: '#fbbf24',
                pointRadius: 8,
                pointHoverRadius: 10,
                showLine: false
            });
        }
    });

    weightChartInstance = new Chart(ctxW, {
        type: 'line',
        data: {
            labels,
            datasets: weightDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            },
            plugins: {
                legend: {
                    labels: { color: '#94a3b8', boxWidth: 10 }
                }
            }
        }
    });

    if (stepsChartInstance) stepsChartInstance.destroy();
    stepsChartInstance = new Chart(ctxS, {
        type: 'line',
        data: {
            labels,
            datasets: [{ label: 'Passi', data: dates.map(d => stepsData[d]), borderColor: '#10b981', tension: 0.3 }]
        }
    });

    if (swimChartInstance) swimChartInstance.destroy();
    swimChartInstance = new Chart(ctxSw, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Nuoto (m)',
                data: dates.map(d => {
                    const swim = historyData[d].find(t => t.name.toLowerCase().includes('nuoto'));
                    return swim ? swim.distanza : 0;
                }),
                borderColor: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                fill: true,
                tension: 0.3
            }]
        }
    });

    const ctxSwP = document.getElementById('swimPerfChart');
    if (ctxSwP) {
        if (swimPerfChartInstance) swimPerfChartInstance.destroy();
        const perfData = dates.map(d => {
            const swim = historyData[d].find(t => t.name.toLowerCase().includes('nuoto') && t.completed && t.vasche && t.duration);
            if (swim && parseInt(swim.vasche) > 0) {
                return Math.round((parseInt(swim.duration) * 60) / parseInt(swim.vasche));
            }
            return null;
        });

        swimPerfChartInstance = new Chart(ctxSwP, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Secondi / Vasca',
                    data: perfData,
                    borderColor: '#06b6d4',
                    backgroundColor: 'rgba(6, 182, 212, 0.1)',
                    fill: true,
                    tension: 0.3,
                    spanGaps: true
                }]
            },
            options: {
                scales: {
                    y: {
                        title: { display: true, text: 'Secondi' }
                    }
                }
            }
        });
    }

    // Tabella riepilogativa (ordinata dalla più recente)
    const tableBody = document.getElementById('analysis-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const sortedDates = Object.keys(historyData).sort().reverse();
    sortedDates.forEach(d => {
        const tasksForDay = historyData[d] || [];
        const swimTask = tasksForDay.find(t => t.name.toLowerCase().includes('nuoto') && t.completed);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${d.split('-').reverse().join('/')}</td>
            <td>${weightData[d] || '-'} kg</td>
            <td>${stepsData[d] || '-'}</td>
            <td>${dailyDistanceData[d] || '-'} m</td>
            <td>${swimTask ? (swimTask.vasche || '-') : '-'}</td>
        `;
        tableBody.appendChild(tr);
    });

    // Tabella Performance Nuoto
    const swimPerformanceBody = document.getElementById('swim-performance-body');
    if (!swimPerformanceBody) return;
    swimPerformanceBody.innerHTML = '';

    sortedDates.forEach(d => {
        const tasksForDay = historyData[d] || [];
        const swimTask = tasksForDay.find(t => t.name.toLowerCase().includes('nuoto') && t.completed && t.vasche && t.duration);

        if (swimTask) {
            const vasche = parseInt(swimTask.vasche);
            const durataMin = parseInt(swimTask.duration);
            if (vasche > 0 && durataMin > 0) {
                const mediaSecondi = Math.round((durataMin * 60) / vasche);
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${d.split('-').reverse().join('/')}</td>
                    <td>${vasche}</td>
                    <td>${durataMin} min</td>
                    <td style="color: var(--accent-color); font-weight: 700;">${mediaSecondi} sec / vasca</td>
                `;
                swimPerformanceBody.appendChild(tr);
            }
        }
    });
}

function renderWeeklyGoals() {
    // Calcola i dati degli ultimi 7 giorni
    const last7Days = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        last7Days.push(d.toISOString().split('T')[0]);
    }

    let totalSteps = 0;
    let totalSwimMeters = 0;
    let totalWorkouts = 0;

    last7Days.forEach(date => {
        totalSteps += parseInt(stepsData[date] || 0);

        const dayTasks = historyData[date] || [];
        dayTasks.forEach(t => {
            if (t.completed) {
                if (t.name.toLowerCase().includes('nuoto') && t.distanza) {
                    totalSwimMeters += parseInt(t.distanza);
                }
                // Contiamo come "allenamento" nuoto, yoga, palestra, camminata > 2000m
                const name = t.name.toLowerCase();
                if (name.includes('nuoto') || name.includes('yoga') || name.includes('palestra') ||
                    (name.includes('camminata') && parseInt(t.distanza || 0) > 2000)) {
                    totalWorkouts++;
                }
            }
        });
    });

    updateGoalCard('goal-steps', totalSteps, weeklyGoals.steps);
    updateGoalCard('goal-swim', totalSwimMeters, weeklyGoals.swimMeters);
    updateGoalCard('goal-workouts', totalWorkouts, weeklyGoals.workouts);
}

function updateGoalCard(id, current, target) {
    const card = document.getElementById(id);
    if (!card) return;
    const progressText = card.querySelector('.goal-progress-text');
    const barFill = card.querySelector('.goal-bar-fill');

    progressText.textContent = `${current.toLocaleString()} / ${target.toLocaleString()}`;
    const percent = Math.min(100, (current / target) * 100) || 0;
    barFill.style.width = percent + '%';

    if (percent >= 100) {
        barFill.style.background = 'var(--grad-success)';
    } else {
        // Ripristiniamo il colore originale basato sull'id
        if (id === 'goal-steps') barFill.style.background = 'var(--grad-primary)';
        if (id === 'goal-swim') barFill.style.background = 'var(--grad-success)';
        if (id === 'goal-workouts') barFill.style.background = 'var(--accent-color)';
    }
}

function exportData() {
    const data = {
        history: historyData,
        weight: weightData,
        steps: stepsData,
        distance: dailyDistanceData,
        water: waterData,
        measurements: measurementsData,
        notes: dailyNotesData,
        goals: weeklyGoals
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diario-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.history) {
                localStorage.setItem('diario-history', JSON.stringify(data.history));
                localStorage.setItem('diario-weight', JSON.stringify(data.weight || {}));
                localStorage.setItem('diario-steps', JSON.stringify(data.steps || {}));
                localStorage.setItem('diario-daily-distance', JSON.stringify(data.distance || {}));
                localStorage.setItem('diario-water', JSON.stringify(data.water || {}));
                localStorage.setItem('diario-measurements', JSON.stringify(data.measurements || {}));
                localStorage.setItem('diario-daily-notes', JSON.stringify(data.notes || {}));
                localStorage.setItem('diario-goals', JSON.stringify(data.goals || weeklyGoals));
                alert('Dati importati con successo! La pagina verrà ricaricata.');
                window.location.reload();
            } else {
                alert('Formato file non valido.');
            }
        } catch (err) {
            alert('Errore durante la lettura del file.');
        }
    };
    reader.readAsText(file);
}

function renderDietAnalysis() {
    const ctx = document.getElementById('dietPieChart');
    if (!ctx) return;

    const rangeInput = document.getElementById('analysis-range');
    const range = rangeInput ? (parseInt(rangeInput.value) || 7) : 7;
    const dates = Object.keys(historyData).sort().reverse();
    const filteredDates = range === 0 ? dates : dates.slice(0, range);

    let totalMeals = 0;
    let sgarri = 0;

    const mealKeywords = ['colazione', 'pranzo', 'cena', 'snack'];

    filteredDates.forEach(date => {
        const dayTasks = historyData[date] || [];
        dayTasks.forEach(task => {
            const isMeal = mealKeywords.some(k => task.name.toLowerCase().includes(k));
            if (task.completed && isMeal) {
                totalMeals++;
                if (task.badDiet) sgarri++;
            }
        });
    });

    const regular = totalMeals - sgarri;
    const sgarroPercent = totalMeals > 0 ? Math.round((sgarri / totalMeals) * 100) : 0;

    // Update Text Stats
    const totalEl = document.getElementById('total-meals-count');
    const regularEl = document.getElementById('regular-meals-count');
    const sgarriEl = document.getElementById('sgarri-count');
    const percentEl = document.getElementById('sgarri-percent');

    if (totalEl) totalEl.textContent = totalMeals;
    if (regularEl) regularEl.textContent = regular;
    if (sgarriEl) sgarriEl.textContent = sgarri;
    if (percentEl) percentEl.textContent = `${sgarroPercent}%`;

    // Render Pie Chart
    if (dietPieChartInstance) dietPieChartInstance.destroy();

    dietPieChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Regolari', 'Sgarri'],
            datasets: [{
                data: [regular, sgarri],
                backgroundColor: ['#10b981', '#f43f5e'],
                borderColor: '#1e293b',
                borderWidth: 2
            }]
        },
        options: {
            cutout: '70%',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#94a3b8', padding: 20 }
                }
            }
        }
    });
}

function updateWater(amount) {
    const current = waterData[currentEditingDate] || 0;
    const updated = Math.max(0, current + amount);
    waterData[currentEditingDate] = updated;
    localStorage.setItem('diario-water', JSON.stringify(waterData));
    syncDataToCloud();
    renderWaterTracker();
}

function renderWaterTracker() {
    const current = waterData[currentEditingDate] || 0;
    const target = weeklyGoals.waterLiters || 3.0;
    const percent = Math.min(100, (current / target) * 100);

    const currentEl = document.getElementById('water-current');
    const targetEl = document.getElementById('water-target');
    const barEl = document.getElementById('water-bar-fill');

    if (currentEl) currentEl.textContent = current.toFixed(2);
    if (targetEl) targetEl.textContent = target.toFixed(2);
    if (barEl) barEl.style.width = `${percent}%`;
}

function renderStreaks() {
    const dates = Object.keys(historyData).sort().reverse();
    if (dates.length === 0) return;

    let perfectStreak = 0;
    let noSgarriStreak = 0;

    // Perfect Day Streak
    for (const date of dates) {
        const dayTasks = historyData[date];
        const fixedTasks = dayTasks.filter(t => t.type === 'fixed');
        const allCompleted = fixedTasks.length > 0 && fixedTasks.every(t => t.completed);

        if (allCompleted) {
            perfectStreak++;
        } else {
            // Only break if it's not today or if today has missed tasks
            if (date !== todayISO) break;
            if (fixedTasks.some(t => !t.completed)) break;
        }
    }

    // No Sgarri Streak
    for (const date of dates) {
        const dayTasks = historyData[date];
        const hasSgarro = dayTasks.some(t => t.badDiet === true);

        if (!hasSgarro) {
            noSgarriStreak++;
        } else {
            break;
        }
    }

    const perfEl = document.getElementById('streak-perfect-days');
    const sgarroEl = document.getElementById('streak-no-sgarri');

    if (perfEl) perfEl.textContent = perfectStreak;
    if (sgarroEl) sgarroEl.textContent = noSgarriStreak;
}

function checkMeasurementReminder() {
    const measurementsCard = document.querySelector('.measurements-card');
    if (!measurementsCard) return;

    const day = new Date(currentEditingDate + 'T12:00:00Z').getDay();
    const isFriday = (day === 5);
    const isTomorrow = (currentEditingDate === '2026-04-27');

    const shouldShow = isFriday || isTomorrow;
    measurementsCard.classList.toggle('hidden', !shouldShow);
}

// --- Cloud Sync Logic ---
async function initAuth() {
    if (!supabaseClient) return;
    const { data: { session } } = await supabaseClient.auth.getSession();
    updateAuthState(session?.user || null);

    supabaseClient.auth.onAuthStateChange((_event, session) => {
        updateAuthState(session?.user || null);
    });
}

function updateAuthState(user) {
    currentUser = user;
    const authBtn = document.getElementById('auth-btn');
    const authFormContainer = document.getElementById('auth-form-container');
    const userInfoContainer = document.getElementById('user-info-container');
    const userEmailDisplay = document.getElementById('user-email-display');

    if (user) {
        if (authBtn) authBtn.style.color = '#10b981'; // Green for logged in
        if (authFormContainer) authFormContainer.classList.add('hidden');
        if (userInfoContainer) userInfoContainer.classList.remove('hidden');
        if (userEmailDisplay) userEmailDisplay.textContent = user.email;
        fetchDataFromCloud();
    } else {
        if (authBtn) authBtn.style.color = 'inherit';
        if (authFormContainer) authFormContainer.classList.remove('hidden');
        if (userInfoContainer) userInfoContainer.classList.add('hidden');
    }
}

async function handleLogin() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const errorEl = document.getElementById('auth-error');
    if (!supabaseClient) return alert('Per favore, configura URL e Key di Supabase nel file app.js');

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
        errorEl.textContent = error.message;
        errorEl.classList.remove('hidden');
    } else {
        errorEl.classList.add('hidden');
        document.getElementById('auth-modal').classList.add('hidden');
    }
}

async function handleSignup() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const errorEl = document.getElementById('auth-error');
    if (!supabaseClient) return alert('Per favore, configura URL e Key di Supabase nel file app.js');

    const { error } = await supabaseClient.auth.signUp({ email, password });
    if (error) {
        errorEl.textContent = error.message;
        errorEl.classList.remove('hidden');
    } else {
        alert('Controlla la tua email per confermare l\'iscrizione!');
    }
}

async function handleLogout() {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
    location.reload();
}

async function syncDataToCloud() {
    if (!currentUser || !supabaseClient) return;

    const payload = {
        user_id: currentUser.id,
        data: {
            history: historyData,
            weight: weightData,
            steps: stepsData,
            distance: dailyDistanceData,
            water: waterData,
            measurements: measurementsData,
            notes: dailyNotesData,
            goals: weeklyGoals
        },
        updated_at: new Date().toISOString()
    };

    const { error } = await supabaseClient.from('user_data').upsert(payload, { onConflict: 'user_id' });
    if (error) console.error('Cloud Sync Error:', error);
}

async function fetchDataFromCloud() {
    if (!currentUser || !supabaseClient) return;

    const { data, error } = await supabaseClient
        .from('user_data')
        .select('data')
        .eq('user_id', currentUser.id)
        .single();

    if (data && data.data) {
        const cloudData = data.data;
        
        // Merge Cloud Data
        if (cloudData.history) historyData = cloudData.history;
        if (cloudData.weight) weightData = cloudData.weight;
        if (cloudData.steps) stepsData = cloudData.steps;
        if (cloudData.distance) dailyDistanceData = cloudData.distance;
        if (cloudData.water) waterData = cloudData.water;
        if (cloudData.measurements) measurementsData = cloudData.measurements;
        if (cloudData.notes) dailyNotesData = cloudData.notes;
        if (cloudData.goals) weeklyGoals = cloudData.goals;
        
        // Save to Local for offline persistence
        localStorage.setItem('diario-history', JSON.stringify(historyData));
        localStorage.setItem('diario-weight', JSON.stringify(weightData));
        localStorage.setItem('diario-steps', JSON.stringify(stepsData));
        localStorage.setItem('diario-daily-distance', JSON.stringify(dailyDistanceData));
        localStorage.setItem('diario-water', JSON.stringify(waterData));
        localStorage.setItem('diario-measurements', JSON.stringify(measurementsData));
        localStorage.setItem('diario-daily-notes', JSON.stringify(dailyNotesData));
        localStorage.setItem('diario-goals', JSON.stringify(weeklyGoals));

        // CRITICAL: Refresh the entire UI for the current date
        const tasks = historyData[currentEditingDate] || JSON.parse(JSON.stringify(defaultFixedTasks));
        renderTasks(tasks);
        updateInputsForDate();
        renderAnalysis();
        renderWaterTracker();
        console.log("Cloud Data applied successfully for:", currentEditingDate);
    }
}

function renderSwimSummary() {
    const rangeInput = document.getElementById('analysis-range');
    const range = rangeInput ? (parseInt(rangeInput.value) || 7) : 7;
    const dates = Object.keys(historyData).sort().reverse();
    const filteredDates = range === 0 ? dates : dates.slice(0, range);

    let totalDist = 0;
    let sessions = 0;
    let totalPaceSeconds = 0;
    let paceCount = 0;
    let bestPace = Infinity;

    filteredDates.forEach(date => {
        const swim = historyData[date]?.find(t => t.name.toLowerCase().includes('nuoto') && t.completed);
        if (swim) {
            sessions++;
            if (swim.distanza) totalDist += parseInt(swim.distanza);
            if (swim.vasche && swim.duration && parseInt(swim.vasche) > 0) {
                const pace = (parseInt(swim.duration) * 60) / parseInt(swim.vasche);
                totalPaceSeconds += pace;
                paceCount++;
                if (pace < bestPace) bestPace = pace;
            }
        }
    });

    const avgPace = paceCount > 0 ? Math.round(totalPaceSeconds / paceCount) : 0;
    const bestPaceFinal = bestPace === Infinity ? 0 : Math.round(bestPace);

    const distEl = document.getElementById('swim-total-dist');
    const sessEl = document.getElementById('swim-total-sessions');
    const avgEl = document.getElementById('swim-avg-pace');
    const bestEl = document.getElementById('swim-best-pace');

    if (distEl) distEl.textContent = `${totalDist} m`;
    if (sessEl) sessEl.textContent = sessions;
    if (avgEl) avgEl.textContent = `${avgPace}s`;
    if (bestEl) bestEl.textContent = `${bestPaceFinal}s`;
}

function renderMeasurementsAnalysis() {
    const ctx = document.getElementById('measurementsChart');
    if (!ctx) return;

    const rangeInput = document.getElementById('analysis-range');
    const range = rangeInput ? (parseInt(rangeInput.value) || 7) : 7;
    const dates = Object.keys(historyData).sort();
    const filteredDates = range === 0 ? dates : dates.slice(-range);
    const labels = filteredDates.map(d => d.split('-').reverse().slice(0, 2).join('/'));

    if (measurementsChartInstance) measurementsChartInstance.destroy();

    measurementsChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Vita',
                    data: filteredDates.map(d => measurementsData[d]?.waist || null),
                    borderColor: '#f43f5e',
                    tension: 0.3,
                    spanGaps: true
                },
                {
                    label: 'Fianchi',
                    data: filteredDates.map(d => measurementsData[d]?.hips || null),
                    borderColor: '#3b82f6',
                    tension: 0.3,
                    spanGaps: true
                },
                {
                    label: 'Torace',
                    data: filteredDates.map(d => measurementsData[d]?.chest || null),
                    borderColor: '#10b981',
                    tension: 0.3,
                    spanGaps: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            },
            plugins: {
                legend: { labels: { color: '#94a3b8' } }
            }
        }
    });
}

function renderWaterAnalysis() {
    const ctx = document.getElementById('waterChart');
    if (!ctx) return;

    const rangeInput = document.getElementById('analysis-range');
    const range = rangeInput ? (parseInt(rangeInput.value) || 7) : 7;
    const dates = Object.keys(historyData).sort();
    const filteredDates = range === 0 ? dates : dates.slice(-range);
    const labels = filteredDates.map(d => d.split('-').reverse().slice(0, 2).join('/'));

    if (waterChartInstance) waterChartInstance.destroy();

    waterChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Litri Acqua',
                data: filteredDates.map(d => waterData[d] || 0),
                backgroundColor: 'rgba(56, 189, 248, 0.4)',
                borderColor: '#38bdf8',
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    suggestedMax: weeklyGoals.waterLiters || 2,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', init);
