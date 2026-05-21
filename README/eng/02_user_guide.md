# 2. User Guide

KlassMarket serves three user roles: **Parents**, **Teachers**, and **Admins**. Each role has a distinct workflow described below.

---

## 2.1. Parent Workflow

### Registration and Onboarding

1. **Register** via VK ID, Yandex ID, or email + password.
2. **Verify email** (confirmation link sent automatically).
3. **Complete the onboarding quiz**: specify the number of children, their ages (3-18), interests (from a predefined list), and preferred class format (group / individual).
4. The system creates child profiles and generates a personalized recommendation feed.

### Finding Classes

1. **Browse the catalog** on the home page or use the search bar.
2. **Apply filters**: age group (3-5, 6-8, 9-11, 12-14, 15-18), subject category (programming, math, English, arts, etc.), price range, format (group / individual / trial), day of week and time, teacher rating (4.0+).
3. **View a class card** with full details: description, teacher profile (photo, rating, reviews, experience), upcoming sections schedule, price per session and per course, age range, spots available, and parent reviews.
4. **See AI recommendations** personalized for each child's age and interests.

### Enrolling and Paying

1. **Sign up for a free trial** (if the class offers one) -- select a child, confirm, and receive an email with details.
2. **Pay for a course** via YooKassa (bank card, SBP, YooMoney). On successful payment:
   - Enrollment status changes to "confirmed"
   - Fiscal receipt is sent by email (54-FZ compliance)
   - Teacher receives the payout amount (minus platform commission)

### Attending Classes

1. A **"Join class"** button appears 15 minutes before the scheduled start time.
2. Clicking it opens a Jitsi/LiveKit video room with camera, microphone, chat, and screen sharing (teacher only).
3. The parent receives a push notification when the child successfully joins.
4. Recorded sessions (if enabled by the teacher) are available for replay in the class card.

### Tracking Progress

- View the child's dashboard: attended/missed sessions, teacher feedback, XP, level, streak, and earned badges.
- Track enrollments across all active and completed courses.

### Leaving Reviews

- After completing a class, leave a star rating (1-5) and a text review.
- Reviews go through moderation before being published.

---

## 2.2. Teacher Workflow

### Registration and Verification

1. **Register** as a teacher (email, VK ID, or Yandex ID).
2. **Fill out the teacher profile**: bio, education, specializations, years of experience, diploma upload, optional intro video, background check document.
3. **Submit for verification** -- admin reviews credentials and approves (or rejects with feedback).
4. Once verified, the profile status changes to "active" and the teacher can create classes.

### Creating Classes

1. **Create a class**: title, description (Markdown), category, age range (min-max), format (one-time, multi-session course, ongoing), duration per session (minutes), max students per group (up to 12), price per session (in rubles), optional course bundle price, cover image, tags.
2. **Add sections** (scheduled sessions): date, time, timezone, trial flag.
3. **Submit for moderation** -- admins review content before publishing.

### Teaching

1. The teacher dashboard shows upcoming sections, enrolled students, and earnings.
2. Open the video room from the dashboard when it is time to teach.
3. In the video room: camera, microphone, screen sharing, chat, recording toggle, participant management (mute, remove).
4. After the session, mark attendance and optionally leave feedback for each child.

### Earnings

- Platform commission: 20-25% (average 22%) of the class price.
- Teacher receives 78% of each payment.
- View earnings breakdown, pending payouts, and withdrawal history in the financial dashboard.
- Request a withdrawal to a bank account (manual process via admin or automated payout).

---

## 2.3. Admin Workflow

### Class Moderation

1. Review newly submitted classes in the moderation queue.
2. Approve, request changes, or reject (with a reason).
3. Published classes appear in the catalog and search results.

### Teacher Verification

1. Review teacher applications: check uploaded diplomas, background documents, and profile completeness.
2. Approve or reject (with feedback).
3. Monitor teacher performance via ratings and review reports.

### Review Moderation

1. Review flagged or newly submitted parent reviews.
2. Publish, hide, or delete reviews that violate platform policies.

### Analytics Dashboard

- **Key metrics**: DAU/MAU, new registrations, total classes, enrollment rate, revenue, average check, teacher payouts, conversion funnel.
- **Operational metrics**: moderation queue length, average approval time, support tickets.

### User Management

- Search users by email, name, or role.
- View user profiles, enrollment history, and payment history.
- Suspend or delete accounts (soft delete with 30-day data retention).

---

## 2.4. Gamification System

KlassMarket includes a gamification layer for children to encourage engagement:

| Element | Description |
|---------|-------------|
| **XP (Experience Points)** | Earned by attending classes, completing courses, and maintaining streaks |
| **Levels** | Progressive levels unlocked by accumulating XP |
| **Badges** | Achievement-based awards (e.g., "First Class", "10-Day Streak", "Science Explorer") |
| **Streaks** | Consecutive days with at least one class attended |

Progress is visible in the child's profile and the parent's dashboard.
