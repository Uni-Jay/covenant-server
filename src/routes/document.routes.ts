import express, { Response } from 'express';
import pool from '../config/database';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission, isExecutive } from '../middleware/permissions.middleware';
import { upload } from '../middleware/upload.middleware';

const router = express.Router();

interface AuthRequest extends express.Request {
  user?: {
    id: number;
    email: string;
    role: string;
  };
}

// Get all documents (with filtering by type and role)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { type } = req.query;

    let query = `
      SELECT 
        d.*,
        u.first_name as creator_first_name,
        u.last_name as creator_last_name
      FROM documents d
      JOIN users u ON d.created_by = u.id
      WHERE (d.is_public = TRUE OR d.required_role IS NULL OR d.required_role = ?)
    `;

    const params: any[] = [userRole];

    if (type) {
      query += ' AND d.document_type = ?';
      params.push(type);
    }

    query += ' ORDER BY d.created_at DESC';

    const [documents] = await pool.execute(query, params);

    res.json({ documents });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get document by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = req.user!.role;

    const [documents] = await pool.execute(`
      SELECT 
        d.*,
        u.first_name as creator_first_name,
        u.last_name as creator_last_name
      FROM documents d
      JOIN users u ON d.created_by = u.id
      WHERE d.id = ?
    `, [id]) as any;

    if (documents.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = documents[0];

    // Check access
    if (!document.is_public && document.required_role && document.required_role !== userRole) {
      return res.status(403).json({ error: 'You do not have access to this document' });
    }

    res.json({ document });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Upload document (secretary and super_admin only)
router.post('/', authenticate, requirePermission('document:create'), upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, documentType, requiredRole, isPublic } = req.body;
    const userId = req.user!.id;

    if (!title || !documentType || !req.file) {
      return res.status(400).json({ error: 'Title, document type, and file are required' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    const [result] = await pool.execute(
      `INSERT INTO documents (title, description, file_url, document_type, required_role, is_public, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, description || null, fileUrl, documentType, requiredRole || null, isPublic === 'true', userId]
    ) as any;

    // Log audit
    await pool.execute(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, 'CREATE_DOCUMENT', 'document', ?, ?)`,
      [userId, result.insertId, JSON.stringify({ title, documentType })]
    );

    res.status(201).json({
      message: 'Document uploaded successfully',
      documentId: result.insertId
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Download document (executives only for letterheads)
router.get('/:id/download', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const [documents] = await pool.execute(
      'SELECT * FROM documents WHERE id = ?',
      [id]
    ) as any;

    if (documents.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = documents[0];

    // Check if document is letterhead - only executives can download
    if (document.document_type === 'letterhead' && !isExecutive(userRole)) {
      return res.status(403).json({ 
        error: 'Only church executives can download letterheads',
        message: 'This feature is restricted to executives: Pastor, Elder, Secretary, Media Head, Department Head, Finance, and Deacon'
      });
    }

    // Check role requirement
    if (!document.is_public && document.required_role && document.required_role !== userRole) {
      return res.status(403).json({ error: 'You do not have access to this document' });
    }

    // Log download
    await pool.execute(
      'INSERT INTO document_downloads (document_id, user_id) VALUES (?, ?)',
      [id, userId]
    );

    // Log audit
    await pool.execute(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, 'DOWNLOAD_DOCUMENT', 'document', ?, ?)`,
      [userId, id, JSON.stringify({ title: document.title, type: document.document_type })]
    );

    res.json({ 
      fileUrl: document.file_url,
      fileName: document.title,
      message: 'Document ready for download'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get document download history (for admins)
router.get('/:id/downloads', authenticate, requirePermission('document:view'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const [downloads] = await pool.execute(`
      SELECT 
        dd.*,
        u.first_name, u.last_name, u.role, u.email
      FROM document_downloads dd
      JOIN users u ON dd.user_id = u.id
      WHERE dd.document_id = ?
      ORDER BY dd.downloaded_at DESC
    `, [id]);

    res.json({ downloads });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update document
router.put('/:id', authenticate, requirePermission('document:create'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, requiredRole, isPublic } = req.body;
    const userId = req.user!.id;

    const [documents] = await pool.execute(
      'SELECT * FROM documents WHERE id = ?',
      [id]
    ) as any;

    if (documents.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    await pool.execute(
      `UPDATE documents 
       SET title = ?, description = ?, required_role = ?, is_public = ?
       WHERE id = ?`,
      [title, description || null, requiredRole || null, isPublic, id]
    );

    // Log audit
    await pool.execute(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, 'UPDATE_DOCUMENT', 'document', ?, ?)`,
      [userId, id, JSON.stringify({ title })]
    );

    res.json({ message: 'Document updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete document
router.delete('/:id', authenticate, requirePermission('document:delete'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const [documents] = await pool.execute(
      'SELECT title FROM documents WHERE id = ?',
      [id]
    ) as any;

    if (documents.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    await pool.execute('DELETE FROM documents WHERE id = ?', [id]);

    // Log audit
    await pool.execute(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, 'DELETE_DOCUMENT', 'document', ?, ?)`,
      [userId, id, JSON.stringify({ title: documents[0].title })]
    );

    res.json({ message: 'Document deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get letterheads only (executives only)
router.get('/letterheads/all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.user!.role;

    if (!isExecutive(userRole)) {
      return res.status(403).json({ 
        error: 'Only church executives can access letterheads',
        message: 'This feature is restricted to executives'
      });
    }

    const [letterheads] = await pool.execute(`
      SELECT 
        d.*,
        u.first_name as creator_first_name,
        u.last_name as creator_last_name,
        (SELECT COUNT(*) FROM document_downloads WHERE document_id = d.id) as download_count
      FROM documents d
      JOIN users u ON d.created_by = u.id
      WHERE d.document_type = 'letterhead'
      ORDER BY d.created_at DESC
    `);

    res.json({ letterheads });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
