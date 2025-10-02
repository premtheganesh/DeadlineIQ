# DeadlineIQ - AI-Powered Assignment Deadline Dashboard
## Product Requirements Document (PRD)

### 1. Product Overview

**Product Name:** DeadlineIQ

**Vision:** An intelligent assignment deadline management system that helps students prioritize their workload using AI-driven insights, reducing stress and improving academic performance.

**Target Users:** College students juggling multiple courses with varying assignment deadlines and grade weights.

---

### 2. Core Problem Statement

Students face several challenges managing multiple assignments:
- **Overwhelm:** Too many deadlines to track manually
- **Poor Prioritization:** Not knowing which assignments to tackle first
- **Stress:** Uncertainty about workload and time management
- **Missed Deadlines:** Lost track of important due dates
- **Grade Impact:** Not considering how assignment weights affect overall grades

---

### 3. Solution Overview

DeadlineIQ solves these problems by:
1. **Centralized Dashboard:** Single place to track all assignments
2. **Smart Prioritization:** AI algorithm that considers:
   - Time until deadline (urgency)
   - Grade weight (importance)
   - Estimated hours needed (workload)
   - Current grade in class (impact)
3. **Visual Insights:** Clear priority levels (Critical, High, Medium, Low)
4. **Progress Tracking:** Mark assignments as not started, in progress, or completed
5. **Multiple Views:** Priority-based, timeline, calendar, and class-grouped views

---

### 4. Key Features

#### 4.1 Assignment Input Form
- **Fields:**
  - Assignment Name (text)
  - Class/Course Name (text)
  - Due Date & Time (datetime picker)
  - Grade Weight (0-100%, slider)
  - Estimated Hours to Complete (number input)
  - Current Grade in Class (0-100%, slider)
  - Optional: Notes/Comments (textarea)

#### 4.2 AI Priority Algorithm
**Formula Components:**
1. **Urgency Score:** Based on time remaining until deadline
2. **Weight Score:** Based on assignment's impact on final grade
3. **Workload Score:** Based on estimated hours needed
4. **Grade Impact Score:** How current grade affects priority

**Priority Levels:**
- 🔴 **Critical:** Immediate attention needed (80-100 points)
- 🟠 **High:** Important, should be next (60-79 points)
- 🟡 **Medium:** Moderate priority (40-59 points)
- 🟢 **Low:** Can wait (0-39 points)

#### 4.3 Dashboard Views

**1. Priority View (Default)**
- Assignments sorted by AI-calculated priority score
- Color-coded by priority level
- Shows: Name, Class, Due Date, Priority Badge

**2. Timeline View**
- Horizontal timeline showing all assignments
- Visual spacing based on due dates
- Quick overview of upcoming weeks

**3. Calendar View**
- Monthly calendar with assignments on due dates
- Color-coded dots for priority levels
- Click to view assignment details

**4. Class View**
- Grouped by course/class
- Shows all assignments per class
- Helps balance workload across courses

**5. This Week View**
- Filtered view of assignments due this week
- Focus mode for immediate priorities

#### 4.4 Assignment Cards
Each assignment displays:
- Assignment name
- Class name
- Due date (with countdown timer)
- Priority level badge
- Estimated hours
- Progress status
- Quick action buttons (Edit, Complete, Delete)

#### 4.5 Status Management
- **Not Started:** Default state (gray)
- **In Progress:** Working on it (blue)
- **Completed:** Finished (green, with confetti animation!)

#### 4.6 Smart Features
- **Completion History:** Track completed assignments
- **Show/Hide Completed:** Toggle visibility of done items
- **Search & Filter:** Find assignments quickly
- **Priority Filter:** View by specific priority levels
- **Local Storage:** All data saved in browser

---

### 5. User Interface Design

#### 5.1 Design Principles
- **Clean & Modern:** Minimalist design, focus on content
- **Responsive:** Works on desktop, tablet, and mobile
- **Accessible:** WCAG compliant, keyboard navigation
- **Dark Mode:** Eye-friendly night mode option

#### 5.2 Color Scheme
- **Primary Gradient:** Pink to Rose to Red (#ec4899 → #f43f5e → #ef4444)
- **Priority Colors:**
  - Critical: Red (#ef4444)
  - High: Orange (#f97316)
  - Medium: Yellow (#eab308)
  - Low: Green (#22c55e)
- **Backgrounds:**
  - Light mode: White (#ffffff) and Light Gray (#f8f9fa)
  - Dark mode: Dark Gray (#0f0f0f) and Charcoal (#1a1a1a)

#### 5.3 Typography
- **Font Family:** Inter (sans-serif)
- **Headings:** Bold, large sizes for hierarchy
- **Body:** 16px base, readable line height

---

### 6. Technical Architecture

#### 6.1 Tech Stack
- **Frontend:** Pure HTML, CSS, JavaScript (Vanilla JS)
- **Storage:** Browser LocalStorage
- **No Backend:** Fully client-side application

#### 6.2 Data Structure
```javascript
{
  id: timestamp,
  name: string,
  className: string,
  dueDate: ISO datetime,
  gradeWeight: number (0-100),
  estimatedHours: number,
  currentGrade: number (0-100),
  priorityScore: number (calculated),
  priorityLevel: 'critical' | 'high' | 'medium' | 'low',
  status: 'not_started' | 'in_progress' | 'completed',
  completedAt: timestamp,
  notes: string
}
```

#### 6.3 Priority Calculation Algorithm
```javascript
function calculatePriority(assignment) {
  // Time urgency (0-40 points)
  const hoursUntilDue = (new Date(dueDate) - now) / (1000 * 60 * 60);
  let urgencyScore = 0;
  if (hoursUntilDue < 24) urgencyScore = 40;
  else if (hoursUntilDue < 48) urgencyScore = 30;
  else if (hoursUntilDue < 72) urgencyScore = 20;
  else if (hoursUntilDue < 168) urgencyScore = 10;

  // Grade weight impact (0-30 points)
  const weightScore = (gradeWeight / 100) * 30;

  // Workload consideration (0-20 points)
  let workloadScore = 0;
  if (estimatedHours > 10) workloadScore = 20;
  else if (estimatedHours > 5) workloadScore = 15;
  else if (estimatedHours > 2) workloadScore = 10;
  else workloadScore = 5;

  // Current grade impact (0-10 points)
  const gradeImpactScore = (100 - currentGrade) / 10;

  return urgencyScore + weightScore + workloadScore + gradeImpactScore;
}
```

---

### 7. User Flow

1. **First Visit:**
   - See empty state with "Add Your First Assignment" CTA
   - Click "Add Assignment" button

2. **Add Assignment:**
   - Fill in assignment details form
   - Click "Add Assignment"
   - See assignment appear in dashboard with calculated priority

3. **View Assignments:**
   - Default priority view shows sorted list
   - Switch between different views (Timeline, Calendar, Class, Week)
   - Use search to find specific assignments
   - Filter by priority level

4. **Manage Assignments:**
   - Click "Start" to mark as in progress
   - Click "Complete" to mark as done (confetti animation!)
   - Edit assignment details
   - Delete assignments

5. **Track Progress:**
   - Toggle "Hide Completed" to focus on active work
   - View completion history
   - See how many assignments completed

---

### 8. Success Metrics

**User Engagement:**
- Number of assignments added
- Daily active users returning to check dashboard
- Feature usage (which views most popular)

**User Outcomes:**
- Reduced missed deadlines
- Better grade distribution awareness
- Improved time management

---

### 9. Future Enhancements (V2)

1. **Notifications:**
   - Browser notifications for upcoming deadlines
   - Email reminders

2. **Analytics:**
   - Completion rate trends
   - Time management insights
   - Grade predictions

3. **Integrations:**
   - Import from Canvas/Blackboard
   - Export to Google Calendar
   - Sync across devices

4. **Collaboration:**
   - Share assignments with study groups
   - Team projects support

5. **AI Enhancements:**
   - Smart time blocking suggestions
   - Workload balancing recommendations
   - Study session planning

---

### 10. Development Phases

**Phase 1: Core MVP** ✅
- Assignment input form
- Priority calculation algorithm
- Priority view dashboard
- Basic CRUD operations
- LocalStorage persistence

**Phase 2: Enhanced Views** ✅
- Timeline view
- Calendar view
- Class-grouped view
- This week filter

**Phase 3: UI Polish** ✅
- Dark mode
- Animations and transitions
- Responsive design
- Accessibility improvements

**Phase 4: Advanced Features** ✅
- Search functionality
- Priority filtering
- Progress tracking
- Completion history

**Phase 5: Analytics & Insights**
- Dashboard statistics
- Completion trends
- Time management insights

---

### 11. Constraints & Assumptions

**Constraints:**
- No backend/database (must use LocalStorage)
- Single-user experience (no multi-user support)
- No real-time sync across devices

**Assumptions:**
- Users have modern browsers with LocalStorage support
- Users are comfortable entering assignment details manually
- Users check dashboard regularly

---

### 12. Success Criteria

The product is successful if:
1. ✅ Users can add and manage assignments easily
2. ✅ Priority algorithm accurately reflects urgency
3. ✅ Dashboard is intuitive and requires minimal learning
4. ✅ All data persists across browser sessions
5. ✅ UI is responsive and accessible
6. ✅ Users report reduced stress about deadlines

---

**Document Version:** 1.0
**Last Updated:** October 1, 2024
**Status:** Development Complete - Phase 4
