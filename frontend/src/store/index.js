import { createStore } from 'vuex'
import axios from '@/utils/axios';
import createPersistedState from 'vuex-persistedstate';

export default createStore({
  state: {
    userConfig: null,
    bingWallPapers: [],
    credentials: null,
    uploadMethod: 'default',
    uploadCopyUrlForm: '',
    compressConfig: {
      customerCompress: undefined,
      compressQuality: undefined,
      compressBar: undefined,
      serverCompress: undefined,
      convertToWebp: undefined,
    },
    storeUploadChannel: '',
    storeChannelName: null, // 指定的渠道名称，null表示从未选择，''表示用户主动清空
    storeAutoRetry: true,
    storeUploadNameType: '',
    uploadFolder: '',
    customUrlSettings: {
      useCustomUrl: 'false',
      customUrlPrefix: '',
    },
    adminUrlSettings: {
      useCustomUrl: 'false',
      customUrlPrefix: '',
    },
    autoReUpload: true,
    // 深色模式
    useDarkMode: null,
    cusDarkMode: false,
  },
  getters: {
    userConfig: state => state.userConfig,
    bingWallPapers: state => state.bingWallPapers,
    credentials: state => state.credentials,
    storeUploadMethod: state => state.uploadMethod,
    uploadCopyUrlForm: state => state.uploadCopyUrlForm,
    compressConfig: state => state.compressConfig,
    storeUploadChannel: state => state.storeUploadChannel,
    storeChannelName: state => state.storeChannelName,
    storeUploadNameType: state => state.storeUploadNameType,
    customUrlSettings: state => state.customUrlSettings,
    storeAutoRetry: state => state.storeAutoRetry,
    adminUrlSettings: state => state.adminUrlSettings,
    storeUploadFolder: (state) => {
      return state.uploadFolder || localStorage.getItem('uploadFolder') || ''
    },
    useDarkMode: state => state.useDarkMode,
    cusDarkMode: state => state.cusDarkMode,
    storeAutoReUpload: state => state.autoReUpload,
  },
  mutations: {
    setUserConfig(state, userConfig) {
      state.userConfig = userConfig;
    },
    setBingWallPapers(state, bingWallPapers) {
      state.bingWallPapers = bingWallPapers;
    },
    setCredentials(state, credentials) {
      state.credentials = credentials;
    },
    setUploadMethod(state, uploadMethod) {
      state.uploadMethod = uploadMethod;
    },
    setUploadCopyUrlForm(state, uploadCopyUrlForm) {
      state.uploadCopyUrlForm = uploadCopyUrlForm;
    },
    setCompressConfig(state, { key, value }) {
      state.compressConfig[key] = value;
    },
    setStoreUploadChannel(state, uploadChannel) {
      state.storeUploadChannel = uploadChannel;
    },
    setStoreChannelName(state, channelName) {
      state.storeChannelName = channelName;
    },
    setStoreUploadNameType(state, storeUploadNameType) {
      state.storeUploadNameType = storeUploadNameType;
    },
    setCustomUrlSettings(state, { key, value }) {
      state.customUrlSettings[key] = value;
    },
    setStoreAutoRetry(state, storeAutoRetry) {
      state.storeAutoRetry = storeAutoRetry;
    },
    setAdminUrlSettings(state, { key, value }) {
      state.adminUrlSettings[key] = value;
    },
    setUseDarkMode(state, useDarkMode) {
      state.useDarkMode = useDarkMode;
    },
    setCusDarkMode(state, cusDarkMode) {
      state.cusDarkMode = cusDarkMode;
    },
    setStoreUploadFolder(state, folder) {
      state.uploadFolder = folder
      localStorage.setItem('uploadFolder', folder)
    },
    setStoreAutoReUpload(state, autoReUpload) {
      state.autoReUpload = autoReUpload;
    }
  },
  actions: {
    async fetchUserConfig({ commit }) {
      try {
        const response = await axios.get('/api/userConfig');
        commit('setUserConfig', response.data);
      } catch (error) {
        console.log(error);
      }
    },
    async fetchBingWallPapers({ commit }) {
      try {
        const response = await axios.get('/api/bing/wallpaper');
        const wallpapers = response.data.data;
        const bingWallPapers = wallpapers.map(wallpaper => {
          return {
            url: 'https://www.bing.com' + wallpaper.url,
          };
        }
        );

        //预加载图片，阻塞直到图片加载完成
        await Promise.all(bingWallPapers.map(wallpaper => {
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = resolve;
            img.onerror = reject;
            img.src = wallpaper.url;
          });
        }));
        commit('setBingWallPapers', bingWallPapers);
      } catch (error) {
        console.log(error);
      }
    }
  },
  modules: {
  },
  plugins: [createPersistedState()]
})
