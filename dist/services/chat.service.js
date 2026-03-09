"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDepartmentGroupAndAddMember = ensureDepartmentGroupAndAddMember;
exports.syncUserDepartmentGroups = syncUserDepartmentGroups;
exports.removeUserFromOldDepartmentGroups = removeUserFromOldDepartmentGroups;
exports.addUserToExecutiveGroup = addUserToExecutiveGroup;
exports.ensureGeneralGroupAndAddMember = ensureGeneralGroupAndAddMember;
exports.removeUserFromExecutiveGroup = removeUserFromExecutiveGroup;
const database_1 = __importDefault(require("../config/database"));
/**
 * Ensure a department group chat exists and add user to it
 * If group is newly created, add ALL users with that department
 */
async function ensureDepartmentGroupAndAddMember(userId, department) {
    const connection = await database_1.default.getConnection();
    try {
        await connection.beginTransaction();
        // Check if department group exists
        const [existingGroups] = await connection.execute('SELECT id FROM chat_groups WHERE department = ? AND type = ?', [department, 'department']);
        let groupId;
        let isNewGroup = false;
        if (existingGroups.length > 0) {
            // Group exists
            groupId = existingGroups[0].id;
        }
        else {
            // Create new department group (use the triggering user as creator)
            const [result] = await connection.execute('INSERT INTO chat_groups (name, description, type, department, created_by) VALUES (?, ?, ?, ?, ?)', [
                `${department} Department`,
                `Official chat group for ${department} department members`,
                'department',
                department,
                userId
            ]);
            groupId = result.insertId;
            isNewGroup = true;
            console.log(`Created new group chat for ${department} department (ID: ${groupId})`);
        }
        if (isNewGroup) {
            // Add ALL users who have this department to the group
            const [usersWithDept] = await connection.execute(`SELECT id FROM users WHERE JSON_CONTAINS(departments, ?, '$')`, [JSON.stringify(department)]);
            if (usersWithDept.length > 0) {
                // Bulk insert all members
                const memberValues = usersWithDept.map((u) => `(${groupId}, ${u.id})`).join(',');
                await connection.query(`INSERT INTO group_members (group_id, user_id) VALUES ${memberValues}`);
                console.log(`Added ${usersWithDept.length} users to ${department} department group`);
            }
        }
        else {
            // Group already exists, just add this user if not a member
            const [existingMember] = await connection.execute('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
            if (existingMember.length === 0) {
                // Add user to group
                await connection.execute('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)', [groupId, userId]);
                console.log(`Added user ${userId} to ${department} department group`);
            }
        }
        await connection.commit();
        return groupId;
    }
    catch (error) {
        await connection.rollback();
        console.error('Error in ensureDepartmentGroupAndAddMember:', error);
        throw error;
    }
    finally {
        connection.release();
    }
}
/**
 * Ensure all departments have group chats and add user to their departments
 */
async function syncUserDepartmentGroups(userId, departments) {
    if (!departments || departments.length === 0) {
        return;
    }
    const promises = departments.map(dept => ensureDepartmentGroupAndAddMember(userId, dept));
    await Promise.all(promises);
}
/**
 * Remove user from department groups they no longer belong to
 */
async function removeUserFromOldDepartmentGroups(userId, oldDepartments, newDepartments) {
    const removedDepartments = oldDepartments.filter(dept => !newDepartments.includes(dept));
    if (removedDepartments.length === 0) {
        return;
    }
    const connection = await database_1.default.getConnection();
    try {
        for (const dept of removedDepartments) {
            // Get group ID for this department
            const [groups] = await connection.execute('SELECT id FROM chat_groups WHERE department = ? AND type = ?', [dept, 'department']);
            if (groups.length > 0) {
                // Remove user from group
                await connection.execute('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [groups[0].id, userId]);
                console.log(`Removed user ${userId} from ${dept} department group`);
            }
        }
    }
    catch (error) {
        console.error('Error removing user from old department groups:', error);
        throw error;
    }
    finally {
        connection.release();
    }
}
/**
 * Add user to department executive group chat
 * Creates the executive group if it doesn't exist
 */
async function addUserToExecutiveGroup(userId, department) {
    const connection = await database_1.default.getConnection();
    try {
        await connection.beginTransaction();
        // Check if executive group exists for this department
        const [existingGroups] = await connection.execute('SELECT id FROM chat_groups WHERE department = ? AND type = ?', [department, 'executive']);
        let groupId;
        let isNewGroup = false;
        if (existingGroups.length > 0) {
            groupId = existingGroups[0].id;
        }
        else {
            // Create new executive group
            const [result] = await connection.execute('INSERT INTO chat_groups (name, description, type, department, created_by) VALUES (?, ?, ?, ?, ?)', [
                `${department} Executives`,
                `Private chat group for ${department} department executives`,
                'executive',
                department,
                userId
            ]);
            groupId = result.insertId;
            isNewGroup = true;
            console.log(`Created new executive group for ${department} department (ID: ${groupId})`);
        }
        if (isNewGroup) {
            // Add ALL executives from this department to the group
            const [executives] = await connection.execute(`SELECT id FROM users WHERE department = ? AND is_executive = 1`, [department]);
            if (executives.length > 0) {
                const memberValues = executives.map((e) => `(${groupId}, ${e.id})`).join(',');
                await connection.query(`INSERT IGNORE INTO group_members (group_id, user_id) VALUES ${memberValues}`);
                console.log(`Added ${executives.length} executives to ${department} executive group`);
            }
        }
        else {
            // Group already exists, just add this user if not a member
            const [existingMember] = await connection.execute('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
            if (existingMember.length === 0) {
                await connection.execute('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)', [groupId, userId]);
                console.log(`Added user ${userId} to ${department} executive group`);
            }
        }
        await connection.commit();
        return groupId;
    }
    catch (error) {
        await connection.rollback();
        console.error('Error in addUserToExecutiveGroup:', error);
        throw error;
    }
    finally {
        connection.release();
    }
}
/**
 * Ensure the General group exists and add a user to it
 * Every registered user should be in the General group
 */
async function ensureGeneralGroupAndAddMember(userId) {
    const connection = await database_1.default.getConnection();
    try {
        await connection.beginTransaction();
        // Check if General group exists
        const [existingGroups] = await connection.execute("SELECT id FROM chat_groups WHERE type = 'general' AND name = 'General'", []);
        let groupId;
        if (existingGroups.length > 0) {
            groupId = existingGroups[0].id;
        }
        else {
            // Get first admin/super_admin as creator fallback
            const [admins] = await connection.execute("SELECT id FROM users WHERE role IN ('super_admin', 'admin', 'pastor') ORDER BY id LIMIT 1", []);
            const creatorId = admins.length > 0 ? admins[0].id : userId;
            const [result] = await connection.execute(`INSERT INTO chat_groups (name, description, type, department, created_by)
         VALUES (?, ?, ?, ?, ?)`, ['General', 'General church-wide group for all members', 'general', null, creatorId]);
            groupId = result.insertId;
            console.log(`Created General group (ID: ${groupId})`);
            // Add ALL existing users to the group
            await connection.query(`INSERT IGNORE INTO group_members (group_id, user_id, role)
         SELECT ?, id, 'member' FROM users WHERE is_approved = 1`, [groupId]);
            console.log('Added all existing users to General group');
        }
        // Add this user if not already a member
        const [existing] = await connection.execute('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
        if (existing.length === 0) {
            await connection.execute('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [groupId, userId, 'member']);
            console.log(`Added user ${userId} to General group`);
        }
        await connection.commit();
        return groupId;
    }
    catch (error) {
        await connection.rollback();
        console.error('Error in ensureGeneralGroupAndAddMember:', error);
        throw error;
    }
    finally {
        connection.release();
    }
}
/**
 * Remove user from department executive group chat
 */
async function removeUserFromExecutiveGroup(userId, department) {
    const connection = await database_1.default.getConnection();
    try {
        // Get executive group ID for this department
        const [groups] = await connection.execute('SELECT id FROM chat_groups WHERE department = ? AND type = ?', [department, 'executive']);
        if (groups.length > 0) {
            // Remove user from group
            await connection.execute('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [groups[0].id, userId]);
            console.log(`Removed user ${userId} from ${department} executive group`);
        }
    }
    catch (error) {
        console.error('Error removing user from executive group:', error);
        throw error;
    }
    finally {
        connection.release();
    }
}
