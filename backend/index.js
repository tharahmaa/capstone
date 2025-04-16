// index.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode'); // QRCode package to generate QR codes

const app = express();
const PORT = 3000;

app.use(cors()); // Izinkan semua origin

// Setup multer to handle file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    // Create 'uploads' directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext); // Save with timestamp to avoid naming conflicts
  },
});

const upload = multer({ storage: storage });

// Route to upload the collage image
app.post('/upload-collage', upload.single('collage'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded');
  }

  // The uploaded file's path
  const uploadedImagePath = `/uploads/${req.file.filename}`;

  // Send back the URL where the image can be accessed
  const imageUrl = `http://localhost:${PORT}${uploadedImagePath}`;

  // Generate QR code for the uploaded image URL
  QRCode.toDataURL(imageUrl, (err, qrCodeDataUrl) => {
    if (err) {
      return res.status(500).send('Failed to generate QR code');
    }
    res.json({
      qrCode: qrCodeDataUrl,
      imageUrl: imageUrl, // Provide the image URL to be accessed
    });
  });
});

// Route to serve the uploaded image
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Existing proxy image route
app.get('/proxy-image', async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) {
    return res.status(400).send('Missing image URL');
  }

  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
    });

    const contentType = response.headers['content-type'];
    const base64 = Buffer.from(response.data, 'binary').toString('base64');

    res.send(`data:${contentType};base64,${base64}`);
  } catch (error) {
    console.error('Error fetching image:', error.message);
    res.status(500).send('Failed to fetch image');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy server is running at http://localhost:${PORT}`);
});
