// index.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors()); // Izinkan semua origin

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
