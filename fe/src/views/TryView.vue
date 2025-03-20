<!-- src/views/TryView.vue -->
<template>
  <div class="try-container">
    <h1 class="main-title">Try BoothMe</h1>
    <p class="info-text">
      Take a selfie and let our AI transform it into something amazing.
      Your can download the result or share it with friends.
    </p>
    
    <div class="camera-section">
      <div class="camera-container" ref="cameraContainer">
        <div v-if="!cameraActive && !capturedImage" class="camera-placeholder">
          <div class="camera-prompt">
            <button @click="startCamera" class="camera-btn">
              <span>Start Camera</span>
            </button>
          </div>
        </div>
        
        <video 
          v-show="cameraActive && !capturedImage" 
          ref="videoElement" 
          autoplay 
          playsinline
          class="camera-feed"
        ></video>
        
        <div v-if="capturedImage" class="captured-container">
          <img :src="capturedImage" alt="Captured selfie" class="captured-image" />
        </div>
        
        <div v-if="cameraActive || capturedImage" class="camera-controls">
          <button v-if="cameraActive && !capturedImage" @click="capturePhoto" class="capture-btn">
            <span class="camera-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
              </svg>
            </span>
          </button>
          
          <div v-if="capturedImage" class="action-buttons">
            <button @click="savePhoto" class="save-btn">Save Photo</button>
            <button @click="retakePhoto" class="retake-btn">Retake</button>
          </div>
        </div>
        
        <div v-if="loadingState" class="loading-state">
          <span class="loading-text">{{ loadingState }}</span>
        </div>
        
        <canvas ref="canvasElement" style="display:none"></canvas>
      </div>
    </div>
    
    <div class="info-section">
      <div class="saved-photos" v-if="savedPhotos.length > 0">
        <h2>Your Saved Photos</h2>
        <div class="photo-grid">
          <div 
            v-for="(photo, index) in savedPhotos" 
            :key="index" 
            class="photo-item"
          >
            <img :src="photo.image" alt="Saved photo" />
            <div class="photo-actions">
              <button @click="downloadPhoto(photo.image)" class="action-btn download-btn" title="Download">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </button>
              <button @click="showShareDialog(photo)" class="action-btn share-btn" title="Share">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="18" cy="5" r="3"></circle>
                  <circle cx="6" cy="12" r="3"></circle>
                  <circle cx="18" cy="19" r="3"></circle>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                </svg>
              </button>
              <button @click="confirmDeletePhoto(photo.id)" class="action-btn delete-btn" title="Delete">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Share Dialog -->
    <div v-if="showShare" class="share-dialog-overlay" @click="closeShareDialog">
      <div class="share-dialog" @click.stop>
        <h3>Share Photo</h3>
        <div class="qr-code-container">
          <div ref="qrCodeElement"></div>
        </div>
        <div class="share-link">
          <input type="text" ref="shareLink" :value="currentShareLink" readonly />
          <button @click="copyShareLink" class="copy-btn">
            <span v-if="!copied">Copy</span>
            <span v-else>Copied!</span>
          </button>
        </div>
        <div class="share-actions">
          <button @click="closeShareDialog" class="close-btn">Close</button>
        </div>
      </div>
    </div>
    
    <!-- Delete Confirmation Dialog -->
    <div v-if="showDeleteConfirm" class="share-dialog-overlay" @click="cancelDelete">
      <div class="share-dialog delete-dialog" @click.stop>
        <h3>Delete Photo</h3>
        <p>Are you sure you want to delete this photo? This action cannot be undone.</p>
        <div class="delete-actions">
          <button @click="deletePhoto" class="delete-confirm-btn">Delete</button>
          <button @click="cancelDelete" class="cancel-btn">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';

const videoElement = ref(null);
const canvasElement = ref(null);
const cameraContainer = ref(null);
const qrCodeElement = ref(null);
const shareLink = ref(null);
const cameraActive = ref(false);
const capturedImage = ref(null);
const loadingState = ref('');
const savedPhotos = ref([]);
const stream = ref(null);
const showShare = ref(false);
const currentShareLink = ref('');
const copied = ref(false);
const currentSharePhoto = ref(null);
const showDeleteConfirm = ref(false);
const photoToDeleteId = ref(null);

// Generate a unique ID for each photo
const generateUniqueId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
};

// Base URL for sharing (in a real app, this would be your domain)
const baseUrl = window.location.origin + '/share/';

// Start camera
const startCamera = async () => {
  try {
    loadingState.value = 'Activating camera...';
    stream.value = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false
    });
    
    if (videoElement.value) {
      videoElement.value.srcObject = stream.value;
      cameraActive.value = true;
      loadingState.value = '';
    }
  } catch (error) {
    console.error('Error accessing camera:', error);
    loadingState.value = 'Camera access denied. Please check permissions.';
    setTimeout(() => {
      loadingState.value = '';
    }, 3000);
  }
};

// Capture photo
const capturePhoto = () => {
  const video = videoElement.value;
  const canvas = canvasElement.value;
  
  if (!video || !canvas) return;
  
  // Set canvas dimensions to match video dimensions
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  // Draw video frame to canvas
  const context = canvas.getContext('2d');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  // Convert canvas to data URL
  capturedImage.value = canvas.toDataURL('image/png');
  
  // Stop camera stream
  if (stream.value) {
    stream.value.getTracks().forEach(track => track.stop());
    cameraActive.value = false;
  }
};

// Retake photo
const retakePhoto = () => {
  capturedImage.value = null;
  startCamera();
};

// Save photo to database (localStorage for demo)
const savePhoto = () => {
  if (!capturedImage.value) return;
  
  loadingState.value = 'Saving photo...';
  
  // Simulate processing delay
  setTimeout(() => {
    try {
      const photoId = generateUniqueId();
      const photoData = {
        id: photoId,
        image: capturedImage.value,
        timestamp: new Date().toISOString()
      };
      
      // Get existing photos from localStorage
      const existingPhotos = JSON.parse(localStorage.getItem('selfies') || '[]');
      existingPhotos.push(photoData);
      
      // Save to localStorage
      localStorage.setItem('selfies', JSON.stringify(existingPhotos));
      
      // Update local state
      savedPhotos.value = existingPhotos;
      
      loadingState.value = 'Photo saved successfully!';
      
      // Clear loading state after 2 seconds
      setTimeout(() => {
        loadingState.value = '';
        capturedImage.value = null;
        startCamera();
      }, 2000);
    } catch (error) {
      console.error('Error saving photo:', error);
      loadingState.value = 'Failed to save photo.';
      
      setTimeout(() => {
        loadingState.value = '';
      }, 2000);
    }
  }, 1500);
};

// Load saved photos from localStorage
const loadSavedPhotos = () => {
  try {
    const photos = JSON.parse(localStorage.getItem('selfies') || '[]');
    // Handle legacy data format
    savedPhotos.value = photos.map(photo => {
      if (typeof photo === 'string') {
        return {
          id: generateUniqueId(),
          image: photo,
          timestamp: new Date().toISOString()
        };
      }
      return photo;
    });
    
    // Update localStorage with the new format if needed
    if (photos.some(photo => typeof photo === 'string')) {
      localStorage.setItem('selfies', JSON.stringify(savedPhotos.value));
    }
  } catch (error) {
    console.error('Error loading saved photos:', error);
  }
};

// Download photo
const downloadPhoto = (imageUrl) => {
  const link = document.createElement('a');
  link.href = imageUrl;
  link.download = `boothme-selfie-${new Date().getTime()}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Show share dialog
const showShareDialog = async (photo) => {
  currentSharePhoto.value = photo;
  currentShareLink.value = `${baseUrl}${photo.id}`;
  showShare.value = true;
  copied.value = false;
  
  // Wait for the dialog to be rendered
  await nextTick();
  
  // Generate QR code
  if (qrCodeElement.value) {
    // In a real app, you would import a QR code library like qrcode.js
    // For this demo, we'll just simulate it
    loadQRCodeLibrary().then(() => {
      if (window.QRCode && qrCodeElement.value) {
        qrCodeElement.value.innerHTML = '';
        new window.QRCode(qrCodeElement.value, {
          text: currentShareLink.value,
          width: 200,
          height: 200
        });
      }
    });
  }
};

// Close share dialog
const closeShareDialog = () => {
  showShare.value = false;
  currentShareLink.value = '';
  currentSharePhoto.value = null;
};

// Copy share link
const copyShareLink = () => {
  if (shareLink.value) {
    shareLink.value.select();
    document.execCommand('copy');
    copied.value = true;
    
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  }
};

// Confirm delete photo
const confirmDeletePhoto = (photoId) => {
  photoToDeleteId.value = photoId;
  showDeleteConfirm.value = true;
};

// Cancel delete
const cancelDelete = () => {
  photoToDeleteId.value = null;
  showDeleteConfirm.value = false;
};

// Delete photo
const deletePhoto = () => {
  if (!photoToDeleteId.value) return;
  
  try {
    // Get photos from localStorage
    const photos = JSON.parse(localStorage.getItem('selfies') || '[]');
    
    // Filter out the photo to delete
    const updatedPhotos = photos.filter(photo => {
      if (typeof photo === 'string') return true; // Skip legacy format
      return photo.id !== photoToDeleteId.value;
    });
    
    // Save updated photos to localStorage
    localStorage.setItem('selfies', JSON.stringify(updatedPhotos));
    
    // Update local state
    savedPhotos.value = updatedPhotos;
    
    // Show success message
    loadingState.value = 'Photo deleted successfully!';
    setTimeout(() => {
      loadingState.value = '';
    }, 2000);
    
    // Close delete confirmation dialog
    cancelDelete();
  } catch (error) {
    console.error('Error deleting photo:', error);
    loadingState.value = 'Failed to delete photo.';
    setTimeout(() => {
      loadingState.value = '';
    }, 2000);
  }
};

// Load QR Code library (simulated for demo)
const loadQRCodeLibrary = () => {
  return new Promise((resolve) => {
    // In a real app, you would load the library from CDN or include it in your project
    // For this demo, we'll simulate it
    if (!window.QRCode) {
      window.QRCode = function(element, options) {
        const container = element;
        const canvas = document.createElement('canvas');
        canvas.width = options.width;
        canvas.height = options.height;
        container.appendChild(canvas);
        
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw a simulated QR code (just a visual representation)
        ctx.fillStyle = '#000000';
        ctx.fillRect(10, 10, canvas.width - 20, canvas.height - 20);
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(20, 20, canvas.width - 40, canvas.height - 40);
        
        ctx.fillStyle = '#000000';
        // Draw some random squares to simulate a QR code pattern
        for (let i = 0; i < 10; i++) {
          for (let j = 0; j < 10; j++) {
            if (Math.random() > 0.5) {
              ctx.fillRect(30 + i * 14, 30 + j * 14, 10, 10);
            }
          }
        }
        
        // Draw positioning squares
        ctx.fillRect(30, 30, 40, 40);
        ctx.fillRect(130, 30, 40, 40);
        ctx.fillRect(30, 130, 40, 40);
      };
    }
    resolve();
  });
};

onMounted(() => {
  loadSavedPhotos();
});

onUnmounted(() => {
  // Clean up camera stream when component is destroyed
  if (stream.value) {
    stream.value.getTracks().forEach(track => track.stop());
  }
});
</script>

<style scoped>
.try-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  width: 100%;
  align-items: center;
}

.main-title {
  font-size: 2.5rem;
  color: #111827;
  margin-bottom: 0.5rem;
  text-align: center;
}

.info-text {
  font-size: 1.1rem;
  color: #4b5563;
  max-width: 700px;
  margin-bottom: 2rem;
  line-height: 1.5;
  text-align: center;
}

.camera-section {
  display: flex;
  justify-content: center;
  width: 100%;
  max-width: 800px;
  margin: 0 auto 2rem auto;
  align-items: center;
  
}

.camera-container {
  position: relative;
  width: 100%;
  max-width: 800px; 
  aspect-ratio: 16/9;
  border-radius: 10px;
  overflow: hidden;
  border: 3px solid #1e3a8a;
  background-color: #e5e7eb;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  margin: 0 auto;
}

.camera-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #d1d5db;
  color: #4b5563;
  padding: 1rem;
}

.camera-prompt {
  text-align: center;
  margin-bottom: 1rem;
}

.camera-btn {
  background-color: #0f172a;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 5px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.camera-btn:hover {
  background-color: #1e293b;
}

.camera-feed {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.captured-container {
  width: 100%;
  height: 100%;
}

.captured-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.camera-controls {
  position: absolute;
  bottom: 20px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  z-index: 10;
}

.capture-btn {
  width: 60px; 
  height: 60px; 
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.7);
  border: 2px solid #3b82f6;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s;
}

.capture-btn:hover {
  transform: scale(1.05);
}

.camera-icon {
  color: #1e3a8a;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-buttons {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
  flex-wrap: wrap;
  justify-content: center;
}

.save-btn, .retake-btn {
  padding: 0.5rem 1.5rem;
  border-radius: 5px;
  font-weight: 500;
  cursor: pointer;
  min-width: 100px;
}

.save-btn {
  background-color: #2563eb;
  color: white;
  border: none;
}

.retake-btn {
  background-color: white;
  color: #1e3a8a;
  border: 1px solid #1e3a8a;
}

.loading-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 5px;
  font-weight: 500;
  z-index: 20;
}

.info-section {
  width: 100%;
  max-width: 1200px;
  padding: 1rem;
}

.saved-photos {
  margin-top: 2rem;
}

.saved-photos h2 {
  font-size: 1.5rem;
  color: #111827;
  margin-bottom: 1rem;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.photo-item {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  aspect-ratio: 1/1;
  position: relative;
}

.photo-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-actions {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  padding: 0.5rem;
  gap: 1rem;
  opacity: 0;
  transition: opacity 0.2s;
}

.photo-item:hover .photo-actions {
  opacity: 1;
}

/* For touch devices, always show photo actions */
@media (hover: none) {
  .photo-actions {
    opacity: 1;
    background-color: rgba(0, 0, 0, 0.3);
  }
}

.action-btn {
  background-color: white;
  color: #1e3a8a;
  border: none;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s;
}

.action-btn:hover {
  transform: scale(1.1);
}

.delete-btn {
  color: #ef4444;
}

/* Share Dialog */
.share-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
}

.share-dialog {
  background-color: white;
  padding: 1.5rem;
  border-radius: 10px;
  max-width: 90%;
  width: 400px;
  box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
}

.share-dialog h3 {
  margin-top: 0;
  margin-bottom: 1.5rem;
  font-size: 1.5rem;
  color: #111827;
  text-align: center;
}

.qr-code-container {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
  max-width: 100%;
  overflow: hidden;
}

.qr-code-container img {
  max-width: 100%;
  height: auto;
}

.share-link {
  display: flex;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.share-link input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 5px 0 0 5px;
  font-size: 0.9rem;
  min-width: 0; /* Allows the input to shrink below its content size */
}

.copy-btn {
  background-color: #2563eb;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0 5px 5px 0;
  cursor: pointer;
  white-space: nowrap;
}

.share-actions {
  display: flex;
  justify-content: center;
}

.close-btn {
  background-color: #e5e7eb;
  color: #111827;
  border: none;
  padding: 0.5rem 1.5rem;
  border-radius: 5px;
  cursor: pointer;
}

/* Delete Dialog */
.delete-dialog p {
  text-align: center;
  margin-bottom: 1.5rem;
  color: #4b5563;
}

.delete-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.delete-confirm-btn {
  background-color: #ef4444;
  color: white;
  border: none;
  padding: 0.5rem 1.5rem;
  border-radius: 5px;
  cursor: pointer;
}

.cancel-btn {
  background-color: #e5e7eb;
  color: #111827;
  border: none;
  padding: 0.5rem 1.5rem;
  border-radius: 5px;
  cursor: pointer;
}

/* Responsive styles */
/* Tablet */
@media (max-width: 1024px) {
  .main-title {
    font-size: 2rem;
  }
  
  .info-text {
    font-size: 1rem;
    max-width: 600px;
  }
  
  .photo-grid {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  }
}

/* Mobile */
@media (max-width: 768px) {
  .try-container {
    padding: 1rem;
  }
  
  .main-title {
    font-size: 1.8rem;
  }
  
  .info-text {
    font-size: 0.95rem;
    margin-bottom: 1.5rem;
  }
  
  .camera-container {
    max-width: 100%;
    aspect-ratio: 4/3; /* Better aspect ratio for mobile */
  }
  
  .photo-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 0.75rem;
  }
  
  .action-buttons {
    gap: 0.75rem;
  }
  
  .share-dialog, .delete-dialog {
    padding: 1.25rem;
  }
}

/* Small Mobile */
@media (max-width: 480px) {
  .main-title {
    font-size: 1.5rem;
  }
  
  .camera-btn, .save-btn, .retake-btn {
    padding: 0.5rem 1.25rem;
    font-size: 0.9rem;
  }
  
  .photo-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 0.5rem;
  }
  
  .capture-btn {
    width: 50px;
    height: 50px;
  }
  
  .action-btn {
    width: 32px;
    height: 32px;
  }
  
  .share-link {
    flex-direction: column;
  }
  
  .share-link input {
    border-radius: 5px;
    margin-bottom: 0.5rem;
    width: 100%;
  }
  
  .copy-btn {
    border-radius: 5px;
    width: 100%;
  }
  
  .delete-actions, .share-actions {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .delete-confirm-btn, .cancel-btn, .close-btn {
    width: 100%;
  }
}
</style>