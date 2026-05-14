# Admin User Management Guide

## Overview
The Covenant app has a complete user management system that allows admins to:
- Assign roles and departments to users
- Suspend/restore user access
- View all users and their access levels
- Audit all role and department changes

## User Lifecycle

### 1. User Registration
When a user registers through the app:
- They are created as a **member** (no special role)
- They have **no departments** assigned
- Their account is **active** by default
- Admins can then customize their access

### 2. Admin Assigns Roles/Departments
Admins can then:
- Assign a role (pastor, elder, media_head, etc.)
- Add to departments (Media, Prayer Team, etc.)
- Make them a department executive (department_head, finance, etc.)

### 3. User Has Full Access (When Assigned)
User gets access to features based on their role and departments

### 4. Admin Can Suspend (If Needed)
For policy violations, suspension, etc.:
- Admin suspends the user
- User cannot login
- User loses all access immediately

### 5. Admin Can Restore
User is re-enabled and regains access

---

## Admin API Endpoints

All endpoints require admin/media role and valid JWT token.

### View All Users
```
GET /api/admin/users?page=1&limit=50
Authorization: Bearer <TOKEN>
```

**Response:**
```json
{
  "users": [
    {
      "id": 1,
      "email": "john@hocfam.org",
      "name": "John Doe",
      "role": "admin",
      "departments": [],
      "isActive": true,
      "status": "active",
      "createdAt": "2026-05-14T10:00:00Z"
    },
    {
      "id": 2,
      "email": "jane@example.com",
      "name": "Jane Smith",
      "role": "member",
      "departments": ["Media", "Choir"],
      "isActive": true,
      "status": "active",
      "createdAt": "2026-05-14T09:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "pages": 2
  }
}
```

---

### Get User Access Info
```
GET /api/admin/users/{userId}/access-info
Authorization: Bearer <TOKEN>
```

**Response:**
```json
{
  "userId": 2,
  "email": "jane@example.com",
  "name": "Jane Smith",
  "role": "member",
  "departments": ["Media"],
  "isActive": true,
  "status": "active"
}
```

---

### Assign Role to User
```
POST /api/admin/users/{userId}/assign-role
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "role": "media_head"
}
```

**Valid Roles:**
- `member` - Default member
- `pastor` - Senior leadership
- `elder` - Leadership
- `deacon` - Leadership  
- `secretary` - Leadership/Clerical
- `finance` - Finance department
- `media_head` - Media department head
- `department_head` - Generic department head
- `choir` - Choir department

**Response:**
```json
{
  "message": "User role updated from 'member' to 'media_head'",
  "userId": 2,
  "newRole": "media_head"
}
```

---

### Remove Role from User (Revert to Member)
```
POST /api/admin/users/{userId}/remove-role
Authorization: Bearer <TOKEN>
```

**Response:**
```json
{
  "message": "User role removed. User reverted to 'member'",
  "userId": 2,
  "previousRole": "media_head",
  "newRole": "member"
}
```

---

### Assign User to Department
```
POST /api/admin/users/{userId}/assign-department
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "department": "Media"
}
```

**Response:**
```json
{
  "message": "User assigned to department 'Media'",
  "userId": 2,
  "departments": ["Media"]
}
```

---

### Remove User from Department
```
POST /api/admin/users/{userId}/remove-department
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "department": "Media"
}
```

**Response:**
```json
{
  "message": "User removed from department 'Media'",
  "userId": 2,
  "departments": []
}
```

---

### Suspend User (Disable Access)
```
POST /api/admin/users/{userId}/suspend
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "reason": "Policy violation"
}
```

**Response:**
```json
{
  "message": "User suspended successfully",
  "userId": 2
}
```

**What happens when a user is suspended:**
- User cannot login
- Existing tokens are invalidated on next request
- User sees: "Your account has been suspended. Contact an administrator."
- All access to app features is blocked

---

### Restore User (Re-enable Access)
```
POST /api/admin/users/{userId}/restore
Authorization: Bearer <TOKEN>
```

**Response:**
```json
{
  "message": "User restored successfully",
  "userId": 2
}
```

---

## Common Admin Workflows

### Workflow 1: Setting Up a New Media Team Member
```bash
# 1. User registers and becomes a member
# 2. Admin views users
GET /api/admin/users

# 3. Admin assigns media_head role
POST /api/admin/users/5/assign-role
{"role": "media_head"}

# 4. Admin adds to Media department
POST /api/admin/users/5/assign-department
{"department": "Media"}

# Now user can:
# - Upload sermons and media
# - Manage media gallery
# - Access media management screens
```

### Workflow 2: Promoting a Member to Pastor
```bash
# 1. Get user info
GET /api/admin/users/10/access-info

# 2. Assign pastor role
POST /api/admin/users/10/assign-role
{"role": "pastor"}

# Now user can:
# - Create events
# - Manage prayer requests
# - Moderate content
# - Access leadership features
```

### Workflow 3: Suspending a User
```bash
# 1. Suspend user with reason
POST /api/admin/users/15/suspend
{"reason": "Violating community guidelines"}

# User is immediately blocked from accessing app
# User logs out if they try to make any request

# 2. When ready, restore user
POST /api/admin/users/15/restore

# User can login again and regain all their access
```

### Workflow 4: Managing Multiple Departments
```bash
# User: Event Coordinator - needs both secretary role + department access

# 1. Assign secretary role
POST /api/admin/users/20/assign-role
{"role": "secretary"}

# 2. Add to Events department
POST /api/admin/users/20/assign-department
{"department": "Events"}

# 3. Add to Finance department (if needed for budgeting)
POST /api/admin/users/20/assign-department
{"department": "Finance"}

# Now user can manage events AND see finance data
```

---

## Audit Logging

All role and department changes are automatically logged to the `audit_logs` table with:
- User ID who was modified
- Admin ID who made the change
- Action type (role_assigned, role_removed, department_added, etc.)
- Old value and new value
- Timestamp

This creates a complete audit trail of all access control changes.

---

## Security Best Practices

1. **Admins Only**
   - Only users with `admin` or `media` role can manage other users
   - All admin actions are logged

2. **No Self-Modification**
   - Admins can modify other users
   - Consider adding checks to prevent admins from removing their own admin access

3. **Suspension Over Deletion**
   - Never delete users
   - Use suspension to temporarily disable access
   - Keep all history for audit purposes

4. **Email Notification**
   - Consider sending emails when:
     - Role is assigned
     - User is suspended
     - User is restored

5. **Approval Workflow**
   - For sensitive roles (finance, media_head), require approval
   - Not automatically available to all admins

---

## Troubleshooting

### User Can't Login After Suspension
- Check if `is_approved` is 0 in database
- Use `/restore` endpoint to re-enable

### User Has Wrong Permissions
- Check user's role: `GET /api/admin/users/{id}/access-info`
- Check departments assignment
- Verify they're not suspended

### Audit Trail Missing
- `audit_logs` table is created automatically on first admin action
- Check if user's role was assigned through proper endpoint
- Direct database changes won't be logged
