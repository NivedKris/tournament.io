import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { verifySession } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';

const router = Router();

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/i;
    const isPhoto = allowed.test(file.mimetype) || allowed.test(path.extname(file.originalname));
    if (isPhoto) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpg, png, webp) are allowed') as any, false);
    }
  },
});

// POST /upload
router.post('/', verifySession, upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }

  try {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(req.file.originalname);
    const fileName = `match-${uniqueSuffix}${ext}`;

    const { data, error } = await supabaseAdmin.storage
      .from('matches')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });

    if (error) {
      console.error('Supabase storage upload error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('matches')
      .getPublicUrl(fileName);

    return res.json({ success: true, data: { url: publicUrl } });
  } catch (err: any) {
    console.error('Upload handler error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
