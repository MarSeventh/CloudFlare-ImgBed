<template>
  <router-view/>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  computed: {
    ...mapGetters(['userConfig', 'useDarkMode'])
  },
  watch: {
    useDarkMode() {
      this.setSiteIcon()
    }
  },
  methods: {
    setSiteIcon() {
      const link = document.createElement('link')
      link.rel = 'icon'
      
      // 根据深色模式选择不同的 logo
      if (this.useDarkMode) {
        link.href = this.userConfig?.siteIcon || '/logo-dark.png'
      } else {
        link.href = this.userConfig?.siteIcon || '/logo.png'
      }
      
      document.head.appendChild(link)
    }
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}

nav {
  padding: 30px;
}

nav a {
  font-weight: bold;
  color: #2c3e50;
}

nav a.router-link-exact-active {
  color: #42b983;
}

body {
  margin: 0;
  padding: 0;
  background-color: #f8f8f8;
}
:focus-visible {
    outline: none;
}
</style>
<style>
.el-dropdown__popper.el-popper {
    border-radius: 12px;
    border: none;
    background-color: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(10px);
    box-shadow: 0 0 10px 2px rgba(0, 0, 0, 0.1);
}
.el-dropdown__popper.el-popper .el-dropdown-menu {
    background: none;
    border: none;
}
.el-dropdown__popper.el-popper .el-dropdown-menu__item {
    border: none;
    background: none;
}
.el-popper.is-light>.el-popper__arrow::before {
    background: none;
    border: none;
}
</style>