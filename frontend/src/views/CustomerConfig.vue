<template>
    <div class="container">
        <el-header>
            <div class="header-content">
                <DashboardTabs activeTab="customerConfig"></DashboardTabs>
                <div class="header-action">
                    <el-tooltip :disabled="disableTooltip" content="退出登录" placement="bottom">
                        <font-awesome-icon icon="sign-out-alt" class="header-icon" @click="handleLogout"></font-awesome-icon>
                    </el-tooltip>
                </div>
            </div>
        </el-header>
        <div class="main-container">
            <el-table :data="paginatedData" :default-sort="{ prop: 'count', order: 'descending' }" class="main-table" table-layout="fixed" v-loading="loading">
                <el-table-column type="expand">
                    <template v-slot="props">
                        <div style="margin: 8px;">
                            <h3 style="text-align: center;">上传文件列表</h3>
                            <el-table :data="props.row.data" style="width: 100%" :default-sort="{ prop: 'metadata.TimeStamp', order: 'descending' }" table-layout="fixed" :max-height="400">
                                <el-table-column prop="metadata.FileName" label="文件名"></el-table-column>
                                <el-table-column label="文件预览">
                                    <template v-slot="{ row }">
                                        <el-image v-if="row.metadata?.FileType?.includes('image')" :src="'/file/' + row.id + '?from=admin'" fit="cover" lazy style="width: 100px; height: 100px;"></el-image>
                                        <video v-else-if="row.metadata?.FileType?.includes('video')" :src="'/file/' + row.id + '?from=admin'" controls style="width: 100px; height: 100px;"></video>
                                        <div v-else style="width: 100px; height: 100px; display: flex; justify-content: center; align-items: center;">
                                            <font-awesome-icon icon="file" style="font-size: 2em;"></font-awesome-icon>
                                        </div>
                                    </template>
                                </el-table-column>
                                <el-table-column 
                                    :formatter="formatTimeStamp" 
                                    label="上传时间" 
                                    prop="metadata.TimeStamp"
                                    sortable 
                                    :sort-method="sortByTimestamp">
                                    <template v-slot="{ row }">
                                        {{ formatTimeStamp(row.metadata.TimeStamp) }}
                                    </template>
                                </el-table-column>
                            </el-table>
                        </div>
                    </template>
                </el-table-column>
                <el-table-column prop="ip" label="IP地址"></el-table-column>
                <el-table-column prop="address" label="地址"></el-table-column>
                <el-table-column prop="count" label="上传次数" sortable></el-table-column>
                <el-table-column label="允许上传">
                    <template v-slot="{ row }">
                        <el-switch
                            v-model="row.enable"
                            active-color="#13ce66"
                            inactive-color="#ff4949"
                            active-text="允许"
                            inactive-text="禁止"
                            @change="handleSwitchEnable(row)"
                        >
                        </el-switch>
                    </template>
                </el-table-column>
            </el-table>

            <!-- 分页组件 -->
            <div class="pagination-container">
                <el-pagination
                    background
                    layout="prev, pager, next"
                    :total="dealedData.length"
                    :current-page="currentPage"
                    :page-size="pageSize"
                    :pager-count="pagerCount"
                    @current-change="handlePageChange"
                ></el-pagination>
                <el-button v-if="currentPage === Math.ceil(dealedData.length / pageSize)" type="primary" @click="loadMoreData" :loading="loading" class="load-more">加载更多</el-button>
            </div>
        </div>
    </div>
</template>

<script>
import fetchWithAuth from '@/utils/fetchWithAuth';
import DashboardTabs from '@/components/DashboardTabs.vue';
import backgroundManager from '@/mixins/backgroundManager';

export default {
    name: 'CustomerConfig',
    mixins: [backgroundManager],
    data() {
        return {
            tableData: [],
            dealedData: [], // 根据IP地址处理后的数据，格式为 {ip, count, [data]}
            blockipList: [], // 禁止上传的IP列表

            loading: false,

            // 分页数据
            currentPage: 1,
            pageSize: 10, // 默认每页10条
        }
    },
    components: {
        DashboardTabs
    },
    computed: {
        disableTooltip() {
            return window.innerWidth < 768;
        },
        pagerCount() {
            return window.innerWidth < 768 ? 3 : 7;
        },
        paginatedData() {
            // 计算分页数据
            const start = (this.currentPage - 1) * this.pageSize;
            const end = start + this.pageSize;
            return this.dealedData.slice(start, end);
        }
    },
    methods: {
        handleLogout() {
            this.$store.commit('setCredentials', null);
            this.$router.push('/adminLogin');
        },
        formatTimeStamp(timeStamp) {
            return new Date(timeStamp).toLocaleString();
        },
        sortByTimestamp(a, b) {
            return new Date(a.metadata.TimeStamp) - new Date(b.metadata.TimeStamp);
        },
        async handleSwitchEnable(row) {
            const ip = row.ip;
            const enable = row.enable;
            if (enable) {
                // 从 blockipList 中移除
                this.blockipList = this.blockipList.filter(item => item !== ip);
                // 更新 blockipList
                await fetchWithAuth("/api/manage/cusConfig/whiteip", {
                    method: 'POST',
                    body: ip
                });
            } else {
                // 添加到 blockipList 中
                this.blockipList.push(ip);
                // 更新 blockipList
                await fetchWithAuth("/api/manage/cusConfig/blockip", {
                    method: 'POST',
                    body: ip
                });
            }
        },
        handlePageChange(page) {
            this.currentPage = page;
            // 到最后一页时，加载更多数据
            if (page === Math.ceil(this.dealedData.length / this.pageSize)) {
                this.loadMoreData();
            }
        },
        loadMoreData() {
            this.loading = true;
            const start = this.dealedData.length;
            const count = 20; // 每次加载20条数据
            fetchWithAuth(`/api/manage/cusConfig/list?start=${start}&count=${count}`, { method: 'GET' })
            .then(response => response.json())
            .then(result => {
                this.dealedData = this.dealedData.concat(result.map(item => {
                    const enable = !this.blockipList.includes(item.ip);
                    return {
                        ip: item.ip,
                        address: item.address,
                        count: item.count,
                        data: item.data,
                        enable: enable
                    };
                }));
            })
            .catch(() => {
                this.$message.error('加载更多数据时出错，请检查网络连接');
            })
            .finally(() => {
                this.loading = false;
            });
        },
        handleSizeChange(size) {
            this.pageSize = size;
            this.currentPage = 1;
        }
    },
    mounted() {
        // 初始化背景图
        this.initializeBackground('adminBkImg', '.container', false, true);

        this.loading = true;

        fetchWithAuth("/api/manage/check", { method: 'GET' })
        .then(response => response.text())
        .then(result => {
            if(result == "true"){
                this.showLogoutButton=true;
                // 在 check 成功后再执行 list 的 fetch 请求
                return fetchWithAuth("/api/manage/cusConfig/list?count=20", { method: 'GET' });
            } else if(result=="Not using basic auth."){
                return fetchWithAuth("/api/manage/cusConfig/list?count=20", { method: 'GET' });
            } else{
                throw new Error('Unauthorized');
            }
        })
        .then(response => response.json())
        .then(async result => {
            // 读取blockipList, 接口返回格式为 'ip1,ip2,ip3'，需要转换为数组
            const blockipList = await fetchWithAuth("/api/manage/cusConfig/blockipList", { method: 'GET' });
            this.blockipList = (await blockipList.text()).split(',');
            this.dealedData = result.map(item => {
                const enable = !this.blockipList.includes(item.ip);
                return {
                    ip: item.ip,
                    address: item.address,
                    count: item.count,
                    data: item.data,
                    enable: enable
                };
            });
        })
        .catch((err) => {
            if (err.message !== 'Unauthorized') {
                this.$message.error('同步数据时出错，请检查网络连接');
            }
        })
        .finally(() => {
            this.loading = false;
        });
    }
}
</script>

<style scoped>
.main-table {
    width: 95%;
    max-width: 1400px;
    border-radius: 16px;
    box-shadow: var(--glass-shadow);
    min-height: 530px;
    overflow: hidden;
    border: 1px solid var(--glass-border);
    background: var(--glass-bg) !important;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
}

.main-table :deep(.el-table__inner-wrapper) {
    background: transparent !important;
}

.main-table :deep(.el-table__header-wrapper) {
    background: var(--glass-header-bg) !important;
}

.main-table :deep(.el-table__header th) {
    background: transparent !important;
}

.main-table :deep(.el-table__body-wrapper) {
    background: transparent !important;
}

.main-table :deep(.el-table__row) {
    background: transparent !important;
}

.main-table :deep(.el-table__row td) {
    background: transparent !important;
}

.main-table :deep(.el-table__row:hover td) {
    background: var(--glass-header-bg) !important;
}

.main-table :deep(.el-table__expanded-cell) {
    background: var(--glass-header-bg) !important;
}

.container {
    background: var(--admin-container-bg-color);
    min-height: 100vh;
    font-family: 'Arial', sans-serif;
    color: var(--admin-container-color);
    margin: 0;
    padding: 0;
}

.header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 24px;
    /* macOS 风格毛玻璃效果 */
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    /* 顶部边框形成玻璃边缘光泽 */
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-top: 1px solid rgba(255, 255, 255, 0.5);
    /* 悬浮阴影效果 */
    box-shadow: 
        0 4px 30px rgba(0, 0, 0, 0.1),
        0 1px 3px rgba(0, 0, 0, 0.05),
        inset 0 1px 0 rgba(255, 255, 255, 0.4);
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    border-radius: 16px;
    position: fixed;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    width: calc(95% - 16px);
    z-index: 2001;
    min-height: 45px;
}

/* 深色模式毛玻璃效果 */
html.dark .header-content {
    background: rgba(30, 30, 30, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 
        0 4px 30px rgba(0, 0, 0, 0.3),
        0 1px 3px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

@media (max-width: 768px) {
    .header-content {
        flex-direction: column;
        top: 6px;
        width: calc(100% - 32px);
        border-radius: 14px;
        padding: 6px 12px;
        gap: 4px;
    }
    
    .header-icon {
        font-size: 0.95em;
    }
}

.header-content:hover {
    background: rgba(255, 255, 255, 0.82);
    box-shadow: 
        0 8px 40px rgba(0, 0, 0, 0.12),
        0 2px 6px rgba(0, 0, 0, 0.08),
        inset 0 1px 0 rgba(255, 255, 255, 0.5);
    transform: translateX(-50%) translateY(-1px);
}

html.dark .header-content:hover {
    background: rgba(35, 35, 35, 0.85);
    box-shadow: 
        0 8px 40px rgba(0, 0, 0, 0.4),
        0 2px 6px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.header-icon {
    font-size: 1.5em;
    cursor: pointer;
    transition: all 0.3s ease;
    color: var(--admin-container-color);
    outline: none;
}

.header-icon:hover {
    color: #B39DDB; /* 使用柔和的淡紫色 */
    transform: scale(1.2);
}

.header-action {
    display: flex;
    gap: 10px;
}

.main-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 20px;
}

@media (max-width: 768px) {
    .main-container {
        margin-top: 35px;
    }
}

.pagination-container {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-top: 24px;
    padding-bottom: 30px;
    gap: 15px;
}

/* 页码按钮美化 */
.pagination-container :deep(.el-pagination) {
    --el-pagination-button-bg-color: var(--admin-dashboard-btn-bg-color);
    --el-pagination-hover-color: var(--admin-purple);
}

.pagination-container :deep(.el-pager li) {
    background: var(--admin-dashboard-btn-bg-color);
    border-radius: 10px;
    margin: 0 4px;
    min-width: 36px;
    height: 36px;
    line-height: 36px;
    font-weight: 500;
    border: none;
    box-shadow: var(--admin-dashboard-btn-shadow);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.pagination-container :deep(.el-pager li:hover) {
    color: #38bdf8;
    transform: translateY(-2px);
    box-shadow: var(--admin-dashboard-btn-hover-shadow);
}

.pagination-container :deep(.el-pager li.is-active) {
    background: linear-gradient(135deg, #0ea5e9, #38bdf8) !important;
    color: white !important;
    border-radius: 10px;
    box-shadow: 
        var(--admin-dashboard-btn-shadow),
        0 4px 12px rgba(56, 189, 248, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.pagination-container :deep(.el-pager li.is-active:hover) {
    transform: translateY(-2px) !important;
    box-shadow: 
        var(--admin-dashboard-btn-hover-shadow),
        0 6px 16px rgba(56, 189, 248, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
}

.pagination-container :deep(.btn-prev),
.pagination-container :deep(.btn-next) {
    background: var(--admin-dashboard-btn-bg-color) !important;
    border-radius: 10px !important;
    min-width: 36px;
    height: 36px;
    border: none;
    box-shadow: var(--admin-dashboard-btn-shadow);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.pagination-container :deep(.btn-prev:hover),
.pagination-container :deep(.btn-next:hover) {
    color: #38bdf8;
    transform: translateY(-2px);
    box-shadow: var(--admin-dashboard-btn-hover-shadow);
}

.load-more {
    cursor: pointer;
    background-color: var(--admin-dashboard-btn-bg-color);
    box-shadow: var(--admin-dashboard-btn-shadow);
    color: var(--admin-dashboard-btn-color);
    border: none;
    transition: all 0.3s ease;
    margin-left: 0;
    border-radius: 8px;
    padding: 8px 20px;
    height: 36px;
}

.load-more:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
</style>