<!-- src/views/AboutView.vue -->
<template>
  <div class="about-container">
    <h1>About BoothMe</h1>
    <p class="about-text">
      BoothMe adalah sebuah website yang menggabungkan artificial intelligence (AI) dan seni fotografi untuk membuat lukisan digital yang unik.
    </p>
    <p class="about-text">
      Capstone B, Information Technology 2022.
    </p>
  </div>
</template>

<script setup>
// No additional script needed for this view
</script>

<style scoped>
.about-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  width: 100%;
}

h1 {
  font-size: 2.5rem;
  color: #111827;
  margin-bottom: 1.5rem;
}

.about-text {
  font-size: 1.1rem;
  color: #4b5563;
  margin-bottom: 1.5rem;
  line-height: 1.6;
}
</style>