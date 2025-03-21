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
        
        <!-- Timer overlay -->
        <div v-if="timerActive" class="timer-overlay">
          <div class="timer-count">{{ timerCount }}</div>
        </div>
        
        <div v-if="cameraActive || capturedImage" class="camera-controls">
          <!-- Timer options when camera is active but no photo is captured yet -->
          <div v-if="cameraActive && !capturedImage" class="timer-options">
            <button @click="capturePhoto(0)" class="timer-btn" :class="{ active: selectedTimer === 0 }">
              No Timer
            </button>
            <button @click="capturePhoto(3)" class="timer-btn" :class="{ active: selectedTimer === 3 }">
              3s
            </button>
            <button @click="capturePhoto(5)" class="timer-btn" :class="{ active: selectedTimer === 5 }">
              5s
            </button>
          </div>
          
          <button v-if="cameraActive && !capturedImage && !timerActive" @click="capturePhoto(selectedTimer)" class="capture-btn">
            <span class="camera-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
              </svg>
            </span>
          </button>
          
          <div v-if="capturedImage" class="action-buttons">
            <button @click="savePhoto" class="save-btn">Save Photo</button>
            <button @click="retakePhoto" class="retake-btn">Retake</button>
            <button @click="viewGallery" class="view-btn">View Gallery</button>
          </div>
        </div>
        
        <div v-if="loadingState" class="loading-state">
          <span class="loading-text">{{ loadingState }}</span>
        </div>
        
        <canvas ref="canvasElement" style="display:none"></canvas>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const videoElement = ref(null);
const canvasElement = ref(null);
const cameraContainer = ref(null);
const cameraActive = ref(false);
const capturedImage = ref(null);
const loadingState = ref('');
const stream = ref(null);
const timerActive = ref(false);
const timerCount = ref(0);
const selectedTimer = ref(0); // Default to no timer

// Generate a unique ID for each photo
const generateUniqueId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
};

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

// Capture photo with optional timer
const capturePhoto = (seconds) => {
  selectedTimer.value = seconds;
  
  if (seconds > 0 && !timerActive.value) {
    // Start timer
    timerActive.value = true;
    timerCount.value = seconds;
    
    const timerInterval = setInterval(() => {
      timerCount.value--;
      
      if (timerCount.value <= 0) {
        clearInterval(timerInterval);
        timerActive.value = false;
        takePhoto();
      }
    }, 1000);
  } else if (!timerActive.value) {
    // Take photo immediately if no timer or timer already active
    takePhoto();
  }
};

// Actually take the photo
const takePhoto = () => {
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
      
      loadingState.value = 'Photo saved successfully!';
      
      // Clear loading state after 2 seconds and ask if user wants to go to gallery
      setTimeout(() => {
        loadingState.value = '';
        
        // Ask user if they want to view the gallery or take another photo
        if (confirm('Photo saved! Would you like to view your gallery?')) {
          viewGallery();
        } else {
          capturedImage.value = null;
          startCamera();
        }
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

// Navigate to gallery page
const viewGallery = () => {
  router.push('/gallery');
};

onMounted(() => {
  // No need to load saved photos here anymore as they're on a different page
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

/* Timer overlay */
.timer-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.3);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 15;
}

.timer-count {
  font-size: 6rem;
  color: white;
  font-weight: bold;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

.camera-controls {
  position: absolute;
  bottom: 20px;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 10;
}

.timer-options {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.timer-btn {
  background-color: rgba(255, 255, 255, 0.7);
  border: 1px solid #3b82f6;
  border-radius: 15px;
  padding: 0.25rem 0.75rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.timer-btn.active {
  background-color: #3b82f6;
  color: white;
}

.timer-btn:hover {
  background-color: rgba(59, 130, 246, 0.2);
}

.timer-btn.active:hover {
  background-color: #2563eb;
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

.save-btn, .retake-btn, .view-btn {
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

.view-btn {
  background-color: #10b981;
  color: white;
  border: none;
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
  
  .action-buttons {
    gap: 0.75rem;
  }
  
  .timer-count {
    font-size: 5rem;
  }
}

/* Small Mobile */
@media (max-width: 480px) {
  .main-title {
    font-size: 1.5rem;
  }
  
  .camera-btn, .save-btn, .retake-btn, .view-btn {
    padding: 0.5rem 1.25rem;
    font-size: 0.9rem;
  }
  
  .capture-btn {
    width: 50px;
    height: 50px;
  }
  
  .timer-options {
    flex-wrap: wrap;
  }
  
  .timer-btn {
    font-size: 0.75rem;
    padding: 0.2rem 0.5rem;
  }
  
  .timer-count {
    font-size: 4rem;
  }
  
  .action-buttons {
    flex-direction: column;
    width: 80%;
    gap: 0.5rem;
  }
  
  .save-btn, .retake-btn, .view-btn {
    width: 100%;
  }
}
</style>