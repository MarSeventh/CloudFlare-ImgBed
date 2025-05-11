<template>
    <div
      id="themeToggle"
      @click="handleToggleClick"
    >
      <svg
        class="theme_toggle_svg"
        :class="{ 'dark': isDark }"
        width="1.5em"
        height="1.5em"
        viewBox="0 0 24 24"
        fill="none"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke="currentColor"
      >
        <mask id="themeMask">
          <rect x="0" y="0" width="100%" height="100%" fill="white"></rect>
          <circle
            class="theme_toggle_circle1"
            fill="black"
            :cx="isDark ? '50%' : '100%'"
            :cy="isDark ? '23%' : '0%'"
            :r="isDark ? '9' : '5'"
          ></circle>
        </mask>
        <circle
          class="theme_toggle_circle2"
          cx="12"
          cy="12"
          :r="isDark ? '9' : '5'"
          mask="url(#themeMask)"
        ></circle>
        <g class="theme_toggle_g" stroke="currentColor" :opacity="isDark ? 0 : 1">
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </g>
      </svg>
    </div>
</template>
  
<script>
export default {
  name: 'ToggleDark',
  data() {
    return {
      isDark: this.$store.getters.useDarkMode,
    };
  },
  methods: {
    handleToggleClick() {
      this.isDark = !this.isDark;
      this.$store.commit('setUseDarkMode', this.isDark);
      this.$store.commit('setCusDarkMode', true);
    },
  }
};
</script>

<style scoped>
#themeToggle {
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
}
@media (max-width: 768px) {
  #themeToggle {
    width: 2rem;
    height: 2rem;
  }
}

.theme_toggle_circle1 {
  transition: cx 0.5s ease-in-out, cy 0.5s ease-in-out, r 0.5s ease-in-out;
}

.theme_toggle_circle2 {
  transition: all 0.5s ease-in-out;
  fill: var(--theme-toggle-bg-color);
}

.theme_toggle_svg {
  transition: transform 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55);
  transform: rotate(90deg);
  color: var(--theme-toggle-color);
}
.dark.theme_toggle_svg {
  transform: rotate(40deg);
}

.theme_toggle_g {
  transition: opacity 0.5s ease-in-out;
}
</style>