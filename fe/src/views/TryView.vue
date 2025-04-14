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
          <div class="image-preview">
            <img :src="capturedImage" alt="Captured selfie" class="captured-image" />
            <img v-if="generatedImage" :src="generatedImage" alt="Generated image" class="generated-image" />
          </div>

          <!-- Add QR Code Section -->
          <div v-if="showQRCode" class="qr-code-section">
            <h3 class="section-title">Scan to Download</h3>
            <img :src="qrCodeImage" alt="QR Code" class="qr-code-image" />
            <p class="qr-code-text">Scan this QR code to download your generated image</p>
          </div>

          <!-- Add skin tone display -->
          <div v-if="skinTone" class="skin-tone-info">
            <h3 class="section-title">Detected Skin Tone</h3>
            <p class="skin-tone-value">{{ skinTone }}</p>
          </div>

          <!-- Age and Gender Selection -->
          <div v-if="!generatedImage && !isGenerating" class="age-gender-section">
            <h3 class="section-title">Tell us about yourself</h3>
            <div class="controls-container">
              <div class="gender-controls">
                <label class="gender-label">Gender:</label>
                <div class="gender-buttons">
                  <button 
                    @click="selectedGender = 'male'" 
                    :class="{ active: selectedGender === 'male' }"
                    class="gender-btn"
                  >
                    Male
                  </button>
                  <button 
                    @click="selectedGender = 'female'" 
                    :class="{ active: selectedGender === 'female' }"
                    class="gender-btn"
                  >
                    Female
                  </button>
                </div>
              </div>
              
              <div class="age-controls">
                <label class="age-label">Age: {{ selectedAge }} years</label>
                <input 
                  type="range" 
                  v-model="selectedAge" 
                  min="10" 
                  max="50" 
                  step="10"
                  class="age-slider"
                />
                <div class="age-markers">
                  <span>10</span>
                  <span>20</span>
                  <span>30</span>
                  <span>40</span>
                  <span>50+</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Style Options -->
          <div v-if="!generatedImage && !isGenerating" class="style-section">
            <h3 class="style-title">Choose a Style Filter</h3>
            <div class="style-grid">
              <button 
                v-for="style in styles" 
                :key="style.id"
                @click="generateImage(style.prompt)"
                :disabled="isGenerating"
                class="style-btn"
              >
                {{ style.name }}
              </button>
            </div>
          </div>

          <div v-if="isGenerating" class="generating-state">
            <div class="spinner"></div>
            <p>Generating your styled photo...</p>
          </div>

          <div class="action-buttons">
            <button @click="retakePhoto" class="retake-btn">Retake</button>
            <button @click="saveGeneratedPhoto" class="save-btn">Save Generated</button>
            <button @click="viewGallery" class="view-btn">View Gallery</button>
          </div>
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
import OpenAI from 'openai';
import { FaceDetection } from '@mediapipe/face_detection';
import QRCode from 'qrcode';

const router = useRouter();
const videoElement = ref(null);
const canvasElement = ref(null);
const cameraContainer = ref(null);
const cameraActive = ref(false);
const capturedImage = ref(null);
const generatedImage = ref(null);
const qrCodeImage = ref(null);
const showQRCode = ref(false);
const loadingState = ref('');
const stream = ref(null);
const timerActive = ref(false);
const timerCount = ref(0);
const selectedTimer = ref(0);
const isGenerating = ref(false);
const selectedAge = ref(20);
const selectedGender = ref('male');
const showAgeGenderControls = ref(false);

// Add new refs for caching and optimization
const cachedAnalysis = ref(null);
const isAnalyzing = ref(false);
const optimizedImage = ref(null);

const faceDetection = ref(null);
const skinTone = ref(null);
const skinToneCategories = [
  { name: 'Very Light', range: [0, 0.2] },
  { name: 'Light', range: [0.2, 0.4] },
  { name: 'Medium', range: [0.4, 0.6] },
  { name: 'Tan', range: [0.6, 0.8] },
  { name: 'Dark', range: [0.8, 1.0] }
];

// 💡 Optimized prompts
const styles = [
  {
    id: 1,
    name: 'Artistic',
    prompt: "Portrait of a person in cyberpunk digital art style, dramatic neon lighting (blue and magenta), futuristic techwear, high-contrast shadows, glowing effects, digital noise overlay, Blade Runner and Ghost in the Shell aesthetics"
  },
  {
    id: 2,
    name: 'Vintage',
    prompt: "Vintage comic book style portrait of a person, halftone print texture, bold outlines, retro color scheme, distressed ink effect, dramatic lighting, 1950s superhero poster aesthetic"
  },
  {
    id: 3,
    name: 'Anime',
    prompt: "Highly stylized anime character portrait, big glossy eyes, spiky anime hair, cel-shaded skin tones, soft background gradients, glow effects, dramatic pose, inspired by Makoto Shinkai and Studio MAPPA"
  },
  {
    id: 4,
    name: 'Oil Painting',
    prompt: "Expressionist oil painting portrait of a person, bold impasto brush strokes, intense emotional color palette, visible canvas texture, dramatic shadows, Van Gogh self-portrait aesthetic"
  },
  {
    id: 5,
    name: 'LEGO',
    prompt: "LEGO minifigure character portrait, cylindrical head, yellow plastic skin, dot eyes, smiling face, classic LEGO hair, high-detail studio lighting, posed in front of LEGO brick background, toy photography style"
  },
  {
    id: 6,
    name: '16-Bit Pixel',
    prompt: "16-bit pixel art RPG character portrait, blocky features, visible pixel grid, 1990s video game sprite style, limited color palette, fantasy background inspired by Chrono Trigger and Final Fantasy VI"
  },
  {
    id: 7,
    name: 'Pixar',
    prompt: "3D Pixar-style animated character portrait, round expressive face, large glossy eyes, stylized hair, soft lighting, warm tones, cinematic cartoon feel, inspired by Turning Red and Up"
  },
  {
    id: 8,
    name: 'Minecraft',
    prompt: "Minecraft character portrait in voxel art style, blocky geometry, pixel textures, simplified facial features, background filled with Minecraft blocks, torches, and floating items"
  },
  {
    id: 9,
    name: 'Van Gogh',
    prompt: "Swirling Van Gogh style painted portrait, visible brushstrokes, vibrant complementary colors, dynamic background inspired by The Starry Night, expressive impressionist art style"
  },
  {
    id: 10,
    name: 'Manga',
    prompt: "Black-and-white manga portrait, high-contrast linework, screentone effects, sharp eyes, speed lines, dramatic composition inspired by shonen manga like Naruto or Attack on Titan"
  },
  {
    id: 11,
    name: 'Manhwa',
    prompt: "Korean manhwa-style character portrait, clean digital line art, flawless glowing skin, glossy black hair, big sparkly eyes, subtle blush, fantasy webtoon aesthetic like Solo Leveling or True Beauty, sparkles and vertical composition"
  },
  {
    id: 12,
    name: 'Royal Portrait',
    prompt: "Fantasy royal portrait painting, ornate renaissance outfit, gold embroidery, gem-studded crown, dramatic studio lighting, grand throne room setting, detailed painterly style inspired by classic European royalty"
  }
];

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

// Generate a unique ID for each photo
const generateUniqueId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
};

// Initialize face detection
const initFaceDetection = async () => {
  faceDetection.value = new FaceDetection({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
    }
  });

  faceDetection.value.setOptions({
    modelSelection: 0,
    minDetectionConfidence: 0.5
  });

  await faceDetection.value.initialize();
};

// Analyze skin tone from image
const analyzeSkinTone = async (imageData) => {
  if (!faceDetection.value) {
    await initFaceDetection();
  }

  const results = await faceDetection.value.send({ image: imageData });
  
  if (results.detections && results.detections.length > 0) {
    const detection = results.detections[0];
    const keypoints = detection.keypoints;
    
    // Get the average skin tone from the face region
    const faceRegion = keypoints.slice(0, 6); // Use the first 6 keypoints for face region
    let totalBrightness = 0;
    
    for (const point of faceRegion) {
      const x = Math.round(point.x * imageData.width);
      const y = Math.round(point.y * imageData.height);
      const pixelIndex = (y * imageData.width + x) * 4;
      
      // Calculate brightness (average of RGB values)
      const r = imageData.data[pixelIndex];
      const g = imageData.data[pixelIndex + 1];
      const b = imageData.data[pixelIndex + 2];
      const brightness = (r + g + b) / 3 / 255; // Normalize to 0-1
      
      totalBrightness += brightness;
    }
    
    const averageBrightness = totalBrightness / faceRegion.length;
    
    // Determine skin tone category
    for (const category of skinToneCategories) {
      if (averageBrightness >= category.range[0] && averageBrightness < category.range[1]) {
        skinTone.value = category.name;
        break;
      }
    }
  }
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

// Modify the capturePhoto function to include skin tone analysis
const capturePhoto = async (timerSeconds) => {
  if (timerSeconds > 0) {
    timerActive.value = true;
    timerCount.value = timerSeconds;
    
    const timer = setInterval(() => {
      timerCount.value--;
      if (timerCount.value <= 0) {
        clearInterval(timer);
        timerActive.value = false;
        takePhoto();
      }
    }, 1000);
    return;
  }
  
  takePhoto();
};

const takePhoto = async () => {
  if (!videoElement.value || !canvasElement.value) return;
  
  const canvas = canvasElement.value;
  const video = videoElement.value;
  
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  capturedImage.value = canvas.toDataURL('image/jpeg');
  
  // Stop the camera
  if (stream.value) {
    stream.value.getTracks().forEach(track => track.stop());
    cameraActive.value = false;
  }
  
  // Analyze skin tone
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  await analyzeSkinTone(imageData);
};

// Add new function to optimize image size
const optimizeImage = (imageData) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Calculate new dimensions while maintaining aspect ratio
      const maxDimension = 1024;
      let width = img.width;
      let height = img.height;
      
      if (width > height) {
        if (width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to PNG with slightly reduced quality for faster processing
      optimizedImage.value = canvas.toDataURL('image/png', 0.9);
      resolve(optimizedImage.value);
    };
    img.src = imageData;
  });
};

// Add new function to start image analysis
const startImageAnalysis = async () => {
  if (!capturedImage.value || isAnalyzing.value) return;
  
  isAnalyzing.value = true;
  loadingState.value = 'Analyzing image features...';
  
  try {
    const analysis = await analyzeImageFeatures(optimizedImage.value || capturedImage.value);
    cachedAnalysis.value = analysis;
    console.log('Image Analysis Cached:', analysis);
  } catch (error) {
    console.error('Error in background analysis:', error);
  } finally {
    isAnalyzing.value = false;
    loadingState.value = '';
  }
};

// Retake photo
const retakePhoto = () => {
  capturedImage.value = null;
  generatedImage.value = null;
  cachedAnalysis.value = null;
  optimizedImage.value = null;
  showAgeGenderControls.value = false;
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

// Update the analyzeImageFeatures function with a simpler prompt
const analyzeImageFeatures = async (imageData) => {
  try {
    loadingState.value = 'Analyzing image features...';
    
    // Ensure the image data is properly formatted
    const base64Image = imageData.split(',')[1];
    
    // Call OpenAI Vision API with GPT-4 Vision Preview
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Briefly describe the person's key features in this format: [hair color/style], [eye color], [facial features], [clothing color/style]. Keep it concise."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${base64Image}`,
                  detail: "low" // Reduced detail level for faster processing
                }
              }
            ]
          }
        ],
        max_tokens: 150, // Reduced token limit
        temperature: 0.3 // Lower temperature for more consistent results
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API Error:', errorData);
      throw new Error(errorData.error?.message || 'Failed to analyze image');
    }

    const result = await response.json();
    console.log('Analysis Result:', result);
    
    if (!result.choices || !result.choices[0] || !result.choices[0].message) {
      throw new Error('Invalid response format from API');
    }
    
    return result.choices[0].message.content;
  } catch (error) {
    console.error('Error analyzing image:', error);
    throw error;
  }
};

// Update generateImage function to use cached analysis
const generateImage = async (stylePrompt) => {
  if (!capturedImage.value) return;

  isGenerating.value = true;
  loadingState.value = 'Preparing image...';

  try {
    // Use cached analysis if available, otherwise analyze now
    let imageAnalysis = cachedAnalysis.value;
    if (!imageAnalysis) {
      imageAnalysis = await analyzeImageFeatures(optimizedImage.value || capturedImage.value);
    }

    // Combine the style prompt with the analyzed features and user demographics
    const enhancedPrompt = `${stylePrompt}. Use these specific features from the original image: ${imageAnalysis}. The person is a ${selectedAge.value} year old ${selectedGender.value}. Maintain the person's unique characteristics while applying the requested style. Ensure the generated image preserves the key facial features, hair style, and clothing details from the original. Focus on maintaining the person's identity while applying the artistic style.`;

    loadingState.value = 'Generating styled image...';

    // Call DALL-E 3 API with the enhanced prompt
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: enhancedPrompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "vivid"
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('DALL-E Error:', error);
      throw new Error(error.error?.message || 'Failed to generate image');
    }

    const result = await response.json();
    generatedImage.value = result.data[0].url;
    loadingState.value = 'Image generated successfully!';
  } catch (err) {
    console.error('Error details:', err);
    loadingState.value = `Failed to generate image: ${err.message}`;
  } finally {
    isGenerating.value = false;
    setTimeout(() => {
      loadingState.value = '';
    }, 3000);
  }
};

// Save generated photo
const saveGeneratedPhoto = () => {
  if (!generatedImage.value) return;
  
  loadingState.value = 'Saving generated photo...';
  
  setTimeout(() => {
    try {
      const photoId = generateUniqueId();
      const photoData = {
        id: photoId,
        image: generatedImage.value,
        timestamp: new Date().toISOString(),
        isGenerated: true
      };
      
      const existingPhotos = JSON.parse(localStorage.getItem('selfies') || '[]');
      existingPhotos.push(photoData);
      
      localStorage.setItem('selfies', JSON.stringify(existingPhotos));
      
      loadingState.value = 'Generated photo saved successfully!';
      
      // Generate QR code automatically after saving
      generateQRCode();
      
      setTimeout(() => {
        loadingState.value = '';
        if (confirm('Generated photo saved! Would you like to view your gallery?')) {
          viewGallery();
        }
      }, 2000);
    } catch (error) {
      console.error('Error saving generated photo:', error);
      loadingState.value = 'Failed to save generated photo.';
      
      setTimeout(() => {
        loadingState.value = '';
      }, 2000);
    }
  }, 1500);
};

// Add new function to generate QR code
const generateQRCode = async () => {
  if (!generatedImage.value) return;
  
  try {
    loadingState.value = 'Generating QR code...';
    const qrCodeDataUrl = await QRCode.toDataURL(generatedImage.value, {
      width: 400,
      margin: 2,
      color: {
        dark: '#1e40af',
        light: '#ffffff'
      }
    });
    qrCodeImage.value = qrCodeDataUrl;
    showQRCode.value = true;
    loadingState.value = '';
  } catch (error) {
    console.error('Error generating QR code:', error);
    loadingState.value = 'Failed to generate QR code';
    setTimeout(() => {
      loadingState.value = '';
    }, 3000);
  }
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
  padding: 2rem;
  background: linear-gradient(to bottom, #f8fafc, #e2e8f0);
  overflow-y: auto; /* Enable vertical scrolling */
  position: relative;
}

.main-title {
  font-size: 3rem;
  color: #0f172a;
  margin-bottom: 1rem;
  text-align: center;
  font-weight: 700;
  background: linear-gradient(135deg, #1e40af, #3b82f6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
}

.info-text {
  font-size: 1.2rem;
  color: #475569;
  max-width: 700px;
  margin-bottom: 3rem;
  line-height: 1.6;
  text-align: center;
}

.camera-section {
  display: flex;
  justify-content: center;
  width: 100%;
  max-width: 1000px;
  margin: 0 auto 2rem auto;
  align-items: center;
  position: relative;
}

.camera-container {
  position: relative;
  width: 100%;
  max-width: 1000px;
  aspect-ratio: 16/9;
  border-radius: 20px;
  background-color: #ffffff;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  margin: 0 auto;
}

.camera-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f1f5f9, #e2e8f0);
  color: #475569;
  padding: 2rem;
}

.camera-prompt {
  text-align: center;
  margin-bottom: 1rem;
}

.camera-btn {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: white;
  border: none;
  padding: 1.125rem 2.25rem;
  border-radius: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 1.1rem;
  box-shadow: 0 8px 16px rgba(37, 99, 235, 0.2);
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.camera-btn:hover {
  transform: translateY(-2px);
  background: linear-gradient(135deg, #2563eb, #1e40af);
  box-shadow: 0 12px 20px rgba(37, 99, 235, 0.3);
}

.camera-btn:active {
  transform: translateY(0);
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.25);
}

.camera-feed {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.captured-container {
  width: 100%;
  height: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  background: transparent;
  overflow-y: auto;
}

.image-preview {
  display: flex;
  gap: 2rem;
  justify-content: center;
  align-items: flex-start; /* Changed from center to flex-start */
  width: 100%;
  margin-bottom: 2rem;
  flex-wrap: wrap; /* Allow wrapping on smaller screens */
}

.captured-image,
.generated-image {
  max-width: 45%;
  height: auto;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
  background: white;
  padding: 1rem;
}

.age-gender-section {
  width: 100%;
  max-width: 1000px;
  margin: 1rem auto;
  padding: 1.5rem;
  background: white;
  border-radius: 20px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

.section-title {
  font-size: 1.5rem;
  color: #0f172a;
  margin-bottom: 1.5rem;
  text-align: center;
  font-weight: 600;
}

.controls-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.gender-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.gender-label {
  font-size: 1.1rem;
  color: #475569;
  font-weight: 500;
}

.gender-buttons {
  display: flex;
  gap: 1rem;
}

.gender-btn {
  padding: 0.75rem 1.5rem;
  border-radius: 12px;
  border: 2px solid #e2e8f0;
  background: white;
  color: #475569;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.gender-btn.active {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: white;
  border-color: transparent;
}

.gender-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.age-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.age-label {
  font-size: 1.1rem;
  color: #475569;
  font-weight: 500;
}

.age-slider {
  width: 100%;
  max-width: 400px;
  height: 8px;
  -webkit-appearance: none;
  background: #e2e8f0;
  border-radius: 4px;
  outline: none;
}

.age-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 24px;
  height: 24px;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s ease;
}

.age-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.age-markers {
  display: flex;
  justify-content: space-between;
  width: 100%;
  max-width: 400px;
  padding: 0 12px;
  color: #64748b;
  font-size: 0.9rem;
}

.style-section {
  width: 100%;
  max-width: 1000px;
  margin: 1rem auto;
  padding: 1.5rem;
  background: white;
  border-radius: 20px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  overflow-y: auto;
}

.style-title {
  font-size: 1.8rem;
  color: #0f172a;
  margin-bottom: 2rem;
  text-align: center;
  font-weight: 600;
}

.style-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
  padding: 1rem;
  max-height: 400px; /* Set a max height */
  overflow-y: auto; /* Make grid scrollable if needed */
}

.style-btn {
  background: white;
  color: #1e40af;
  padding: 1rem 1.5rem;
  border-radius: 14px;
  border: 2px solid #e2e8f0;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-weight: 600;
  font-size: 0.95rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  width: 100%;
  height: 100%;
  min-height: 3.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  position: relative;
  overflow: hidden;
}

.style-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: white;
  border-color: transparent;
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(37, 99, 235, 0.2);
}

.style-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
}

.style-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: #f1f5f9;
  border-color: #e2e8f0;
  color: #64748b;
}

/* Timer overlay */
.timer-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 15;
  backdrop-filter: blur(4px);
}

.timer-count {
  font-size: 8rem;
  color: white;
  font-weight: bold;
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.8; }
  100% { transform: scale(1); opacity: 1; }
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
  position: sticky;
  bottom: 1rem;
  background: rgba(255, 255, 255, 0.95);
  padding: 1.25rem;
  border-radius: 16px;
  backdrop-filter: blur(12px);
  z-index: 10;
  margin-top: 1rem;
  width: 100%;
  max-width: 1000px;
  display: flex;
  gap: 1rem;
  justify-content: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.save-btn, .retake-btn, .view-btn {
  padding: 0.875rem 2rem;
  border-radius: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 1rem;
  min-width: 160px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 0.5px;
}

.save-btn {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: white;
  border: none;
}

.save-btn:hover {
  background: linear-gradient(135deg, #2563eb, #1e40af);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.25);
}

.retake-btn {
  background: white;
  color: #1e40af;
  border: 2px solid #3b82f6;
}

.retake-btn:hover {
  background: #f0f7ff;
  border-color: #2563eb;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.15);
}

.view-btn {
  background: linear-gradient(135deg, #10b981, #047857);
  color: white;
  border: none;
}

.view-btn:hover {
  background: linear-gradient(135deg, #059669, #065f46);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(5, 150, 105, 0.25);
}

.loading-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(15, 23, 42, 0.9);
  color: white;
  padding: 1rem 2rem;
  border-radius: 12px;
  font-weight: 500;
  z-index: 20;
  backdrop-filter: blur(8px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
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
    height: auto;
  }
  
  .main-title {
    font-size: 2.2rem;
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
    padding: 1rem;
    flex-direction: column;
    gap: 0.75rem;
    width: 90%;
  }
  
  .save-btn, .retake-btn, .view-btn {
    width: 100%;
    min-width: unset;
    padding: 0.75rem 1.5rem;
    font-size: 0.95rem;
  }
  
  .camera-btn {
    padding: 0.875rem 1.75rem;
    font-size: 1rem;
  }
  
  .timer-count {
    font-size: 5rem;
  }

  .image-preview {
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .captured-image,
  .generated-image {
    max-width: 100%;
    margin: 0 auto;
  }

  .style-section {
    margin: 0.5rem auto;
    padding: 1rem;
  }

  .style-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
    padding: 0.5rem;
    max-height: 300px;
  }

  .style-btn {
    padding: 0.75rem;
    font-size: 0.9rem;
  }

  .age-gender-section {
    padding: 1rem;
  }
  
  .section-title {
    font-size: 1.3rem;
  }
  
  .gender-btn {
    padding: 0.625rem 1.25rem;
    font-size: 0.95rem;
  }
  
  .age-slider {
    max-width: 300px;
  }
}

/* Small Mobile */
@media (max-width: 480px) {
  .main-title {
    font-size: 1.5rem;
  }
  
  .action-buttons {
    width: 100%;
    padding: 0.875rem;
    gap: 0.5rem;
  }
  
  .save-btn, .retake-btn, .view-btn {
    padding: 0.75rem 1.25rem;
    font-size: 0.9rem;
    border-radius: 12px;
  }
  
  .camera-btn {
    padding: 0.75rem 1.5rem;
    font-size: 0.95rem;
    border-radius: 12px;
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

  .age-gender-section {
    padding: 0.875rem;
  }
  
  .section-title {
    font-size: 1.2rem;
  }
  
  .gender-buttons {
    flex-direction: column;
    width: 100%;
  }
  
  .gender-btn {
    width: 100%;
  }
  
  .age-slider {
    max-width: 250px;
  }
}

/* Scrollbar Styling */
.style-grid::-webkit-scrollbar {
  width: 8px;
}

.style-grid::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 4px;
}

.style-grid::-webkit-scrollbar-thumb {
  background: #94a3b8;
  border-radius: 4px;
}

.style-grid::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}

.skin-tone-info {
  margin: 1rem 0;
  text-align: center;
}

.skin-tone-value {
  font-size: 1.2rem;
  color: #4b5563;
  margin-top: 0.5rem;
}

/* Add QR Code Styles */
.qr-code-section {
  width: 100%;
  max-width: 400px;
  margin: 1.5rem auto;
  padding: 1.5rem;
  background: white;
  border-radius: 20px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  text-align: center;
}

.qr-code-image {
  width: 100%;
  max-width: 300px;
  height: auto;
  margin: 1rem auto;
  border-radius: 12px;
  padding: 1rem;
  background: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.qr-code-text {
  color: #475569;
  font-size: 0.95rem;
  margin-top: 0.5rem;
}

.qr-btn {
  background: linear-gradient(135deg, #8b5cf6, #6d28d9);
  color: white;
  border: none;
  padding: 0.875rem 2rem;
  border-radius: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 1rem;
  min-width: 160px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.qr-btn:hover {
  background: linear-gradient(135deg, #7c3aed, #5b21b6);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(139, 92, 246, 0.25);
}

/* Responsive styles for QR code */
@media (max-width: 768px) {
  .qr-code-section {
    padding: 1rem;
    margin: 1rem auto;
  }
  
  .qr-code-image {
    max-width: 250px;
  }
  
  .qr-code-text {
    font-size: 0.9rem;
  }
}

@media (max-width: 480px) {
  .qr-code-section {
    padding: 0.875rem;
  }
  
  .qr-code-image {
    max-width: 200px;
  }
  
  .qr-code-text {
    font-size: 0.85rem;
  }
}
</style>