# Church Role & Department Structure

## Overview

The Covenant app implements a comprehensive church organizational structure with:
- **Church-wide roles** - Leadership and officer positions at the church level
- **Departments** - Organized divisions of the church (Media, Choir, Ushers, etc.)
- **Department roles** - Officer positions within each department

---

## Church-Wide Roles

All users start as `member`. Admins can assign church-wide roles as needed.

### Role Hierarchy (Highest to Lowest Authority)

#### 1. **Admin** (Level 11)
- **Authority**: System administrator
- **Purpose**: Full app control, system management
- **Can Do**: Everything
- **Notes**: Technical system role, separate from church hierarchy

#### 2. **Gen Overseer** (Level 10)
- **Title**: General Overseer
- **Authority**: Highest church authority
- **Can Do**: User management, role assignment, all church operations
- **Common Tasks**: Oversee entire church operations, assign senior leadership

#### 3. **Senior Pastor** (Level 9)
- **Authority**: Senior pastoral leadership
- **Can Do**: Sermon creation, event management, user approval, content moderation
- **Typical Tasks**: Preach sermons, lead services, oversee pastoral operations

#### 4. **Pastor** (Level 8)
- **Authority**: Pastoral leadership
- **Can Do**: Sermon creation, event management, user approval, content moderation
- **Typical Tasks**: Preach sermons, conduct services, pastoral care

#### 5. **Church Committee Chairman** (Level 7)
- **Authority**: Committee leadership
- **Can Do**: Event management, department oversight, document access
- **Typical Tasks**: Lead church committee, coordinate church operations

#### 6. **Church Committee Secretary** (Level 6)
- **Authority**: Committee support
- **Can Do**: Event management, document management, attendance tracking
- **Typical Tasks**: Record committee meetings, manage documents, track attendance

#### 7. **Secretary** (Level 3)
- **Authority**: General administrative
- **Can Do**: Event management, document creation, user assistance
- **Typical Tasks**: Schedule events, manage documents, support other officers

#### 8. **Treasurer** (Level 5)
- **Authority**: Financial management
- **Can Do**: View/create/update financial records, financial reporting
- **Typical Tasks**: Manage church finances, create financial reports, track donations

#### 9. **Pro** (Level 4)
- **Title**: Public Relation Officer (Propagandist)
- **Authority**: Communications and publicity
- **Can Do**: Blog creation, content moderation, event promotion
- **Typical Tasks**: Write blog posts, manage social media, promote church activities

#### 10. **Media** (Level 2)
- **Authority**: Media operations
- **Can Do**: Upload media, manage livestreams, sermon uploads
- **Typical Tasks**: Record services, manage photos/videos, handle livestreams

#### 11. **Member** (Level 1)
- **Authority**: None
- **Can Do**: View public content, post to feed, participate in discussions
- **Notes**: Default role for new users

---

## Departments

Departments are organizational divisions. Users can belong to multiple departments. Department membership determines access to department-specific features.

### Available Departments

1. **Media**
   - Purpose: All media-related operations
   - Department Roles: Coordinator, Assistant Coordinator, Secretary, Treasurer, Pro

2. **Choir**
   - Purpose: Church choir and music ministry
   - Department Roles: Coordinator, Assistant Coordinator, Secretary, Treasurer

3. **Ushers**
   - Purpose: Church ushering/welcoming ministry
   - Department Roles: Coordinator, Assistant Coordinator, Secretary

4. **Drama**
   - Purpose: Church drama/skit ministry
   - Department Roles: Coordinator, Assistant Coordinator, Secretary, Treasurer

5. **Covenant Men**
   - Purpose: Men's fellowship group
   - Department Roles: Coordinator, Assistant Coordinator, Secretary, Treasurer

6. **Covenant Women**
   - Purpose: Women's fellowship group
   - Department Roles: Coordinator, Assistant Coordinator, Secretary, Treasurer

7. **Covenant Youth**
   - Purpose: Youth ministry group
   - Department Roles: Coordinator, Assistant Coordinator, Secretary, Treasurer, Pro

8. **Covenant Children**
   - Purpose: Children's ministry group
   - Department Roles: Coordinator, Assistant Coordinator, Secretary, Treasurer

---

## Department Roles

Each department has internal officer positions. These roles only apply within their department (scoped access).

### Department-Specific Roles

#### **Coordinator** (Level 1.5)
- **Authority**: Department leadership
- **Can Do**: 
  - Update department information
  - View department members
  - Manage department events
  - Create department documents
- **Typical Tasks**: Lead department, manage activities, report to church leadership

#### **Assistant Coordinator** (Level 1.2)
- **Authority**: Department support
- **Can Do**:
  - View department information
  - View department members
  - Support coordinator activities
- **Typical Tasks**: Support coordinator, help with department operations

#### **Secretary** (Department Level)
- **Authority**: Department administrative
- **Can Do**:
  - Create/manage department documents
  - Track department attendance
  - Record department meetings
- **Typical Tasks**: Keep records, manage meetings, track attendance

#### **Treasurer** (Department Level)
- **Authority**: Department financial
- **Can Do**:
  - View department finances
  - Record department donations
  - Create financial reports
- **Typical Tasks**: Manage department budget, track donations, report finances

#### **Pro** (Department Level)
- **Authority**: Department communications
- **Can Do**:
  - Create department posts
  - Promote department activities
  - Moderate department content
- **Typical Tasks**: Promote activities, manage department blog/social media

---

## Role Assignment Workflow

### For Admin/Gen Overseer

1. **Assigning a Church Role**
   ```
   PATCH /api/admin/users/{userId}/assign-role
   {
     "role": "pastor"
   }
   ```

2. **Adding to a Department**
   ```
   PATCH /api/admin/users/{userId}/assign-department
   {
     "department": "media",
     "department_role": "coordinator"  // optional, just adds to department
   }
   ```

3. **Full Example**
   - Create user → Starts as `member`
   - Assign role → User becomes `pastor`
   - Add to department → User becomes part of Media department
   - User now has: `role: pastor` + `departments: ["media"]`

---

## User Access Levels

### 1. **Regular Member**
- Role: `member`
- Departments: None
- Access: View public content, post to feed

### 2. **Department Member**
- Role: `member`
- Departments: One or more (Media, Choir, etc.)
- Access: Department-specific features, view member content

### 3. **Department Executive**
- Role: `coordinator` or `assistant_coordinator`
- Departments: One (their department)
- Access: Manage their department, limited administrative features

### 4. **Church Officer**
- Role: Any church role (pastor, secretary, treasurer, etc.)
- Departments: Optional
- Access: Church-level features based on role

### 5. **Church Leader**
- Role: gen_overseer, senior_pastor, or pastor
- Departments: Optional
- Access: Leadership features, user management, content moderation

### 6. **System Administrator**
- Role: `admin`
- Departments: Any
- Access: Full system control

---

## Permission Model

### Permission Levels

```
Admin (11)
  ↓
Gen Overseer (10)
  ↓
Senior Pastor (9)
  ↓
Pastor (8)
  ↓
Church Committee Chairman (7)
  ↓
Treasurer (5)
  ↓
Pro (4)
  ↓
Media (2)
  ↓
Coordinator (1.5)
  ↓
Assistant Coordinator (1.2)
  ↓
Member (1)
```

### Permission Examples

| Feature | Admin | Gen Overseer | Pastor | Secretary | Pro | Media | Member |
|---------|-------|--------------|--------|-----------|-----|-------|--------|
| View Users | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create Users | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Assign Roles | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create Sermons | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Upload Media | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Moderate Content | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| View Finance | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage Finance | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Post to Feed | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## API Endpoints

### Admin User Management

All endpoints require `admin` or `gen_overseer` role.

#### Assign Church Role
```
POST /api/admin/users/{userId}/assign-role
Content-Type: application/json

{
  "role": "pastor"
}
```

Valid roles:
- gen_overseer
- senior_pastor
- pastor
- church_committee_chairman
- church_committee_secretary
- secretary
- treasurer
- pro
- media

#### Remove Church Role
```
POST /api/admin/users/{userId}/remove-role
```

Reverts user back to `member`.

#### Add to Department
```
POST /api/admin/users/{userId}/assign-department
Content-Type: application/json

{
  "department": "media",
  "role": "coordinator"  // Optional
}
```

Valid departments:
- media, choir, ushers, drama
- covenant_men, covenant_women, covenant_youth, covenant_children

#### Remove from Department
```
POST /api/admin/users/{userId}/remove-department
Content-Type: application/json

{
  "department": "media"
}
```

#### Suspend User
```
POST /api/admin/users/{userId}/suspend
Content-Type: application/json

{
  "reason": "Policy violation"
}
```

User cannot access app until restored.

#### Restore User
```
POST /api/admin/users/{userId}/restore
```

---

## Mobile App Permission Utilities

### Available Functions

```typescript
import * as rolePermissions from '@/utils/rolePermissions';

// Leadership checks
rolePermissions.hasLeadershipAccess(role)      // gen_overseer, senior_pastor, pastor, etc.
rolePermissions.hasAdminAccess(role)           // Only admin
rolePermissions.hasMediaAccess(role)           // admin, gen_overseer, senior_pastor, pastor, media
rolePermissions.canModerateContent(role)       // admin, gen_overseer, senior_pastor, pastor, media, pro, coordinator

// Department checks
rolePermissions.hasMediaDepartment(departments)
rolePermissions.hasChoirDepartment(departments)
rolePermissions.hasCovenantMenDepartment(departments)
rolePermissions.hasCovenantWomenDepartment(departments)
rolePermissions.hasCovenantYouthDepartment(departments)
rolePermissions.hasCovenantChildrenDepartment(departments)
rolePermissions.hasDramaDepartment(departments)
rolePermissions.hasUshersDepartment(departments)

// Role checks
rolePermissions.isExecutive(role)               // All church officers and coordinators
rolePermissions.isCoordinator(role)             // Coordinators and assistant coordinators
rolePermissions.isMember(role)                  // No role (member)
```

---

## Common Scenarios

### Scenario 1: Add Someone to Media Department
1. User registers → becomes `member`
2. Admin assigns role → e.g., `coordinator`
3. Admin adds to Media department → `departments: ["media"]`
4. User can now upload media, manage department activities

### Scenario 2: Church Committee Setup
1. Create chairman → Assign role `church_committee_chairman`
2. Create secretary → Assign role `church_committee_secretary`
3. Optionally add treasurer → Assign role `treasurer`
4. All can access committee features and create documents

### Scenario 3: Department Team
1. Create coordinator → Role: `member`, Assign to choir department with `coordinator` title
2. Create assistants → Role: `member`, Assign to choir department as `assistant_coordinator`
3. Create secretary → Role: `member`, Assign to choir department as `secretary`
4. Choir department is now fully staffed

### Scenario 4: Suspend Problematic User
1. Admin reviews user
2. Admin suspends user: `POST /api/admin/users/{id}/suspend`
3. User immediately cannot access app
4. Later, admin can restore: `POST /api/admin/users/{id}/restore`

---

## Database Schema

### Users Table
```sql
ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'member';
ALTER TABLE users ADD COLUMN departments JSON;
ALTER TABLE users ADD COLUMN is_approved TINYINT(1) DEFAULT 1;
```

### Audit Logs Table (Auto-created)
```sql
CREATE TABLE audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  admin_id INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  old_value VARCHAR(255),
  new_value VARCHAR(255),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_admin_id (admin_id),
  INDEX idx_timestamp (timestamp)
);
```

---

## Migration Notes

### Old Role Structure → New Structure

| Old Role | New Role | Notes |
|----------|----------|-------|
| super_admin | admin | System role only |
| elder | gen_overseer/pastor | Map based on responsibility |
| deacon | coordinator | Map to department coordinator |
| choir | Not a role | Now a department only |
| media_head | media | Now just "media" |
| department_head | coordinator | Now department-scoped |
| finance | treasurer | Financial authority |

---

## Best Practices

### 1. **Role Assignment**
- Start users as `member`
- Only assign roles when they take on responsibilities
- Use church roles for top-level positions
- Use department roles for department-specific positions

### 2. **Department Organization**
- Assign users to departments they actually belong to
- Use department roles to structure within each department
- Allow users to belong to multiple departments if needed

### 3. **Security**
- Only admin/gen_overseer can assign roles
- Suspended users have immediate access revocation
- All changes are audited in `audit_logs`
- Regular reviews of user access

### 4. **Mobile App**
- Use utility functions for permission checks
- Always check both role AND departments
- Example: `if (hasLeadershipAccess(role) || hasMediaDepartment(departments))`

---

## Future Enhancements

1. **Email Notifications** - Notify users when roles change
2. **Role Approval** - Require approval for sensitive roles
3. **Self-Service Requests** - Users can request department membership
4. **Role Templates** - Pre-configured role combinations
5. **Session Management** - Force logout of suspended users
6. **Two-Factor Auth** - For admin/leadership accounts

