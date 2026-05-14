# Calendar System - Complete Implementation Guide

## Overview

The Covenant app includes a comprehensive **yearly calendar system** for:
1. **Church Activities & Programs** - Admin-uploaded yearly schedule
2. **Birthday Management** - Automatic birthday reminders
3. **Automatic Reminders** - Daily email & WhatsApp notifications

### Key Features

✅ **Daily Event Reminders** - Starting 3 months before event, sent every day until event date  
✅ **Birthday Greetings** - Automatic message at 6:00 AM on birthday  
✅ **Multi-channel** - Sends via Email (Brevo) & WhatsApp Business API  
✅ **Privacy Control** - Members can hide their birthday if desired  
✅ **Admin Dashboard** - View calendars, manage events, check reminder logs  
✅ **Automatic Scheduling** - Uses cron jobs, no manual intervention needed  

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────┐
│           Calendar System Architecture            │
├─────────────────────────────────────────────────┤
│                                                   │
│  Frontend (Mobile/Web)                           │
│  ├─ Calendar View (upcoming events & birthdays) │
│  ├─ Event Details                                │
│  └─ Birthday Settings (show/hide)               │
│                                                   │
│  Backend API                                     │
│  ├─ /api/calendar (events, birthdays)           │
│  ├─ /api/calendar/admin (admin management)      │
│  └─ Routes: calendar.routes.ts, calendarAdmin   │
│                                                   │
│  Services                                        │
│  ├─ calendarReminder.service.ts (sending logic) │
│  ├─ calendarScheduler.ts (cron jobs)            │
│  ├─ whatsapp.service.ts (WhatsApp API)          │
│  └─ notification.service.ts (email via Brevo)  │
│                                                   │
│  Database Tables                                 │
│  ├─ calendar_events                             │
│  ├─ reminder_logs                               │
│  ├─ birthday_greetings_sent                     │
│  ├─ user_settings                               │
│  └─ whatsapp_logs                               │
│                                                   │
│  Scheduler (Cron Jobs)                          │
│  ├─ 9:00 AM daily → Send event reminders       │
│  ├─ 6:00 AM daily → Send birthday greetings    │
│  └─ Automatic retry on failure                  │
│                                                   │
└─────────────────────────────────────────────────┘
```

---

## Event Reminder System

### How It Works

1. **Event Created** → Admin creates event for specific date via API
2. **3+ Months Before** → System starts tracking the event
3. **Daily at 9:00 AM** → Scheduler checks for events within 3-month window
4. **For Each Event** → Sends reminder to ALL active members
5. **Daily Emails** → Members get email reminder every day
6. **Daily WhatsApp** → WhatsApp message sent to members with phone numbers
7. **Event Day** → Final reminder sent on the day of event
8. **After Event** → No more reminders (event date passed)

### Reminder Content

**Email:**
```
Subject: 📅 Reminder: [Event Title] - [Days] days away!

Hi [Member Name],

This is a reminder about an upcoming church activity:

[Event Title]
📅 Date: [Day], [Month] [Date], [Year]
⏳ Days remaining: [Number] days
📝 Details: [Description]

We look forward to your participation!

Blessings,
The Church Team
```

**WhatsApp:**
```
🙏 *Church Activity Reminder* 🙏

Hi [Member Name],

📅 *[Event Title]*
📆 Date: [Day], [Month] [Date], [Year]
⏳ In [Number] day(s)!

[Optional Description]

See you there!
```

### Example Timeline

For an event on **June 1, 2025**:

```
Today: March 1, 2025 (92 days before)
↓
March 2 - June 1: DAILY reminders sent at 9:00 AM
├─ March 2: "92 days away"
├─ March 3: "91 days away"
├─ ...
├─ May 31: "1 day away"
└─ June 1: "TODAY! Event is happening!"
↓
June 2, 2025: Reminders stop (event passed)
```

---

## Birthday Greeting System

### How It Works

1. **User Registers** → Date of birth stored in database
2. **Each Day at 6:00 AM** → System checks for birthdays today
3. **Birthday Found** → Sends message to birthday person
4. **Greeting Type** → Birthday message + Church family notified
5. **Privacy** → Only shown if user hasn't hidden their birthday
6. **Once Per Day** → Prevents duplicate greetings

### Birthday Message

**To Birthday Person - Email:**
```
Subject: 🎉 Happy Birthday, [Name]!

🎂 Happy Birthday! 🎂

Dear [Name],

Wishing you a blessed and wonderful birthday!
We pray God's favor, joy, and protection over you.

You are turning [Age] today! 🎉

May this year bring you closer to God's purpose.

With love and prayers,
The Church Family
```

**To Birthday Person - WhatsApp:**
```
🎂 *Happy Birthday, [Name]!* 🎂

Wishing you a blessed and wonderful birthday!
We pray God's favor and joy over you.

You are [Age] today! 🎉

May this year be filled with God's grace and blessings.

With love from the Church Family ❤️
```

**To Other Members - Email:**
```
Subject: 🎉 Today is [Birthday Person]'s birthday!

Hi [Member Name],

Today is [Birthday Person]'s birthday! 🎉
They are turning [Age] today.

Why not send a birthday blessing or encouragement message?

Blessings,
The Church Team
```

---

## API Endpoints

### Admin Endpoints

#### Create Event
```
POST /api/calendar/admin/events
Authorization: Bearer [JWT_TOKEN]
Content-Type: application/json

{
  "title": "Annual General Meeting",
  "description": "Church annual general assembly",
  "eventDate": "2025-12-15 10:00:00",
  "eventType": "activity",  // or "service", "meeting"
  "notes": "Bring family members"
}

Response:
{
  "message": "Event created successfully",
  "eventId": 1,
  "event": {...}
}
```

#### Update Event
```
PUT /api/calendar/admin/events/:eventId
Authorization: Bearer [JWT_TOKEN]
Content-Type: application/json

{
  "title": "Updated Event Name",
  "description": "Updated description",
  "eventDate": "2025-12-20 10:00:00",
  "isActive": true
}
```

#### Delete Event
```
DELETE /api/calendar/admin/events/:eventId
Authorization: Bearer [JWT_TOKEN]
```

#### List All Events (Admin)
```
GET /api/calendar/admin/events?status=active&type=activity&limit=50&offset=0
Authorization: Bearer [JWT_TOKEN]

Response:
{
  "events": [{...}],
  "total": 15,
  "limit": 50,
  "offset": 0
}
```

### Member Endpoints

#### View Calendar
```
GET /api/calendar/calendar
Authorization: Bearer [JWT_TOKEN]

Response:
{
  "events": [
    {
      "id": 1,
      "title": "Annual Meeting",
      "eventDate": "2025-12-15",
      "daysUntil": 276,
      "description": "..."
    }
  ],
  "birthdays": [
    {
      "id": 5,
      "firstName": "John",
      "lastName": "Doe",
      "dateOfBirth": "1990-06-15",
      "daysUntil": 45
    }
  ],
  "total": 8
}
```

#### Get All Events
```
GET /api/calendar/events?type=activity
Authorization: Bearer [JWT_TOKEN]

Response:
{
  "events": [{...}]
}
```

#### Get Single Event
```
GET /api/calendar/events/:eventId
Authorization: Bearer [JWT_TOKEN]

Response:
{
  "event": {...}
}
```

#### Get Birthday Settings
```
GET /api/calendar/birthday-settings
Authorization: Bearer [JWT_TOKEN]

Response:
{
  "showBirthday": true
}
```

#### Update Birthday Settings
```
PUT /api/calendar/birthday-settings
Authorization: Bearer [JWT_TOKEN]
Content-Type: application/json

{
  "showBirthday": false  // Hide birthday from calendar
}
```

### Admin Management Endpoints

#### Setup Calendar Database (First Time)
```
POST /api/calendar/admin/setup-calendar
Authorization: Bearer [ADMIN_TOKEN]

Response:
{
  "success": true,
  "message": "Calendar database initialized successfully"
}
```

#### Get Scheduler Status
```
GET /api/calendar/admin/scheduler-status
Authorization: Bearer [ADMIN_TOKEN]

Response:
{
  "status": {
    "isActive": true,
    "jobCount": 2,
    "jobs": [
      {
        "name": "Daily Event Reminders",
        "schedule": "0 9 * * * (9:00 AM daily)",
        "enabled": true
      },
      {
        "name": "Birthday Greetings",
        "schedule": "0 6 * * * (6:00 AM daily)",
        "enabled": true
      }
    ]
  }
}
```

#### Manually Trigger Event Reminders
```
POST /api/calendar/admin/trigger-event-reminders
Authorization: Bearer [ADMIN_TOKEN]

Response:
{
  "success": true,
  "message": "Event reminders sent"
}
```

#### Manually Trigger Birthday Greetings
```
POST /api/calendar/admin/trigger-birthdays
Authorization: Bearer [ADMIN_TOKEN]

Response:
{
  "success": true,
  "message": "Birthday greetings sent"
}
```

#### View Reminder Logs
```
GET /api/calendar/admin/reminder-logs?type=event&limit=100&offset=0
Authorization: Bearer [ADMIN_TOKEN]

Response:
{
  "logs": [
    {
      "id": 1,
      "eventId": 1,
      "userId": 5,
      "reminderType": "event",
      "daysRemaining": 45,
      "sentAt": "2025-03-05T09:00:00Z"
    }
  ],
  "total": 250
}
```

#### View WhatsApp Logs
```
GET /api/calendar/admin/whatsapp-logs?status=sent&limit=100
Authorization: Bearer [ADMIN_TOKEN]

Response:
{
  "logs": [
    {
      "id": 1,
      "phoneNumber": "+1234567890",
      "message": "🎂 Happy Birthday!...",
      "status": "sent",
      "messageId": "wamid.xxx",
      "sentAt": "2025-03-05T06:00:00Z"
    }
  ],
  "total": 1200
}
```

#### View Calendar Statistics
```
GET /api/calendar/admin/calendar-stats
Authorization: Bearer [ADMIN_TOKEN]

Response:
{
  "totalEvents": 45,
  "upcomingEvents": 12,
  "birthdayUsers": 250,
  "reminderssentToday": 450,
  "birthdaysGreetedToday": 3
}
```

---

## Environment Configuration

### Required Variables

```env
# WhatsApp Business API
WHATSAPP_API_URL=https://graph.instagram.com/v18.0
WHATSAPP_PHONE_ID=your-phone-id
WHATSAPP_ACCESS_TOKEN=your-access-token
WHATSAPP_FROM_PHONE=+1234567890
WHATSAPP_WEBHOOK_TOKEN=test_token

# Calendar Settings
CALENDAR_REMINDER_ENABLED=true
CALENDAR_BIRTHDAY_ENABLED=true

# Email (already configured via Brevo)
EMAIL_HOST=smtp-relay.brevo.com
EMAIL_USER=ab4311001@smtp-brevo.com
EMAIL_PASSWORD=your-brevo-password
```

---

## Database Schema

### calendar_events Table
```sql
CREATE TABLE calendar_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description LONGTEXT,
  event_date DATETIME NOT NULL,
  event_type ENUM('activity', 'birthday', 'service', 'meeting', 'anniversary'),
  notes LONGTEXT,
  created_by INT NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_event_date (event_date),
  INDEX idx_event_type (event_type),
  INDEX idx_is_active (is_active)
);
```

### reminder_logs Table
```sql
CREATE TABLE reminder_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  user_id INT NOT NULL,
  reminder_type ENUM('event', 'birthday'),
  days_remaining INT,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES calendar_events(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY unique_daily_reminder (event_id, user_id, DATE(sent_at))
);
```

### birthday_greetings_sent Table
```sql
CREATE TABLE birthday_greetings_sent (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY unique_daily_birthday (user_id, DATE(sent_at))
);
```

### user_settings Table
```sql
CREATE TABLE user_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNIQUE NOT NULL,
  show_birthday TINYINT(1) DEFAULT 1,
  notification_email TINYINT(1) DEFAULT 1,
  notification_whatsapp TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## Setup Instructions

### Step 1: Run Database Migration

```bash
cd server
npx ts-node src/scripts/setupCalendarDatabase.ts
```

Or via API:
```bash
curl -X POST http://localhost:5000/api/calendar/admin/setup-calendar \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Step 2: Configure WhatsApp

1. Get WhatsApp Business API credentials from Meta/Facebook
2. Update `.env` with:
   - `WHATSAPP_PHONE_ID`
   - `WHATSAPP_ACCESS_TOKEN`
   - `WHATSAPP_FROM_PHONE`

### Step 3: Verify Scheduler is Running

```bash
# Check logs
tail -f logs/app.log | grep "scheduler"

# Or via API
curl http://localhost:5000/api/calendar/admin/scheduler-status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Step 4: Create Test Events

```bash
# Admin creates an event
curl -X POST http://localhost:5000/api/calendar/admin/events \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Event",
    "description": "Testing calendar system",
    "eventDate": "2025-06-15 10:00:00",
    "eventType": "activity"
  }'
```

### Step 5: Test Reminders

```bash
# Manually trigger event reminders
curl -X POST http://localhost:5000/api/calendar/admin/trigger-event-reminders \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Manually trigger birthday greetings
curl -X POST http://localhost:5000/api/calendar/admin/trigger-birthdays \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## Scheduling Details

### Automatic Jobs

#### Event Reminders
- **Time:** Every day at 9:00 AM
- **Action:** Sends reminder for all events within 3 months
- **Recipients:** All active members with email/phone
- **Retry:** Automatic retry on failure

#### Birthday Greetings
- **Time:** Every day at 6:00 AM
- **Action:** Sends birthday message to birthday person + notifies others
- **Recipients:** Birthday person + all other members
- **Frequency:** Once per birthday (prevents duplicates)

### Cron Expressions

```
Event Reminders:  0 9 * * * (9:00 AM every day)
Birthday Greetings: 0 6 * * * (6:00 AM every day)
```

### Timezone

Adjust cron times based on your server timezone. The scheduler uses the server's system time.

---

## Testing Checklist

- [ ] Calendar database tables created
- [ ] Admin can create events
- [ ] Admin can update events
- [ ] Admin can delete events
- [ ] Members can view calendar
- [ ] Members can see upcoming events
- [ ] Members can see upcoming birthdays
- [ ] Members can hide their birthday
- [ ] Event reminders sent daily (9:00 AM)
- [ ] Birthday greetings sent at 6:00 AM
- [ ] WhatsApp messages received correctly
- [ ] Email notifications received
- [ ] Scheduler running without errors
- [ ] No duplicate reminders sent
- [ ] Admin can view reminder logs
- [ ] Admin can manually trigger reminders

---

## Troubleshooting

### Reminders Not Sending

**Issue:** Reminders aren't being sent at scheduled times

**Solutions:**
1. Check scheduler is running: `GET /api/calendar/admin/scheduler-status`
2. Check logs for errors: `grep "calendarReminder" server.log`
3. Verify WhatsApp credentials in `.env`
4. Check email configuration (Brevo)
5. Verify users have `is_approved=1` in database

### WhatsApp Messages Failed

**Issue:** WhatsApp messages show "failed" status

**Solutions:**
1. Verify `WHATSAPP_ACCESS_TOKEN` is valid
2. Verify `WHATSAPP_PHONE_ID` matches registered number
3. Check WhatsApp Business account status
4. Ensure phone numbers include country code (+)
5. Check `whatsapp_logs` table for detailed errors

### Birthday Not Showing on Calendar

**Issue:** User's birthday not visible

**Solutions:**
1. Check `date_of_birth` is set in users table
2. Check `show_birthday` in user_settings (should be 1)
3. Birthday might be in the past (shows only future dates)
4. User might have hidden their birthday

### Events Not Showing

**Issue:** Events not appearing in calendar

**Solutions:**
1. Check `is_active = 1` in calendar_events
2. Event date might be in the past
3. Check `event_type` is valid
4. Verify event is created by admin

---

## Future Enhancements

1. **Email Notification Preferences** - Let users choose frequency
2. **Calendar Sync** - Sync with Google Calendar, Outlook
3. **Event RSVP** - Members can RSVP to events
4. **Event Attendance** - Track who attended
5. **SMS Fallback** - If WhatsApp fails, send SMS
6. **Timezone Support** - Different timezones per user
7. **Event Series** - Recurring events (weekly, monthly)
8. **Custom Reminders** - Customize reminder times per event

---

## Files Created/Modified

### New Files
- ✅ `src/services/calendarReminder.service.ts` - Reminder logic
- ✅ `src/services/calendarScheduler.ts` - Cron jobs
- ✅ `src/services/whatsapp.service.ts` - WhatsApp integration
- ✅ `src/routes/calendar.routes.ts` - Public calendar routes
- ✅ `src/routes/calendarAdmin.routes.ts` - Admin management routes
- ✅ `src/scripts/setupCalendarDatabase.ts` - Database migration

### Modified Files
- ✅ `src/index.ts` - Added calendar routes and scheduler init
- ✅ `.env.example` - Added WhatsApp and calendar settings

---

## Summary

✅ **Complete Calendar System**
- Yearly event management
- Automatic daily reminders (3 months to event date)
- Birthday tracking and greetings
- Multi-channel notifications (Email + WhatsApp)
- Admin dashboard for management
- Automatic scheduling (cron jobs)
- Privacy controls (hide birthday)
- Comprehensive logging and monitoring

✅ **Production Ready**
- Error handling and retries
- Database migrations included
- Comprehensive documentation
- Testing instructions
- Troubleshooting guide

🚀 **Ready to Deploy**

