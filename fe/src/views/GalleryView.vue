<template>
  <div class="gallery-container">
    <h2>Saved Photos</h2>

    <div class="controls">
      <label>
        <input type="checkbox" v-model="selectAll" @change="toggleSelectAll" />
        Select All
      </label>
      <button @click="clearSelection">Clear Selection</button>
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

    <div v-if="collagePreview" class="collage-preview">
      <h3>Collage Preview</h3>
      <img :src="collagePreview" alt="Collage" />
      <button @click="downloadCollage" class="download-btn">Download Collage</button>
    </div>

    <canvas ref="canvasRef" style="display: none"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'

const savedPhotos = ref([])
const selectedPhotos = ref([])
const collagePreview = ref('')
const canvasRef = ref(null)
const selectAll = ref(false)

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

const downloadCollage = () => {
  if (!collagePreview.value) return

  setTimeout(() => {
    const link = document.createElement('a')
    link.href = collagePreview.value
    link.download = 'collage.png'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, 0)
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
    const proxyUrl = `http://localhost:3001/proxy-image?url=${encodeURIComponent(imageUrl)}`
    const response = await fetch(proxyUrl)
    const blob = await response.blob()

    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (err) {
    console.error('Proxy error:', err)
    return null
  }
}

const generateCollage = async () => {
  const images = []
  const frameImage = new Image()

  // Tentukan ukuran tetap untuk kolase (5x15 cm dengan 300 DPI = 590x1770 piksel)
  const collageWidth = 590 // 5 cm dalam piksel pada 300 DPI
  const collageHeight = 1770 // 15 cm dalam piksel pada 300 DPI

  // Menggunakan bg.jpg sebagai background
  frameImage.src = 'bg.jpg' // ubah sesuai path kalau perlu
  await new Promise((resolve) => {
    frameImage.onload = resolve
    frameImage.onerror = resolve
  })

  // Proses foto
  for (const photo of selectedPhotos.value) {
    const base64 = await getBase64FromProxy(photo.image)
    if (base64) {
      const img = new Image()
      img.src = base64
      await new Promise((resolve) => {
        img.onload = () => resolve()
        img.onerror = () => resolve()
      })
      images.push(img)
    }
  }

  if (!images.length || !frameImage.complete) return

  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')

  // Set ukuran canvas sesuai dengan ukuran kolase yang diinginkan
  canvas.width = collageWidth
  canvas.height = collageHeight
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Gambar background (bg.jpg) di canvas
  ctx.drawImage(frameImage, 0, 0, collageWidth, collageHeight)

  // Tentukan padding dan ukuran foto
  const photoPadding = 30 // padding antar foto
  const photoSize = collageWidth * 0.8 // ukuran foto, sesuaikan dengan kebutuhan

  // Tempatkan foto secara vertikal
  let currentY = 50 // Mulai dari posisi Y di atas
  images.forEach((img, index) => {
    // Tentukan posisi Y untuk setiap foto, menambahkan padding untuk setiap foto baru
    const x = (collageWidth - photoSize) / 2 // Posisikan foto di tengah secara horizontal
    ctx.drawImage(img, x, currentY, photoSize, photoSize)

    // Geser posisi Y ke bawah untuk foto berikutnya
    currentY += photoSize + photoPadding
  })

  // Preview kolase kecil untuk layar
  const previewCanvas = document.createElement('canvas')
  const previewCtx = previewCanvas.getContext('2d')
  const previewWidth = 300 // Ukuran preview yang lebih kecil (misalnya 300px lebar)
  const previewHeight = Math.floor((collageHeight / collageWidth) * previewWidth) // Sesuaikan rasio

  previewCanvas.width = previewWidth
  previewCanvas.height = previewHeight
  previewCtx.drawImage(canvas, 0, 0, collageWidth, collageHeight, 0, 0, previewWidth, previewHeight)

  collagePreview.value = previewCanvas.toDataURL('image/png') // Set preview ke gambar kecil

  // Fungsi untuk download
  const downloadCollage = () => {
    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png') // Download dalam ukuran asli
    link.download = 'collage.png'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Tampilkan tombol download
  document.querySelector('.download-btn').addEventListener('click', downloadCollage)
}

onMounted(loadSavedPhotos)
</script>

<style scoped>
.gallery-container {
  padding: 1rem;
  max-width: 1200px;
  margin: auto;
}

.controls {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1rem;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
}

.photo-item {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.photo-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

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

.photo-item input[type='checkbox'] {
  position: absolute;
  top: 8px;
  left: 8px;
  transform: scale(1.3);
  background: white;
}

.photo-item.selected {
  outline: 3px solid #4f46e5;
}

.collage-preview {
  margin-top: 2rem;
  text-align: center;
}

.collage-preview img {
  max-width: 100%;
  border-radius: 8px;
}
</style>
