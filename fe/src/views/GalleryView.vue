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

    <!-- Loading Spinner -->
    <div v-if="isLoading" class="loading-spinner">
      <span>Loading...</span>
      <div class="spinner"></div>
    </div>

    <!-- Collage Preview -->
    <div v-if="collagePreview" class="collage-preview">
      <h3>Collage Preview</h3>
      <img :src="collagePreview" alt="Collage" />
      <button @click="downloadCollage" class="download-btn">Download Collage</button>
    </div>

    <!-- Hidden canvas for drawing the collage -->
    <canvas ref="canvasRef" style="display: none"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'

const savedPhotos = ref([]) // Array to hold photos
const selectedPhotos = ref([]) // Array to hold selected photos
const collagePreview = ref('') // Data URL for the collage preview
const canvasRef = ref(null) // Reference to the canvas for the collage
const selectAll = ref(false) // Flag for "select all" checkbox
const isLoading = ref(false) // Flag to show loading spinner

// Load saved photos from localStorage
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

// Toggle select all functionality
const toggleSelectAll = () => {
  if (selectAll.value) {
    selectedPhotos.value = [...savedPhotos.value]
  } else {
    selectedPhotos.value = []
  }
}

// Clear the selected photos
const clearSelection = () => {
  selectedPhotos.value = []
  selectAll.value = false
}

// Watch for changes in selected photos and generate the collage
watch(selectedPhotos, async (newVal) => {
  selectAll.value = newVal.length === savedPhotos.value.length && newVal.length > 0
  if (newVal.length > 0) {
    await generateCollage() // Generate collage when selection changes
  } else {
    collagePreview.value = '' // Clear preview if no selection
  }
})

// Fetch base64 encoded image from the proxy server
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

// Generate the collage
const generateCollage = async () => {
  isLoading.value = true // Show loading spinner

  const images = [] // Array to hold loaded images
  const frameImage = new Image() // Background frame image

  const collageWidth = 590
  const collageHeight = 1770

  frameImage.src = 'bg.jpg'
  await new Promise((resolve) => {
    frameImage.onload = resolve
    frameImage.onerror = resolve
  })

  // Load all images in parallel using Promise.all
  const imagePromises = selectedPhotos.value.map((photo) =>
    getBase64FromProxy(photo.image).then((base64) => {
      if (base64) {
        const img = new Image()
        img.src = base64
        return new Promise((resolve) => {
          img.onload = () => resolve(img)
          img.onerror = () => resolve(null) // Resolve even if there's an error
        })
      }
    })
  )

  const loadedImages = await Promise.all(imagePromises)

  // Filter out any failed image loading attempts
  const validImages = loadedImages.filter((img) => img !== null)

  if (!validImages.length || !frameImage.complete) {
    isLoading.value = false // Hide loading spinner if no images are available
    return
  }

  // Drawing the collage on the canvas
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  canvas.width = collageWidth
  canvas.height = collageHeight
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  ctx.drawImage(frameImage, 0, 0, collageWidth, collageHeight)

  const photoPadding = 30
  const photoSize = collageWidth * 0.8
  let currentY = 50

  // Draw each valid image on the canvas
  validImages.forEach((img) => {
    const x = (collageWidth - photoSize) / 2
    ctx.drawImage(img, x, currentY, photoSize, photoSize)
    currentY += photoSize + photoPadding
  })

  // Create a preview of the collage in a smaller canvas
  const previewCanvas = document.createElement('canvas')
  const previewCtx = previewCanvas.getContext('2d')
  const previewWidth = 300
  const previewHeight = Math.floor((collageHeight / collageWidth) * previewWidth)

  previewCanvas.width = previewWidth
  previewCanvas.height = previewHeight
  previewCtx.drawImage(canvas, 0, 0, collageWidth, collageHeight, 0, 0, previewWidth, previewHeight)

  // Set the preview image source to the canvas data URL
  collagePreview.value = previewCanvas.toDataURL('image/png')

  isLoading.value = false // Hide loading spinner when done
}


// Download the collage as an image
const downloadCollage = () => {
  const canvas = canvasRef.value
  const link = document.createElement('a')
  link.href = canvas.toDataURL('image/png')
  link.download = 'collage.png'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Load photos when component is mounted
onMounted(loadSavedPhotos)
</script>

<style scoped>
/* Container styles */
.gallery-container {
  padding: 1rem;
  max-width: 1200px;
  margin: auto;
}

/* Controls and photo grid styles */
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

/* Individual photo item styles */
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

/* Download button styles */
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

/* Checkbox input styles */
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

/* Collage preview styles */
.collage-preview {
  margin-top: 2rem;
  text-align: center;
}

.collage-preview img {
  max-width: 100%;
  border-radius: 8px;
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

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
