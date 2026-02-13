document.addEventListener('DOMContentLoaded', function () {
    // Initialize Theme
    initTheme();

    // Determine which page we are on and initialize accordingly
    if (document.getElementById('loginForm')) {
        initLogin();
    } else if (document.getElementById('adminForm')) {
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
    const toggleBtns = document.querySelectorAll('.toggle-btn');
    const studentInputs = document.getElementById('studentInputs');
    const adminInputs = document.getElementById('adminInputs');

    // Tab Switching
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all
            toggleBtns.forEach(b => b.classList.remove('active'));
            // Add to clicked
            btn.classList.add('active');

            // Show/Hide inputs
            if (btn.dataset.type === 'student') {
                studentInputs.style.display = 'block';
                adminInputs.style.display = 'none';
                studentInputs.classList.add('active');
                adminInputs.classList.remove('active');
            } else {
                studentInputs.style.display = 'none';
                adminInputs.style.display = 'block';
                adminInputs.classList.add('active');
                studentInputs.classList.remove('active');
            }
        });
    });

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        // Determine active tab to get correct values
        const activeBtn = document.querySelector('.toggle-btn.active');
        const activeType = activeBtn ? activeBtn.dataset.type : 'student';

        let email, password;

        if (activeType === 'student') {
            email = document.getElementById('studentEmail').value;
            password = document.getElementById('studentPassword').value;
        } else {
            email = document.getElementById('adminEmail').value;
            password = document.getElementById('adminPassword').value;
        }

        if (!email || !password) {
            showMessage(messageDiv, 'Please fill in all fields', 'error');
            return;
        }

        messageDiv.textContent = 'Signing in...';
        messageDiv.className = 'message';
        messageDiv.style.display = 'block';

        fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: password })
        })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    // Update theme based on saved preference or default
                    // initTheme(); // already called on load
                    showMessage(messageDiv, 'Login successful! Redirecting...', 'success');
                    setTimeout(() => {
                        window.location.href = data.redirect;
                    }, 1000);
                } else {
                    showMessage(messageDiv, data.message, 'error');
                }
            })
            .catch(err => {
                showMessage(messageDiv, 'Connection error', 'error');
            });
    });
}

// --- Admin Page Logic (Updated) ---
function initAdmin() {
    const form = document.getElementById('adminForm');
    const tableBody = document.querySelector('#studentsTable tbody');
    const messageDiv = document.getElementById('message');
    const saveBtn = document.getElementById('saveBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const studentIdInput = document.getElementById('studentId');
    const formTitle = document.getElementById('formTitle');
    const searchInput = document.getElementById('tableSearch');

    // Navigation and Views
    const navDashboard = document.getElementById('navDashboard');
    const navAddStudent = document.getElementById('navAddStudent');
    const dashboardView = document.getElementById('dashboardView');
    const addStudentView = document.getElementById('addStudentView');

    // Stats Elements
    const totalEl = document.getElementById('totalStudents');
    const highEl = document.getElementById('highStabilityCount');
    const lowEl = document.getElementById('lowStabilityCount');
    const highListEl = document.getElementById('highStabilityList');
    const lowListEl = document.getElementById('lowStabilityList');

    let allStudents = [];

    // Load initial data
    loadStudents();

    // --- Navigation Logic ---
    function switchView(viewName) {
        if (viewName === 'dashboard') {
            if (dashboardView) dashboardView.style.display = 'block';
            if (addStudentView) addStudentView.style.display = 'none';
            if (navDashboard) navDashboard.classList.add('active');
            if (navAddStudent) navAddStudent.classList.remove('active');
            resetFormState(); // Clear form when leaving it
        } else if (viewName === 'addStudent') {
            if (dashboardView) dashboardView.style.display = 'none';
            if (addStudentView) addStudentView.style.display = 'block';
            if (navDashboard) navDashboard.classList.remove('active');
            if (navAddStudent) navAddStudent.classList.add('active');
        }
    }

    if (navDashboard) {
        navDashboard.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('dashboard');
        });
    }

    if (navAddStudent) {
        navAddStudent.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('addStudent');
            resetFormState();
        });
    }

    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();

            const id = studentIdInput.value;
            const payload = {
                name: document.getElementById('name').value,
                roll_no: document.getElementById('rollNo').value,
                tamil: document.getElementById('tamil').value,
                english: document.getElementById('english').value,
                maths: document.getElementById('maths').value,
                science: document.getElementById('science').value,
                social_science: document.getElementById('social').value,
                attendance: document.getElementById('attendance').value,
                assignment: document.getElementById('assignment').value
            };

            let url = '/api/students';
            let method = 'POST';

            if (id) {
                url += '/' + id;
                method = 'PUT';
            }

            fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        showMessage(messageDiv, data.message, 'success');
                        resetFormState();
                        loadStudents(); // Reload to update table and stats

                        // If editing, maybe stay? If adding, maybe go back?
                        // Let's stay on form for "Add another", but user can click dashboard.
                        // Or better, switch back to dashboard to see the new entry.
                        // switchView('dashboard'); 

                        if (id) {
                            // If it was an edit, go back to dashboard
                            switchView('dashboard');
                        }
                    } else {
                        showMessage(messageDiv, data.message, 'error');
                    }
                })
                .catch(err => showMessage(messageDiv, 'Error saving student', 'error'));
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', function () {
            resetFormState();
            switchView('dashboard');
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', function () {
            const term = this.value.toLowerCase();
            const filtered = allStudents.filter(s =>
                s.name.toLowerCase().includes(term) ||
                (s.roll_no && s.roll_no.toLowerCase().includes(term)) ||
                s.id.toString().includes(term)
            );
            renderTable(filtered);
        });
    }

    function resetFormState() {
        if (form) form.reset();
        if (studentIdInput) studentIdInput.value = '';
        if (saveBtn) saveBtn.textContent = 'Save Student';
        // cancelBtn is always visible in this view now
        if (formTitle) formTitle.textContent = 'Add New Student';
    }

    function loadStudents() {
        fetch('/api/students')
            .then(res => res.json())
            .then(data => {
                allStudents = data;
                updateStats(data);
                renderTable(data);
                renderStabilityLists(data);
            });
    }

    function updateStats(data) {
        if (totalEl) totalEl.textContent = data.length;

        const highCount = data.filter(s => s.stability_score >= 80).length;
        const lowCount = data.filter(s => s.stability_score < 50).length;

        if (highEl) highEl.textContent = highCount;
        if (lowEl) lowEl.textContent = lowCount;
    }

    function renderStabilityLists(data) {
        const highStudents = data.filter(s => s.stability_score >= 80);
        const lowStudents = data.filter(s => s.stability_score < 50);

        if (highListEl) {
            highListEl.innerHTML = highStudents.length ? '' : '<li style="color:#9ca3af; justify-content:center;">No high stability students</li>';
            highStudents.forEach(s => {
                highListEl.innerHTML += `
                    <li>
                        <span>${s.name}</span>
                        <span class="text-success font-bold">${s.stability_score}%</span>
                    </li>
                `;
            });
        }

        if (lowListEl) {
            lowListEl.innerHTML = lowStudents.length ? '' : '<li style="color:#9ca3af; justify-content:center;">No low stability students</li>';
            lowStudents.forEach(s => {
                lowListEl.innerHTML += `
                    <li>
                        <span>${s.name}</span>
                        <span class="text-danger font-bold">${s.stability_score}%</span>
                    </li>
                `;
            });
        }
    }

    function renderTable(data) {
        if (!tableBody) return;
        tableBody.innerHTML = '';
        if (data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#888;">No students found</td></tr>';
            return;
        }

        data.forEach(student => {
            let catClass = 'category';
            if (student.stability_score >= 80) catClass += ' high';
            else if (student.stability_score >= 50) catClass += ' moderate';
            else catClass += ' low';

            // Trend Logic
            let trendIcon = '<i class="fas fa-minus" style="color:gray;"></i>';
            let trendClass = 'text-muted';
            const diff = student.trend_diff || 0;
            const rec = student.recommendation || "No data yet";

            if (diff > 0) {
                trendIcon = '<i class="fas fa-arrow-up" style="color:green;"></i>';
                trendClass = 'text-success';
            } else if (diff < 0) {
                trendIcon = '<i class="fas fa-arrow-down" style="color:red;"></i>';
                trendClass = 'text-danger';
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>#${student.id}</td>
                <td>${student.roll_no || '-'}</td>
                <td><strong>${student.name || 'Unknown'}</strong></td>
                <td>${student.stability_score}%</td>
                <td>
                    <span class="${trendClass}" title="${rec}">
                        ${trendIcon} ${diff}%
                    </span>
                </td>
                <td><span class="${catClass}">${student.category}</span></td>
                <td>
                    <button class="action-btn edit-btn" onclick="editStudent(${student.id})" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete-btn" onclick="deleteStudent(${student.id})" title="Delete"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    // Expose to global scope for onclick handlers
    window.editStudent = function (id) {
        const student = allStudents.find(s => s.id === id);
        if (student) {
            // Switch to form view
            switchView('addStudent');

            if (studentIdInput) studentIdInput.value = student.id;
            document.getElementById('name').value = student.name || '';
            document.getElementById('rollNo').value = student.roll_no || '';

            document.getElementById('tamil').value = student.tamil || 0;
            document.getElementById('english').value = student.english || 0;
            document.getElementById('maths').value = student.maths || 0;
            document.getElementById('science').value = student.science || 0;
            document.getElementById('social').value = student.social_science || 0;

            document.getElementById('attendance').value = student.attendance;
            document.getElementById('assignment').value = student.assignment;

            if (saveBtn) saveBtn.textContent = 'Update Student';
            if (formTitle) formTitle.textContent = 'Edit Student';
        }
    };

    window.deleteStudent = function (id) {
        if (confirm('Are you sure you want to delete this student?')) {
            fetch('/api/students/' + id, { method: 'DELETE' })
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        loadStudents(); // Reloads list and stats
                        showMessage(messageDiv, 'Student deleted successfully', 'success');
                    }
                });
        }
    };
}

// --- Student Page Logic ---
function initStudent() {
    // const searchIdInput = document.getElementById('studentSearchId'); // Hidden input
    const messageDiv = document.getElementById('studentMessage');
    const nameInput = document.getElementById('studentNameSearch');
    const suggestionsBox = document.getElementById('nameSuggestions');
    const resultsArea = document.getElementById('resultsArea');
    const welcomeState = document.getElementById('welcomeState');
    const headerSearch = document.querySelector('.header-search');

    let allStudents = [];

    // Check if we have user context (for strict view)
    const currentUser = window.currentUser || {};

    // Load student data based on role
    fetch('/api/students')
        .then(res => res.json())
        .then(data => {
            allStudents = data;

            // If Student Role: Auto-load their data and hide search
            if (currentUser.type === 'student') {
                if (headerSearch) headerSearch.style.display = 'none'; // Hide search bar
                if (data.length > 0) {
                    // The API already filters for this user, so data[0] is the user
                    loadStudentData(data[0].id);
                } else {
                    showMessage(messageDiv, 'No data found for this user.', 'error');
                }
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

    function loadStudentData(id) {
        // Updated search logic to find correctly
        // Since we might have restricted list, we search in allStudents loaded
        const student = allStudents.find(s => s.id == id);

        if (student) {
            // Hide welcome, show results
            if (welcomeState) welcomeState.style.display = 'none';
            if (resultsArea) {
                resultsArea.style.display = 'block';
                resultsArea.classList.add('fade-in');
            }

            document.getElementById('studentNameDisplay').textContent = student.name || 'Student';
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

            updateChart(student.test_score, student.attendance, student.assignment);

            // --- NEW: Comparison Section Logic ---
            const compSection = document.getElementById('comparisonSection');
            if (compSection) {
                compSection.style.display = 'block';

                // Populate Metrics
                document.getElementById('prevStability').textContent = (student.previous_stability_score || 0) + '%';
                document.getElementById('currStability').textContent = (student.stability_score || 0) + '%';

                document.getElementById('prevTest').textContent = (student.prev_test_score || 0) + '%';
                document.getElementById('currTest').textContent = (student.test_score || 0) + '%';

                document.getElementById('prevAssignment').textContent = (student.prev_assignment || 0) + '%';
                document.getElementById('currAssignment').textContent = (student.assignment || 0) + '%';

                // Render Chart
                renderComparisonChart(student);
            }

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
        setTimeout(() => {
            subjects.forEach((sub, index) => {
                const score = sub.score || 0;
                const item = document.createElement('div');
                item.className = 'subject-card';
                // Add unique color variable for CSS
                item.style.setProperty('--card-color', sub.color);
                item.style.animation = `fadeInUp 0.5s ease-out ${index * 0.1}s backwards`;

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

                // Trigger animation after render
                setTimeout(() => {
                    const fill = item.querySelector('.progress-fill');
                    if (fill) fill.style.width = `${score}%`;
                }, 100);
            });
        }, 50);

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

        // Prepare data
        const payload = {
            test_score: testScore,
            attendance: attendance,
            assignment: assignment
        };

        // Send to backend (using original endpoint or handling locally if endpoint removed)
        // Original endpoint /evaluate was removed in new app.py, so we calculate locally or mock it.
        // Wait, I replaced app.py content, so /evaluate is GONE.
        // I should probably restore /evaluate OR just do client-side calc for demo.
        // Let's do client-side calc for the index page to avoid 404s since I removed the route.

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
