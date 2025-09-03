const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const multer = require('multer');

const router = express.Router();

// Multer in-memory storage for simple pass-through to Python service
const storage = multer.memoryStorage();
const upload = multer({ storage });

// POST /api/stegoshield/analyze
// Body: multipart/form-data with field `image` (file)
// Optional query params: purger_ncomp, watermark_enabled, watermark_msg
router.post('/stegoshield/analyze', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file uploaded. Use field name "image".' });
        }

        const pythonServiceUrl = process.env.STEGOSHIELD_SERVICE_URL || 'http://127.0.0.1:8001/analyze';

        const formData = new FormData();
        formData.append('file', req.file.buffer, {
            filename: req.file.originalname || 'upload.png',
            contentType: req.file.mimetype || 'application/octet-stream'
        });

        // Forward optional params
        if (typeof req.query.purger_ncomp !== 'undefined') {
            formData.append('purger_ncomp', String(req.query.purger_ncomp));
        }
        if (typeof req.query.watermark_enabled !== 'undefined') {
            formData.append('watermark_enabled', String(req.query.watermark_enabled));
        }
        if (typeof req.query.watermark_msg !== 'undefined') {
            formData.append('watermark_msg', String(req.query.watermark_msg));
        }

        const response = await axios.post(pythonServiceUrl, formData, {
            headers: formData.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 60_000
        });

        return res.status(200).json(response.data);
    } catch (err) {
        const status = err.response?.status || 500;
        const data = err.response?.data || { error: 'StegoShield service error' };
        return res.status(status).json(data);
    }
});

module.exports = router;


