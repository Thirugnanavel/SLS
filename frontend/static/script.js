document.addEventListener('DOMContentLoaded', function () {
    // Initialize Theme
    initTheme();

    // Determine which page we are on and initialize accordingly
    if (document.getElementById('loginForm')) {
        initLogin();
    } else if (document.body.classList.contains('faculty-page')) {
        initFacultyV2();
    } else if (document.body.classList.contains('admin-page')) {
        initAdmin();
    } else if (document.getElementById('studentSearchId')) {
        initStudent();
    } else if (document.getElementById('evalForm')) {
        initIndex();
    }
});

// --- Global Variables ---
// --- Global Variables ---
let myChart = null;
let comparisonChartInstance = null;
let adminTrendChartInstance = null;
let adminRiskChartInstance = null;
let studentStabilityRadarChart = null;
let studentStabilityTrendChart = null;

function sortByName(list) {
    return [...(list || [])].sort((a, b) => {
        const nameA = String((a && a.name) || '').toLowerCase();
        const nameB = String((b && b.name) || '').toLowerCase();
        return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    });
}

// --- Theme Logic ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    }

    // Add event listener to all toggle buttons (if any exist on load)
    // We will assume buttons have class 'theme-toggle'
    const themeToggles = document.querySelectorAll('.theme-toggle');
    themeToggles.forEach(btn => {
        btn.addEventListener('click', toggleTheme);
        updateThemeIcon(btn);
    });
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');

    // Update all toggle buttons
    const themeToggles = document.querySelectorAll('.theme-toggle');
    themeToggles.forEach(btn => updateThemeIcon(btn));
}

function updateThemeIcon(btn) {
    const isDark = document.body.classList.contains('dark-mode');
    // Assuming button contains an icon element <i>
    const icon = btn.querySelector('i');
    if (icon) {
        if (isDark) {
            icon.className = 'fas fa-sun';
        } else {
            icon.className = 'fas fa-moon';
        }
    }
}

// --- Login Page Logic ---
function initLogin() {
    const form = document.getElementById('loginForm');
    const messageDiv = document.getElementById('loginMessage');
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');

    if (!form || !messageDiv || !emailInput || !passwordInput) return;

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password.trim()) {
            showMessage(messageDiv, 'Please fill in all fields', 'error');
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        messageDiv.textContent = 'Signing in...';
        messageDiv.className = 'message';
        messageDiv.style.display = 'block';

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: password.trim() }),
            credentials: 'same-origin',
            signal: controller.signal
        })
            .then(async (res) => {
                const text = await res.text();
                let data;
                try {
                    data = text ? JSON.parse(text) : {};
                } catch {
                    throw new Error('bad_json');
                }
                if (!res.ok && (!data || !data.message)) {
                    throw new Error('http_' + res.status);
                }
                return data;
            })
            .then(data => {
                clearTimeout(timeoutId);
                if (data.status === 'success') {
                    showMessage(messageDiv, 'Login successful! Redirecting...', 'success');
                    setTimeout(() => {
                        window.location.href = data.redirect || '/';
                    }, 800);
                } else {
                    if (submitBtn) submitBtn.disabled = false;
                    showMessage(messageDiv, data.message || 'Login failed', 'error');
                }
            })
            .catch(err => {
                clearTimeout(timeoutId);
                if (submitBtn) submitBtn.disabled = false;
                if (err && err.name === 'AbortError') {
                    showMessage(messageDiv, 'Request timed out. Check that the app server is running.', 'error');
                } else if (err && err.message === 'bad_json') {
                    showMessage(messageDiv, 'Server returned an invalid response. Is the Flask app running?', 'error');
                } else {
                    showMessage(messageDiv, 'Connection error. Is the server running at this address?', 'error');
                }
            });
    });
}

// --- Admin Page Logic (Updated) ---
function initAdmin() {
    if (window.__adminInitDone) return;
    window.__adminInitDone = true;

    const studentTableBody = document.querySelector('#studentAccountsTable tbody');
    const facultyTableBody = document.querySelector('#facultyAccountsTable tbody');
    const studentAccessMessage = document.getElementById('studentAccessMessage');
    const facultyAccessMessage = document.getElementById('facultyAccessMessage');
    const studentAccountMessage = document.getElementById('studentAccountMessage');
    const facultyAccountMessage = document.getElementById('facultyAccountMessage');
    const studentSearchInput = document.getElementById('studentAccountSearch');
    const facultySearchInput = document.getElementById('facultyAccountSearch');
    const downloadCsvBtn = document.getElementById('downloadCsvBtn');
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    const passwordToggles = document.querySelectorAll('.password-toggle');
    const createStudentBtn = document.getElementById('createStudentBtn');
    const createFacultyBtn = document.getElementById('createFacultyBtn');
    const classToggleGroups = document.querySelectorAll('.class-toggle');
    const classToggleMap = new Map();

    // Navigation and Views
    const analyticsGroup = document.getElementById('analyticsGroup');
    const navAnalytics = document.getElementById('navAnalytics');
    const navDashboard = document.getElementById('navDashboard');
    const navAtRisk = document.getElementById('navAtRisk');
    const userAccessGroup = document.getElementById('userAccessGroup');
    const navUserAccess = document.getElementById('navUserAccess');
    const navStudentAccounts = document.getElementById('navStudentAccounts');
    const navFacultyAccounts = document.getElementById('navFacultyAccounts');
    const navReports = document.getElementById('navReports');
    const dashboardView = document.getElementById('dashboardView');
    const atRiskView = document.getElementById('atRiskView');
    const studentAccountsView = document.getElementById('studentAccountsView');
    const facultyAccountsView = document.getElementById('facultyAccountsView');
    const reportsView = document.getElementById('reportsView');
    const atRiskTableBody = document.getElementById('atRiskTableBody');

    // Stats Elements
    const totalEl = document.getElementById('totalStudents');
    const stableEl = document.getElementById('stableCount');
    const moderateRiskEl = document.getElementById('moderateRiskCount');
    const highRiskEl = document.getElementById('highRiskCount');
    const riskDistributionSummary = document.getElementById('riskDistributionSummary');
    const highListEl = document.getElementById('highStabilityList');
    const lowListEl = document.getElementById('lowStabilityList');
    const adminFeedbackList = document.getElementById('adminStudentFeedbackList');

    let allStudents = [];
    let allAccounts = [];

    // Load initial data
    loadStudents();
    loadAccounts();

    // --- Navigation Logic ---
    function switchView(viewName) {
        if (dashboardView) dashboardView.style.display = 'none';
        if (atRiskView) atRiskView.style.display = 'none';
        if (studentAccountsView) studentAccountsView.style.display = 'none';
        if (facultyAccountsView) facultyAccountsView.style.display = 'none';
        if (reportsView) reportsView.style.display = 'none';

        if (navAnalytics) navAnalytics.classList.remove('active');
        if (navDashboard) navDashboard.classList.remove('active');
        if (navAtRisk) navAtRisk.classList.remove('active');
        if (navReports) navReports.classList.remove('active');
        if (navStudentAccounts) navStudentAccounts.classList.remove('active');
        if (navFacultyAccounts) navFacultyAccounts.classList.remove('active');

        if (viewName === 'dashboard') {
            if (dashboardView) dashboardView.style.display = 'block';
            if (navDashboard) navDashboard.classList.add('active');
            if (navAnalytics) navAnalytics.classList.add('active');
            if (analyticsGroup) analyticsGroup.classList.add('open');
            if (userAccessGroup) userAccessGroup.classList.remove('open');
        } else if (viewName === 'atRisk') {
            if (atRiskView) atRiskView.style.display = 'block';
            if (navAtRisk) navAtRisk.classList.add('active');
            if (navAnalytics) navAnalytics.classList.add('active');
            if (analyticsGroup) analyticsGroup.classList.add('open');
            if (userAccessGroup) userAccessGroup.classList.remove('open');
        } else if (viewName === 'studentAccounts') {
            if (studentAccountsView) studentAccountsView.style.display = 'block';
            if (navStudentAccounts) navStudentAccounts.classList.add('active');
            if (analyticsGroup) analyticsGroup.classList.remove('open');
            if (userAccessGroup) userAccessGroup.classList.add('open');
        } else if (viewName === 'facultyAccounts') {
            if (facultyAccountsView) facultyAccountsView.style.display = 'block';
            if (navFacultyAccounts) navFacultyAccounts.classList.add('active');
            if (analyticsGroup) analyticsGroup.classList.remove('open');
            if (userAccessGroup) userAccessGroup.classList.add('open');
        } else if (viewName === 'reports') {
            if (reportsView) reportsView.style.display = 'block';
            if (navReports) navReports.classList.add('active');
            if (analyticsGroup) analyticsGroup.classList.remove('open');
            if (userAccessGroup) userAccessGroup.classList.remove('open');
        }
    }

    if (navAnalytics) {
        navAnalytics.addEventListener('click', (e) => {
            e.preventDefault();
            if (!analyticsGroup) return;
            const willOpen = !analyticsGroup.classList.contains('open');
            analyticsGroup.classList.toggle('open');
            if (willOpen && !navDashboard?.classList.contains('active') && !navAtRisk?.classList.contains('active')) {
                switchView('dashboard');
            }
        });
    }

    if (navDashboard) {
        navDashboard.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('dashboard');
        });
    }

    if (navAtRisk) {
        navAtRisk.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('atRisk');
        });
    }

    if (navUserAccess) {
        navUserAccess.addEventListener('click', (e) => {
            e.preventDefault();
            if (!userAccessGroup) return;
            const willOpen = !userAccessGroup.classList.contains('open');
            userAccessGroup.classList.toggle('open');
            if (willOpen && !navStudentAccounts?.classList.contains('active') && !navFacultyAccounts?.classList.contains('active')) {
                switchView('studentAccounts');
            }
        });
    }

    if (navStudentAccounts) {
        navStudentAccounts.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('studentAccounts');
        });
    }

    if (navFacultyAccounts) {
        navFacultyAccounts.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('facultyAccounts');
        });
    }

    if (navReports) {
        navReports.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('reports');
        });
    }

    if (downloadCsvBtn) {
        downloadCsvBtn.addEventListener('click', () => {
            window.location.href = '/api/reports/csv';
        });
    }

    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener('click', () => {
            window.location.href = '/api/reports/pdf';
        });
    }

    if (passwordToggles.length > 0) {
        passwordToggles.forEach(btn => {
            btn.addEventListener('click', function () {
                const targetId = this.dataset.target;
                const input = document.getElementById(targetId);
                const icon = this.querySelector('i');
                if (!input || !icon) return;

                const show = input.type === 'password';
                input.type = show ? 'text' : 'password';
                icon.className = show ? 'fas fa-eye-slash' : 'fas fa-eye';
                this.title = show ? 'Hide password' : 'Show password';
            });
        });
    }

    function setClassToggleActive(activeBtn, target, buttons) {
        if (!activeBtn || !target) return;
        buttons.forEach(btn => btn.classList.toggle('active', btn === activeBtn));
        const value = (activeBtn.dataset.value || activeBtn.textContent || '').trim();
        target.value = value;
    }

    function initClassToggleGroups() {
        classToggleGroups.forEach(group => {
            const targetId = group.dataset.target;
            if (!targetId) return;
            const target = document.getElementById(targetId);
            if (!target) return;
            const buttons = Array.from(group.querySelectorAll('button'));
            if (!buttons.length) return;
            classToggleMap.set(targetId, { target, buttons });

            buttons.forEach(btn => {
                btn.addEventListener('click', () => setClassToggleActive(btn, target, buttons));
            });

            const current = (target.value || '').trim();
            const match = buttons.find(btn => btn.dataset.value === current);
            setClassToggleActive(match || buttons[0], target, buttons);
        });
    }

    function resetClassToggle(targetId) {
        const entry = classToggleMap.get(targetId);
        if (!entry) return;
        setClassToggleActive(entry.buttons[0], entry.target, entry.buttons);
    }

    initClassToggleGroups();

    if (studentSearchInput) {
        studentSearchInput.addEventListener('input', function () {
            const term = this.value.toLowerCase();
            const filtered = sortByName(getStudentAccounts().filter(s =>
                s.name.toLowerCase().includes(term) ||
                (s.roll_no && s.roll_no.toLowerCase().includes(term)) ||
                s.id.toString().includes(term)
            ));
            renderStudentAccountsTable(filtered);
        });
    }

    if (facultySearchInput) {
        facultySearchInput.addEventListener('input', function () {
            const term = this.value.toLowerCase();
            const filtered = sortByName(getFacultyAccounts().filter(s =>
                s.name.toLowerCase().includes(term) ||
                (s.faculty_id && s.faculty_id.toLowerCase().includes(term)) ||
                s.id.toString().includes(term)
            ));
            renderFacultyAccountsTable(filtered);
        });
    }

    if (createStudentBtn) {
        createStudentBtn.addEventListener('click', function () {
            const payload = {
                account_type: 'student',
                name: (document.getElementById('createStudentName')?.value || '').trim(),
                roll_no: (document.getElementById('createStudentRoll')?.value || '').trim(),
                class_name: (document.getElementById('createStudentClass')?.value || '').trim(),
                email: (document.getElementById('createStudentEmail')?.value || '').trim(),
                password: (document.getElementById('createStudentPassword')?.value || '').trim()
            };

            fetch('/api/accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        const form = document.getElementById('createStudentForm');
                        if (form) form.reset();
                        resetClassToggle('createStudentClass');
                        showMessage(studentAccountMessage, data.message, 'success');
                        loadAccounts();
                        loadStudents();
                    } else {
                        showMessage(studentAccountMessage, data.message || 'Unable to create student account', 'error');
                    }
                })
                .catch(() => showMessage(studentAccountMessage, 'Connection error', 'error'));
        });
    }

    if (createFacultyBtn) {
        createFacultyBtn.addEventListener('click', function () {
            const payload = {
                account_type: 'faculty',
                name: (document.getElementById('createFacultyName')?.value || '').trim(),
                faculty_id: (document.getElementById('createFacultyId')?.value || '').trim(),
                class_name: (document.getElementById('createFacultyClass')?.value || '').trim()
            };

            fetch('/api/accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        const form = document.getElementById('createFacultyForm');
                        if (form) form.reset();
                        resetClassToggle('createFacultyClass');
                        showMessage(facultyAccountMessage, data.message, 'success');
                        loadAccounts();
                    } else {
                        showMessage(facultyAccountMessage, data.message || 'Unable to create faculty account', 'error');
                    }
                })
                .catch(() => showMessage(facultyAccountMessage, 'Connection error', 'error'));
        });
    }

    function loadStudents() {
        fetch('/api/students')
            .then(res => res.json())
            .then(data => {
                const ordered = sortByName(data);
                allStudents = ordered;
                updateStats(ordered);
                renderStabilityLists(ordered);
                renderAdminTrendChart(ordered);
                renderAdminRiskChart(ordered);
                renderAtRiskTable(ordered);
                loadRiskSummary();
                loadFeedbackForStaff();
                renderStudentAccountsTable(getStudentAccounts());
            });
    }

    function loadFeedbackForStaff() {
        if (!adminFeedbackList) return;
        fetch('/api/feedback')
            .then(res => res.json())
            .then(payload => {
                const items = payload?.feedback || [];
                adminFeedbackList.innerHTML = items.length ? '' : '<li style="color:#9ca3af; justify-content:center;">No feedback yet</li>';
                items.slice(0, 8).forEach(item => {
                    adminFeedbackList.innerHTML += `<li><span>${escHtml(item.student_name)} (${escHtml(item.roll_no)})</span><span>${escHtml(item.message)}</span></li>`;
                });
            })
            .catch(() => {
                adminFeedbackList.innerHTML = '<li style="color:#ef4444; justify-content:center;">Unable to load feedback</li>';
            });
    }

    function loadAccounts() {
        fetch('/api/accounts')
            .then(res => res.json())
            .then(data => {
                allAccounts = Array.isArray(data) ? sortByName(data) : [];
                renderStudentAccountsTable(getStudentAccounts());
                renderFacultyAccountsTable(getFacultyAccounts());
            });
    }

    function getStudentAccounts() {
        return sortByName(allAccounts.filter(a => !a.user_role || a.user_role === 'student'));
    }

    function getFacultyAccounts() {
        return sortByName(allAccounts.filter(a => a.user_role === 'faculty'));
    }

    function escAttr(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function escHtml(value) {
        return escAttr(value);
    }

    function getRiskMeta(student) {
        const risk = String(student?.risk_level || '').toLowerCase();
        if (risk === 'stable') return { key: 'stable', label: 'Stable', className: 'risk-stable' };
        if (risk === 'moderate') return { key: 'moderate', label: 'Moderate Risk', className: 'risk-moderate' };
        return { key: 'high', label: 'High Risk', className: 'risk-high' };
    }

    function getRiskMetaByAccountId(accountId) {
        const linked = allStudents.find(s => Number(s.id) === Number(accountId));
        return getRiskMeta(linked);
    }

    function loadRiskSummary() {
        fetch('/api/admin/risk_summary')
            .then(res => {
                if (!res.ok) throw new Error('forbidden');
                return res.json();
            })
            .then(payload => {
                const summary = payload?.summary;
                if (!summary || !riskDistributionSummary) return;
                const dist = summary.risk_distribution || {};
                riskDistributionSummary.textContent =
                    `Stable ${dist.stable_pct || 0}% | Moderate ${dist.moderate_pct || 0}% | High ${dist.high_pct || 0}%`;
            })
            .catch(() => {
                if (riskDistributionSummary) riskDistributionSummary.textContent = '';
            });
    }

    function updateStats(data) {
        if (totalEl) totalEl.textContent = data.length;
        const stableCount = data.filter(s => getRiskMeta(s).key === 'stable').length;
        const moderateCount = data.filter(s => getRiskMeta(s).key === 'moderate').length;
        const highCount = data.filter(s => getRiskMeta(s).key === 'high').length;

        if (stableEl) stableEl.textContent = stableCount;
        if (moderateRiskEl) moderateRiskEl.textContent = moderateCount;
        if (highRiskEl) highRiskEl.textContent = highCount;
    }

    function renderStabilityLists(data) {
        const highStudents = sortByName(data.filter(s => s.stability_score >= 80));
        const lowStudents = data.filter(s => {
            const key = getRiskMeta(s).key;
            return key === 'moderate' || key === 'high';
        });
        const lowSorted = sortByName(lowStudents);

        if (highListEl) {
            highListEl.innerHTML = highStudents.length ? '' : '<li style="color:#9ca3af; justify-content:center;">No high stability students</li>';
            highStudents.forEach(s => {
                highListEl.innerHTML += `
                    <li>
                        <span>${escHtml(s.name)}</span>
                        <span class="text-success font-bold">${s.stability_score}%</span>
                    </li>
                `;
            });
        }

        if (lowListEl) {
            lowListEl.innerHTML = lowSorted.length ? '' : '<li style="color:#9ca3af; justify-content:center;">No low stability students</li>';
            lowSorted.forEach(s => {
                lowListEl.innerHTML += `
                    <li>
                        <span>${escHtml(s.name)}</span>
                        <span class="text-danger font-bold">${s.stability_score}% (${getRiskMeta(s).label})</span>
                    </li>
                `;
            });
        }
    }

    function renderAtRiskTable(data) {
        if (!atRiskTableBody) return;
        const atRisk = sortByName([...data].filter(s => {
            const key = getRiskMeta(s).key;
            return key === 'moderate' || key === 'high';
        }));

        atRiskTableBody.innerHTML = '';
        if (atRisk.length === 0) {
            atRiskTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#888;">No at-risk students found</td></tr>';
            return;
        }

        atRisk.forEach((student, idx) => {
            const riskMeta = getRiskMeta(student);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>#${idx + 1}</td>
                <td>${escHtml(student.name)}</td>
                <td>${escHtml(student.roll_no)}</td>
                <td>${student.stability_score}%</td>
                <td><span class="risk-badge ${riskMeta.className}">${riskMeta.label}</span></td>
            `;
            atRiskTableBody.appendChild(row);
        });
    }

    function renderStudentAccountsTable(data) {
        if (!studentTableBody) return;
        const rows = sortByName(data);
        studentTableBody.innerHTML = '';
        if (rows.length === 0) {
            studentTableBody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:#888;">No student accounts found</td></tr>';
            return;
        }

        rows.forEach((account, index) => {
            const role = account.user_role || 'student';
            const isActive = account.is_active !== false;
            const riskMeta = getRiskMetaByAccountId(account.id);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>#${index + 1}</td>
                <td><input type="text" class="account-edit-input account-name-input" data-id="${account.id}" value="${escAttr(account.name)}"></td>
                <td><input type="text" class="account-edit-input account-id-input" data-id="${account.id}" value="${escAttr(account.roll_no)}"></td>
                <td><input type="text" class="account-edit-input account-class-input" data-id="${account.id}" value="${escAttr(account.class_name || '')}"></td>
                <td><input type="email" class="account-edit-input account-email-input" data-id="${account.id}" value="${escAttr(account.email)}"></td>
                <td><input type="password" class="account-edit-input account-password-input" data-id="${account.id}" placeholder="New password"></td>
                <td>
                    <select class="role-select" data-id="${account.id}">
                        <option value="admin" ${role === 'admin' ? 'selected' : ''}>Admin</option>
                        <option value="student" ${role === 'student' ? 'selected' : ''}>Student</option>
                        <option value="faculty" ${role === 'faculty' ? 'selected' : ''}>Faculty</option>
                    </select>
                </td>
                <td>
                    <label class="status-toggle">
                        <input type="checkbox" class="active-toggle" data-id="${account.id}" ${isActive ? 'checked' : ''}>
                        <span>${isActive ? 'Active' : 'Inactive'}</span>
                    </label>
                </td>
                <td><span class="risk-badge ${riskMeta.className}">${riskMeta.label}</span></td>
                <td>
                    <button class="action-btn edit-btn save-account-btn" data-id="${account.id}" data-type="student" title="Save Details">
                        <i class="fas fa-user-pen"></i>
                    </button>
                    <button class="action-btn edit-btn update-access-btn" data-id="${account.id}" title="Update Role/Status">
                        <i class="fas fa-shield-check"></i>
                    </button>
                    <button class="action-btn delete-btn delete-account-btn" data-id="${account.id}" title="Delete Account">
                        <i class="fas fa-trash-can"></i>
                    </button>
                </td>
            `;
            studentTableBody.appendChild(row);
        });
    }

    function renderFacultyAccountsTable(data) {
        if (!facultyTableBody) return;
        const rows = sortByName(data);
        facultyTableBody.innerHTML = '';
        if (rows.length === 0) {
            facultyTableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#888;">No faculty accounts found</td></tr>';
            return;
        }

        rows.forEach((account, index) => {
            const role = account.user_role || 'faculty';
            const isActive = account.is_active !== false;
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>#${index + 1}</td>
                <td><input type="text" class="account-edit-input account-name-input" data-id="${account.id}" value="${escAttr(account.name)}"></td>
                <td><input type="text" class="account-edit-input account-id-input" data-id="${account.id}" value="${escAttr(account.faculty_id || account.roll_no)}"></td>
                <td><input type="text" class="account-edit-input account-class-input" data-id="${account.id}" value="${escAttr(account.class_name || '')}"></td>
                <td><input type="email" class="account-edit-input account-email-input" data-id="${account.id}" value="${escAttr(account.email)}"></td>
                <td><input type="password" class="account-edit-input account-password-input" data-id="${account.id}" placeholder="New password"></td>
                <td>
                    <select class="role-select" data-id="${account.id}">
                        <option value="admin" ${role === 'admin' ? 'selected' : ''}>Admin</option>
                        <option value="student" ${role === 'student' ? 'selected' : ''}>Student</option>
                        <option value="faculty" ${role === 'faculty' ? 'selected' : ''}>Faculty</option>
                    </select>
                </td>
                <td>
                    <label class="status-toggle">
                        <input type="checkbox" class="active-toggle" data-id="${account.id}" ${isActive ? 'checked' : ''}>
                        <span>${isActive ? 'Active' : 'Inactive'}</span>
                    </label>
                </td>
                <td>
                    <button class="action-btn edit-btn save-account-btn" data-id="${account.id}" data-type="faculty" title="Save Details">
                        <i class="fas fa-user-pen"></i>
                    </button>
                    <button class="action-btn edit-btn update-access-btn" data-id="${account.id}" title="Update Role/Status">
                        <i class="fas fa-shield-check"></i>
                    </button>
                    <button class="action-btn delete-btn delete-account-btn" data-id="${account.id}" title="Delete Account">
                        <i class="fas fa-trash-can"></i>
                    </button>
                </td>
            `;
            facultyTableBody.appendChild(row);
        });
    }

    function bindAccessTableEvents(tableBody, messageEl) {
        if (!tableBody) return;

        tableBody.addEventListener('click', function (e) {
            const saveBtn = e.target.closest('.save-account-btn');
            if (saveBtn) {
                const id = saveBtn.dataset.id;
                const accountType = saveBtn.dataset.type || 'student';
                const nameInput = tableBody.querySelector(`.account-name-input[data-id="${id}"]`);
                const identityInput = tableBody.querySelector(`.account-id-input[data-id="${id}"]`);
                const classInput = tableBody.querySelector(`.account-class-input[data-id="${id}"]`);
                const emailInput = tableBody.querySelector(`.account-email-input[data-id="${id}"]`);
                const passwordInput = tableBody.querySelector(`.account-password-input[data-id="${id}"]`);

                if (!nameInput || !identityInput || !emailInput || !passwordInput || !classInput) return;

                fetch('/api/accounts/' + id, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        account_type: accountType,
                        name: nameInput.value.trim(),
                        identity_value: identityInput.value.trim(),
                        class_name: classInput.value.trim(),
                        email: emailInput.value.trim(),
                        password: passwordInput.value.trim()
                    })
                })
                    .then(res => res.json())
                    .then(data => {
                        if (data.status === 'success') {
                            if (passwordInput) passwordInput.value = '';
                            showMessage(messageEl, data.message || 'Account details updated', 'success');
                            loadAccounts();
                            loadStudents();
                        } else {
                            showMessage(messageEl, data.message || 'Unable to update account', 'error');
                        }
                    })
                    .catch(() => showMessage(messageEl, 'Connection error', 'error'));

                return;
            }

            const deleteBtn = e.target.closest('.delete-account-btn');
            if (deleteBtn) {
                const id = deleteBtn.dataset.id;
                const confirmed = window.confirm('Delete this account permanently?');
                if (!confirmed) return;

                fetch('/api/accounts/' + id, {
                    method: 'DELETE'
                })
                    .then(res => res.json())
                    .then(data => {
                        if (data.status === 'success') {
                            showMessage(messageEl, data.message || 'Account deleted successfully', 'success');
                            loadAccounts();
                            loadStudents();
                        } else {
                            showMessage(messageEl, data.message || 'Unable to delete account', 'error');
                        }
                    })
                    .catch(() => showMessage(messageEl, 'Connection error', 'error'));
                return;
            }

            const btn = e.target.closest('.update-access-btn');
            if (!btn) return;

            const id = btn.dataset.id;
            const roleSelect = tableBody.querySelector(`.role-select[data-id="${id}"]`);
            const activeToggle = tableBody.querySelector(`.active-toggle[data-id="${id}"]`);

            if (!roleSelect || !activeToggle) return;

            fetch('/api/users/' + id + '/access', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_role: roleSelect.value,
                    is_active: activeToggle.checked
                })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        showMessage(messageEl, 'Access updated successfully', 'success');
                        loadAccounts();
                        loadStudents();
                    } else {
                        showMessage(messageEl, data.message || 'Unable to update access', 'error');
                    }
                })
                .catch(() => showMessage(messageEl, 'Connection error', 'error'));
        });

        tableBody.addEventListener('change', function (e) {
            if (e.target.classList.contains('active-toggle')) {
                const label = e.target.closest('.status-toggle');
                const text = label ? label.querySelector('span') : null;
                if (text) text.textContent = e.target.checked ? 'Active' : 'Inactive';
            }
        });
    }

    bindAccessTableEvents(studentTableBody, studentAccessMessage || facultyAccessMessage);
    bindAccessTableEvents(facultyTableBody, facultyAccessMessage || studentAccessMessage);

    function renderAdminTrendChart(data) {
        const canvas = document.getElementById('adminTrendChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const sorted = [...data].sort((a, b) => (a.id || 0) - (b.id || 0));
        const labels = sorted.map(s => s.roll_no || `#${s.id}`);
        const stability = sorted.map(s => s.stability_score || 0);
        const trend = sorted.map(s => s.trend_diff || 0);

        if (adminTrendChartInstance) {
            adminTrendChartInstance.destroy();
        }

        adminTrendChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Stability Score',
                        data: stability,
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37,99,235,0.12)',
                        tension: 0.35,
                        yAxisID: 'y',
                        fill: true
                    },
                    {
                        label: 'Trend Diff (%)',
                        data: trend,
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245,158,11,0.12)',
                        tension: 0.3,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: { display: true, text: 'Stability' }
                    },
                    y1: {
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        title: { display: true, text: 'Trend %' }
                    }
                }
            }
        });
    }

    function renderAdminRiskChart(data) {
        const canvas = document.getElementById('adminRiskChart');
        if (!canvas) return;

        const stableCount = data.filter(s => getRiskMeta(s).key === 'stable').length;
        const moderateCount = data.filter(s => getRiskMeta(s).key === 'moderate').length;
        const highCount = data.filter(s => getRiskMeta(s).key === 'high').length;

        if (adminRiskChartInstance) {
            adminRiskChartInstance.destroy();
        }

        adminRiskChartInstance = new Chart(canvas.getContext('2d'), {
            type: 'pie',
            data: {
                labels: ['Stable', 'Moderate Risk', 'High Risk'],
                datasets: [{
                    data: [stableCount, moderateCount, highCount],
                    backgroundColor: ['#16a34a', '#f59e0b', '#ef4444'],
                    borderColor: ['#15803d', '#d97706', '#dc2626'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    switchView('dashboard');
}

// --- Faculty Page Logic ---
function initFaculty() {
    if (window.__facultyInitDone) return;
    window.__facultyInitDone = true;

    const searchInput = document.getElementById('facultyStudentSearch');
    const tableBody = document.querySelector('#facultyStudentsTable tbody');
    const messageDiv = document.getElementById('facultyUpdateMessage');
    const totalEl = document.getElementById('facultyTotalStudents');
    const avgTestEl = document.getElementById('facultyAvgTest');
    const avgAttendanceEl = document.getElementById('facultyAvgAttendance');
    const avgAssignmentEl = document.getElementById('facultyAvgAssignment');

    let allStudents = [];

    function esc(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function updateStats(students) {
        const total = students.length;
        const avg = (arr, key) => {
            if (!arr.length) return 0;
            const val = arr.reduce((sum, s) => sum + (Number(s[key]) || 0), 0) / arr.length;
            return Math.round(val * 100) / 100;
        };

        if (totalEl) totalEl.textContent = total;
        if (avgTestEl) avgTestEl.textContent = `${avg(students, 'test_score')}%`;
        if (avgAttendanceEl) avgAttendanceEl.textContent = `${avg(students, 'attendance')}%`;
        if (avgAssignmentEl) avgAssignmentEl.textContent = `${avg(students, 'assignment')}%`;
    }

    function renderRows(students) {
        if (!tableBody) return;
        tableBody.innerHTML = '';

        if (!students.length) {
            tableBody.innerHTML = '<tr><td colspan="12" style="text-align:center; color:#888;">No students found</td></tr>';
            return;
        }

        students.forEach((student, idx) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>#${idx + 1}</td>
                <td>${esc(student.name)}</td>
                <td>${esc(student.roll_no)}</td>
                <td><input type="number" class="account-edit-input fac-mark" data-field="tamil" data-id="${student.id}" min="0" max="100" value="${Number(student.tamil) || 0}"></td>
                <td><input type="number" class="account-edit-input fac-mark" data-field="english" data-id="${student.id}" min="0" max="100" value="${Number(student.english) || 0}"></td>
                <td><input type="number" class="account-edit-input fac-mark" data-field="maths" data-id="${student.id}" min="0" max="100" value="${Number(student.maths) || 0}"></td>
                <td><input type="number" class="account-edit-input fac-mark" data-field="science" data-id="${student.id}" min="0" max="100" value="${Number(student.science) || 0}"></td>
                <td><input type="number" class="account-edit-input fac-mark" data-field="social_science" data-id="${student.id}" min="0" max="100" value="${Number(student.social_science) || 0}"></td>
                <td><input type="number" class="account-edit-input fac-mark" data-field="attendance" data-id="${student.id}" min="0" max="100" value="${Number(student.attendance) || 0}"></td>
                <td><input type="number" class="account-edit-input fac-mark" data-field="assignment" data-id="${student.id}" min="0" max="100" value="${Number(student.assignment) || 0}"></td>
                <td><input type="text" class="account-edit-input fac-remarks" data-field="faculty_remarks" data-id="${student.id}" value="${esc(student.faculty_remarks || '')}" placeholder="Add remark"></td>
                <td>
                    <button type="button" class="action-btn edit-btn fac-save-btn" data-id="${student.id}" title="Save">
                        <i class="fas fa-floppy-disk"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    function loadStudents() {
        fetch('/api/students')
            .then(res => res.json())
            .then(data => {
                allStudents = Array.isArray(data) ? data : [];
                updateStats(allStudents);
                renderRows(allStudents);
            })
            .catch(() => showMessage(messageDiv, 'Unable to load students', 'error'));
    }

    if (searchInput) {
        searchInput.addEventListener('input', function () {
            const q = this.value.trim().toLowerCase();
            const filtered = allStudents.filter(s =>
                (s.name || '').toLowerCase().includes(q) || (s.roll_no || '').toLowerCase().includes(q)
            );
            renderRows(filtered);
        });
    }

    if (tableBody) {
        tableBody.addEventListener('click', function (e) {
            const btn = e.target.closest('.fac-save-btn');
            if (!btn) return;

            const id = btn.dataset.id;
            const getField = (field) => tableBody.querySelector(`[data-id="${id}"][data-field="${field}"]`);
            const payload = {
                tamil: Number(getField('tamil')?.value || 0),
                english: Number(getField('english')?.value || 0),
                maths: Number(getField('maths')?.value || 0),
                science: Number(getField('science')?.value || 0),
                social_science: Number(getField('social_science')?.value || 0),
                attendance: Number(getField('attendance')?.value || 0),
                assignment: Number(getField('assignment')?.value || 0),
                faculty_remarks: (getField('faculty_remarks')?.value || '').trim()
            };

            fetch(`/api/students/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        showMessage(messageDiv, 'Student record updated', 'success');
                        loadStudents();
                    } else {
                        showMessage(messageDiv, data.message || 'Unable to update student', 'error');
                    }
                })
                .catch(() => showMessage(messageDiv, 'Connection error', 'error'));
        });
    }

    loadStudents();
}

// --- Student Page Logic ---
function initStudent() {
    if (window.__studentInitDone) return;
    window.__studentInitDone = true;

    // const searchIdInput = document.getElementById('studentSearchId'); // Hidden input
    const messageDiv = document.getElementById('studentMessage');
    const nameInput = document.getElementById('studentNameSearch');
    const suggestionsBox = document.getElementById('nameSuggestions');
    const resultsArea = document.getElementById('resultsArea');
    const welcomeState = document.getElementById('welcomeState');
    const headerSearch = document.querySelector('.header-search');
    const downloadStudentPdfBtn = document.getElementById('downloadStudentPdfBtn');

    let allStudents = [];
    let currentStudentId = null;

    // Check if we have user context (for strict view)
    const currentUser = window.currentUser || {};
    let studentAssignments = [];

    const stuViews = {
        dashboard: document.getElementById('studentDashboardView'),
        attendance: document.getElementById('studentAttendanceView'),
        assignments: document.getElementById('studentAssignmentsView'),
        currentScores: document.getElementById('studentCurrentScoresView'),
        stability: document.getElementById('studentStabilityView'),
        comparison: document.getElementById('studentComparisonView'),
        feedback: document.getElementById('studentFeedbackView'),
        download: document.getElementById('studentDownloadView')
    };

    const stuNav = {
        dashboard: document.getElementById('stuNavDashboard'),
        academics: document.getElementById('stuNavAcademics'),
        reports: document.getElementById('stuNavReports'),
        attendance: document.getElementById('stuNavAttendance'),
        assignments: document.getElementById('stuNavAssignments'),
        currentScores: document.getElementById('stuNavCurrentScores'),
        stability: document.getElementById('stuNavStability'),
        comparison: document.getElementById('stuNavComparison'),
        feedback: document.getElementById('stuNavFeedback'),
        download: document.getElementById('stuNavDownload')
    };
    const academicsGroup = document.getElementById('stuAcademicsGroup');
    const reportsGroup = document.getElementById('stuReportsGroup');

    function switchStudentView(key) {
        Object.keys(stuViews).forEach(k => {
            if (stuViews[k]) stuViews[k].style.display = (k === key ? 'block' : 'none');
        });
        Object.values(stuNav).forEach(node => { if (node) node.classList.remove('active'); });
        if (key === 'dashboard' && stuNav.dashboard) stuNav.dashboard.classList.add('active');
        if (key === 'attendance' && stuNav.attendance) stuNav.attendance.classList.add('active');
        if (key === 'assignments' && stuNav.assignments) stuNav.assignments.classList.add('active');
        if (key === 'currentScores' && stuNav.currentScores) stuNav.currentScores.classList.add('active');
        if (key === 'stability' && stuNav.stability) stuNav.stability.classList.add('active');
        if (key === 'comparison' && stuNav.comparison) stuNav.comparison.classList.add('active');
        if (key === 'feedback' && stuNav.feedback) stuNav.feedback.classList.add('active');
        if (key === 'download' && stuNav.download) stuNav.download.classList.add('active');
        if (academicsGroup) academicsGroup.classList.toggle('open', ['attendance', 'assignments', 'currentScores', 'stability'].includes(key));
        if (reportsGroup) reportsGroup.classList.toggle('open', ['comparison', 'feedback', 'download'].includes(key));
    }

    function populateStudentAcademicPanels(student) {
        const attendanceBody = document.getElementById('stuAttendanceBody');
        const currTest = document.getElementById('stuCurrTest');
        const currAttendance = document.getElementById('stuCurrAttendance');
        const currAssignment = document.getElementById('stuCurrAssignment');
        const currStability = document.getElementById('stuCurrStability');
        const stabilityText = document.getElementById('stuStabilityText');
        const subjectScoresBody = document.getElementById('stuSubjectScoresBody');
        const stabilityCurrent = document.getElementById('stuStabilityCurrent');
        const stabilityPrevious = document.getElementById('stuStabilityPrevious');
        const stabilityDiff = document.getElementById('stuStabilityDiff');

        if (attendanceBody) {
            attendanceBody.innerHTML = `
                <tr>
                    <td>${student.name || ''}</td>
                    <td>${student.roll_no || ''}</td>
                    <td>${student.class_name || '-'}</td>
                    <td>${student.attendance || 0}%</td>
                    <td>Yes</td>
                </tr>
            `;
        }
        if (currTest) currTest.textContent = `${student.test_score || 0}%`;
        if (currAttendance) currAttendance.textContent = `${student.attendance || 0}%`;
        if (currAssignment) currAssignment.textContent = `${student.assignment || 0}%`;
        if (currStability) currStability.textContent = `${student.stability_score || 0}%`;
        if (stabilityCurrent) stabilityCurrent.textContent = `${student.stability_score || 0}%`;
        if (stabilityPrevious) stabilityPrevious.textContent = `${student.previous_stability_score || 0}%`;
        if (stabilityDiff) stabilityDiff.textContent = `${student.trend_diff || 0}%`;
        if (stabilityText) stabilityText.textContent = student.recommendation || 'No stability recommendation available.';

        if (subjectScoresBody) {
            const rows = [
                { name: 'Tamil', score: student.tamil || 0 },
                { name: 'English', score: student.english || 0 },
                { name: 'Maths', score: student.maths || 0 },
                { name: 'Science', score: student.science || 0 },
                { name: 'Social Science', score: student.social_science || 0 }
            ];
            const level = (s) => s >= 80 ? 'Excellent' : s >= 50 ? 'Moderate' : 'Needs Focus';
            subjectScoresBody.innerHTML = '';
            rows.forEach(r => {
                subjectScoresBody.innerHTML += `<tr><td>${r.name}</td><td>${r.score}</td><td>${level(r.score)}</td></tr>`;
            });
        }

        renderStudentStabilityCharts(student);
    }

    function renderStudentStabilityCharts(student) {
        const radarCanvas = document.getElementById('stuStabilityRadarChart');
        const trendCanvas = document.getElementById('stuStabilityTrendChart');
        if (radarCanvas) {
            if (studentStabilityRadarChart) studentStabilityRadarChart.destroy();
            studentStabilityRadarChart = new Chart(radarCanvas.getContext('2d'), {
                type: 'radar',
                data: {
                    labels: ['Test', 'Attendance', 'Assignment', 'Stability'],
                    datasets: [{
                        label: 'Current Performance',
                        data: [
                            Number(student.test_score || 0),
                            Number(student.attendance || 0),
                            Number(student.assignment || 0),
                            Number(student.stability_score || 0)
                        ],
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37,99,235,0.2)'
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: { r: { min: 0, max: 100 } } }
            });
        }

        if (trendCanvas) {
            if (studentStabilityTrendChart) studentStabilityTrendChart.destroy();
            studentStabilityTrendChart = new Chart(trendCanvas.getContext('2d'), {
                type: 'line',
                data: {
                    labels: ['Previous', 'Current'],
                    datasets: [{
                        label: 'Stability Score',
                        data: [
                            Number(student.previous_stability_score || 0),
                            Number(student.stability_score || 0)
                        ],
                        borderColor: '#0ea5e9',
                        backgroundColor: 'rgba(14,165,233,0.15)',
                        tension: 0.3,
                        fill: true
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } }
            });
        }
    }

    function renderStudentAssignments() {
        const body = document.getElementById('stuAssignmentsBody');
        if (!body) return;
        body.innerHTML = studentAssignments.length ? '' : '<tr><td colspan="7" style="text-align:center; color:#888;">No assignments available</td></tr>';
        studentAssignments.forEach((a, i) => {
            const markText = (a.assignment_mark === null || a.assignment_mark === undefined || a.assignment_mark === '') ? 'Not graded' : `${a.assignment_mark}%`;
            body.innerHTML += `
                <tr>
                    <td>#${i + 1}</td>
                    <td>${a.title || ''}</td>
                    <td>${a.due_date || ''}</td>
                    <td>${a.status || 'Pending'}</td>
                    <td><input type="file" class="account-edit-input stu-assignment-file" data-assignment-id="${a.assignment_id}" accept="application/pdf"></td>
                    <td>
                        <button type="button" class="action-btn edit-btn stu-submit-assignment-btn" data-assignment-id="${a.assignment_id}" ${a.status === 'Submitted' ? 'disabled' : ''}>
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </td>
                    <td>${markText}</td>
                </tr>
            `;
        });
    }

    function loadStudentAssignments() {
        if (currentUser.type !== 'student') return;
        fetch('/api/student/assignments')
            .then(r => r.json())
            .then(data => {
                if (data.status === 'success') {
                    studentAssignments = data.assignments || [];
                    renderStudentAssignments();
                } else {
                    showMessage(document.getElementById('stuAssignmentsMsg'), data.message || 'Unable to load assignments', 'error');
                }
            })
            .catch(() => showMessage(document.getElementById('stuAssignmentsMsg'), 'Unable to load assignments', 'error'));
    }

    // Load student data based on role
    fetch('/api/students')
        .then(res => res.json())
        .then(data => {
            allStudents = sortByName(data);
            const targetId = Number(currentUser.targetStudentId || 0);

            // If Student Role: Auto-load their data and hide search
            if (currentUser.type === 'student') {
                if (headerSearch) headerSearch.style.display = 'none'; // Hide search bar
                if (data.length > 0) {
                    // The API already filters for this user, so data[0] is the user
                    loadStudentData(data[0].id);
                } else {
                    showMessage(messageDiv, 'No data found for this user.', 'error');
                }
            } else if (targetId > 0) {
                if (headerSearch) headerSearch.style.display = 'none';
                loadStudentData(targetId);
            }
        });

    // Name/ID Search Logic (Only enabled if search inputs exist/visible)
    if (nameInput && (!currentUser.type || currentUser.type === 'admin')) {
        nameInput.addEventListener('input', function () {
            const query = this.value.toLowerCase();
            suggestionsBox.innerHTML = '';

            if (query.length < 1) {
                suggestionsBox.style.display = 'none';
                return;
            }

            // Filter by Name OR Roll No
            const matches = allStudents.filter(s =>
                (s.name && s.name.toLowerCase().includes(query)) ||
                (s.roll_no && s.roll_no.toLowerCase().includes(query))
            );

            if (matches.length > 0) {
                matches.forEach(student => {
                    const div = document.createElement('div');
                    div.className = 'suggestion-item';
                    div.innerHTML = `
                        <span class="name">${student.name}</span>
                        <span class="id-pill">Roll: ${student.roll_no || student.id}</span>
                    `;
                    div.addEventListener('click', () => {
                        nameInput.value = `${student.name} (Roll: ${student.roll_no})`;
                        suggestionsBox.style.display = 'none';
                        loadStudentData(student.id);
                    });
                    suggestionsBox.appendChild(div);
                });
                suggestionsBox.style.display = 'block';
            } else {
                suggestionsBox.style.display = 'none';
            }
        });

        // Hide suggestions when clicking outside
        document.addEventListener('click', function (e) {
            if (!nameInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
                suggestionsBox.style.display = 'none';
            }
        });
    }

    if (downloadStudentPdfBtn) {
        downloadStudentPdfBtn.addEventListener('click', function () {
            if (!currentStudentId) {
                showMessage(messageDiv, 'Select a student record first', 'error');
                return;
            }
            if (currentUser.type === 'student') {
                window.location.href = '/api/reports/student/pdf';
            } else {
                window.location.href = `/api/reports/student/${currentStudentId}/pdf`;
            }
        });
    }

    if (stuNav.dashboard) stuNav.dashboard.addEventListener('click', (e) => { e.preventDefault(); switchStudentView('dashboard'); });
    if (stuNav.academics) stuNav.academics.addEventListener('click', (e) => {
        e.preventDefault();
        if (academicsGroup) academicsGroup.classList.toggle('open');
        if (reportsGroup) reportsGroup.classList.remove('open');
        if (stuNav.academics) stuNav.academics.classList.add('active');
        if (stuNav.reports) stuNav.reports.classList.remove('active');
    });
    if (stuNav.reports) stuNav.reports.addEventListener('click', (e) => {
        e.preventDefault();
        if (reportsGroup) reportsGroup.classList.toggle('open');
        if (academicsGroup) academicsGroup.classList.remove('open');
        if (stuNav.reports) stuNav.reports.classList.add('active');
        if (stuNav.academics) stuNav.academics.classList.remove('active');
    });
    if (stuNav.attendance) stuNav.attendance.addEventListener('click', (e) => { e.preventDefault(); switchStudentView('attendance'); });
    if (stuNav.assignments) stuNav.assignments.addEventListener('click', (e) => { e.preventDefault(); switchStudentView('assignments'); });
    if (stuNav.currentScores) stuNav.currentScores.addEventListener('click', (e) => { e.preventDefault(); switchStudentView('currentScores'); });
    if (stuNav.stability) stuNav.stability.addEventListener('click', (e) => { e.preventDefault(); switchStudentView('stability'); });
    if (stuNav.comparison) stuNav.comparison.addEventListener('click', (e) => { e.preventDefault(); switchStudentView('comparison'); });
    if (stuNav.feedback) stuNav.feedback.addEventListener('click', (e) => { e.preventDefault(); switchStudentView('feedback'); });
    if (stuNav.download) stuNav.download.addEventListener('click', (e) => { e.preventDefault(); switchStudentView('download'); });

    const assignmentsBody = document.getElementById('stuAssignmentsBody');
    if (assignmentsBody) {
        assignmentsBody.addEventListener('click', function (e) {
            const btn = e.target.closest('.stu-submit-assignment-btn');
            if (!btn) return;
            const assignmentId = btn.dataset.assignmentId;
            const fileInput = assignmentsBody.querySelector(`.stu-assignment-file[data-assignment-id="${assignmentId}"]`);
            const file = fileInput && fileInput.files ? fileInput.files[0] : null;
            if (!file) {
                showMessage(document.getElementById('stuAssignmentsMsg'), 'Please attach a PDF file before submitting', 'error');
                return;
            }
            if (!String(file.name || '').toLowerCase().endsWith('.pdf')) {
                showMessage(document.getElementById('stuAssignmentsMsg'), 'Only PDF file is allowed', 'error');
                return;
            }
            const formData = new FormData();
            formData.append('file', file);
            fetch(`/api/student/assignments/${assignmentId}/submit`, {
                method: 'POST',
                body: formData
            })
                .then(r => r.json())
                .then(data => {
                    if (data.status === 'success') {
                        showMessage(document.getElementById('stuAssignmentsMsg'), data.message || 'Submitted successfully', 'success');
                        loadStudentAssignments();
                    } else {
                        showMessage(document.getElementById('stuAssignmentsMsg'), data.message || 'Submission failed', 'error');
                    }
                })
                .catch(() => showMessage(document.getElementById('stuAssignmentsMsg'), 'Connection error', 'error'));
        });
    }

    const submitFeedbackBtn = document.getElementById('stuSubmitFeedbackBtn');
    if (submitFeedbackBtn) {
        submitFeedbackBtn.addEventListener('click', function () {
            const input = document.getElementById('stuFeedbackInput');
            const message = (input?.value || '').trim();
            fetch('/api/student/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: message })
            })
                .then(r => r.json())
                .then(data => {
                    if (data.status === 'success') {
                        if (input) input.value = '';
                        showMessage(document.getElementById('stuFeedbackMsg'), data.message || 'Feedback submitted', 'success');
                    } else {
                        showMessage(document.getElementById('stuFeedbackMsg'), data.message || 'Unable to submit feedback', 'error');
                    }
                })
                .catch(() => showMessage(document.getElementById('stuFeedbackMsg'), 'Connection error', 'error'));
        });
    }

    const stuDownloadPdfBtn = document.getElementById('stuDownloadPdfBtn');
    if (stuDownloadPdfBtn) {
        stuDownloadPdfBtn.addEventListener('click', function () {
            if (currentUser.type === 'student') window.location.href = '/api/reports/student/pdf';
        });
    }

    switchStudentView('dashboard');

    function loadStudentData(id) {
        // Updated search logic to find correctly
        // Since we might have restricted list, we search in allStudents loaded
        const student = allStudents.find(s => s.id == id);

        if (student) {
            currentStudentId = student.id;
            // Hide welcome, show results
            if (welcomeState) welcomeState.style.display = 'none';
            if (resultsArea) {
                resultsArea.style.display = 'block';
                resultsArea.classList.add('fade-in');
            }

            document.getElementById('studentNameDisplay').textContent = student.name || 'Student';
            const classEl = document.getElementById('studentClassDisplay');
            if (classEl) classEl.textContent = `Class: ${student.class_name || '-'}`;
            document.getElementById('dispStability').textContent = student.stability_score + '%';
            document.getElementById('dispTest').textContent = student.test_score + '%';

            // Render Subject Breakdown
            renderSubjectBreakdown(student);
            document.getElementById('dispAttendance').textContent = student.attendance;
            document.getElementById('dispAssignment').textContent = student.assignment;

            const catEl = document.getElementById('dispCategory');
            catEl.textContent = student.category;

            // Style category
            catEl.className = 'category-badge'; // reset
            if (student.stability_score >= 80) catEl.classList.add('high');
            else if (student.stability_score >= 50) catEl.classList.add('moderate');
            else catEl.classList.add('low');

            // Trend Logic
            const trendDisplay = document.getElementById('trendDisplay');
            const trendIcon = document.getElementById('trendIcon');
            const trendText = document.getElementById('trendText');
            const trendRec = document.getElementById('trendRecommendation');
            const remarksSection = document.getElementById('remarksSection');
            const remarksText = document.getElementById('facultyRemarksText');

            if (trendDisplay) {
                const diff = student.trend_diff || 0;
                const rec = student.recommendation || "No data yet";

                trendDisplay.style.display = 'inline-flex';
                trendDisplay.className = 'trend-badge'; // reset

                if (diff > 0) {
                    trendIcon.innerHTML = '<i class="fas fa-arrow-up"></i>';
                    trendDisplay.classList.add('positive');
                    trendText.textContent = `Improved by ${diff}%`;
                } else if (diff < 0) {
                    trendIcon.innerHTML = '<i class="fas fa-arrow-down"></i>';
                    trendDisplay.classList.add('negative');
                    trendText.textContent = `Declined by ${Math.abs(diff)}%`;
                } else {
                    trendIcon.innerHTML = '<i class="fas fa-minus"></i>';
                    trendDisplay.classList.add('neutral');
                    trendText.textContent = 'No Change';
                }

                if (trendRec) trendRec.textContent = rec;
            }

            if (remarksSection && remarksText) {
                remarksSection.style.display = 'block';
                remarksText.textContent = student.faculty_remarks || 'No remarks yet.';
            }

            updateChart(student.test_score, student.attendance, student.assignment);
            populateStudentAcademicPanels(student);
            loadStudentAssignments();

            // Comparison report metrics/charts
            const prevStability = document.getElementById('prevStability');
            const currStability = document.getElementById('currStability');
            const prevTest = document.getElementById('prevTest');
            const currTest = document.getElementById('currTest');
            const prevAssignment = document.getElementById('prevAssignment');
            const currAssignment = document.getElementById('currAssignment');
            if (prevStability) prevStability.textContent = (student.previous_stability_score || 0) + '%';
            if (currStability) currStability.textContent = (student.stability_score || 0) + '%';
            if (prevTest) prevTest.textContent = (student.prev_test_score || 0) + '%';
            if (currTest) currTest.textContent = (student.test_score || 0) + '%';
            if (prevAssignment) prevAssignment.textContent = (student.prev_assignment || 0) + '%';
            if (currAssignment) currAssignment.textContent = (student.assignment || 0) + '%';
            renderComparisonChart(student);

            if (messageDiv) showMessage(messageDiv, '', 'success');

        } else {
            if (messageDiv) showMessage(messageDiv, 'Student not found', 'error');
        }
    }

    function renderComparisonChart(student) {
        const ctx = document.getElementById('comparisonChart').getContext('2d');

        if (comparisonChartInstance) {
            comparisonChartInstance.destroy();
        }

        comparisonChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Stability', 'Test', 'Assignment'],
                datasets: [
                    {
                        label: 'Previous',
                        data: [
                            student.previous_stability_score || 0,
                            student.prev_test_score || 0,
                            student.prev_assignment || 0
                        ],
                        backgroundColor: 'rgba(100, 116, 139, 0.5)',
                        borderColor: '#64748b',
                        borderWidth: 1
                    },
                    {
                        label: 'Current',
                        data: [
                            student.stability_score || 0,
                            student.test_score || 0,
                            student.assignment || 0
                        ],
                        backgroundColor: 'rgba(37, 99, 235, 0.8)',
                        borderColor: '#2563eb',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    title: { display: true, text: 'Performance vs Last Month' }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }
    function renderSubjectBreakdown(student) {
        const container = document.getElementById('subjectBreakdown');
        if (!container) return;

        const subjects = [
            { name: 'Tamil', score: student.tamil, color: '#FF6384' },
            { name: 'English', score: student.english, color: '#36A2EB' },
            { name: 'Maths', score: student.maths, color: '#FFCE56' },
            { name: 'Science', score: student.science, color: '#4BC0C0' },
            { name: 'Social Sc.', score: student.social_science, color: '#9966FF' }
        ];

        container.innerHTML = '';
        subjects.forEach((sub, index) => {
            const score = sub.score || 0;
            const item = document.createElement('div');
            item.className = 'subject-card';
            item.style.setProperty('--card-color', sub.color);
            item.style.animation = `fadeInUp 0.45s ease-out ${index * 0.08}s backwards`;

            item.innerHTML = `
                <div class="sub-header">
                    <span class="sub-name">${sub.name}</span>
                    <span class="sub-score">${score}</span>
                </div>
                <div class="progress-container">
                    <div class="progress-fill" style="width: 0%; background-color: ${sub.color};"></div>
                </div>
            `;
            container.appendChild(item);
        });

        requestAnimationFrame(() => {
            container.querySelectorAll('.subject-card').forEach((card, index) => {
                const fill = card.querySelector('.progress-fill');
                const score = subjects[index].score || 0;
                if (fill) fill.style.width = `${score}%`;
            });
        });

        // Ensure container is visible
        document.getElementById('subjectSection').style.display = 'block';
    }
}

// --- Index Page Logic (Keeping original) ---
function initIndex() {
    const form = document.getElementById('evalForm');
    const resultSection = document.getElementById('resultSection');
    const scoreValue = document.getElementById('scoreValue');
    const categoryValue = document.getElementById('categoryValue');

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        // Get values
        const testScore = parseFloat(document.getElementById('test_score').value);
        const attendance = parseFloat(document.getElementById('attendance').value);
        const assignment = parseFloat(document.getElementById('assignment').value);

        // Simple validation
        if (isNaN(testScore) || isNaN(attendance) || isNaN(assignment)) {
            alert("Please enter valid numbers for all fields.");
            return;
        }

        // Stability is calculated client-side for this page.

        // Stability Score Calculation (Average)
        let stability_score = (testScore + attendance + assignment) / 3;
        stability_score = Math.round(stability_score * 100) / 100;

        let category = "";
        let category_class = "";

        if (stability_score >= 80) {
            category = "High Stability (Advanced Learner)";
            category_class = "high";
        } else if (stability_score >= 50) {
            category = "Moderate Stability (Average Learner)";
            category_class = "moderate";
        } else {
            category = "Low Stability (Needs Improvement)";
            category_class = "low";
        }

        // Show results
        resultSection.style.display = 'block';
        scoreValue.textContent = stability_score;
        categoryValue.textContent = category;
        categoryValue.className = 'value ' + category_class;

        updateChart(testScore, attendance, assignment);
        resultSection.scrollIntoView({ behavior: 'smooth' });
    });
}

// --- Shared Helper ---
function showMessage(element, msg, type) {
    element.textContent = msg;
    element.className = 'message ' + type;
    setTimeout(() => {
        element.textContent = '';
        element.className = 'message';
    }, 3000);
}

function updateChart(test, attendance, assignment) {
    const ctx = document.getElementById('performanceChart').getContext('2d');

    if (myChart) {
        myChart.destroy();
    }

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Test Score', 'Attendance', 'Assignment Completion'],
            datasets: [{
                label: 'Score',
                data: [test, attendance, assignment],
                backgroundColor: [
                    'rgba(54, 162, 235, 0.7)',
                    'rgba(75, 192, 192, 0.7)',
                    'rgba(153, 102, 255, 0.7)'
                ],
                borderColor: [
                    'rgba(54, 162, 235, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            },
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// --- Faculty Page Logic V2 ---
function initFacultyV2() {
    if (window.__facultyV2InitDone) return;
    window.__facultyV2InitDone = true;

    const nav = {
        dashboard: document.getElementById('facultyNavDashboard'),
        marks: document.getElementById('facultyNavMarks'),
        attendance: document.getElementById('facultyNavAttendance'),
        assignments: document.getElementById('facultyNavAssignments'),
        assignmentMarks: document.getElementById('facultyNavAssignmentMarks'),
        assignmentCreate: document.getElementById('facultyNavAssignmentCreate'),
        assignmentStatus: document.getElementById('facultyNavAssignmentStatus'),
        analytics: document.getElementById('facultyNavAnalytics'),
        atRisk: document.getElementById('facultyNavAtRisk'),
        feedback: document.getElementById('facultyNavFeedback'),
        profile: document.getElementById('facultyNavProfile')
    };
    const assignmentsGroup = document.getElementById('facultyAssignmentsGroup');

    const views = {
        dashboard: document.getElementById('facultyDashboardView'),
        marks: document.getElementById('facultyMarksView'),
        attendance: document.getElementById('facultyAttendanceView'),
        assignmentMarks: document.getElementById('facultyAssignmentMarksView'),
        assignmentCreate: document.getElementById('facultyAssignmentCreateView'),
        assignmentStatus: document.getElementById('facultyAssignmentStatusView'),
        analytics: document.getElementById('facultyAnalyticsView'),
        atRisk: document.getElementById('facultyAtRiskView'),
        feedback: document.getElementById('facultyFeedbackView'),
        profile: document.getElementById('facultyProfileView')
    };

    const subtitle = document.getElementById('facultyHeaderSubtitle');
    const subtitles = {
        dashboard: 'Update marks, attendance, assignments, and remarks for students.',
        marks: 'Edit subject marks for each student and save.',
        attendance: 'Manage student attendance percentages.',
        assignmentMarks: 'Update assignment marks for each student.',
        assignmentCreate: 'Create assignments for students with a clear deadline.',
        assignmentStatus: 'Track and update submission status for each student.',
        analytics: 'Monitor class performance analytics.',
        atRisk: 'Track moderate and high risk students.',
        feedback: 'Add feedback and remarks for students.',
        profile: 'View student profile details.'
    };

    const marksBody = document.querySelector('#facultyMarksTable tbody');
    const attendanceBody = document.querySelector('#facultyAttendanceTable tbody');
    const assignmentsBody = document.querySelector('#facultyAssignmentsTable tbody');
    const createdAssignmentsBody = document.querySelector('#facultyCreatedAssignmentsTable tbody');
    const submissionStatusBody = document.querySelector('#facultySubmissionStatusTable tbody');
    const atRiskBody = document.querySelector('#facultyAtRiskTable tbody');
    const feedbackBody = document.querySelector('#facultyFeedbackTable tbody');
    const profileBody = document.querySelector('#facultyProfileTable tbody');
    const facultyStudentFeedbackList = document.getElementById('facultyStudentFeedbackList');

    const marksSearch = document.getElementById('facultyMarksSearch');
    const attendanceSearch = document.getElementById('facultyAttendanceSearch');
    const assignmentsSearch = document.getElementById('facultyAssignmentsSearch');
    const feedbackSearch = document.getElementById('facultyFeedbackSearch');
    const profileSearch = document.getElementById('facultyProfileSearch');
    const createAssignmentBtn = document.getElementById('createAssignmentBtn');
    const assignmentSelect = document.getElementById('submissionAssignmentSelect');

    const marksMsg = document.getElementById('facultyMarksMessage');
    const attendanceMsg = document.getElementById('facultyAttendanceMessage');
    const assignmentsMsg = document.getElementById('facultyAssignmentsMessage');
    const assignmentCreateMsg = document.getElementById('facultyAssignmentCreateMessage');
    const submissionStatusMsg = document.getElementById('facultySubmissionStatusMessage');
    const feedbackMsg = document.getElementById('facultyFeedbackMessage');

    const totalEl = document.getElementById('facultyTotalStudents');
    const avgTestEl = document.getElementById('facultyAvgTest');
    const avgAttendanceEl = document.getElementById('facultyAvgAttendance');
    const avgAssignmentEl = document.getElementById('facultyAvgAssignment');
    const totalAnalyticsEl = document.getElementById('facultyTotalStudentsAnalytics');
    const avgStabilityEl = document.getElementById('facultyAvgStability');
    const dashboardStudentsList = document.getElementById('facultyDashboardStudentsList');

    const profileCard = document.getElementById('facultyProfileCard');
    const profileName = document.getElementById('facultyProfileName');
    const profileDetails = document.getElementById('facultyProfileDetails');

    let students = [];
    let assignments = [];
    let analyticsChart = null;

    const esc = (v) => String(v || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const avg = (arr, key) => {
        if (!arr.length) return 0;
        return Math.round((arr.reduce((s, x) => s + (Number(x[key]) || 0), 0) / arr.length) * 100) / 100;
    };

    function switchView(key) {
        Object.keys(views).forEach(k => {
            if (views[k]) views[k].style.display = (k === key ? 'block' : 'none');
            if (nav[k]) nav[k].classList.toggle('active', k === key);
        });
        if (assignmentsGroup) {
            const onAssignments = key === 'assignmentMarks' || key === 'assignmentCreate' || key === 'assignmentStatus';
            assignmentsGroup.classList.toggle('open', onAssignments);
            if (nav.assignments) nav.assignments.classList.toggle('active', onAssignments);
        }
        if (subtitle) subtitle.textContent = subtitles[key] || subtitles.dashboard;
    }

    function filterBy(query) {
        const q = (query || '').trim().toLowerCase();
        if (!q) return students;
        return sortByName(students.filter(s => (s.name || '').toLowerCase().includes(q) || (s.roll_no || '').toLowerCase().includes(q)));
    }

    function updateStats(data) {
        if (totalEl) totalEl.textContent = data.length;
        if (avgTestEl) avgTestEl.textContent = `${avg(data, 'test_score')}%`;
        if (avgAttendanceEl) avgAttendanceEl.textContent = `${avg(data, 'attendance')}%`;
        if (avgAssignmentEl) avgAssignmentEl.textContent = `${avg(data, 'assignment')}%`;
        if (totalAnalyticsEl) totalAnalyticsEl.textContent = data.length;
        if (avgStabilityEl) avgStabilityEl.textContent = `${avg(data, 'stability_score')}%`;
    }

    function saveStudent(id, payload, messageEl, okMsg) {
        fetch(`/api/students/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(r => r.json())
            .then(data => {
                if (data.status === 'success') {
                    showMessage(messageEl, okMsg, 'success');
                    loadStudents();
                } else {
                    showMessage(messageEl, data.message || 'Update failed', 'error');
                }
            })
            .catch(() => showMessage(messageEl, 'Connection error', 'error'));
    }

    function renderMarks(data) {
        if (!marksBody) return;
        marksBody.innerHTML = data.length ? '' : '<tr><td colspan="10" style="text-align:center; color:#888;">No students found</td></tr>';
        data.forEach((s, i) => {
            marksBody.innerHTML += `<tr>
                <td>#${i + 1}</td><td>${esc(s.name)}</td><td>${esc(s.roll_no)}</td><td>${esc(s.class_name || '-')}</td>
                <td><input type="number" class="account-edit-input" data-id="${s.id}" data-field="tamil" min="0" max="100" value="${Number(s.tamil) || 0}"></td>
                <td><input type="number" class="account-edit-input" data-id="${s.id}" data-field="english" min="0" max="100" value="${Number(s.english) || 0}"></td>
                <td><input type="number" class="account-edit-input" data-id="${s.id}" data-field="maths" min="0" max="100" value="${Number(s.maths) || 0}"></td>
                <td><input type="number" class="account-edit-input" data-id="${s.id}" data-field="science" min="0" max="100" value="${Number(s.science) || 0}"></td>
                <td><input type="number" class="account-edit-input" data-id="${s.id}" data-field="social_science" min="0" max="100" value="${Number(s.social_science) || 0}"></td>
                <td><button class="action-btn edit-btn fac-save-marks" data-id="${s.id}"><i class="fas fa-floppy-disk"></i></button></td>
            </tr>`;
        });
    }

    function renderAttendance(data) {
        if (!attendanceBody) return;
        attendanceBody.innerHTML = data.length ? '' : '<tr><td colspan="6" style="text-align:center; color:#888;">No students found</td></tr>';
        data.forEach((s, i) => {
            attendanceBody.innerHTML += `<tr>
                <td>#${i + 1}</td><td>${esc(s.name)}</td><td>${esc(s.roll_no)}</td><td>${esc(s.class_name || '-')}</td>
                <td><input type="number" class="account-edit-input" data-id="${s.id}" data-field="attendance" min="0" max="100" value="${Number(s.attendance) || 0}"></td>
                <td><button class="action-btn edit-btn fac-save-attendance" data-id="${s.id}"><i class="fas fa-floppy-disk"></i></button></td>
            </tr>`;
        });
    }

    function renderCreatedAssignmentsTable(data) {
        if (!createdAssignmentsBody) return;
        createdAssignmentsBody.innerHTML = data.length ? '' : '<tr><td colspan="4" style="text-align:center; color:#888;">No assignments created yet</td></tr>';
        data.forEach((a, i) => {
            createdAssignmentsBody.innerHTML += `<tr>
                <td>#${i + 1}</td>
                <td>${esc(a.title)}</td>
                <td>${esc(a.due_date)}</td>
                <td>${esc(a.created_at)}</td>
            </tr>`;
        });
    }

    function renderAssignments(data) {
        if (!assignmentsBody) return;
        assignmentsBody.innerHTML = data.length ? '' : '<tr><td colspan="6" style="text-align:center; color:#888;">No students found</td></tr>';
        data.forEach((s, i) => {
            assignmentsBody.innerHTML += `<tr>
                <td>#${i + 1}</td><td>${esc(s.name)}</td><td>${esc(s.roll_no)}</td><td>${esc(s.class_name || '-')}</td>
                <td><input type="number" class="account-edit-input" data-id="${s.id}" data-field="assignment" min="0" max="100" value="${Number(s.assignment) || 0}"></td>
                <td><button class="action-btn edit-btn fac-save-assignment" data-id="${s.id}"><i class="fas fa-floppy-disk"></i></button></td>
            </tr>`;
        });
    }

    function renderAssignmentSelectOptions(data) {
        if (!assignmentSelect) return;
        assignmentSelect.innerHTML = '<option value="">Select Assignment</option>';
        data.forEach(a => {
            assignmentSelect.innerHTML += `<option value="${a.id}">${esc(a.title)} (Due: ${esc(a.due_date)})</option>`;
        });
    }

    function renderSubmissionStatusRows(rows) {
        if (!submissionStatusBody) return;
        submissionStatusBody.innerHTML = rows.length ? '' : '<tr><td colspan="8" style="text-align:center; color:#888;">No submission records found</td></tr>';
        rows.forEach((r, i) => {
            const fileHtml = r.file_url ? `<a href="${r.file_url}" target="_blank" class="small-search" style="text-decoration:none;">View PDF</a>` : '<span style="color:#9ca3af;">Not submitted</span>';
            submissionStatusBody.innerHTML += `<tr>
                <td>#${i + 1}</td>
                <td>${esc(r.student_name)}</td>
                <td>${esc(r.roll_no)}</td>
                <td>
                    <select class="role-select fac-submission-status" data-student-id="${r.student_id}">
                        <option value="Pending" ${r.status === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="Submitted" ${r.status === 'Submitted' ? 'selected' : ''}>Submitted</option>
                        <option value="Late" ${r.status === 'Late' ? 'selected' : ''}>Late</option>
                        <option value="Missing" ${r.status === 'Missing' ? 'selected' : ''}>Missing</option>
                    </select>
                </td>
                <td>${fileHtml}</td>
                <td><input type="number" min="0" max="100" class="account-edit-input fac-assignment-mark" data-student-id="${r.student_id}" value="${r.assignment_mark ?? ''}" placeholder="Mark"></td>
                <td>${esc(r.submitted_at || '-')}</td>
                <td>
                    <button type="button" class="action-btn edit-btn fac-save-submission" data-student-id="${r.student_id}">
                        <i class="fas fa-floppy-disk"></i>
                    </button>
                </td>
            </tr>`;
        });
    }

    function loadAssignments() {
        fetch('/api/faculty/assignments')
            .then(r => r.json())
            .then(payload => {
                if (payload.status !== 'success') {
                    if (assignmentCreateMsg) showMessage(assignmentCreateMsg, payload.message || 'Unable to load assignments', 'error');
                    return;
                }
                assignments = Array.isArray(payload.assignments) ? payload.assignments : [];
                renderCreatedAssignmentsTable(assignments);
                renderAssignmentSelectOptions(assignments);
            })
            .catch(() => {
                if (assignmentCreateMsg) showMessage(assignmentCreateMsg, 'Unable to load assignments', 'error');
            });
    }

    function loadSubmissionStatus(assignmentId) {
        if (!assignmentId) {
            renderSubmissionStatusRows([]);
            return;
        }
        fetch(`/api/faculty/assignments/${assignmentId}/submissions`)
            .then(r => r.json())
            .then(payload => {
                if (payload.status !== 'success') {
                    if (submissionStatusMsg) showMessage(submissionStatusMsg, payload.message || 'Unable to load submission status', 'error');
                    return;
                }
                renderSubmissionStatusRows(payload.submissions || []);
            })
            .catch(() => {
                if (submissionStatusMsg) showMessage(submissionStatusMsg, 'Unable to load submission status', 'error');
            });
    }

    function renderAtRisk(data) {
        if (!atRiskBody) return;
        const rows = sortByName(data.filter(s => Number(s.stability_score) < 70));
        atRiskBody.innerHTML = rows.length ? '' : '<tr><td colspan="6" style="text-align:center; color:#888;">No at-risk students found</td></tr>';
        rows.forEach((s, i) => {
            atRiskBody.innerHTML += `<tr><td>#${i + 1}</td><td>${esc(s.name)}</td><td>${esc(s.roll_no)}</td><td>${esc(s.class_name || '-')}</td><td>${Number(s.stability_score || 0)}%</td><td>${esc(s.category || '-')}</td></tr>`;
        });
    }

    function renderFeedback(data) {
        if (!feedbackBody) return;
        feedbackBody.innerHTML = data.length ? '' : '<tr><td colspan="6" style="text-align:center; color:#888;">No students found</td></tr>';
        data.forEach((s, i) => {
            feedbackBody.innerHTML += `<tr>
                <td>#${i + 1}</td><td>${esc(s.name)}</td><td>${esc(s.roll_no)}</td><td>${esc(s.class_name || '-')}</td>
                <td><input type="text" class="account-edit-input" data-id="${s.id}" data-field="faculty_remarks" value="${esc(s.faculty_remarks || '')}" placeholder="Add remark"></td>
                <td><button class="action-btn edit-btn fac-save-feedback" data-id="${s.id}"><i class="fas fa-floppy-disk"></i></button></td>
            </tr>`;
        });
    }

    function renderProfiles(data) {
        if (!profileBody) return;
        profileBody.innerHTML = data.length ? '' : '<tr><td colspan="7" style="text-align:center; color:#888;">No students found</td></tr>';
        data.forEach((s, i) => {
            profileBody.innerHTML += `<tr>
                <td>#${i + 1}</td><td>${esc(s.name)}</td><td>${esc(s.roll_no)}</td><td>${esc(s.class_name || '-')}</td><td>${esc(s.email || '-')}</td><td>${Number(s.stability_score || 0)}%</td>
                <td><button class="action-btn edit-btn fac-view-profile" data-id="${s.id}"><i class="fas fa-eye"></i></button></td>
            </tr>`;
        });
    }

    function renderDashboardStudents(data) {
        if (!dashboardStudentsList) return;
        dashboardStudentsList.innerHTML = data.length ? '' : '<li style="color:#9ca3af; justify-content:center;">No students found</li>';
        data.forEach(s => {
            dashboardStudentsList.innerHTML += `<li><span>${esc(s.name)}</span><span>${esc(s.roll_no)}</span></li>`;
        });
    }

    function renderAnalytics(data) {
        const canvas = document.getElementById('facultyPerformanceChart');
        if (!canvas) return;
        if (analyticsChart) analyticsChart.destroy();
        analyticsChart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: data.map(s => s.roll_no || `#${s.id}`),
                datasets: [
                    { label: 'Test', data: data.map(s => Number(s.test_score || 0)), borderColor: '#2563eb', tension: 0.3 },
                    { label: 'Attendance', data: data.map(s => Number(s.attendance || 0)), borderColor: '#0ea5e9', tension: 0.3 },
                    { label: 'Assignment', data: data.map(s => Number(s.assignment || 0)), borderColor: '#f59e0b', tension: 0.3 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } }
        });
    }

    function renderAll(data) {
        updateStats(data);
        renderMarks(data);
        renderAttendance(data);
        renderAssignments(data);
        renderAtRisk(data);
        renderFeedback(data);
        renderProfiles(data);
        renderDashboardStudents(data);
        renderAnalytics(data);
        loadFacultyStudentFeedback();
    }

    function loadFacultyStudentFeedback() {
        if (!facultyStudentFeedbackList) return;
        fetch('/api/feedback')
            .then(r => r.json())
            .then(payload => {
                const items = payload?.feedback || [];
                facultyStudentFeedbackList.innerHTML = items.length ? '' : '<li style="color:#9ca3af; justify-content:center;">No feedback yet</li>';
                items.slice(0, 10).forEach(item => {
                    facultyStudentFeedbackList.innerHTML += `<li><span>${esc(item.student_name)} (${esc(item.roll_no)})</span><span>${esc(item.message)}</span></li>`;
                });
            })
            .catch(() => {
                facultyStudentFeedbackList.innerHTML = '<li style="color:#ef4444; justify-content:center;">Unable to load feedback</li>';
            });
    }

    function loadStudents() {
        fetch('/api/students')
            .then(r => r.json())
            .then(data => {
                students = sortByName(Array.isArray(data) ? data : []);
                renderAll(students);
            })
            .catch(() => {
                [marksMsg, attendanceMsg, assignmentsMsg, feedbackMsg].forEach(el => {
                    if (el) showMessage(el, 'Unable to load students', 'error');
                });
            });
    }

    if (marksSearch) marksSearch.addEventListener('input', function () { renderMarks(filterBy(this.value)); });
    if (attendanceSearch) attendanceSearch.addEventListener('input', function () { renderAttendance(filterBy(this.value)); });
    if (assignmentsSearch) assignmentsSearch.addEventListener('input', function () { renderAssignments(filterBy(this.value)); });
    if (feedbackSearch) feedbackSearch.addEventListener('input', function () { renderFeedback(filterBy(this.value)); });
    if (profileSearch) profileSearch.addEventListener('input', function () { renderProfiles(filterBy(this.value)); });

    Object.keys(nav).forEach(key => {
        if (!nav[key]) return;
        nav[key].addEventListener('click', function (e) {
            e.preventDefault();
            if (key === 'assignments') {
                if (assignmentsGroup) assignmentsGroup.classList.toggle('open');
                return;
            }
            switchView(key);
        });
    });

    if (marksBody) {
        marksBody.addEventListener('click', function (e) {
            const btn = e.target.closest('.fac-save-marks');
            if (!btn) return;
            const id = btn.dataset.id;
            const get = (field) => marksBody.querySelector(`[data-id="${id}"][data-field="${field}"]`);
            saveStudent(id, {
                tamil: Number(get('tamil')?.value || 0),
                english: Number(get('english')?.value || 0),
                maths: Number(get('maths')?.value || 0),
                science: Number(get('science')?.value || 0),
                social_science: Number(get('social_science')?.value || 0)
            }, marksMsg, 'Marks updated');
        });
    }

    if (attendanceBody) {
        attendanceBody.addEventListener('click', function (e) {
            const btn = e.target.closest('.fac-save-attendance');
            if (!btn) return;
            const id = btn.dataset.id;
            const field = attendanceBody.querySelector(`[data-id="${id}"][data-field="attendance"]`);
            saveStudent(id, { attendance: Number(field?.value || 0) }, attendanceMsg, 'Attendance updated');
        });
    }

    if (assignmentsBody) {
        assignmentsBody.addEventListener('click', function (e) {
            const btn = e.target.closest('.fac-save-assignment');
            if (!btn) return;
            const id = btn.dataset.id;
            const field = assignmentsBody.querySelector(`[data-id="${id}"][data-field="assignment"]`);
            saveStudent(id, { assignment: Number(field?.value || 0) }, assignmentsMsg, 'Assignment marks updated');
        });
    }

    if (createAssignmentBtn) {
        createAssignmentBtn.addEventListener('click', function () {
            const title = (document.getElementById('assignmentTitle')?.value || '').trim();
            const dueDate = (document.getElementById('assignmentDeadline')?.value || '').trim();
            const description = (document.getElementById('assignmentDescription')?.value || '').trim();

            fetch('/api/faculty/assignments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: title, due_date: dueDate, description: description })
            })
                .then(r => r.json())
                .then(data => {
                    if (data.status === 'success') {
                        const form = document.getElementById('facultyCreateAssignmentForm');
                        if (form) form.reset();
                        showMessage(assignmentCreateMsg, data.message || 'Assignment created', 'success');
                        loadAssignments();
                    } else {
                        showMessage(assignmentCreateMsg, data.message || 'Unable to create assignment', 'error');
                    }
                })
                .catch(() => showMessage(assignmentCreateMsg, 'Connection error', 'error'));
        });
    }

    if (assignmentSelect) {
        assignmentSelect.addEventListener('change', function () {
            loadSubmissionStatus(this.value);
        });
    }

    if (submissionStatusBody) {
        submissionStatusBody.addEventListener('click', function (e) {
            const btn = e.target.closest('.fac-save-submission');
            if (!btn) return;
            const assignmentId = assignmentSelect ? assignmentSelect.value : '';
            if (!assignmentId) {
                showMessage(submissionStatusMsg, 'Select assignment first', 'error');
                return;
            }
            const studentId = btn.dataset.studentId;
            const statusSelect = submissionStatusBody.querySelector(`.fac-submission-status[data-student-id="${studentId}"]`);
            const status = statusSelect ? statusSelect.value : 'Pending';
            const markInput = submissionStatusBody.querySelector(`.fac-assignment-mark[data-student-id="${studentId}"]`);
            const assignmentMark = markInput ? markInput.value : '';

            fetch(`/api/faculty/assignments/${assignmentId}/submissions/${studentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: status, assignment_mark: assignmentMark })
            })
                .then(r => r.json())
                .then(data => {
                    if (data.status === 'success') {
                        showMessage(submissionStatusMsg, data.message || 'Status updated', 'success');
                        loadSubmissionStatus(assignmentId);
                    } else {
                        showMessage(submissionStatusMsg, data.message || 'Unable to update status', 'error');
                    }
                })
                .catch(() => showMessage(submissionStatusMsg, 'Connection error', 'error'));
        });
    }

    if (feedbackBody) {
        feedbackBody.addEventListener('click', function (e) {
            const btn = e.target.closest('.fac-save-feedback');
            if (!btn) return;
            const id = btn.dataset.id;
            const field = feedbackBody.querySelector(`[data-id="${id}"][data-field="faculty_remarks"]`);
            saveStudent(id, { faculty_remarks: (field?.value || '').trim() }, feedbackMsg, 'Feedback updated');
        });
    }

    if (profileBody) {
        profileBody.addEventListener('click', function (e) {
            const btn = e.target.closest('.fac-view-profile');
            if (!btn) return;
            const id = Number(btn.dataset.id);
            if (!id) return;
            window.location.href = `/faculty/student/${id}`;
        });
    }

    switchView('dashboard');
    loadStudents();
    loadAssignments();
}
