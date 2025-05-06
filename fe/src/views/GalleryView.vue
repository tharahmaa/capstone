<template>
  <div class="gallery-container">
    <h2>Saved Photos</h2>

    <div class="controls">
      <select v-model="selectedLayout">
        <option value="1x3">1x3 Layout</option>
        <option value="2x2">2x2 Layout</option>
      </select>
    </div>

    <div class="frame-options-container">
      <div class="select-frame-header">
        <h3>Select Frame</h3>
      </div>

      <div class="frame-options">
        <label
          v-for="option in filteredFrameOptions"
          :key="option.value"
          class="frame-option"
          @click="selectedFrame = option.value"
        >
          <div
            :class="[
              selectedLayout === '1x3' ? 'frame-preview-wrapper-1x3' : 'frame-preview-wrapper-2x2',
              { selected: selectedFrame === option.value },
            ]"
          >
            <img :src="option.value + '.jpg'" :alt="selectedLayout + ' Frame Preview'" />
          </div>
        </label>
      </div>
    </div>

    <div class="photo-grid">
      <div
        v-for="(photo, index) in savedPhotos"
        :key="index"
        class="photo-item"
        :class="{ selected: selectedPhotos.includes(photo) }"
      >
        <img :src="photo.image" alt="Saved" />
        <input type="checkbox" :value="photo" v-model="selectedPhotos" />
      </div>
    </div>

    <div v-if="isLoading" class="loading-spinner">
      <span>Loading...</span>
      <div class="spinner"></div>
    </div>

    <div v-if="collagePreview" class="collage-preview">
      <div>
        <h3>Collage Preview</h3>
        <img :src="collagePreview" alt="Collage" />
      </div>
      <div>
        <button @click="downloadCollage" class="download-btn">Download Collage</button>
      </div>
    </div>

    <div v-if="qrCodeDataUrl" class="qr-preview">
      <h3>Scan QR to download your collage!</h3>
      <img :src="qrCodeDataUrl" alt="QR Code" style="max-width: 300px" />
    </div>

    <canvas ref="canvasRef" style="display: none"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import QRCode from 'qrcode'

const savedPhotos = ref([])
const selectedPhotos = ref([])
const collagePreview = ref('')
const canvasRef = ref(null)
const selectAll = ref(false)
const isLoading = ref(false)

const selectedFrame = ref('bg')
const selectedLayout = ref('1x3')

const clientId = 'fabfda01b119459'
const imgurLink = ref('')
const imgurApiUrl = 'https://api.imgur.com/3/image' // Imgur API URL
const qrCodeDataUrl = ref('')

const frameOptions1x3 = [
  { label: 'Frame 1', value: 'bg' },
  { label: 'Frame 2', value: 'bg2' },
  { label: 'Frame 3', value: 'bg3' },
]

const frameOptions2x2 = [
  { label: 'Frame 1', value: '2bg' },
  { label: 'Frame 2', value: '2bg2' },
  { label: 'Frame 3', value: '2bg3' },
]

const filteredFrameOptions = computed(() =>
  selectedLayout.value === '1x3' ? frameOptions1x3 : frameOptions2x2,
)

const loadSavedPhotos = () => {
  try {
    const photos = JSON.parse(localStorage.getItem('selfies') || '[]')
    savedPhotos.value = photos.map((photo) =>
      typeof photo === 'string' ? { id: Date.now() + Math.random(), image: photo } : photo,
    )
  } catch (err) {
    console.error('Error loading photos:', err)
  }
}

const toggleSelectAll = () => {
  if (selectAll.value) {
    selectedPhotos.value = [...savedPhotos.value]
  } else {
    selectedPhotos.value = []
  }
}

const clearSelection = () => {
  selectedPhotos.value = []
  selectAll.value = false
}

watch(selectedPhotos, async (newVal) => {
  selectAll.value = newVal.length === savedPhotos.value.length && newVal.length > 0
  if (newVal.length > 0) {
    await generateCollage()
  } else {
    collagePreview.value = ''
  }
})

const getBase64FromProxy = async (imageUrl) => {
  try {
    const proxyUrl = `http://localhost:3000/proxy-image?url=${encodeURIComponent(imageUrl)}`
    const response = await fetch(proxyUrl)
    const base64 = await response.text()
    return base64
  } catch (err) {
    console.error('Proxy error:', err)
    return null
  }
}

const generateCollage = async () => {
  isLoading.value = true

  const frameImage = new Image()
  let collageWidth = 1210
  let collageHeight = 1410
  let photoPadding = 50
  let photoSize = 500
  let positions = []

  const is2x2 = selectedLayout.value === '2x2'
  const framePath = `${selectedFrame.value}.jpg`
  frameImage.src = framePath

  if (!is2x2) {
    collageWidth = 590
    collageHeight = 1770
    photoSize = collageWidth * 0.8
    let y = 50
    for (let i = 0; i < 3; i++) {
      positions.push({ x: (collageWidth - photoSize) / 2, y })
      y += photoSize + photoPadding
    }
  } else {
    collageWidth = 800
    collageHeight = 1000
    photoSize = (collageWidth - 3 * 80) / 2
    positions = [
      { x: 80, y: 80 },
      { x: 80 + photoSize + 50, y: 80 },
      { x: 80, y: 80 + photoSize + 50 },
      { x: 80 + photoSize + 50, y: 80 + photoSize + 50 },
    ]
  }

  await new Promise((resolve) => {
    frameImage.onload = resolve
    frameImage.onerror = resolve
  })

  const imagePromises = selectedPhotos.value.map((photo) =>
    getBase64FromProxy(photo.image).then((base64) => {
      if (base64) {
        const img = new Image()
        img.src = base64
        return new Promise((resolve) => {
          img.onload = () => resolve(img)
          img.onerror = () => resolve(null)
        })
      }
    }),
  )

  const loadedImages = (await Promise.all(imagePromises)).filter((img) => img !== null)

  if (!loadedImages.length || !frameImage.complete) {
    isLoading.value = false
    return
  }

  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  canvas.width = collageWidth
  canvas.height = collageHeight
  ctx.clearRect(0, 0, collageWidth, collageHeight)
  ctx.drawImage(frameImage, 0, 0, collageWidth, collageHeight)

  loadedImages.forEach((img, i) => {
    if (positions[i]) {
      const { x, y } = positions[i]
      ctx.drawImage(img, x, y, photoSize, photoSize)
    }
  })

  const previewCanvas = document.createElement('canvas')
  const previewCtx = previewCanvas.getContext('2d')
  const previewWidth = 300
  const previewHeight = Math.floor((collageHeight / collageWidth) * previewWidth)
  previewCanvas.width = previewWidth
  previewCanvas.height = previewHeight
  previewCtx.drawImage(canvas, 0, 0, collageWidth, collageHeight, 0, 0, previewWidth, previewHeight)

  collagePreview.value = previewCanvas.toDataURL('image/png')
  isLoading.value = false
}

const downloadCollage = async () => {
  const canvas = canvasRef.value
  const imageBase64 = canvas.toDataURL('image/png').split(',')[1] // Ambil base64-nya

  try {
    // Kirim gambar ke backend untuk di-upload ke Imgur
    const response = await fetch('http://localhost:3000/upload-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to upload image to backend')
    }

    const data = await response.json()
    const imgurLink = data.link

    if (imgurLink) {
      console.log('Image uploaded to Imgur:', imgurLink)
      // Generate QR code untuk link gambar Imgur
      qrCodeDataUrl.value = await QRCode.toDataURL(imgurLink)
      console.log('QR Code generated')
    } else {
      console.error('Failed to get image link from Imgur')
    }
  } catch (error) {
    console.error('Error uploading image:', error.message)
  }
}

onMounted(loadSavedPhotos)
</script>

<style>
/* Container styles */
.gallery-container {
  padding: 1.5rem;
  max-width: 1200px;
  margin: auto;
  background-color: #f7f7f7;
  border-radius: 10px;
  text-align: center;
}

/* Title styling */
h2 {
  font-size: 2rem;
  font-weight: bold;
  color: #333;
  margin-bottom: 1.5rem;
}

/* Controls */
.controls {
  display: flex;
  justify-content: center;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1.5rem;
}

.controls select {
  padding: 0.5rem 1rem;
  font-size: 1rem;
  border: 1px solid #ccc;
  border-radius: 6px;
  cursor: pointer;
}

/* Frame options container */
.frame-options-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 2rem;
}

/* Header for Select Frame */
.select-frame-header {
  margin-bottom: 1rem;
}

/* Frame options layout - Make sure options stay in a row */
.frame-options {
  display: flex;
  justify-content: center;
  gap: 2rem;
  flex-wrap: nowrap; /* Keep options in one line */
  align-items: center;
}

/* Frame option styles */
.frame-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.3s ease;
}

.frame-option:hover {
  transform: scale(1.05);
  box-shadow: 0 0 15px rgba(79, 70, 229, 0.3);
}

.frame-option.selected {
  border: 3px solid #4f46e5;
  box-shadow: 0 0 10px rgba(79, 70, 229, 0.5);
}

.frame-option span {
  margin-top: 0.25rem;
  font-size: 0.9rem;
  color: #333;
}

/* Frame preview wrapper styles */
.frame-preview-wrapper-1x3,
.frame-preview-wrapper-2x2 {
  display: inline-block;
  margin: 10px;
  border-radius: 6px;
  overflow: hidden;
}

.frame-preview-wrapper-1x3 {
  width: 120px;
  height: 360px;
}

.frame-preview-wrapper-2x2 {
  width: 240px;
  height: 280px;
}

.frame-preview-wrapper-1x3 img,
.frame-preview-wrapper-2x2 img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Photo grid styles */
.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
  justify-items: center;  /* This centers the photo items horizontally */
  align-items: center;    /* This centers the photo items vertically */
  margin-top: 2rem;
  width: 100%;
}

/* Individual photo item styles */
.photo-item {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transition:
    transform 0.2s ease,
    box-shadow 0.3s ease;
}

.photo-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-item:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.photo-item.selected {
  outline: 3px solid #4f46e5;
}

/* Checkbox input styles */
.photo-item input[type='checkbox'] {
  position: absolute;
  top: 8px;
  left: 8px;
  transform: scale(1.4);
  background: white;
  z-index: 1;
}

/* Collage preview styles */
.collage-preview {
  margin-top: 2rem;
  text-align: center;
}

.collage-preview img {
  max-width: 100%;
  border-radius: 8px;
  object-fit: cover;
}

/* QR code preview styles */
.qr-preview {
  margin-top: 2rem;
  text-align: center;
}

.qr-preview img {
  border: 2px solid #4f46e5;
  padding: 10px;
  border-radius: 8px;
}

/* Button styles */
.download-btn {
  margin-top: 1rem;
  padding: 0.5rem 1.2rem;
  background-color: #4f46e5;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.2s ease;
}

.download-btn:hover {
  background-color: #4338ca;
}

/* Loading spinner styles */
.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: bold;
  color: #4f46e5;
  margin-top: 20px;
}

.spinner {
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid #4f46e5;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  animation: spin 1s linear infinite;
  margin-top: 10px;
}

/* Keyframe for spinner animation */
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
