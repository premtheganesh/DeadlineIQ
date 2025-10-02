// ========================================
// Assignment Deadline Dashboard - App Logic
// ========================================

// ========================================
// Data Structure & State Management
// ========================================

let assignments = [];

// Assignment object structure:
// {
//   id: unique timestamp,
//   name: string,
//   className: string,
//   dueDate: ISO datetime string,
//   gradeWeight: number (0-100),
//   estimatedHours: number,
//   currentGrade: number (0-100),
//   priorityScore: number (calculated),
//   priorityLevel: 'critical' | 'high' | 'medium' | 'low',
//   status: 'not_started' | 'in_progress' | 'completed',
//   completedAt: timestamp (when marked complete),
//   progress: number (0-100, percentage of completion for in-progress items),
//   notes: string (optional notes/comments for the assignment)
// }

let showCompleted = true;
let currentView = localStorage.getItem('currentView') || 'priority'; // 'priority' | 'timeline' | 'calendar' | 'class' | 'week'
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let searchQuery = '';
let priorityFilter = 'all';

// ========================================
// LocalStorage Functions
// ========================================

function loadAssignments() {
    const stored = localStorage.getItem('deadlineiq_assignments');
    if (stored) {
        assignments = JSON.parse(stored);
        // Recalculate priorities (in case algorithm changed)
        assignments = assignments.map(a => ({
            ...a,
            ...calculatePriority(a)
        }));
    }
}

function saveAssignments() {
    localStorage.setItem('deadlineiq_assignments', JSON.stringify(assignments));
}

// ========================================
// Smart Priority Algorithm
// ========================================

function calculatePriority(assignment) {
    const now = new Date();
    const dueDate = new Date(assignment.dueDate);
    const hoursUntilDue = (dueDate - now) / (1000 * 60 * 60);
    const daysUntilDue = hoursUntilDue / 24;

    // 1. Urgency Score (40% weight)
    // Exponential decay - the closer the deadline, the higher the score
    let urgencyScore = 0;
    if (hoursUntilDue < 0) {
        urgencyScore = 100; // Overdue
    } else if (hoursUntilDue < 24) {
        urgencyScore = 100; // Due within 24 hours
    } else if (hoursUntilDue < 48) {
        urgencyScore = 90; // Due within 2 days
    } else if (daysUntilDue < 3) {
        urgencyScore = 80;
    } else if (daysUntilDue < 5) {
        urgencyScore = 60;
    } else if (daysUntilDue < 7) {
        urgencyScore = 40;
    } else if (daysUntilDue < 14) {
        urgencyScore = 20;
    } else {
        urgencyScore = 10;
    }

    // 2. Importance Score (30% weight)
    // Direct mapping of grade weight
    const importanceScore = assignment.gradeWeight;

    // 3. Feasibility Score (20% weight)
    // Check if there's enough time to complete
    const timeAvailable = hoursUntilDue;
    const timeNeeded = assignment.estimatedHours;
    let feasibilityScore = 0;

    if (timeAvailable < timeNeeded) {
        feasibilityScore = 100; // Not enough time - CRITICAL
    } else if (timeAvailable < timeNeeded * 2) {
        feasibilityScore = 80; // Tight deadline
    } else if (timeAvailable < timeNeeded * 3) {
        feasibilityScore = 60;
    } else if (timeAvailable < timeNeeded * 5) {
        feasibilityScore = 40;
    } else {
        feasibilityScore = 20; // Plenty of time
    }

    // 4. Risk Score (10% weight)
    // Lower current grade = higher risk
    const riskScore = 100 - assignment.currentGrade;

    // Calculate weighted total
    const priorityScore =
        (urgencyScore * 0.40) +
        (importanceScore * 0.30) +
        (feasibilityScore * 0.20) +
        (riskScore * 0.10);

    // Determine priority level
    let priorityLevel = 'low';
    if (priorityScore >= 75) {
        priorityLevel = 'critical';
    } else if (priorityScore >= 55) {
        priorityLevel = 'high';
    } else if (priorityScore >= 35) {
        priorityLevel = 'medium';
    }

    return {
        priorityScore: Math.round(priorityScore),
        priorityLevel,
        hoursUntilDue,
        daysUntilDue
    };
}

// ========================================
// UI Rendering Functions
// ========================================

function switchView(view) {
    currentView = view;
    localStorage.setItem('currentView', view);

    // Update active button
    document.querySelectorAll('.view-btn[data-view]').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.view-btn[data-view="${view}"]`).classList.add('active');

    // Update title
    const titles = {
        priority: 'Prioritized Assignments',
        timeline: 'Timeline View',
        calendar: 'Monthly Calendar',
        class: 'Assignments by Class',
        week: 'This Week\'s Assignments'
    };
    document.getElementById('viewTitle').textContent = titles[view];

    renderAssignments();
}

function renderAssignments() {
    const grid = document.getElementById('assignmentsGrid');
    const emptyState = document.getElementById('emptyState');

    if (assignments.length === 0) {
        grid.classList.add('hidden');
        emptyState.classList.remove('hidden');
        updateStats();
        return;
    }

    emptyState.classList.add('hidden');
    grid.classList.remove('hidden');

    // Render based on current view
    switch(currentView) {
        case 'priority':
            renderPriorityView(grid);
            break;
        case 'timeline':
            renderTimelineView(grid);
            break;
        case 'calendar':
            renderMonthlyCalendarView(grid);
            break;
        case 'class':
            renderClassView(grid);
            break;
        case 'week':
            renderWeekView(grid);
            break;
        default:
            renderPriorityView(grid);
    }

    updateStats();
    generateRecommendations();
    generateTimeBlocks();
    reInit3DTilt();
}

function renderPriorityView(grid) {

    // Filter assignments based on showCompleted flag
    let filteredAssignments = showCompleted
        ? assignments
        : assignments.filter(a => a.status !== 'completed');

    // Apply search and filter
    filteredAssignments = applySearchAndFilter(filteredAssignments);

    // Sort: completed to bottom, then by priority score
    const sortedAssignments = [...filteredAssignments].sort((a, b) => {
        // Completed always go to bottom
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;
        // Otherwise sort by priority
        return b.priorityScore - a.priorityScore;
    });

    grid.innerHTML = sortedAssignments.map(assignment => {
        const priorityInfo = getPriorityDisplay(assignment);
        const timeInfo = getTimeDisplay(assignment);
        const status = assignment.status || 'not_started';
        const statusInfo = getStatusDisplay(status);

        return `
            <div class="assignment-card priority-${assignment.priorityLevel} status-${status}" data-id="${assignment.id}">
                <div class="card-header">
                    <span class="priority-badge ${assignment.priorityLevel}">
                        ${priorityInfo.icon} ${priorityInfo.text} - ${timeInfo.text}
                    </span>
                    <div class="card-actions">
                        <select class="status-dropdown" onchange="changeStatus(${assignment.id}, this.value)" title="Change status">
                            <option value="not_started" ${status === 'not_started' ? 'selected' : ''}>⭕ Not Started</option>
                            <option value="in_progress" ${status === 'in_progress' ? 'selected' : ''}>⏳ In Progress</option>
                            <option value="completed" ${status === 'completed' ? 'selected' : ''}>✅ Completed</option>
                        </select>
                        <button class="icon-btn edit" onclick="editAssignment(${assignment.id})" title="Edit">
                            ✏️
                        </button>
                        <button class="icon-btn delete" onclick="deleteAssignment(${assignment.id})" title="Delete">
                            🗑️
                        </button>
                    </div>
                </div>
                <div class="card-content">
                    <h3>${assignment.name}</h3>
                    <div class="card-meta">
                        <div class="meta-item">
                            <span class="meta-icon">📚</span>
                            <span>${assignment.className}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-icon">📊</span>
                            <span>${assignment.gradeWeight}% of grade</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-icon">⏱️</span>
                            <span>Est. ${assignment.estimatedHours}h</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-icon">📈</span>
                            <span>Current grade: ${assignment.currentGrade}%</span>
                        </div>
                    </div>
                    ${status === 'in_progress' ? `
                        <div class="progress-section">
                            <div class="progress-header">
                                <span class="progress-label">Progress</span>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value="${assignment.progress || 0}"
                                    class="progress-input"
                                    onchange="updateProgress(${assignment.id}, parseInt(this.value))"
                                    placeholder="0"
                                >
                            </div>
                            <div class="progress-bar-container">
                                <div class="progress-bar-track">
                                    <div class="progress-bar-filled" style="width: ${assignment.progress || 0}%"></div>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    ${assignment.notes ? `
                        <div class="notes-section">
                            <div class="notes-label">📝 Notes</div>
                            <div class="notes-content">${assignment.notes}</div>
                        </div>
                    ` : ''}
                </div>
                <div class="card-footer">
                    <div class="time-remaining ${timeInfo.isUrgent ? 'urgent' : ''}">
                        ⏰ Due: ${formatDateTime(assignment.dueDate)}
                    </div>
                    <div class="priority-score">
                        ${status === 'completed' ? '✅ Completed' : `Priority Score: ${assignment.priorityScore}/100`}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderTimelineView(grid) {
    // Filter assignments based on showCompleted flag
    let filteredAssignments = showCompleted
        ? assignments
        : assignments.filter(a => a.status !== 'completed');

    // Apply search and filter
    filteredAssignments = applySearchAndFilter(filteredAssignments);

    // Group by date
    const groupedByDate = {};
    filteredAssignments.forEach(assignment => {
        const dueDate = new Date(assignment.dueDate);
        const dateKey = dueDate.toDateString();

        if (!groupedByDate[dateKey]) {
            groupedByDate[dateKey] = [];
        }
        groupedByDate[dateKey].push(assignment);
    });

    // Sort dates
    const sortedDates = Object.keys(groupedByDate).sort((a, b) => {
        return new Date(a) - new Date(b);
    });

    grid.innerHTML = sortedDates.map(dateKey => {
        const assignmentsForDate = groupedByDate[dateKey].sort((a, b) => b.priorityScore - a.priorityScore);
        const date = new Date(dateKey);
        const isToday = date.toDateString() === new Date().toDateString();
        const isTomorrow = date.toDateString() === new Date(Date.now() + 86400000).toDateString();

        let dateLabel = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        if (isToday) dateLabel = '🔥 Today - ' + dateLabel;
        else if (isTomorrow) dateLabel = '⚡ Tomorrow - ' + dateLabel;

        return `
            <div class="calendar-group">
                <h3 class="calendar-date-header">${dateLabel}</h3>
                <div class="calendar-assignments">
                    ${assignmentsForDate.map(assignment => renderAssignmentCard(assignment)).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function renderMonthlyCalendarView(grid) {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    // Get calendar data
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startingDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    // Get assignments for this month
    const monthAssignments = assignments.filter(a => {
        const dueDate = new Date(a.dueDate);
        return dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear;
    });

    // Group assignments by day
    const assignmentsByDay = {};
    monthAssignments.forEach(assignment => {
        const day = new Date(assignment.dueDate).getDate();
        if (!assignmentsByDay[day]) {
            assignmentsByDay[day] = [];
        }
        assignmentsByDay[day].push(assignment);
    });

    grid.innerHTML = `
        <div class="monthly-calendar">
            <div class="calendar-header">
                <button class="month-nav-btn" onclick="changeMonth(-1)">‹</button>
                <h2 class="month-title">${monthNames[currentMonth]} ${currentYear}</h2>
                <button class="month-nav-btn" onclick="changeMonth(1)">›</button>
            </div>
            <div class="calendar-grid">
                <div class="calendar-day-label">Sun</div>
                <div class="calendar-day-label">Mon</div>
                <div class="calendar-day-label">Tue</div>
                <div class="calendar-day-label">Wed</div>
                <div class="calendar-day-label">Thu</div>
                <div class="calendar-day-label">Fri</div>
                <div class="calendar-day-label">Sat</div>
                ${renderCalendarDays(startingDayOfWeek, daysInMonth, assignmentsByDay)}
            </div>
        </div>
    `;
}

function renderCalendarDays(startingDay, daysInMonth, assignmentsByDay) {
    let days = '';

    // Empty cells before first day
    for (let i = 0; i < startingDay; i++) {
        days += '<div class="calendar-day empty"></div>';
    }

    // Days of the month
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
        const dayAssignments = assignmentsByDay[day] || [];
        const isToday = day === today.getDate() &&
                        currentMonth === today.getMonth() &&
                        currentYear === today.getFullYear();

        const criticalCount = dayAssignments.filter(a => a.priorityLevel === 'critical' && a.status !== 'completed').length;
        const highCount = dayAssignments.filter(a => a.priorityLevel === 'high' && a.status !== 'completed').length;
        const completedCount = dayAssignments.filter(a => a.status === 'completed').length;
        const totalCount = dayAssignments.length;

        days += `
            <div class="calendar-day ${isToday ? 'today' : ''} ${totalCount > 0 ? 'has-assignments' : ''}"
                 onclick="showDayAssignments(${day}, '${currentMonth}', ${currentYear})">
                <div class="day-number">${day}</div>
                ${totalCount > 0 ? `
                    <div class="day-indicators">
                        ${criticalCount > 0 ? `<span class="indicator critical" title="${criticalCount} critical">🔴 ${criticalCount}</span>` : ''}
                        ${highCount > 0 ? `<span class="indicator high" title="${highCount} high">🟠 ${highCount}</span>` : ''}
                        ${completedCount > 0 && completedCount === totalCount ? `<span class="indicator completed">✅</span>` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }

    return days;
}

function changeMonth(direction) {
    currentMonth += direction;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    } else if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    renderAssignments();
}

function showDayAssignments(day, month, year) {
    const dateAssignments = assignments.filter(a => {
        const dueDate = new Date(a.dueDate);
        return dueDate.getDate() === day &&
               dueDate.getMonth() === parseInt(month) &&
               dueDate.getFullYear() === year;
    });

    if (dateAssignments.length === 0) return;

    // Create modal to show assignments for this day
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const dateStr = `${monthNames[month]} ${day}, ${year}`;

    const modalHTML = `
        <div class="day-modal-overlay" onclick="this.remove()">
            <div class="day-modal" onclick="event.stopPropagation()">
                <div class="day-modal-header">
                    <h3>📅 ${dateStr}</h3>
                    <button class="modal-close" onclick="this.closest('.day-modal-overlay').remove()">&times;</button>
                </div>
                <div class="day-modal-content">
                    ${dateAssignments.sort((a, b) => b.priorityScore - a.priorityScore).map(a => renderAssignmentCard(a)).join('')}
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function renderClassView(grid) {
    // Filter assignments based on showCompleted flag
    let filteredAssignments = showCompleted
        ? assignments
        : assignments.filter(a => a.status !== 'completed');

    // Apply search and filter
    filteredAssignments = applySearchAndFilter(filteredAssignments);

    // Group by class
    const groupedByClass = {};
    filteredAssignments.forEach(assignment => {
        const className = assignment.className;
        if (!groupedByClass[className]) {
            groupedByClass[className] = [];
        }
        groupedByClass[className].push(assignment);
    });

    // Sort classes alphabetically
    const sortedClasses = Object.keys(groupedByClass).sort();

    grid.innerHTML = sortedClasses.map(className => {
        const assignmentsForClass = groupedByClass[className].sort((a, b) => b.priorityScore - a.priorityScore);
        const criticalCount = assignmentsForClass.filter(a => a.priorityLevel === 'critical').length;

        return `
            <div class="class-group">
                <h3 class="class-header">
                    <span class="class-name">📚 ${className}</span>
                    <span class="class-count">${assignmentsForClass.length} assignment${assignmentsForClass.length !== 1 ? 's' : ''}${criticalCount > 0 ? ` · ${criticalCount} critical` : ''}</span>
                </h3>
                <div class="class-assignments">
                    ${assignmentsForClass.map(assignment => renderAssignmentCard(assignment)).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function renderWeekView(grid) {
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Filter by this week AND completed visibility
    let filteredAssignments = assignments.filter(a => {
        const dueDate = new Date(a.dueDate);
        const isThisWeek = dueDate <= weekFromNow;
        const shouldShow = showCompleted || a.status !== 'completed';
        return isThisWeek && shouldShow;
    });

    // Apply search and filter
    filteredAssignments = applySearchAndFilter(filteredAssignments);

    if (filteredAssignments.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎉</div>
                <h3>No assignments due this week!</h3>
                <p>Enjoy your free time or get ahead on future work.</p>
            </div>
        `;
        return;
    }

    // Sort by priority
    const sortedAssignments = filteredAssignments.sort((a, b) => {
        // Completed to bottom
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;
        return b.priorityScore - a.priorityScore;
    });

    grid.innerHTML = `
        <div class="week-view">
            <div class="week-summary">
                <span class="week-count">📅 ${filteredAssignments.length} assignment${filteredAssignments.length !== 1 ? 's' : ''} due in the next 7 days</span>
            </div>
            ${sortedAssignments.map(assignment => renderAssignmentCard(assignment)).join('')}
        </div>
    `;
}

function renderAssignmentCard(assignment) {
    const priorityInfo = getPriorityDisplay(assignment);
    const timeInfo = getTimeDisplay(assignment);
    const status = assignment.status || 'not_started';

    return `
        <div class="assignment-card priority-${assignment.priorityLevel} status-${status}" data-id="${assignment.id}">
            <div class="card-header">
                <span class="priority-badge ${assignment.priorityLevel}">
                    ${priorityInfo.icon} ${priorityInfo.text} - ${timeInfo.text}
                </span>
                <div class="card-actions">
                    <select class="status-dropdown" onchange="changeStatus(${assignment.id}, this.value)" title="Change status">
                        <option value="not_started" ${status === 'not_started' ? 'selected' : ''}>⭕ Not Started</option>
                        <option value="in_progress" ${status === 'in_progress' ? 'selected' : ''}>⏳ In Progress</option>
                        <option value="completed" ${status === 'completed' ? 'selected' : ''}>✅ Completed</option>
                    </select>
                    <button class="icon-btn edit" onclick="editAssignment(${assignment.id})" title="Edit">
                        ✏️
                    </button>
                    <button class="icon-btn delete" onclick="deleteAssignment(${assignment.id})" title="Delete">
                        🗑️
                    </button>
                </div>
            </div>
            <div class="card-content">
                <h3>${assignment.name}</h3>
                <div class="card-meta">
                    <div class="meta-item">
                        <span class="meta-icon">📚</span>
                        <span>${assignment.className}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-icon">📊</span>
                        <span>${assignment.gradeWeight}% of grade</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-icon">⏱️</span>
                        <span>Est. ${assignment.estimatedHours}h</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-icon">📈</span>
                        <span>Current grade: ${assignment.currentGrade}%</span>
                    </div>
                </div>
                ${status === 'in_progress' ? `
                    <div class="progress-section">
                        <div class="progress-header">
                            <span class="progress-label">Progress</span>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value="${assignment.progress || 0}"
                                class="progress-input"
                                onchange="updateProgress(${assignment.id}, parseInt(this.value))"
                                placeholder="0"
                            >
                        </div>
                        <div class="progress-bar-container">
                            <div class="progress-bar-track">
                                <div class="progress-bar-filled" style="width: ${assignment.progress || 0}%"></div>
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
            <div class="card-footer">
                <div class="time-remaining ${timeInfo.isUrgent ? 'urgent' : ''}">
                    ⏰ Due: ${formatDateTime(assignment.dueDate)}
                </div>
                <div class="priority-score">
                    ${status === 'completed' ? '✅ Completed' : `Priority Score: ${assignment.priorityScore}/100`}
                </div>
            </div>
        </div>
    `;
}

function getPriorityDisplay(assignment) {
    const displays = {
        critical: { icon: '🔴', text: 'CRITICAL' },
        high: { icon: '🟠', text: 'HIGH' },
        medium: { icon: '🟡', text: 'MEDIUM' },
        low: { icon: '🟢', text: 'LOW' }
    };
    return displays[assignment.priorityLevel];
}

function getStatusDisplay(status) {
    const displays = {
        not_started: { icon: '⭕', text: 'Not Started', class: 'not-started' },
        in_progress: { icon: '⏳', text: 'In Progress', class: 'in-progress' },
        completed: { icon: '✅', text: 'Completed', class: 'completed' }
    };
    return displays[status] || displays.not_started;
}

function getTimeDisplay(assignment) {
    const hours = assignment.hoursUntilDue;
    const days = assignment.daysUntilDue;

    if (hours < 0) {
        return { text: 'OVERDUE', isUrgent: true };
    } else if (hours < 24) {
        return { text: `Due in ${Math.round(hours)} hours`, isUrgent: true };
    } else if (days < 2) {
        return { text: 'Due tomorrow', isUrgent: true };
    } else if (days < 7) {
        return { text: `Due in ${Math.round(days)} days`, isUrgent: false };
    } else {
        return { text: `Due in ${Math.round(days)} days`, isUrgent: false };
    }
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    const options = {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    };
    return date.toLocaleDateString('en-US', options);
}

function updateStats() {
    const critical = assignments.filter(a => a.priorityLevel === 'critical' && a.status !== 'completed').length;
    const high = assignments.filter(a => a.priorityLevel === 'high' && a.status !== 'completed').length;

    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const dueThisWeek = assignments.filter(a => {
        const dueDate = new Date(a.dueDate);
        return dueDate <= weekFromNow && a.status !== 'completed';
    }).length;

    const completed = assignments.filter(a => a.status === 'completed').length;

    // Calculate weighted completion percentage (includes partial progress)
    const totalProgress = assignments.reduce((sum, a) => {
        if (a.status === 'completed') return sum + 100;
        if (a.status === 'in_progress') return sum + (a.progress || 0);
        return sum;
    }, 0);

    const completionPercentage = assignments.length > 0
        ? Math.round(totalProgress / assignments.length)
        : 0;

    document.getElementById('criticalCount').textContent = critical;
    document.getElementById('highCount').textContent = high;
    document.getElementById('weekCount').textContent = dueThisWeek;
    document.getElementById('totalCount').textContent = assignments.length;

    // Update progress bar if it exists
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    if (progressBar && progressText) {
        progressBar.style.width = completionPercentage + '%';

        // Show different text based on whether we have in-progress items
        const inProgress = assignments.filter(a => a.status === 'in_progress').length;
        if (inProgress > 0) {
            progressText.textContent = `${completed} completed, ${inProgress} in progress (${completionPercentage}% overall)`;
        } else {
            progressText.textContent = `${completed}/${assignments.length} completed (${completionPercentage}%)`;
        }
    }
}

// ========================================
// Assignment Management Functions
// ========================================

let editingAssignmentId = null;

function addAssignment(assignmentData) {
    const assignment = {
        id: Date.now(),
        status: 'not_started',
        completedAt: null,
        progress: 0,
        ...assignmentData,
        ...calculatePriority(assignmentData)
    };

    assignments.push(assignment);
    saveAssignments();
    renderAssignments();

    // Show success feedback
    showNotification('✅ Assignment added successfully!');
}

function editAssignment(id) {
    const assignment = assignments.find(a => a.id === id);
    if (!assignment) return;

    editingAssignmentId = id;

    // Update modal title
    document.getElementById('modalTitle').textContent = 'Edit Assignment';

    // Pre-fill form with assignment data
    document.getElementById('assignmentName').value = assignment.name;
    document.getElementById('className').value = assignment.className;

    // Split datetime into date and time
    const dueDate = new Date(assignment.dueDate);
    const dateString = dueDate.toISOString().split('T')[0];
    const timeString = dueDate.toTimeString().slice(0, 5);

    document.getElementById('dueDate').value = dateString;
    document.getElementById('dueTime').value = timeString;
    document.getElementById('estimatedHours').value = assignment.estimatedHours;

    // Set slider and number input values
    document.getElementById('gradeWeight').value = assignment.gradeWeight;
    document.getElementById('gradeWeightNumber').value = assignment.gradeWeight;
    document.getElementById('currentGrade').value = assignment.currentGrade;
    document.getElementById('currentGradeNumber').value = assignment.currentGrade;

    // Set notes
    document.getElementById('notes').value = assignment.notes || '';

    openModal();
}

function updateAssignment(id, assignmentData) {
    const index = assignments.findIndex(a => a.id === id);
    if (index === -1) return;

    const oldAssignment = assignments[index];

    assignments[index] = {
        id,
        status: oldAssignment.status || 'not_started',
        completedAt: oldAssignment.completedAt || null,
        progress: oldAssignment.progress || 0,
        ...assignmentData,
        ...calculatePriority(assignmentData)
    };

    saveAssignments();
    renderAssignments();
    showNotification('✅ Assignment updated successfully!');
}

function changeStatus(id, newStatus) {
    const index = assignments.findIndex(a => a.id === id);
    if (index === -1) return;

    assignments[index].status = newStatus;
    assignments[index].completedAt = newStatus === 'completed' ? Date.now() : null;

    // Set progress based on status
    if (newStatus === 'completed') {
        assignments[index].progress = 100;
    } else if (newStatus === 'in_progress' && assignments[index].progress === 0) {
        // Auto-set to 25% when switching to in-progress from not-started
        assignments[index].progress = 25;
    } else if (newStatus === 'not_started') {
        assignments[index].progress = 0;
    }

    saveAssignments();
    renderAssignments();

    // Show celebration if completed
    if (newStatus === 'completed') {
        showCelebration();
        showNotification('🎉 Assignment completed! Great work!');
        trackCompletion(); // Track for productivity chart
    }
}

function updateProgress(id, progress) {
    const index = assignments.findIndex(a => a.id === id);
    if (index === -1) return;

    assignments[index].progress = Math.max(0, Math.min(100, progress));

    // Auto-update status based on progress
    if (progress === 100) {
        assignments[index].status = 'completed';
        assignments[index].completedAt = Date.now();
        showCelebration();
        showNotification('🎉 Assignment completed! Great work!');
        trackCompletion(); // Track for productivity chart
    } else if (progress > 0 && assignments[index].status === 'not_started') {
        assignments[index].status = 'in_progress';
    }

    saveAssignments();
    renderAssignments();
}

function deleteAssignment(id) {
    if (confirm('Are you sure you want to delete this assignment?')) {
        assignments = assignments.filter(a => a.id !== id);
        saveAssignments();
        renderAssignments();
        showNotification('🗑️ Assignment deleted');
    }
}

function showNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: var(--bg-primary);
        border: 2px solid var(--accent-pink);
        border-radius: 0.75rem;
        padding: 1rem 1.5rem;
        box-shadow: var(--shadow-lg);
        z-index: 3000;
        animation: slideInRight 0.3s ease-out;
        font-weight: 600;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// ========================================
// Celebration Sound Effects
// ========================================

function playCelebrationSound() {
    // Create AudioContext for sound generation
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const audioContext = new AudioContext();
    const now = audioContext.currentTime;

    // Create a cheerful ascending arpeggio
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

    notes.forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';

        const startTime = now + (index * 0.1);
        const duration = 0.15;

        gainNode.gain.setValueAtTime(0.3, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
    });
}

function showCelebration() {
    // Play celebration sound
    playCelebrationSound();

    // Create confetti container
    const confettiContainer = document.createElement('div');
    confettiContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 9999;
        overflow: hidden;
    `;
    document.body.appendChild(confettiContainer);

    // Create confetti pieces
    const colors = ['#ec4899', '#f43f5e', '#ef4444', '#fda4af', '#fecdd3', '#fb7185', '#f43f5e'];
    const confettiCount = 80; // Increased for more celebration

    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        const color = colors[Math.floor(Math.random() * colors.length)];
        const left = Math.random() * 100;
        const animationDuration = 2 + Math.random() * 3;
        const size = 5 + Math.random() * 10;

        confetti.style.cssText = `
            position: absolute;
            left: ${left}%;
            top: -10px;
            width: ${size}px;
            height: ${size}px;
            background: ${color};
            border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
            animation: confettiFall ${animationDuration}s ease-out forwards;
            transform: rotate(${Math.random() * 360}deg);
        `;
        confettiContainer.appendChild(confetti);
    }

    // Remove after animation
    setTimeout(() => {
        confettiContainer.remove();
    }, 5000);
}

function toggleCompletedVisibility() {
    showCompleted = !showCompleted;
    const toggleBtn = document.getElementById('toggleCompletedBtn');
    if (toggleBtn) {
        toggleBtn.textContent = showCompleted ? '👁️ Hide Completed' : '👁️ Show Completed';
    }
    renderAssignments();
}

// ========================================
// Modal Management
// ========================================

const modal = document.getElementById('modalOverlay');
const addBtn = document.getElementById('addAssignmentBtn');
const closeBtn = document.getElementById('modalClose');
const cancelBtn = document.getElementById('cancelBtn');
const form = document.getElementById('assignmentForm');

function openModal() {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Only set defaults if not editing
    if (!editingAssignmentId) {
        // Set default due date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateString = tomorrow.toISOString().split('T')[0];
        document.getElementById('dueDate').value = dateString;
        document.getElementById('dueTime').value = '23:59';
    }
}

function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
    form.reset();
    editingAssignmentId = null;
    document.getElementById('modalTitle').textContent = 'Add New Assignment';

    // Reset slider values to defaults
    document.getElementById('gradeWeight').value = 20;
    document.getElementById('gradeWeightNumber').value = 20;
    document.getElementById('currentGrade').value = 85;
    document.getElementById('currentGradeNumber').value = 85;
}

addBtn.addEventListener('click', () => {
    editingAssignmentId = null;
    openModal();
});
closeBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);

// Close modal on overlay click
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        closeModal();
    }
});

// Close modal on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeModal();
    }
});

// ========================================
// Form Handling
// ========================================

// Sync slider and number input values
const gradeWeightSlider = document.getElementById('gradeWeight');
const gradeWeightNumber = document.getElementById('gradeWeightNumber');
const currentGradeSlider = document.getElementById('currentGrade');
const currentGradeNumber = document.getElementById('currentGradeNumber');

// Grade Weight sync
gradeWeightSlider.addEventListener('input', (e) => {
    gradeWeightNumber.value = e.target.value;
});

gradeWeightNumber.addEventListener('input', (e) => {
    let value = parseInt(e.target.value) || 0;
    value = Math.max(0, Math.min(100, value)); // Clamp between 0-100
    gradeWeightSlider.value = value;
    gradeWeightNumber.value = value;
});

// Current Grade sync
currentGradeSlider.addEventListener('input', (e) => {
    currentGradeNumber.value = e.target.value;
});

currentGradeNumber.addEventListener('input', (e) => {
    let value = parseInt(e.target.value) || 0;
    value = Math.max(0, Math.min(100, value)); // Clamp between 0-100
    currentGradeSlider.value = value;
    currentGradeNumber.value = value;
});

// Time preset buttons
const timePresetButtons = document.querySelectorAll('.time-preset-btn');
const dueTimeInput = document.getElementById('dueTime');

timePresetButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const time = e.target.dataset.time;
        dueTimeInput.value = time;

        // Visual feedback
        timePresetButtons.forEach(b => b.style.background = '');
        e.target.style.background = 'var(--gradient-primary)';
        e.target.style.color = 'white';
        e.target.style.borderColor = 'transparent';

        setTimeout(() => {
            e.target.style.background = '';
            e.target.style.color = '';
            e.target.style.borderColor = '';
        }, 300);
    });
});

// Form submission
form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Combine date and time into ISO string
    const date = document.getElementById('dueDate').value;
    const time = document.getElementById('dueTime').value;
    const dueDateTime = new Date(`${date}T${time}`).toISOString();

    const formData = {
        name: document.getElementById('assignmentName').value,
        className: document.getElementById('className').value,
        dueDate: dueDateTime,
        gradeWeight: parseInt(gradeWeightSlider.value),
        estimatedHours: parseFloat(document.getElementById('estimatedHours').value),
        currentGrade: parseInt(currentGradeSlider.value),
        notes: document.getElementById('notes').value.trim()
    };

    if (editingAssignmentId) {
        updateAssignment(editingAssignmentId, formData);
    } else {
        addAssignment(formData);
    }

    closeModal();
});

// ========================================
// Animation Styles
// ========================================

const animationStyles = document.createElement('style');
animationStyles.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }

    @keyframes confettiFall {
        0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
        }
        100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
        }
    }
`;
document.head.appendChild(animationStyles);

// ========================================
// Search and Filter
// ========================================

function handleSearch(query) {
    searchQuery = query.toLowerCase().trim();
    updateFilterTags();
    renderAssignments();
}

function handleFilter(priority) {
    priorityFilter = priority;
    updateFilterTags();
    updateStatCardHighlight();
    renderAssignments();
}

function filterByStatCard(priority) {
    // Update the filter dropdown to match
    const filterSelect = document.getElementById('filterSelect');
    if (filterSelect) {
        filterSelect.value = priority;
    }

    // Apply the filter
    handleFilter(priority);

    // Scroll to assignments section
    const assignmentsSection = document.querySelector('.assignments-section');
    if (assignmentsSection) {
        assignmentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function updateStatCardHighlight() {
    // Remove active class from all stat cards
    document.querySelectorAll('.stat-card').forEach(card => {
        card.classList.remove('active-filter');
    });

    // Add active class to the matching card
    if (priorityFilter === 'critical') {
        document.querySelector('.stat-card.critical')?.classList.add('active-filter');
    } else if (priorityFilter === 'high') {
        document.querySelector('.stat-card.high')?.classList.add('active-filter');
    } else if (priorityFilter === 'medium') {
        document.querySelector('.stat-card.week')?.classList.add('active-filter');
    } else if (priorityFilter === 'all') {
        document.querySelector('.stat-card.total')?.classList.add('active-filter');
    }
}

function clearFilter(type) {
    if (type === 'search') {
        searchQuery = '';
        document.getElementById('searchInput').value = '';
    } else if (type === 'priority') {
        priorityFilter = 'all';
        document.getElementById('filterSelect').value = 'all';
    }
    updateFilterTags();
    renderAssignments();
}

function updateFilterTags() {
    const filterTagsContainer = document.getElementById('filterTags');
    const tags = [];

    if (searchQuery) {
        tags.push(`<div class="filter-tag">
            🔍 "${searchQuery}"
            <span class="filter-tag-close" onclick="clearFilter('search')">×</span>
        </div>`);
    }

    if (priorityFilter !== 'all') {
        const priorityIcons = {
            critical: '🔴',
            high: '🟠',
            medium: '🟡',
            low: '🟢'
        };
        tags.push(`<div class="filter-tag">
            ${priorityIcons[priorityFilter]} ${priorityFilter.charAt(0).toUpperCase() + priorityFilter.slice(1)}
            <span class="filter-tag-close" onclick="clearFilter('priority')">×</span>
        </div>`);
    }

    filterTagsContainer.innerHTML = tags.join('');
}

function applySearchAndFilter(assignmentsList) {
    let filtered = assignmentsList;

    // Apply search filter
    if (searchQuery) {
        filtered = filtered.filter(a =>
            a.name.toLowerCase().includes(searchQuery) ||
            a.className.toLowerCase().includes(searchQuery) ||
            (a.notes && a.notes.toLowerCase().includes(searchQuery))
        );
    }

    // Apply priority filter
    if (priorityFilter !== 'all') {
        filtered = filtered.filter(a => a.priorityLevel === priorityFilter);
    }

    return filtered;
}

// ========================================
// Export / Import Data
// ========================================

function exportData() {
    const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        assignments: assignments,
        settings: {
            currentView: currentView,
            showCompleted: showCompleted,
            notificationsEnabled: notificationsEnabled
        }
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `deadlineiq-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotification('📤 Data exported successfully!');
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);

            // Validate data structure
            if (!importedData.assignments || !Array.isArray(importedData.assignments)) {
                throw new Error('Invalid data format');
            }

            // Confirm before importing
            const confirmMsg = `Import ${importedData.assignments.length} assignments?\n\nThis will replace all current data!`;
            if (!confirm(confirmMsg)) {
                event.target.value = ''; // Reset file input
                return;
            }

            // Import assignments
            assignments = importedData.assignments.map(a => ({
                ...a,
                ...calculatePriority(a) // Recalculate priorities
            }));

            // Import settings if available
            if (importedData.settings) {
                if (importedData.settings.currentView) {
                    currentView = importedData.settings.currentView;
                }
                if (typeof importedData.settings.showCompleted !== 'undefined') {
                    showCompleted = importedData.settings.showCompleted;
                }
            }

            saveAssignments();
            localStorage.setItem('currentView', currentView);

            renderAssignments();
            switchView(currentView);

            showNotification(`📥 Successfully imported ${assignments.length} assignments!`);

        } catch (error) {
            alert('Error importing data: ' + error.message);
            console.error('Import error:', error);
        }

        event.target.value = ''; // Reset file input
    };

    reader.readAsText(file);
}

// ========================================
// Smart Notifications
// ========================================

let notificationsEnabled = localStorage.getItem('deadlineiq_notifications') === 'true';
let lastNotificationCheck = parseInt(localStorage.getItem('deadlineiq_last_notification') || '0');

function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('This browser does not support notifications');
        return;
    }

    if (Notification.permission === 'granted') {
        notificationsEnabled = true;
        localStorage.setItem('deadlineiq_notifications', 'true');
        updateNotificationIcon();
        showNotification('✅ Notifications enabled!');
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                notificationsEnabled = true;
                localStorage.setItem('deadlineiq_notifications', 'true');
                updateNotificationIcon();
                showNotification('✅ Notifications enabled!');
            }
        });
    }
}

function updateNotificationIcon() {
    const notificationIcon = document.querySelector('.notification-icon');
    if (notificationIcon) {
        notificationIcon.textContent = notificationsEnabled ? '🔔' : '🔕';
    }
}

function checkAndSendNotifications() {
    if (!notificationsEnabled || Notification.permission !== 'granted') {
        return;
    }

    const now = new Date();
    const nowTime = now.getTime();

    // Only check once per hour
    if (nowTime - lastNotificationCheck < 3600000) {
        return;
    }

    lastNotificationCheck = nowTime;
    localStorage.setItem('deadlineiq_last_notification', nowTime.toString());

    const incompleteAssignments = assignments.filter(a => a.status !== 'completed');

    incompleteAssignments.forEach(assignment => {
        const dueDate = new Date(assignment.dueDate);
        const hoursUntilDue = (dueDate - now) / (1000 * 60 * 60);

        // Send notifications at specific intervals
        let shouldNotify = false;
        let message = '';

        if (hoursUntilDue < 0) {
            // Overdue
            shouldNotify = true;
            message = `⚠️ Overdue! ${assignment.name} was due ${Math.abs(Math.round(hoursUntilDue))} hours ago.`;
        } else if (hoursUntilDue <= 2) {
            // Due in 2 hours
            shouldNotify = true;
            message = `🔥 Due in ${Math.round(hoursUntilDue)} hours! ${assignment.name}`;
        } else if (hoursUntilDue <= 24) {
            // Due today
            shouldNotify = true;
            message = `⚠️ Due today! ${assignment.name} - ${assignment.className}`;
        } else if (hoursUntilDue <= 48) {
            // Due tomorrow
            shouldNotify = true;
            message = `📅 Due tomorrow! ${assignment.name} - ${assignment.className}`;
        }

        if (shouldNotify) {
            new Notification('DeadlineIQ Reminder', {
                body: message,
                icon: '📚',
                badge: '📚',
                tag: `assignment-${assignment.id}`,
                requireInteraction: hoursUntilDue < 2
            });
        }
    });
}

// ========================================
// Daily Recommendations & Time Blocks
// ========================================

function generateRecommendations() {
    const recommendationsList = document.getElementById('recommendationsList');

    // Filter incomplete assignments
    const incompleteAssignments = assignments
        .filter(a => a.status !== 'completed')
        .sort((a, b) => b.priorityScore - a.priorityScore);

    if (incompleteAssignments.length === 0) {
        recommendationsList.innerHTML = '<div class="empty-recommendations">🎉 No pending assignments! You\'re all caught up!</div>';
        return;
    }

    const recommendations = [];
    const now = new Date();

    // Get top 3 priorities
    const topPriorities = incompleteAssignments.slice(0, 3);

    topPriorities.forEach((assignment, index) => {
        let reason = '';
        const hoursUntilDue = (new Date(assignment.dueDate) - now) / (1000 * 60 * 60);
        const daysUntilDue = hoursUntilDue / 24;

        if (index === 0) {
            if (hoursUntilDue < 24) {
                reason = `🔥 Due in ${Math.round(hoursUntilDue)} hours! Start immediately.`;
            } else if (daysUntilDue < 3) {
                reason = `⚠️ Due in ${Math.round(daysUntilDue)} days. High priority.`;
            } else {
                reason = `🎯 Highest priority. ${assignment.gradeWeight}% of your grade.`;
            }
        } else if (index === 1) {
            if (assignment.estimatedHours >= 5) {
                reason = `⏰ Needs ${assignment.estimatedHours}h to complete. Start early.`;
            } else {
                reason = `📌 Second priority. Due ${new Date(assignment.dueDate).toLocaleDateString()}.`;
            }
        } else {
            reason = `✅ Quick win opportunity. ${assignment.estimatedHours}h estimated.`;
        }

        recommendations.push({
            assignment,
            reason
        });
    });

    recommendationsList.innerHTML = recommendations.map(r => `
        <div class="recommendation-item priority-${r.assignment.priorityLevel}">
            <div class="recommendation-title">
                ${r.assignment.priorityLevel === 'critical' ? '🔴' : r.assignment.priorityLevel === 'high' ? '🟠' : '🟡'}
                ${r.assignment.name}
            </div>
            <div class="recommendation-reason">${r.reason}</div>
        </div>
    `).join('');
}

function generateTimeBlocks() {
    const timeBlocksList = document.getElementById('timeBlocksList');

    // Filter incomplete assignments
    const incompleteAssignments = assignments
        .filter(a => a.status !== 'completed')
        .sort((a, b) => b.priorityScore - a.priorityScore);

    if (incompleteAssignments.length === 0) {
        timeBlocksList.innerHTML = '<div class="empty-time-blocks">📅 No time blocks needed. Enjoy your free time!</div>';
        return;
    }

    const blocks = [];
    const now = new Date();
    const startHour = now.getHours() >= 17 ? 19 : now.getHours() >= 12 ? 14 : 9;

    let currentTime = new Date();
    currentTime.setHours(startHour, 0, 0, 0);

    // If it's past the start time today, start from tomorrow
    if (now.getHours() >= startHour) {
        currentTime.setDate(currentTime.getDate() + 1);
    }

    // Generate blocks for top 4 assignments
    const topAssignments = incompleteAssignments.slice(0, 4);

    topAssignments.forEach((assignment, index) => {
        // Determine block duration based on estimated hours
        let blockHours = Math.min(assignment.estimatedHours, 3); // Max 3-hour blocks
        if (assignment.status === 'in_progress' && assignment.progress > 0) {
            // Adjust time for in-progress items
            blockHours = blockHours * (1 - assignment.progress / 100);
        }

        const endTime = new Date(currentTime);
        endTime.setHours(endTime.getHours() + blockHours);

        const formatTime = (date) => {
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        };

        const formatDate = (date) => {
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            if (date.toDateString() === today.toDateString()) return 'Today';
            if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
            return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        };

        blocks.push({
            assignment,
            startTime: new Date(currentTime),
            endTime: new Date(endTime),
            duration: blockHours
        });

        // Move to next block (add 1-hour break between blocks)
        currentTime.setHours(currentTime.getHours() + blockHours + 1);

        // If past 9 PM, move to next day at 9 AM
        if (currentTime.getHours() >= 21) {
            currentTime.setDate(currentTime.getDate() + 1);
            currentTime.setHours(9, 0, 0, 0);
        }
    });

    const formatTime = (date) => {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    const formatDate = (date) => {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    timeBlocksList.innerHTML = blocks.map(block => `
        <div class="time-block-item">
            <div class="time-block-time">
                ${formatDate(block.startTime)}, ${formatTime(block.startTime)} - ${formatTime(block.endTime)}
            </div>
            <div class="time-block-assignment">${block.assignment.name}</div>
            <div class="time-block-duration">${block.duration.toFixed(1)} hours • ${block.assignment.className}</div>
        </div>
    `).join('');
}

// ========================================
// Recommendations & Time Blocks Modals
// ========================================

function openRecommendations() {
    const modal = document.getElementById('recommendationsModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    generateRecommendations();
}

function closeRecommendations() {
    const modal = document.getElementById('recommendationsModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function openTimeBlocks() {
    const modal = document.getElementById('timeBlocksModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    generateTimeBlocks();
}

function closeTimeBlocks() {
    const modal = document.getElementById('timeBlocksModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// ========================================
// Theme Toggle
// ========================================

function initializeTheme() {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;

    const html = document.documentElement;
    const themeIcon = themeToggle.querySelector('.theme-icon');

    // Check for saved theme preference or default to 'dark'
    const currentTheme = localStorage.getItem('theme') || 'dark';
    html.setAttribute('data-theme', currentTheme);
    themeIcon.textContent = currentTheme === 'dark' ? '☀️' : '🌙';

    themeToggle.addEventListener('click', () => {
        const currentTheme = html.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';

        // Add animation
        themeToggle.style.transform = 'rotate(360deg)';
        setTimeout(() => {
            themeToggle.style.transform = 'rotate(0deg)';
        }, 300);
    });
}

// ========================================
// Welcome Modal & Onboarding
// ========================================

function showWelcomeModal() {
    const welcomeModal = document.getElementById('welcomeModal');
    if (welcomeModal) {
        welcomeModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function hideWelcomeModal() {
    const welcomeModal = document.getElementById('welcomeModal');
    if (welcomeModal) {
        welcomeModal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function closeWelcomeModal() {
    localStorage.setItem('deadlineiq_visited', 'true');
    hideWelcomeModal();
}

function loadDemoData() {
    const now = new Date();

    const demoAssignments = [
        {
            name: 'Final Project Presentation',
            className: 'CSE 340 - Principles of Programming Languages',
            dueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days
            gradeWeight: 30,
            estimatedHours: 15,
            currentGrade: 85,
            status: 'in_progress',
            progress: 60,
            notes: 'Need to prepare slides and practice presentation'
        },
        {
            name: 'Machine Learning Homework 4',
            className: 'CSE 412 - Database Management',
            dueDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day
            gradeWeight: 15,
            estimatedHours: 8,
            currentGrade: 88,
            status: 'not_started',
            progress: 0,
            notes: 'Focus on neural network implementation'
        },
        {
            name: 'Research Paper Draft',
            className: 'ENG 102 - English Composition',
            dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days
            gradeWeight: 25,
            estimatedHours: 20,
            currentGrade: 90,
            status: 'in_progress',
            progress: 40,
            notes: 'Literature review complete, working on methodology section'
        },
        {
            name: 'Calculus Problem Set',
            className: 'MAT 265 - Calculus I',
            dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
            gradeWeight: 10,
            estimatedHours: 5,
            currentGrade: 92,
            status: 'not_started',
            progress: 0,
            notes: 'Chapter 5: Integration techniques'
        },
        {
            name: 'Group Project Milestone 2',
            className: 'CSE 340 - Principles of Programming Languages',
            dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week
            gradeWeight: 20,
            estimatedHours: 12,
            currentGrade: 85,
            status: 'not_started',
            progress: 0,
            notes: 'Meet with team on Thursday'
        },
        {
            name: 'Physics Lab Report',
            className: 'PHY 121 - Physics I',
            dueDate: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days
            gradeWeight: 12,
            estimatedHours: 6,
            currentGrade: 87,
            status: 'in_progress',
            progress: 75,
            notes: 'Just need to write conclusion and proofread'
        }
    ];

    // Add calculated priority to each assignment
    assignments = demoAssignments.map(a => ({
        ...a,
        id: Date.now() + Math.random(),
        ...calculatePriority(a)
    }));

    saveAssignments();
    closeWelcomeModal();
    renderAssignments();

    // Show success message
    showNotification('🎉 Demo data loaded! Explore all the features.', 'success');

    // Start tutorial after loading demo data
    setTimeout(() => {
        startTutorial();
    }, 1500);
}

// ========================================
// Tutorial System
// ========================================

const tutorialSteps = [
    {
        element: '#addAssignmentBtn',
        title: '📝 Add Assignments',
        content: 'Click here to add your assignments. Our AI will automatically calculate priority scores!',
    },
    {
        element: '#recommendationsBtn',
        title: '🤖 AI Recommendations',
        content: 'Get personalized suggestions on what to work on next based on your deadlines and priorities.',
    },
    {
        element: '#timeBlocksBtn',
        title: '⏰ Time Blocking',
        content: 'See suggested time blocks to organize your day efficiently.',
    },
    {
        element: '.view-controls',
        title: '📊 Multiple Views',
        content: 'Switch between Priority, Timeline, Calendar, Class, and Weekly views to see your work different ways.',
    }
];

let currentTutorialStep = 0;
let tutorialActive = false;

function startTutorial() {
    const tutorialSeen = localStorage.getItem('deadlineiq_tutorial_seen');
    if (tutorialSeen) return;

    tutorialActive = true;
    currentTutorialStep = 0;
    showTutorialStep(0);
}

function showTutorialStep(stepIndex) {
    if (stepIndex >= tutorialSteps.length) {
        endTutorial();
        return;
    }

    const step = tutorialSteps[stepIndex];
    const element = document.querySelector(step.element);

    if (!element) {
        // Skip to next step if element not found
        showTutorialStep(stepIndex + 1);
        return;
    }

    // Remove any existing tooltips
    document.querySelectorAll('.tutorial-tooltip').forEach(t => t.remove());

    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip tutorial-tooltip active';
    tooltip.innerHTML = `
        <div class="tooltip-header">
            <span class="tooltip-title">${step.title}</span>
            <button class="tooltip-close" onclick="skipTutorial()">×</button>
        </div>
        <div class="tooltip-content">${step.content}</div>
        <div class="tooltip-actions">
            ${stepIndex > 0 ? '<button class="tooltip-btn secondary" onclick="previousTutorialStep()">← Back</button>' : ''}
            <button class="tooltip-btn" onclick="nextTutorialStep()">${stepIndex < tutorialSteps.length - 1 ? 'Next →' : 'Got it!'}</button>
        </div>
        <div class="tooltip-progress">
            <span class="tooltip-progress-text">Step ${stepIndex + 1} of ${tutorialSteps.length}</span>
            <div class="tooltip-progress-dots">
                ${tutorialSteps.map((_, i) => `<div class="tooltip-progress-dot ${i === stepIndex ? 'active' : ''}"></div>`).join('')}
            </div>
        </div>
    `;

    // Position tooltip
    element.style.position = 'relative';
    element.appendChild(tooltip);

    // Highlight element
    element.style.outline = '2px solid var(--accent-pink)';
    element.style.outlineOffset = '4px';
    element.style.borderRadius = '0.5rem';
}

function nextTutorialStep() {
    clearTutorialHighlight(currentTutorialStep);
    currentTutorialStep++;
    showTutorialStep(currentTutorialStep);
}

function previousTutorialStep() {
    clearTutorialHighlight(currentTutorialStep);
    currentTutorialStep--;
    showTutorialStep(currentTutorialStep);
}

function skipTutorial() {
    clearTutorialHighlight(currentTutorialStep);
    endTutorial();
}

function endTutorial() {
    tutorialActive = false;
    localStorage.setItem('deadlineiq_tutorial_seen', 'true');
    document.querySelectorAll('.tutorial-tooltip').forEach(t => t.remove());
    showNotification('✅ Tutorial complete! You\'re all set.', 'success');
}

function clearTutorialHighlight(stepIndex) {
    if (stepIndex >= tutorialSteps.length) return;
    const step = tutorialSteps[stepIndex];
    const element = document.querySelector(step.element);
    if (element) {
        element.style.outline = '';
        element.style.outlineOffset = '';
    }
}

// ========================================
// AI Chat Assistant
// ========================================

function toggleAiChat() {
    const chatWindow = document.getElementById('aiChatWindow');
    const chatBubble = document.getElementById('aiChatBubble');

    if (chatWindow.classList.contains('active')) {
        chatWindow.classList.remove('active');
        chatBubble.style.display = 'flex';
    } else {
        chatWindow.classList.add('active');
        chatBubble.style.display = 'none';
        document.getElementById('chatInput').focus();
    }
}

function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();

    if (!message) return;

    // Add user message
    addChatMessage(message, 'user');
    input.value = '';

    // Simulate AI thinking
    setTimeout(() => {
        const response = generateAIResponse(message);
        addChatMessage(response, 'ai');
    }, 800);
}

function askAI(question) {
    document.getElementById('chatInput').value = question;
    sendChatMessage();
}

function addChatMessage(text, sender) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}-message`;

    const avatar = sender === 'ai' ? '🤖' : '👤';

    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            <p>${text}</p>
        </div>
    `;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function generateAIResponse(question) {
    const lowerQuestion = question.toLowerCase();

    // Analyze assignments for context
    const total = assignments.length;
    const completed = assignments.filter(a => a.status === 'completed').length;
    const critical = assignments.filter(a => a.priorityLevel === 'critical' && a.status !== 'completed').length;
    const high = assignments.filter(a => a.priorityLevel === 'high' && a.status !== 'completed').length;

    // Get highest priority assignment
    const nextAssignment = assignments
        .filter(a => a.status !== 'completed')
        .sort((a, b) => b.priorityScore - a.priorityScore)[0];

    // Generate contextual responses
    if (lowerQuestion.includes('next') || lowerQuestion.includes('work on')) {
        if (nextAssignment) {
            return `Based on my analysis, you should work on <strong>"${nextAssignment.name}"</strong> next! It's ${nextAssignment.priorityLevel} priority with a score of ${nextAssignment.priorityScore.toFixed(1)}/100. Due in ${getTimeDisplay(nextAssignment).text}. 📚`;
        } else {
            return "Great news! You don't have any pending assignments right now. Time to relax! 🎉";
        }
    }

    if (lowerQuestion.includes('time') || lowerQuestion.includes('manage')) {
        return `Here are my top time management tips:\n\n1. ⏰ Use the Pomodoro technique (25 min work, 5 min break)\n2. 🎯 Focus on high-priority tasks first\n3. 📅 Break large assignments into smaller chunks\n4. 🚫 Eliminate distractions during work sessions\n\nYou have ${critical + high} high/critical priority tasks that need immediate attention!`;
    }

    if (lowerQuestion.includes('progress') || lowerQuestion.includes('stats')) {
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        return `Here's your progress summary:\n\n📊 Completed: ${completed}/${total} assignments (${percentage}%)\n🔥 Critical: ${critical} tasks\n⚠️ High priority: ${high} tasks\n\nYou're doing ${percentage > 70 ? 'amazing' : percentage > 40 ? 'good' : 'okay'} - keep it up! 💪`;
    }

    if (lowerQuestion.includes('help') || lowerQuestion.includes('what can you')) {
        return "I can help you with:\n\n📋 Assignment recommendations\n⏰ Time management strategies\n📊 Progress tracking\n🎯 Priority optimization\n💡 Study tips\n\nJust ask me anything about your assignments!";
    }

    if (lowerQuestion.includes('stress') || lowerQuestion.includes('overwhelmed')) {
        return "I understand feeling overwhelmed! Here's what I recommend:\n\n1. Take a 5-minute break right now 🧘\n2. Focus on just ONE task at a time\n3. Start with the smallest task to build momentum\n4. Remember: progress > perfection\n\nYou've got this! 💪";
    }

    // Default response
    return `I hear you! ${total > 0 ? `You currently have ${total} assignments. Your highest priority is "${nextAssignment?.name || 'None'}".` : "You don't have any assignments yet."} Feel free to ask me about specific tasks, time management, or study strategies! 🤖`;
}

// ========================================
// Reset Demo Function
// ========================================

function resetDemo() {
    // Clear all localStorage data
    localStorage.removeItem('deadlineiq_visited');
    localStorage.removeItem('deadlineiq_tutorial_seen');
    localStorage.removeItem('deadlineiq_assignments');

    // Reload the page to show welcome modal
    location.reload();
}

// ========================================
// Pull to Refresh
// ========================================

let pullStartY = 0;
let pullMoveY = 0;
let isPulling = false;
const pullThreshold = 80;

function initializePullToRefresh() {
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;

    let refreshIndicator = document.createElement('div');
    refreshIndicator.className = 'pull-refresh-indicator';
    refreshIndicator.innerHTML = '<span class="refresh-icon">↓</span><span class="refresh-text">Pull to refresh</span>';
    mainContent.insertBefore(refreshIndicator, mainContent.firstChild);

    document.addEventListener('touchstart', (e) => {
        if (window.scrollY === 0) {
            pullStartY = e.touches[0].clientY;
            isPulling = true;
        }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!isPulling) return;

        pullMoveY = e.touches[0].clientY;
        const pullDistance = pullMoveY - pullStartY;

        if (pullDistance > 0 && pullDistance < pullThreshold * 2) {
            refreshIndicator.style.transform = `translateY(${pullDistance}px)`;
            refreshIndicator.style.opacity = Math.min(pullDistance / pullThreshold, 1);

            if (pullDistance > pullThreshold) {
                refreshIndicator.querySelector('.refresh-text').textContent = 'Release to refresh';
                refreshIndicator.querySelector('.refresh-icon').style.transform = 'rotate(180deg)';
            } else {
                refreshIndicator.querySelector('.refresh-text').textContent = 'Pull to refresh';
                refreshIndicator.querySelector('.refresh-icon').style.transform = 'rotate(0deg)';
            }
        }
    }, { passive: true });

    document.addEventListener('touchend', () => {
        if (!isPulling) return;

        const pullDistance = pullMoveY - pullStartY;

        if (pullDistance > pullThreshold) {
            // Trigger refresh
            refreshIndicator.querySelector('.refresh-text').textContent = 'Refreshing...';
            refreshIndicator.querySelector('.refresh-icon').style.animation = 'spin 1s linear infinite';

            setTimeout(() => {
                renderAssignments();
                generateRecommendations();
                generateTimeBlocks();

                refreshIndicator.style.transform = '';
                refreshIndicator.style.opacity = '0';
                refreshIndicator.querySelector('.refresh-icon').style.animation = '';

                showNotification('✅ Refreshed successfully!', 'success');
            }, 1000);
        } else {
            refreshIndicator.style.transform = '';
            refreshIndicator.style.opacity = '0';
            refreshIndicator.querySelector('.refresh-icon').style.transform = '';
        }

        isPulling = false;
        pullStartY = 0;
        pullMoveY = 0;
    });
}

// ========================================
// Initialization
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    // Check if first visit
    const hasVisited = localStorage.getItem('deadlineiq_visited');
    if (!hasVisited) {
        showWelcomeModal();
    } else {
        hideWelcomeModal();
    }

    loadAssignments();

    // Initialize theme toggle
    initializeTheme();

    // Initialize Dashboard modal
    const dashboardBtn = document.getElementById('dashboardBtn');
    const dashboardClose = document.getElementById('dashboardClose');
    const dashboardModal = document.getElementById('dashboardModal');

    if (dashboardBtn) {
        dashboardBtn.addEventListener('click', openDashboard);
    }

    if (dashboardClose) {
        dashboardClose.addEventListener('click', closeDashboard);
    }

    // Close modal on overlay click
    if (dashboardModal) {
        dashboardModal.addEventListener('click', (e) => {
            if (e.target === dashboardModal) {
                closeDashboard();
            }
        });
    }

    // Initialize Recommendations modal
    const recommendationsBtn = document.getElementById('recommendationsBtn');
    const recommendationsClose = document.getElementById('recommendationsClose');
    const recommendationsModal = document.getElementById('recommendationsModal');

    if (recommendationsBtn) {
        recommendationsBtn.addEventListener('click', openRecommendations);
    }

    if (recommendationsClose) {
        recommendationsClose.addEventListener('click', closeRecommendations);
    }

    // Close modal on overlay click
    if (recommendationsModal) {
        recommendationsModal.addEventListener('click', (e) => {
            if (e.target === recommendationsModal) {
                closeRecommendations();
            }
        });
    }

    // Initialize Time Blocks modal
    const timeBlocksBtn = document.getElementById('timeBlocksBtn');
    const timeBlocksClose = document.getElementById('timeBlocksClose');
    const timeBlocksModal = document.getElementById('timeBlocksModal');

    if (timeBlocksBtn) {
        timeBlocksBtn.addEventListener('click', openTimeBlocks);
    }

    if (timeBlocksClose) {
        timeBlocksClose.addEventListener('click', closeTimeBlocks);
    }

    // Close modal on overlay click
    if (timeBlocksModal) {
        timeBlocksModal.addEventListener('click', (e) => {
            if (e.target === timeBlocksModal) {
                closeTimeBlocks();
            }
        });
    }

    // Close modals on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (dashboardModal && dashboardModal.classList.contains('active')) {
                closeDashboard();
            }
            if (recommendationsModal && recommendationsModal.classList.contains('active')) {
                closeRecommendations();
            }
            if (timeBlocksModal && timeBlocksModal.classList.contains('active')) {
                closeTimeBlocks();
            }
        }
    });

    // Initialize notification icon
    updateNotificationIcon();

    // Set initial view
    switchView(currentView);

    // Generate recommendations and time blocks
    generateRecommendations();
    generateTimeBlocks();

    // Check for notifications on load
    checkAndSendNotifications();

    // Initialize 3D tilt effect on cards
    initialize3DTilt();

    // Initialize pull to refresh (mobile)
    initializePullToRefresh();

    // Initialize Pomodoro timer stats
    updatePomodoroStats();

    console.log('%c📚 DeadlineIQ App Loaded', 'font-size: 16px; font-weight: bold; color: #ec4899;');
    console.log(`Loaded ${assignments.length} assignments from localStorage`);
    console.log(`Current view: ${currentView}`);
});

// ========================================
// 3D Tilt Effect
// ========================================

function initialize3DTilt() {
    const cards = document.querySelectorAll('.assignment-card, .stat-card');

    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = ((y - centerY) / centerY) * -10; // Max 10deg
            const rotateY = ((x - centerX) / centerX) * 10;

            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-5px) scale(1.01)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    });
}

// Re-initialize 3D tilt after rendering assignments
function reInit3DTilt() {
    setTimeout(() => {
        initialize3DTilt();
        initializeSwipeGestures();
    }, 100);
}

// ========================================
// Dashboard Analytics
// ========================================

function openDashboard() {
    const modal = document.getElementById('dashboardModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Generate all dashboard visualizations
    updateStressLevel();
    generatePieChart();
    generateProductivityChart();
    updateTimeStats();
}

function closeDashboard() {
    const modal = document.getElementById('dashboardModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function updateStressLevel() {
    const incompleteAssignments = assignments.filter(a => a.status !== 'completed');

    if (incompleteAssignments.length === 0) {
        document.getElementById('stressBar').style.width = '0%';
        document.getElementById('stressLabel').textContent = 'Relaxed';
        document.getElementById('stressDescription').textContent = 'No pending assignments!';
        return;
    }

    // Calculate stress based on multiple factors
    const criticalCount = incompleteAssignments.filter(a => a.priorityLevel === 'critical').length;
    const highCount = incompleteAssignments.filter(a => a.priorityLevel === 'high').length;
    const avgPriority = incompleteAssignments.reduce((sum, a) => sum + a.priorityScore, 0) / incompleteAssignments.length;

    // Check for tight deadlines
    const now = new Date();
    const urgentCount = incompleteAssignments.filter(a => {
        const hours = (new Date(a.dueDate) - now) / (1000 * 60 * 60);
        return hours < 48;
    }).length;

    // Calculate stress level (0-100)
    let stressLevel = 0;
    stressLevel += (criticalCount * 25); // Each critical adds 25%
    stressLevel += (highCount * 10); // Each high adds 10%
    stressLevel += (urgentCount * 15); // Each urgent adds 15%
    stressLevel += (avgPriority / 4); // Average priority contributes
    stressLevel = Math.min(100, stressLevel);

    // Update UI
    const stressBar = document.getElementById('stressBar');
    const stressLabel = document.getElementById('stressLabel');
    const stressDescription = document.getElementById('stressDescription');

    stressBar.style.width = stressLevel + '%';

    if (stressLevel < 25) {
        stressLabel.textContent = 'Low';
        stressDescription.textContent = "You're managing well! Keep it up! 😊";
    } else if (stressLevel < 50) {
        stressLabel.textContent = 'Moderate';
        stressDescription.textContent = 'Stay focused and prioritize critical tasks. 💪';
    } else if (stressLevel < 75) {
        stressLabel.textContent = 'High';
        stressDescription.textContent = 'Consider using Pomodoro timer and breaks. 🔥';
    } else {
        stressLabel.textContent = 'Critical';
        stressDescription.textContent = 'Take a deep breath. Focus on one task at a time! 🚨';
    }
}

function generatePieChart() {
    const incompleteAssignments = assignments.filter(a => a.status !== 'completed');

    const priorityCounts = {
        critical: incompleteAssignments.filter(a => a.priorityLevel === 'critical').length,
        high: incompleteAssignments.filter(a => a.priorityLevel === 'high').length,
        medium: incompleteAssignments.filter(a => a.priorityLevel === 'medium').length,
        low: incompleteAssignments.filter(a => a.priorityLevel === 'low').length
    };

    const total = Object.values(priorityCounts).reduce((sum, count) => sum + count, 0);

    if (total === 0) {
        document.getElementById('pieChart').innerHTML = '<text x="100" y="100" text-anchor="middle" fill="var(--text-secondary)" font-size="14">No data</text>';
        document.getElementById('pieLegend').innerHTML = '<p style="color: var(--text-secondary);">No pending assignments</p>';
        return;
    }

    const colors = {
        critical: '#ef4444',
        high: '#f97316',
        medium: '#eab308',
        low: '#22c55e'
    };

    const labels = {
        critical: 'Critical',
        high: 'High',
        medium: 'Medium',
        low: 'Low'
    };

    // Generate SVG pie segments
    let currentAngle = 0;
    let segments = '';

    Object.entries(priorityCounts).forEach(([priority, count]) => {
        if (count === 0) return;

        const percentage = (count / total) * 100;
        const angle = (percentage / 100) * 360;
        const endAngle = currentAngle + angle;

        const x1 = 100 + 90 * Math.cos((currentAngle * Math.PI) / 180);
        const y1 = 100 + 90 * Math.sin((currentAngle * Math.PI) / 180);
        const x2 = 100 + 90 * Math.cos((endAngle * Math.PI) / 180);
        const y2 = 100 + 90 * Math.sin((endAngle * Math.PI) / 180);

        const largeArc = angle > 180 ? 1 : 0;

        const pathData = [
            `M 100 100`,
            `L ${x1} ${y1}`,
            `A 90 90 0 ${largeArc} 1 ${x2} ${y2}`,
            `Z`
        ].join(' ');

        segments += `<path d="${pathData}" fill="${colors[priority]}" class="pie-segment" data-priority="${priority}"></path>`;
        currentAngle = endAngle;
    });

    document.getElementById('pieChart').innerHTML = segments;

    // Generate legend
    const legend = Object.entries(priorityCounts)
        .filter(([_, count]) => count > 0)
        .map(([priority, count]) => {
            const percentage = ((count / total) * 100).toFixed(1);
            return `
                <div class="legend-item">
                    <div class="legend-color" style="background: ${colors[priority]}"></div>
                    <span class="legend-label">${labels[priority]}</span>
                    <span class="legend-value">${count} (${percentage}%)</span>
                </div>
            `;
        }).join('');

    document.getElementById('pieLegend').innerHTML = legend;
}

function generateProductivityChart() {
    // Get completion history from localStorage
    let completionHistory = JSON.parse(localStorage.getItem('completion_history') || '{}');

    const barsContainer = document.getElementById('productivityBars');
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const today = new Date();

    let bars = '';
    let maxCount = 0;

    // Calculate completions for last 7 days
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateKey = date.toDateString();
        const count = completionHistory[dateKey] || 0;
        last7Days.push(count);
        maxCount = Math.max(maxCount, count);
    }

    if (maxCount === 0) maxCount = 1; // Prevent division by zero

    last7Days.forEach((count, index) => {
        const height = (count / maxCount) * 100;
        bars += `<div class="chart-bar" style="height: ${height}%" data-value="${count}"></div>`;
    });

    barsContainer.innerHTML = bars;
}

function updateTimeStats() {
    const incompleteAssignments = assignments.filter(a => a.status !== 'completed');
    const completedAssignments = assignments.filter(a => a.status === 'completed');

    // Total hours estimated
    const totalHours = assignments.reduce((sum, a) => sum + a.estimatedHours, 0);
    document.getElementById('totalHoursEstimated').textContent = totalHours.toFixed(1);

    // Hours completed
    const hoursCompleted = completedAssignments.reduce((sum, a) => sum + a.estimatedHours, 0);
    document.getElementById('hoursCompleted').textContent = hoursCompleted.toFixed(1);

    // Hours remaining
    const hoursRemaining = incompleteAssignments.reduce((sum, a) => sum + a.estimatedHours, 0);
    document.getElementById('hoursRemaining').textContent = hoursRemaining.toFixed(1);

    // Average priority score
    const avgPriority = assignments.length > 0
        ? (assignments.reduce((sum, a) => sum + a.priorityScore, 0) / assignments.length)
        : 0;
    document.getElementById('avgPriorityScore').textContent = avgPriority.toFixed(0);
}

// Track completions for productivity chart
function trackCompletion() {
    let completionHistory = JSON.parse(localStorage.getItem('completion_history') || '{}');
    const today = new Date().toDateString();
    completionHistory[today] = (completionHistory[today] || 0) + 1;
    localStorage.setItem('completion_history', JSON.stringify(completionHistory));
}

// ========================================
// Pomodoro Timer
// ========================================

let timerInterval = null;
let timeRemaining = 25 * 60; // 25 minutes in seconds
let timerMode = 'work'; // 'work', 'short', 'long'
let isTimerRunning = false;
let linkedAssignmentId = null;
let pomodoroStats = JSON.parse(localStorage.getItem('pomodoro_stats')) || {
    sessionsToday: 0,
    totalMinutes: 0,
    currentStreak: 0,
    lastSessionDate: null
};

const timerModes = {
    work: 25 * 60,
    short: 5 * 60,
    long: 15 * 60
};

function togglePomodoro() {
    const pomodoroWindow = document.getElementById('pomodoroWindow');
    const pomodoroBubble = document.getElementById('pomodoroBubble');

    if (pomodoroWindow.classList.contains('active')) {
        pomodoroWindow.classList.remove('active');
        pomodoroBubble.style.display = 'flex';
    } else {
        pomodoroWindow.classList.add('active');
        pomodoroBubble.style.display = 'none';
        updateAssignmentSelect();
    }
}

function setTimerMode(mode) {
    if (isTimerRunning) {
        if (!confirm('Stop current session and switch mode?')) {
            return;
        }
        pauseTimer();
    }

    timerMode = mode;
    timeRemaining = timerModes[mode];
    updateTimerDisplay();

    // Update active button
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-mode="${mode}"]`).classList.add('active');

    updateStatusText();
}

function toggleTimer() {
    if (isTimerRunning) {
        pauseTimer();
    } else {
        startTimer();
    }
}

function startTimer() {
    isTimerRunning = true;
    document.getElementById('timerToggle').textContent = '⏸ Pause';
    updateStatusText();

    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();

        if (timeRemaining <= 0) {
            completeSession();
        }
    }, 1000);
}

function pauseTimer() {
    isTimerRunning = false;
    clearInterval(timerInterval);
    document.getElementById('timerToggle').textContent = '▶ Start';
    updateStatusText();
}

function resetTimer() {
    pauseTimer();
    timeRemaining = timerModes[timerMode];
    updateTimerDisplay();
    updateStatusText();
}

function completeSession() {
    pauseTimer();
    playCelebrationSound();
    showNotification('🎉 Pomodoro session complete! Great work!');

    // Update stats
    const today = new Date().toDateString();
    if (pomodoroStats.lastSessionDate === today) {
        pomodoroStats.sessionsToday++;
        pomodoroStats.currentStreak++;
    } else {
        pomodoroStats.sessionsToday = 1;
        pomodoroStats.currentStreak = 1;
        pomodoroStats.lastSessionDate = today;
    }

    const minutes = timerModes[timerMode] / 60;
    pomodoroStats.totalMinutes += minutes;
    localStorage.setItem('pomodoro_stats', JSON.stringify(pomodoroStats));

    updatePomodoroStats();

    // Auto-switch to break mode
    if (timerMode === 'work') {
        if (pomodoroStats.sessionsToday % 4 === 0) {
            setTimerMode('long');
        } else {
            setTimerMode('short');
        }
    } else {
        setTimerMode('work');
    }

    // If linked to an assignment, update progress
    if (linkedAssignmentId) {
        const assignment = assignments.find(a => a.id === linkedAssignmentId);
        if (assignment && assignment.status !== 'completed') {
            // Auto-increment progress by 10% per work session
            if (timerMode === 'work') {
                const newProgress = Math.min(100, (assignment.progress || 0) + 10);
                updateProgress(linkedAssignmentId, newProgress);
            }
        }
    }
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('timerDisplay').textContent = display;

    // Update bubble text if timer is running
    const bubble = document.getElementById('pomodoroBubble');
    if (isTimerRunning && timeRemaining < timerModes[timerMode]) {
        bubble.innerHTML = `<span class="timer-icon">${minutes}:${seconds.toString().padStart(2, '0')}</span>`;
    } else {
        bubble.innerHTML = '<span class="timer-icon">⏰</span>';
    }
}

function updateStatusText() {
    const statusElement = document.getElementById('pomodoroStatus');
    if (!statusElement) return;

    if (isTimerRunning) {
        if (timerMode === 'work') {
            statusElement.textContent = 'Focus time! 💪';
        } else {
            statusElement.textContent = 'Break time! 🧘';
        }
    } else {
        if (timerMode === 'work') {
            statusElement.textContent = 'Ready to focus';
        } else {
            statusElement.textContent = 'Ready for a break';
        }
    }
}

function updateAssignmentSelect() {
    const select = document.getElementById('pomodoroAssignmentSelect');
    if (!select) return;

    const incompleteAssignments = assignments
        .filter(a => a.status !== 'completed')
        .sort((a, b) => b.priorityScore - a.priorityScore);

    select.innerHTML = '<option value="">No assignment linked</option>' +
        incompleteAssignments.map(a => `
            <option value="${a.id}" ${linkedAssignmentId === a.id ? 'selected' : ''}>
                ${a.name}
            </option>
        `).join('');

    select.addEventListener('change', (e) => {
        linkedAssignmentId = e.target.value ? parseInt(e.target.value) : null;
    });
}

function updatePomodoroStats() {
    const today = new Date().toDateString();
    const sessionsToday = pomodoroStats.lastSessionDate === today ? pomodoroStats.sessionsToday : 0;

    document.getElementById('sessionsToday').textContent = sessionsToday;
    document.getElementById('totalMinutes').textContent = pomodoroStats.totalMinutes;
    document.getElementById('currentStreak').textContent = pomodoroStats.currentStreak;
}

// ========================================
// Mobile Swipe Gestures
// ========================================

function initializeSwipeGestures() {
    const cards = document.querySelectorAll('.assignment-card');

    cards.forEach(card => {
        let startX = 0;
        let currentX = 0;
        let isDragging = false;
        let initialTransform = '';

        card.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            isDragging = true;
            initialTransform = card.style.transform;
            card.style.transition = 'none';
        }, { passive: true });

        card.addEventListener('touchmove', (e) => {
            if (!isDragging) return;

            currentX = e.touches[0].clientX;
            const diff = currentX - startX;

            // Only allow horizontal swipe
            if (Math.abs(diff) > 10) {
                e.preventDefault();
                card.style.transform = `translateX(${diff}px)`;

                // Show visual feedback
                if (diff > 100) {
                    // Swipe right = complete (green)
                    card.style.background = 'linear-gradient(90deg, rgba(34, 197, 94, 0.2), rgba(var(--bg-secondary-rgb), 0.7))';
                } else if (diff < -100) {
                    // Swipe left = delete (red)
                    card.style.background = 'linear-gradient(90deg, rgba(var(--bg-secondary-rgb), 0.7), rgba(239, 68, 68, 0.2))';
                } else {
                    card.style.background = '';
                }
            }
        });

        card.addEventListener('touchend', () => {
            if (!isDragging) return;

            const diff = currentX - startX;
            card.style.transition = 'all 0.3s ease';

            if (diff > 150) {
                // Swipe right - Mark as complete
                const id = parseInt(card.dataset.id);
                changeStatus(id, 'completed');
                playCelebrationSound();
            } else if (diff < -150) {
                // Swipe left - Delete
                const id = parseInt(card.dataset.id);
                if (confirm('Delete this assignment?')) {
                    deleteAssignment(id);
                }
            }

            // Reset
            card.style.transform = initialTransform;
            card.style.background = '';
            isDragging = false;
            startX = 0;
            currentX = 0;
        });

        card.addEventListener('touchcancel', () => {
            card.style.transform = initialTransform;
            card.style.background = '';
            isDragging = false;
        });
    });
}

// Recalculate priorities and check notifications every minute
setInterval(() => {
    if (assignments.length > 0) {
        assignments = assignments.map(a => ({
            ...a,
            ...calculatePriority(a)
        }));
        saveAssignments();
        renderAssignments();
        generateRecommendations();
        generateTimeBlocks();
        checkAndSendNotifications();
    }
}, 60000); // Every 60 seconds
