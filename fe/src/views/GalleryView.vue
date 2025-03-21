<!-- src/views/GalleryView.vue -->
<template>
    <div class="gallery-container">
      <div class="gallery-header">
        <h1 class="main-title">BoothMe Gallery</h1>
        <div class="header-actions">
          <button @click="goBack" class="back-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to Camera
          </button>
        </div>
      </div>
      
      <div class="info-section">
        <div class="saved-photos" v-if="savedPhotos.length > 0">
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
        
        <div v-else class="empty-gallery">
          <p>You don't have any saved photos yet.</p>
          <button @click="goBack" class="camera-btn">Take a Photo</button>
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
  import { ref, onMounted, nextTick } from 'vue';
  import { useRouter } from 'vue-router';
  
  const router = useRouter();
  const qrCodeElement = ref(null);
  const shareLink = ref(null);
  const savedPhotos = ref([]);
  const showShare = ref(false);
  const currentShareLink = ref('');
  const copied = ref(false);
  const currentSharePhoto = ref(null);
  const showDeleteConfirm = ref(false);
  const photoToDeleteId = ref(null);
  const loadingState = ref('');
  
  // Generate a unique ID for each photo
  const generateUniqueId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  };
  
  // Base URL for sharing (in a real app, this would be your domain)
  const baseUrl = window.location.origin + '/share/';
  
  // Load saved photos from localStorage
  const loadSavedPhotos = () => {
  try {
    const photos = JSON.parse(localStorage.getItem('selfies') || '[]');

    savedPhotos.value = photos.map(photo => {
      if (typeof photo === 'string') {
        return {
          id: generateUniqueId(),
          image: photo,
          timestamp: new Date().toISOString()
        };
      }
      return photo;
    }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

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
  
  // Go back to camera view
  const goBack = () => {
    router.push('/try');
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
  </script>
  
  <style scoped>
  .gallery-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    width: 100%;
    align-items: center;
    padding: 1rem;
  }
  
  .gallery-header {
    width: 100%;
    max-width: 1200px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    flex-wrap: wrap;
    gap: 1rem;
  }
  
  .main-title {
    font-size: 2.5rem;
    color: #111827;
    margin: 0;
  }
  
  .header-actions {
    display: flex;
    gap: 1rem;
  }
  
  .back-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background-color: #f3f4f6;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 5px;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .back-btn:hover {
    background-color: #e5e7eb;
  }
  
  .info-section {
    width: 100%;
    max-width: 1200px;
  }
  
  .saved-photos {
    width: 100%;
  }
  
  .photo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1.5rem;
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
  display: flex;
  justify-content: space-around;
  padding: 0.5rem;
  background-color: rgba(0, 0, 0, 0.6);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.photo-item:hover .photo-actions {
  opacity: 1;
}

.action-btn {
  background-color: transparent;
  border: none;
  color: white;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.action-btn:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.empty-gallery {
  text-align: center;
  padding: 3rem;
  background-color: #f9fafb;
  border-radius: 8px;
}

.empty-gallery p {
  font-size: 1.2rem;
  color: #6b7280;
  margin-bottom: 1.5rem;
}

.camera-btn {
  background-color: #3b82f6;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 5px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.camera-btn:hover {
  background-color: #2563eb;
}

.share-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.share-dialog {
  background-color: white;
  border-radius: 8px;
  padding: 1.5rem;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.delete-dialog {
  max-width: 350px;
}

.share-dialog h3 {
  margin-top: 0;
  margin-bottom: 1.5rem;
  text-align: center;
  color: #111827;
}

.qr-code-container {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.share-link {
  display: flex;
  margin-bottom: 1.5rem;
}

.share-link input {
  flex-grow: 1;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 5px 0 0 5px;
  font-size: 0.875rem;
}

.copy-btn {
  background-color: #3b82f6;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0 5px 5px 0;
  cursor: pointer;
  transition: background-color 0.2s;
}

.copy-btn:hover {
  background-color: #2563eb;
}

.share-actions, .delete-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
}

.close-btn {
  background-color: #f3f4f6;
  border: none;
  padding: 0.5rem 1.5rem;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: #e5e7eb;
}

.delete-confirm-btn {
  background-color: #ef4444;
  color: white;
  border: none;
  padding: 0.5rem 1.5rem;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.delete-confirm-btn:hover {
  background-color: #dc2626;
}

.cancel-btn {
  background-color: #f3f4f6;
  border: none;
  padding: 0.5rem 1.5rem;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.cancel-btn:hover {
  background-color: #e5e7eb;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .gallery-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .photo-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
  
  .main-title {
    font-size: 2rem;
  }
}

/* Loading state indicator */
.loading-state {
  position: fixed;
  top: 1rem;
  right: 1rem;
  background-color: #111827;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 5px;
  z-index: 1000;
  animation: fadeIn 0.3s;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

</style>