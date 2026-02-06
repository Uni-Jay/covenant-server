"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDepartmentGroupAndAddMember = ensureDepartmentGroupAndAddMember;
exports.syncUserDepartmentGroups = syncUserDepartmentGroups;
exports.removeUserFromOldDepartmentGroups = removeUserFromOldDepartmentGroups;
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
