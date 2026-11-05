<template>
    <div class="container">

        <el-container>
            <el-header>
            <div class="header-content">
                <DashboardTabs activeTab="dashboard"></DashboardTabs>
                <div class="search-area">
                    <div class="search-card">
                        <el-input v-model="tempSearch" size="small" :placeholder="$t('dashboard.searchPlaceholder')" @keyup.enter="handleSearch">
                            <template #suffix>
                                <font-awesome-icon icon="search" class="search-icon" @click="handleSearch"/>
                            </template>
                        </el-input>
                    </div>
                    <!-- 筛选下拉菜单 -->
                    <FilterDropdown
                        v-model:filters="filters"
                        :channelNameOptions="channelNameOptions"
                        :tagOptions="tagOptions"
                        @change="handleFilterChange"
                    />
                </div>
                <div class="actions">
                <QuickUpload :current-path="currentPath" @uploaded="scheduleUploadRefresh" />
                <el-tooltip :content="$t('tagCatalog.title')" placement="bottom">
                    <button class="column-settings-btn" :aria-label="$t('tagCatalog.title')" @click="showTagCatalog = true"><font-awesome-icon icon="tags" class="header-icon" /></button>
                </el-tooltip>
                <el-dropdown @command="sort" :hide-on-click="false">
                    <span class="el-dropdown-link">
                        <font-awesome-icon :icon="sortIcon" class="header-icon"></font-awesome-icon>
                    </span>
                    <template #dropdown>
                        <el-dropdown-menu>
                            <el-dropdown-item command="dateDesc">{{ $t('dashboard.sortByDateDesc') }}</el-dropdown-item>
                            <el-dropdown-item command="nameAsc">{{ $t('dashboard.sortByNameAsc') }}</el-dropdown-item>
                        </el-dropdown-menu>
                    </template>
                </el-dropdown>
                <el-tooltip :disabled="disableTooltip" :content="$t('dashboard.selectPage')" placement="bottom">
                    <font-awesome-icon :icon="selectPageIcon" class="header-icon" @click="handleSelectPage"></font-awesome-icon>
                </el-tooltip>
                <el-dropdown @command="handleBatchAction" :hide-on-click="false" :disabled="selectedFiles.length === 0">
                    <span class="el-dropdown-link">
                        <font-awesome-icon icon="ellipsis-h" class="header-icon" :class="{ disabled: selectedFiles.length === 0 }"></font-awesome-icon>
                    </span>
                    <template #dropdown>
                        <el-dropdown-menu>
                            <el-dropdown-item command="copy">
                                <font-awesome-icon icon="copy" class="batch-action-item-icon"></font-awesome-icon>
                                {{ $t('dashboard.copy') }}
                            </el-dropdown-item>
                            <el-dropdown-item command="tagManagement">
                                <font-awesome-icon icon="tags" class="batch-action-item-icon"></font-awesome-icon>
                                {{ $t('dashboard.tagManagement') }}
                            </el-dropdown-item>
                            <el-dropdown-item command="ban">
                                <font-awesome-icon icon="ban" class="batch-action-item-icon"></font-awesome-icon>
                                {{ $t('dashboard.addToBlacklist') }}
                            </el-dropdown-item>
                            <el-dropdown-item command="white">
                                <font-awesome-icon icon="user-plus" class="batch-action-item-icon"></font-awesome-icon>
                                {{ $t('dashboard.addToWhitelist') }}
                            </el-dropdown-item>
                        </el-dropdown-menu>
                    </template>
                </el-dropdown>
                <el-tooltip :disabled="disableTooltip" :content="$t('dashboard.linkFormat')" placement="bottom">
                    <span class="el-dropdown-link">
                        <font-awesome-icon icon="link" class="header-icon" @click="showUrlDialog = true"></font-awesome-icon>
                    </span>
                </el-tooltip>
                <el-tooltip :disabled="disableTooltip" :content="viewMode === 'card' ? $t('dashboard.listView') : $t('dashboard.cardView')" placement="bottom">
                    <font-awesome-icon :icon="viewMode === 'card' ? 'list' : 'th-large'" class="header-icon" @click="toggleViewMode"></font-awesome-icon>
                </el-tooltip>
                <el-popover v-if="viewMode === 'list'" placement="bottom-end" trigger="click" :width="230">
                    <template #reference>
                        <span><el-tooltip :content="$t('dashboard.visibleColumns')" placement="bottom"><button class="column-settings-btn" :aria-label="$t('dashboard.visibleColumns')"><font-awesome-icon icon="cog" class="header-icon"/></button></el-tooltip></span>
                    </template>
                    <strong>{{ $t('dashboard.visibleColumns') }}</strong>
                    <p>{{ $t('dashboard.requiredColumns') }}</p>
                    <el-checkbox-group v-model="visibleListColumns" class="column-options">
                        <el-checkbox v-for="column in listColumnOptions" :key="column.key" :label="column.key">{{ $t('dashboard.' + column.label) }}</el-checkbox>
                    </el-checkbox-group>
                    <el-button link type="primary" @click="resetListColumns">{{ $t('dashboard.resetColumns') }}</el-button>
                </el-popover>
                <el-tooltip :disabled="disableTooltip" :content="$t('dashboard.logout')" placement="bottom">
                    <font-awesome-icon icon="sign-out-alt" class="header-icon" @click="handleLogout"></font-awesome-icon>
                </el-tooltip>
                </div>
            </div>
            </el-header>
            <el-main class="main-container">
        <el-alert v-if="normalizationRunning || normalizationError || normalizationResult?.skipped" :type="normalizationError || normalizationResult?.skipped ? 'warning' : 'info'" :closable="!normalizationRunning" style="margin-bottom: 12px">
            <div v-if="normalizationRunning">{{ $t('dashboard.normalizingNames') }}</div>
            <div v-else-if="normalizationError">{{ $t('dashboard.nameNormalizationFailed') }}</div>
            <div v-else>{{ $t('dashboard.nameNormalizationDone', { count: normalizationResult?.renamed || 0, conflicts: normalizationResult?.conflictsResolved || 0 }) }}</div>
            <div v-if="normalizationResult?.skipped">{{ $t('dashboard.nameNormalizationSkipped', { count: normalizationResult.skipped }) }}</div>
            <ul v-if="normalizationResult?.errors?.length"><li v-for="item in normalizationResult.errors" :key="item.path">{{ item.path }}：{{ item.reason }}</li></ul>
            <el-button v-if="!normalizationRunning && (normalizationError || normalizationResult?.skipped)" link type="primary" @click="retryNameNormalization">{{ $t('dashboard.retryNameNormalization') }}</el-button>
        </el-alert>
            <!-- 目录导航 -->
            <div class="breadcrumb-container">
                <!-- 移动端目录按钮 -->
                <div class="mobile-directory-trigger" @click="showMobileDirectoryDrawer = true">
                    <font-awesome-icon icon="folder-open" class="mobile-directory-icon"/>
                    <span class="mobile-directory-path">{{ currentPath && currentPath.split('/').filter(Boolean).length > 0 ? currentPath.split('/').filter(Boolean).pop() : $t('dashboard.rootDirectory') }}</span>
                    <font-awesome-icon icon="chevron-down" class="mobile-directory-arrow"/>
                </div>
                <!-- 桌面端面包屑 -->
                <div class="breadcrumb desktop-only">
                    <el-breadcrumb separator="/">
                        <el-breadcrumb-item @click="navigateToFolder('')">
                            <font-awesome-icon icon="home" class="breadcrumb-home-icon"/>
                        </el-breadcrumb-item>
                        <el-breadcrumb-item 
                            v-for="(folder, index) in currentPath.split('/').filter(Boolean)" 
                            :key="index"
                            @click="navigateToFolder(currentPath.split('/').filter(Boolean).slice(0, index + 1).join('/'))">
                            {{ folder }}
                        </el-breadcrumb-item>
                    </el-breadcrumb>
                </div>
            <div class="batch-toolbar" role="toolbar" :aria-label="$t('dashboard.batchActions')">
                <span class="selection-count">{{ $t('dashboard.selectedCount', { count: selectedFiles.length }) }}</span>
                <el-tooltip v-for="action in batchHeaderActions" :key="action.command" :content="$t('dashboard.' + action.command)" placement="top">
                    <span><button class="batch-header-button" :class="{ danger: action.command === 'delete' }" :aria-label="$t('dashboard.' + action.command)" :disabled="loading || !selectedFiles.length || (['download', 'telegramSend'].includes(action.command) && !selectedFiles.some(file => !file.isFolder))" @click="handleBatchAction(action.command)"><font-awesome-icon :icon="action.icon" /></button></span>
                </el-tooltip>
            </div>
                <span class="stats-badge" :title="$t('dashboard.totalFiles', { count: $data.Number })">
                    <font-awesome-icon icon="database" class="stats-badge-icon"/>
                    {{ Number }}
                </span>
            </div>
            
            <!-- 卡片视图 -->
            <div v-if="viewMode === 'card'" class="content" ref="cardContainerRef">
                <!-- 加载骨架屏 -->
                <SkeletonLoader v-if="loading" type="card" :count="15" />
                <!-- 空状态 -->
                <div v-else-if="paginatedTableData.length === 0" class="empty-state">
                    <font-awesome-icon icon="folder-open" class="empty-icon" />
                    <p class="empty-text">{{ hasSearchOrFilter ? $t('dashboard.noMatchingFiles') : $t('dashboard.currentDirEmpty') }}</p>
                    <p class="empty-hint">{{ hasSearchOrFilter ? $t('dashboard.adjustSearchHint') : $t('dashboard.uploadHint') }}</p>
                </div>
                <!-- 文件夹和文件列表 -->
                <template v-else v-for="(item, index) in paginatedTableData" :key="index">
                    <!-- 文件夹卡片 -->
                    <FolderCard 
                        v-if="isFolder(item)"
                        :name="item.name"
                        v-model:selected="item.selected"
                        :showActions="!isSearchMode"
                        :disableTooltip="disableTooltip"
                        @enter="enterFolder(item.name)"
                        @copy="handleFolderCopy(item.name)"
                        @move="handleMove(index, item.name)"
                        @delete="handleDelete(index, item.name)"
                        @touchstart="handleFolderTouchStart(item, index)"
                        @touchend="handleTouchEnd"
                        @touchmove="handleTouchEnd"
                    />
                    <!-- 文件卡片 -->
                    <FileCard 
                        v-else
                        :item="item"
                        v-model:selected="item.selected"
                        :fileLink="getFileLink(item.name)"
                        :previewSrcList="item.previewSrcList"
                        :disableTooltip="disableTooltip"
                        @detail="openDetailDialog(index, item.name)"
                        @tags="handleTagManagement(item.name)"
                        @rename="openQuickRename(item)"
                        @replace="openReplaceDialog(item)"
                        @replace-local="openLocalReplaceDialog(item)"
                        @copy="handleCopy(index, item.name)"
                        @move="handleMove(index, item.name)"
                        @delete="handleDelete(index, item.name)"
                        @download="handleDownload(item.name)"
                        @touchstart="handleTouchStart(item, index)"
                        @touchend="handleTouchEnd"
                        @touchmove="handleTouchEnd"
                    />
                </template>
            </div>
            <!-- 列表视图 -->
            <div v-else class="list-view" :style="listLayout" ref="listContainerRef">
                <div class="list-header">
                    <div class="list-col list-col-checkbox">
                        <span class="custom-checkbox" :class="{ 'checked': isSelectAll, 'indeterminate': isIndeterminate }" @click="handleSelectAllPage(!isSelectAll)">
                            <font-awesome-icon v-if="isSelectAll" icon="check" class="check-icon"/>
                            <font-awesome-icon v-else-if="isIndeterminate" icon="minus" class="check-icon"/>
                        </span>
                    </div>
                    <div v-if="visibleListColumns.includes('preview')" class="list-col list-col-preview">{{ $t('dashboard.preview') }}</div>
                    <div class="list-col list-col-name">{{ $t('dashboard.fileName') }}</div>
                    <div v-if="visibleListColumns.includes('tags')" class="list-col list-col-tags">{{ $t('dashboard.tags') }}</div>
                    <div v-if="visibleListColumns.includes('channel')" class="list-col list-col-channel">{{ $t('dashboard.channelType') }}</div>
                    <div v-if="visibleListColumns.includes('channel-name')" class="list-col list-col-channel-name">{{ $t('dashboard.channelNameCol') }}</div>
                    <div v-if="visibleListColumns.includes('address')" class="list-col list-col-address">{{ $t('dashboard.uploadAddress') }}</div>
                    <div v-if="visibleListColumns.includes('size')" class="list-col list-col-size">{{ $t('dashboard.fileSize') }}</div>
                    <div v-if="visibleListColumns.includes('date')" class="list-col list-col-date">{{ $t('dashboard.uploadTime') }}</div>
                    <div class="list-col list-col-actions">{{ $t('dashboard.actions') }}</div>
                </div>
                <!-- 列表骨架屏 -->
                <SkeletonLoader v-if="loading" type="list" :count="15" />
                <!-- 空状态 -->
                <div v-else-if="paginatedTableData.length === 0" class="empty-state list-empty">
                    <font-awesome-icon icon="folder-open" class="empty-icon" />
                    <p class="empty-text">{{ hasSearchOrFilter ? $t('dashboard.noMatchingFiles') : $t('dashboard.currentDirEmpty') }}</p>
                    <p class="empty-hint">{{ hasSearchOrFilter ? $t('dashboard.adjustSearchHint') : $t('dashboard.uploadHint') }}</p>
                </div>
                <!-- 实际数据 -->
                <template v-else>
                    <FileListItem
                        :visibleColumns="visibleListColumns"
                        v-for="(item, index) in paginatedTableData"
                        :key="index"
                        :item="item"
                        v-model:selected="item.selected"
                        :fileLink="getFileLink(item.name)"
                        @enter="enterFolder(item.name)"
                        @detail="openDetailDialog(index, item.name)"
                        @tags="handleTagManagement(item.name)"
                        @rename="openQuickRename(item)"
                        @replace="openReplaceDialog(item)"
                        @replace-local="openLocalReplaceDialog(item)"
                        @copy="handleCopy(index, item.name)"
                        @folderCopy="handleFolderCopy(item.name)"
                        @move="handleMove(index, item.name)"
                        @delete="handleDelete(index, item.name)"
                        @download="handleDownload(item.name)"
                        @touchstart="isFolder(item) ? handleFolderTouchStart(item, index) : handleTouchStart(item, index)"
                        @touchend="handleTouchEnd"
                        @touchmove="handleTouchEnd"
                    />
                </template>
            </div>
            
            <!-- 选区矩形覆盖层 -->
            <div
              v-if="isDragging"
              class="drag-select-overlay"
              :style="{
                position: 'fixed',
                left: selectionRect.left + 'px',
                top: selectionRect.top + 'px',
                width: selectionRect.width + 'px',
                height: selectionRect.height + 'px'
              }"
            ></div>

            <div class="pagination-container">
                <div class="pagination-center">
                    <el-pagination
                        background
                        layout="prev, pager, next"
                        :total="directFolderCount + directFileCount"
                        :page-size="pageSize"
                        :current-page="currentPage"
                        :pager-count="pagerCount"
                        @current-change="handlePageChange">
                    </el-pagination>
                    <el-button :disabled="loading || currentPage >= realTotalPages" @click="handlePageChange(currentPage + 1)">{{ $t('dashboard.nextPage') }}</el-button>
                    <el-button 
                        type="primary" 
                        @click="refreshFileList" 
                        class="refresh-btn">
                        <font-awesome-icon icon="sync" :class="{ 'fa-spin': refreshLoading }"/>
                    </el-button>
                    <el-button
                        v-if="currentPage === Math.ceil(filteredTableData.length / pageSize)" 
                        type="primary" 
                        @click="loadMoreData" 
                        :loading="loading" 
                        class="load-more">
                        {{ $t('dashboard.loadMore') }}
                    </el-button>
                </div>
                <div class="pagination-right">
                    <span class="page-total">{{ $t('dashboard.totalPages', { count: realTotalPages }) }}</span>
                    <div class="page-jump">
                        <span>{{ $t('dashboard.jumpTo') }}</span>
                        <el-input 
                            v-model="jumpPage" 
                            size="small" 
                            class="jump-input"
                            @keyup.enter="handleJumpPage"
                        />
                        <el-button size="small" type="primary" @click="handleJumpPage" class="jump-btn">GO</el-button>
                    </div>
                </div>
            </div>
            </el-main>
        </el-container>
        <!-- 文件详情弹窗 -->
        <el-dialog v-model="showRenameDialog" :title="$t('dashboard.quickRename')" width="min(460px, 90vw)" :close-on-click-modal="!renaming" :close-on-press-escape="!renaming" :show-close="!renaming">
            <el-input v-model="renameValue" :aria-label="$t('dashboard.fileName')" :disabled="renaming" @keyup.enter="saveQuickRename" autofocus />
            <p>{{ $t('dashboard.quickRenameHint') }}</p>
            <template #footer>
                <el-button :disabled="renaming" @click="showRenameDialog = false">{{ $t('fileDetail.renameCancel') }}</el-button>
                <el-button type="primary" :loading="renaming" @click="saveQuickRename">{{ $t('fileDetail.renameConfirm') }}</el-button>
            </template>
        </el-dialog>
        <FileDetailDialog
            v-model="showdetailDialog"
            :file="detailFile"
            :fileLink="getFileLink(detailFile?.name)"
            :urls="allUrl"
            @download="handleDownload(detailFile?.name)"
            @tagManagement="handleTagManagement(detailFile?.name)"
            @block="handleBlock(detailFile?.name)"
            @white="handleWhite(detailFile?.name)"
            @delete="handleDetailDelete(detailFile?.name)"
            @metadataUpdated="handleMetadataUpdated"
            @fileRenamed="handleFileRenamed"
        />
        <el-dialog :title="$t('dashboard.linkFormat')" v-model="showUrlDialog" :width="dialogWidth" :show-close="false" class="settings-dialog">
            <div class="dialog-section">
                <div class="section-header">
                    <span class="section-title">{{ $t('settings.defaultCopyLink') }}</span>
                </div>
                <div class="section-content">
                    <el-radio-group v-model="defaultUrlFormat" class="radio-card-group grid-2x2">
                        <el-radio label="originUrl" class="radio-card">
                            <font-awesome-icon icon="link" class="radio-icon"/>
                            <span>{{ $t('settings.rawLink') }}</span>
                        </el-radio>
                        <el-radio label="mdUrl" class="radio-card">
                            <font-awesome-icon icon="code" class="radio-icon"/>
                            <span>Markdown</span>
                        </el-radio>
                        <el-radio label="htmlUrl" class="radio-card">
                            <font-awesome-icon icon="code-branch" class="radio-icon"/>
                            <span>HTML</span>
                        </el-radio>
                        <el-radio label="bbUrl" class="radio-card">
                            <font-awesome-icon icon="quote-right" class="radio-icon"/>
                            <span>BBCode</span>
                        </el-radio>
                        <el-radio label="tgId" class="radio-card">
                            <font-awesome-icon icon="paper-plane" class="radio-icon"/>
                            <span>TG File ID</span>
                        </el-radio>
                        <el-radio label="s3Location" class="radio-card">
                            <font-awesome-icon icon="cloud" class="radio-icon"/>
                            <span>{{ $t('settings.s3Link') }}</span>
                        </el-radio>
                    </el-radio-group>
                </div>
            </div>

            <div class="dialog-section">
                <div class="section-header">
                    <span class="section-title">{{ $t('settings.customLink') }}</span>
                    <el-tooltip :content="$t('settings.customLinkTooltip')" placement="top" raw-content>
                        <font-awesome-icon icon="question-circle" class="section-help-icon"/>
                    </el-tooltip>
                </div>
                <div class="section-content">
                    <div class="setting-item">
                        <span class="setting-label">{{ $t('settings.enableCustom') }}</span>
                        <el-switch v-model="useCustomUrl" active-value="true" inactive-value="false" />
                    </div>
                    <div class="setting-item" v-if="useCustomUrl === 'true'">
                        <span class="setting-label">{{ $t('settings.customPrefix') }}</span>
                        <el-input v-model="customUrlPrefix" :placeholder="$t('settings.customPrefixPlaceholder')" class="setting-input"/>
                    </div>
                </div>
            </div>

            <div class="dialog-action">
                <el-button type="primary" @click="showUrlDialog = false" class="confirm-btn">{{ $t('settings.confirm') }}</el-button>
            </div>
        </el-dialog>

        <BatchTelegramDialog v-model="showTelegramDialog" :files="telegramSelection" />
        <TagCatalogDialog v-model="showTagCatalog" @changed="handleCatalogChanged" />
        <!-- Tag Management Dialog -->
        <TagManagementDialog
            v-model="showTagDialog"
            :fileId="currentTagFile"
            @tagsUpdated="handleTagsUpdated"
        />

        <!-- Batch Tag Management Dialog -->
        <BatchTagDialog
            v-model="showBatchTagDialog"
            :selectedFiles="selectedFiles"
            @tagsUpdated="handleBatchTagsUpdated"
        />
        <!-- 移动端操作菜单 -->
        <MobileActionSheet
            v-model="showMobileActionModal"
            :title="mobileActionIsFolder ? getFolderName(mobileActionFile?.name || '') : (mobileActionFile?.metadata?.FileName || getFileName(mobileActionFile?.name || ''))"
            :isFolder="mobileActionIsFolder"
            @action="handleMobileAction"
        />
        <!-- 移动端目录抽屉 -->
        <MobileDirectoryDrawer
            v-model="showMobileDirectoryDrawer"
            :currentPath="currentPath"
            @navigate="navigateToFolder"
            @goBack="handleGoBack"
        />
        <UploadReplacementDialog v-model="showLocalReplaceDialog" :target="replaceTarget" @replaced="handleReplaced" />
        <ReplaceFileDialog v-model="showReplaceDialog" :source="replaceSource"
            :current-directory="currentPath" @replaced="handleReplaced" />
        <!-- 移动文件对话框 -->
        <MoveFileDialog
            v-model="showMoveDialog"
            :current-directory="currentPath"
            :is-batch-move="isBatchMove"
            :initial-path="moveTargetPath"
            @confirm="confirmMove"
        />
    </div>
</template>

<script>
import { mapGetters } from 'vuex';
import JSZip from 'jszip';
import BatchTelegramDialog from '@/components/dashboard/BatchTelegramDialog.vue';
import DashboardTabs from '@/components/DashboardTabs.vue';
import TagCatalogDialog from '@/components/dashboard/TagCatalogDialog.vue';
import TagManagementDialog from '@/components/dashboard/TagManagementDialog.vue';
import BatchTagDialog from '@/components/dashboard/BatchTagDialog.vue';
import SkeletonLoader from '@/components/dashboard/SkeletonLoader.vue';
import FileCard from '@/components/dashboard/FileCard.vue';
import FolderCard from '@/components/dashboard/FolderCard.vue';
import UploadReplacementDialog from '@/components/dashboard/UploadReplacementDialog.vue';
import ReplaceFileDialog from '@/components/dashboard/ReplaceFileDialog.vue';
import QuickUpload from '@/components/dashboard/QuickUpload.vue';
import MoveFileDialog from '@/components/dashboard/MoveFileDialog.vue';
import FileListItem from '@/components/dashboard/FileListItem.vue';
import FileDetailDialog from '@/components/dashboard/FileDetailDialog.vue';
import MobileActionSheet from '@/components/dashboard/MobileActionSheet.vue';
import MobileDirectoryDrawer from '@/components/dashboard/MobileDirectoryDrawer.vue';
import FilterDropdown from '@/components/dashboard/FilterDropdown.vue';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
import { fileManager } from '@/utils/fileManager';
import fetchWithAuth from '@/utils/fetchWithAuth';
import { validateFolderPath } from '@/utils/pathValidator';
import backgroundManager from '@/mixins/backgroundManager';
import { ref } from 'vue';
import { optionalListColumns, defaultListColumns, loadListColumns, listColumnLayout, validOverviewFileName } from '@/utils/overviewHelpers';
import { useDragSelect } from '@/utils/dashboard/useDragSelect.js';

export default {
name: 'AdminDashBoard',
mixins: [backgroundManager],
data() {
    return {
        Number: 0,
        uploadRefreshTimer: null,
        normalizationRunning: false, normalizationError: false, normalizationResult: null,
        directFileCount: 0, // 当前目录直接子文件数量
        directFolderCount: 0, // 当前目录直接子文件夹数量
        showLogoutButton: false,
        tableData: [],
        tempSearch: '',
        search: '',
        searchKeywords: '', // Keywords only (without tag filters) for backend search
        searchIncludeTags: '', // 包含的标签，逗号分隔
        searchExcludeTags: '', // 排除的标签，逗号分隔
        isSearchMode: false,
        currentPage: 1,
        pageSize: 60,
        showTagCatalog: false,
        tagOptions: [],
        selectedFiles: [],
        showTelegramDialog: false,
        telegramSelection: [],
        batchHeaderActions: [{ command: 'download', icon: 'download' }, { command: 'move', icon: 'file-export' }, { command: 'telegramSend', icon: 'paper-plane' }, { command: 'delete', icon: 'trash-alt' }],
        sortOption: 'dateDesc',
        isUploading: false,
        showdetailDialog: false,
        detailFile: null,
        activeUrlTab: 'originUrl',
        defaultUrlFormat: 'originUrl',
        showUrlDialog: false,
        useCustomUrl: 'false', // 是否启用自定义链接
        customUrlPrefix: '', // 自定义链接前缀
        loading: false, // 加载状态
        currentPath: '', // 当前文件夹路径
        refreshLoading: false,
        showTagDialog: false, // 标签管理对话框
        showBatchTagDialog: false, // 批量标签管理对话框
        currentTagFile: '', // 当前标签管理的文件
        visibleListColumns: loadListColumns(localStorage),
        listColumnOptions: optionalListColumns,
        renameTarget: null,
        renameValue: '',
        renaming: false,
        showRenameDialog: false,
        viewMode: 'card', // 视图模式：card 或 list
        showMobileActionModal: false, // 移动端操作模态框
        mobileActionFile: null, // 当前移动端操作的文件
        mobileActionIndex: -1, // 当前移动端操作的文件索引
        mobileActionIsFolder: false, // 是否为文件夹操作
        longPressTimer: null, // 长按计时器
        showMobileDirectoryDrawer: false, // 移动端目录抽屉
        jumpPage: '', // 跳转页码输入
        // 筛选相关状态（数组形式支持多选）
        filters: {
            accessStatus: [], // 访问状态: 'normal'(正常), 'blocked'(已屏蔽)
            listType: [],     // 黑白名单: 'White', 'Block', 'None'
            label: [],         // 审查结果: 'normal', 'teen', 'adult'
            tagGroup1: [], tagGroup2: [],
            fileType: [],      // 文件类型: 'image', 'video', 'audio', 'other'
            channel: [],       // 渠道类型: 'TelegramNew', 'CloudflareR2', 'S3', 'Discord', 'HuggingFace', 'WebDAV', 'External'
            channelName: []    // 渠道名称: 动态获取
        },
        channelNameOptions: [], // 动态从文件列表中提取
        // 移动文件对话框相关状态
        showReplaceDialog: false, replaceSource: null,
        showLocalReplaceDialog: false, replaceTarget: null,
        showMoveDialog: false, // 移动文件对话框
        moveTargetPath: '/', // 移动目标路径
        moveFileKey: '', // 当前移动的文件key
        moveFileIndex: -1, // 当前移动的文件索引
        isBatchMove: false // 是否为批量移动
    }
},
components: {
    UploadReplacementDialog,
    QuickUpload,
    BatchTelegramDialog,
    DashboardTabs,
    TagCatalogDialog,
    TagManagementDialog,
    BatchTagDialog,
    SkeletonLoader,
    FileCard,
    FolderCard,
    FileListItem,
    FileDetailDialog,
    MobileActionSheet,
    MobileDirectoryDrawer,
    FilterDropdown,
    MoveFileDialog,
    ReplaceFileDialog,
    LanguageSwitcher
},
setup() {
    const cardContainerRef = ref(null);
    const listContainerRef = ref(null);
    const viewModeRef = ref('card');
    const itemsRef = ref([]);

    const { isDragging, selectionRect } = useDragSelect({
        modes: {
            card: { containerRef: cardContainerRef, itemSelector: '.img-card' },
            list: { containerRef: listContainerRef, itemSelector: '.list-item' },
        },
        viewMode: viewModeRef,
        items: itemsRef,
    });

    return {
        cardContainerRef,
        listContainerRef,
        viewModeRef,
        itemsRef,
        isDragging,
        selectionRect,
    };
},
computed: {
    listLayout() { return listColumnLayout(this.visibleListColumns); },
    ...mapGetters(['adminUrlSettings', 'userConfig']),
    filteredTableData() {
        return this.tableData;
    },
    totalPages() {
        return Math.ceil(this.filteredTableData.length / this.pageSize) || 1;
    },
    // 基于当前文件夹直接子文件和子文件夹数量计算的真实总页数
    realTotalPages() {
        const total = this.directFolderCount + this.directFileCount;
        return Math.ceil(total / this.pageSize) || 1;
    },
    // 计算当前激活的筛选条件数量（数组形式）
    activeFilterCount() {
        return Object.values(this.filters).reduce((count, arr) => count + (Array.isArray(arr) ? arr.length : 0), 0);
    },
    // 判断是否处于搜索或筛选模式
    hasSearchOrFilter() {
        return this.isSearchMode || this.activeFilterCount > 0;
    },
    paginatedTableData() {
        const sortedData = this.sortData(this.filteredTableData);
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        let data = sortedData.slice(start, end);
        // 增加previewSrcList属性，用于预览图片
        const fullList = data.filter(file => this.isImage(file)).map(file => this.getFileLink(file.name));
        data.forEach(file => {
            if (this.isImage(file)) {
                // 重新排序，索引大于等于当前索引的元素在前，否则在后
                file.previewSrcList = fullList.slice(fullList.indexOf(this.getFileLink(file.name))).concat(fullList.slice(0, fullList.indexOf(this.getFileLink(file.name))));
            }
        });
        // 增加channelTag属性，用于显示渠道信息
        data.forEach(file => {
            if (file.metadata?.Channel === 'TelegramNew' || file.metadata?.Channel === 'Telegram') {
                file.channelTag = 'TG';
            } else if (file.metadata?.Channel === 'CloudflareR2') {
                file.channelTag = 'R2';
            } else if (file.metadata?.Channel === 'S3') {
                file.channelTag = 'S3';
            } else if (file.metadata?.Channel === 'Discord') {
                file.channelTag = 'DC';
            } else if (file.metadata?.Channel === 'HuggingFace') {
                file.channelTag = 'HF';
            } else if (file.metadata?.Channel === 'WebDAV') {
                file.channelTag = 'WD';
            } else if (file.metadata?.Channel === 'External') {
                file.channelTag = this.$t('dashboard.externalTag');
            } else {
                file.channelTag = this.$t('dashboard.unknownTag');
            }
        });
        return data;
    },
    sortIcon() {
        return this.sortOption === 'dateDesc' ? 'sort-amount-down' : 'sort-alpha-up';
    },
    dialogWidth() {
        return window.innerWidth > 768 ? '50%' : '90%';
    },
    detailDialogWidth() {
        return window.innerWidth > 768 ? '70%' : '90%';
    },
    accessType() {
        if (this.detailFile?.metadata?.ListType === 'White') {
            return this.$t('filter.normal');
        } else if (this.detailFile?.metadata?.ListType === 'Block' || this.detailFile?.metadata?.Label === 'adult') {
            return this.$t('filter.blocked');
        } else {
            return this.$t('filter.normal');
        }
    },
    allUrl() {
        // 外链图片均采用外链
        if (this.detailFile?.metadata?.Channel === 'External') {
            return {
                'originUrl': `${this.detailFile?.metadata?.ExternalLink}`,
                'mdUrl': `![${this.detailFile?.metadata?.FileName || this.detailFile?.name}](${this.detailFile?.metadata?.ExternalLink})`,
                'htmlUrl': `<img src="${this.detailFile?.metadata?.ExternalLink}" alt="${this.detailFile?.metadata?.FileName || this.detailFile?.name}" width=100%>`,
                'bbUrl': `[img]${this.detailFile?.metadata?.ExternalLink}[/img]`,
                'tgId': this.detailFile?.metadata?.TgFileId || this.$t('fileDetail.unknown'),
                'S3Location': this.detailFile?.metadata?.S3Location || this.$t('fileDetail.unknown'),
                'S3CdnFileUrl': this.detailFile?.metadata?.S3CdnFileUrl || this.$t('fileDetail.unknown')
            }
        } else {
            return {
                'originUrl': `${this.rootUrl}${this.detailFile?.metadata?.FixedId || this.detailFile?.name}`,
                'mdUrl': `![${this.detailFile?.metadata?.FileName || this.detailFile?.name}](${this.rootUrl}${this.detailFile?.metadata?.FixedId || this.detailFile?.name})`,
                'htmlUrl': `<img src="${this.rootUrl}${this.detailFile?.metadata?.FixedId || this.detailFile?.name}" alt="${this.detailFile?.metadata?.FileName || this.detailFile?.name}" width=100%>`,
                'bbUrl': `[img]${this.rootUrl}${this.detailFile?.metadata?.FixedId || this.detailFile?.name}[/img]`,
                'tgId': this.detailFile?.metadata?.TgFileId || this.$t('fileDetail.unknown'),
                'S3Location': this.detailFile?.metadata?.S3Location || this.$t('fileDetail.unknown'),
                'S3CdnFileUrl': this.detailFile?.metadata?.S3CdnFileUrl || this.$t('fileDetail.unknown')
            }
        }
    },
    tableColumnNum() {
        return window.innerWidth > 768 ? 3 : 1;
    },
    tablePreviewSpan() {
        return window.innerWidth > 768 ? 2 : 1;
    },
    disableTooltip() {
        return window.innerWidth < 768;
    },
    selectPage() {
        // 如果当前页所有文件都被选中，则返回 true，否则返回 false
        return this.paginatedTableData.every(file => file.selected);
    },
    selectedPageFiles() {
        // 如果当前页有文件被选中，则返回 true，否则返回 false
        return this.paginatedTableData.some(file => file.selected);
    },
    selectPageIcon() {
        // 全选为 true 时，返回 check-square；部分选中为 minus-square；全不选为 square
        return this.selectPage ? 'check-square' : this.selectedPageFiles ? 'minus-square' : 'square';
    },
    rootUrl() {
        // 链接前缀，优先级：用户自定义 > urlPrefix > 默认
        return this.useCustomUrl === 'true' ? this.customUrlPrefix : this.userConfig?.urlPrefix || `${document.location.origin}/file/`
    },
    isSelectAll: {
        get() {
            return this.paginatedTableData.length > 0 && this.paginatedTableData.every(file => file.selected);
        },
        set(val) {
            this.paginatedTableData.forEach(file => file.selected = val);
        }
    },
    isIndeterminate() {
        const selectedCount = this.paginatedTableData.filter(file => file.selected).length;
        return selectedCount > 0 && selectedCount < this.paginatedTableData.length;
    },
    pagerCount() {
        return window.innerWidth < 768 ? 5 : 7;
    }
},
watch: {
    visibleListColumns: { deep: true, handler(value) {
        try { localStorage.setItem('dashboardListColumns', JSON.stringify(value)); } catch { /* Storage may be unavailable. */ }
    } },
    // Sync viewMode data property to the ref used by useDragSelect
    viewMode: {
        handler(newVal) {
            this.viewModeRef = newVal;
        },
        immediate: true
    },
    // Sync paginatedTableData computed property to the ref used by useDragSelect
    paginatedTableData: {
        handler(newVal) {
            this.itemsRef = newVal;
        },
        immediate: true
    },
    tableData: {
        handler(newData) {
            // selectedFiles 增加 newData中新选中，不包含在 selectedFiles 中的文件
            this.selectedFiles = this.selectedFiles.concat(newData.filter(file => file.selected && !this.selectedFiles.includes(file)));
            // selectedFiles 删掉 newData 中已取消选中的文件
            this.selectedFiles = this.selectedFiles.filter(file => file.selected);
            // selectedFiles 删掉 tableData 中已删除的文件
            this.selectedFiles = this.selectedFiles.filter(file => newData.includes(file));
        },
        deep: true
    },
    sortOption(newOption) {
        localStorage.setItem('sortOption', newOption);
    },
    defaultUrlFormat(newFormat) {
        localStorage.setItem('defaultUrlFormat', newFormat);
    },
    showdetailDialog(newVal) {
        if (newVal) {
            this.activeUrlTab = this.defaultUrlFormat || 'originUrl';
        }
    },
    customUrlPrefix(val) {
        this.$store.commit('setAdminUrlSettings', { key: 'customUrlPrefix', value: val })
    },
    useCustomUrl(val) {
        this.$store.commit('setAdminUrlSettings', { key: 'useCustomUrl', value: val })
    },
    currentPath(val) {
        // 页面切换时，取消选择的内容
        this.tableData.forEach(file => file.selected = false);
    }
},
methods: {
    scheduleUploadRefresh() {
        clearTimeout(this.uploadRefreshTimer);
        this.uploadRefreshTimer = setTimeout(() => this.refreshFileList(), 700);
    },
    async normalizeExistingNames(restart = false) {
        if (this.normalizationRunning) return;
        this.normalizationRunning = true;
        this.normalizationError = false;
        try {
            let first = true;
            do {
                const response = await fetchWithAuth('/api/manage/normalizeNames', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restart: first && restart }) });
                if (!response.ok) throw new Error('Normalization failed');
                this.normalizationResult = await response.json();
                first = false;
            } while (!this.normalizationResult.done);
        } catch { this.normalizationError = true; }
        finally { this.normalizationRunning = false; }
    },
    async retryNameNormalization() {
        await this.normalizeExistingNames(true);
        await this.refreshFileList();
    },
    // 切换视图模式
    toggleViewMode() {
        this.viewMode = this.viewMode === 'card' ? 'list' : 'card';
        localStorage.setItem('viewMode', this.viewMode);
    },
    // 列表视图全选当前页
    handleSelectAllPage(val) {
        this.paginatedTableData.forEach(file => file.selected = val);
    },
    // 移动端长按开始
    handleTouchStart(item, index) {
        this.longPressTimer = setTimeout(() => {
            this.mobileActionFile = item;
            this.mobileActionIndex = index;
            this.mobileActionIsFolder = false;
            this.showMobileActionModal = true;
        }, 500); // 500ms 长按触发
    },
    // 移动端长按结束/取消
    handleTouchEnd() {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    },
    // 文件夹长按开始
    handleFolderTouchStart(item, index) {
        this.longPressTimer = setTimeout(() => {
            this.mobileActionFile = item;
            this.mobileActionIndex = index;
            this.mobileActionIsFolder = true;
            this.showMobileActionModal = true;
        }, 500);
    },
    // 处理移动端操作
    handleMobileAction(action) {
        const file = this.mobileActionFile;
        const index = this.mobileActionIndex;
        this.showMobileActionModal = false;
        
        if (!file) return;
        
        switch (action) {
            case 'detail':
                this.openDetailDialog(index, file.name);
                break;
            case 'copy':
                this.handleCopy(index, file.name);
                break;
            case 'folderCopy':
                this.handleFolderCopy(file.name);
                break;
            case 'download':
                this.handleDownload(file.name);
                break;
            case 'move':
                this.handleMove(index, file.name);
                break;
            case 'replaceLocal':
                this.openLocalReplaceDialog(file);
                break;
            case 'replace':
                this.openReplaceDialog(file);
                break;
            case 'delete':
                this.handleDelete(index, file.name);
                break;
            case 'tag':
                this.handleTagManagement(file.name);
                break;
        }
    },
    // 返回上一级目录
    handleGoBack() {
        const pathParts = this.currentPath.split('/').filter(Boolean);
        if (pathParts.length > 0) {
            pathParts.pop();
            const parentPath = pathParts.join('/');
            this.navigateToFolder(parentPath);
        }
        this.showMobileDirectoryDrawer = false;
    },
    // 获取标签颜色
    getTagColor(index) {
        const colors = [
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
        ];
        return colors[index % colors.length];
    },
    // 视频hover播放控制
    handleVideoHover(event, isEnter) {
        const video = event.target;
        if (isEnter) {
            video.play().catch(() => {});
        } else {
            video.pause();
            video.currentTime = 0;
        }
    },
    // 格式化文件大小
    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '-';
        bytes = Number(bytes);
        if (isNaN(bytes)) return '-';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let i = 0;
        while (bytes >= 1024 && i < units.length - 1) {
            bytes /= 1024;
            i++;
        }
        return bytes.toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
    },
    handleSearch() {
        this.search = this.tempSearch;
        this.isSearchMode = this.search.trim() !== '';
        this.currentPage = 1; // 重置到第一页

        // 解析搜索字符串，提取标签和关键字
        // 支持 #tag 表示包含标签，-#tag 表示排除标签
        if (this.search && this.search.trim()) {
            const includeTags = [];
            const excludeTags = [];
            
            // 匹配 -#tag 和 #tag
            let searchText = this.search;
            
            // 先匹配排除标签 -#tag
            const excludeTagRegex = /-#([\w\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\.\+\-]+)/g;
            searchText = searchText.replace(excludeTagRegex, (match, tag) => {
                excludeTags.push(tag.toLowerCase());
                return ' ';
            });
            
            // 再匹配包含标签 #tag
            const includeTagRegex = /#([\w\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\.\+\-]+)/g;
            searchText = searchText.replace(includeTagRegex, (match, tag) => {
                includeTags.push(tag.toLowerCase());
                return ' ';
            });
            
            // 清理剩余的关键字（去除多余空格）
            this.searchKeywords = searchText.replace(/\s+/g, ' ').trim();
            
            // 构建标签查询字符串
            this.searchIncludeTags = includeTags.join(',');
            this.searchExcludeTags = excludeTags.join(',');
            
            console.log('Search keywords:', this.searchKeywords);
            console.log('Include tags:', this.searchIncludeTags);
            console.log('Exclude tags:', this.searchExcludeTags);
        } else {
            this.searchKeywords = '';
            this.searchIncludeTags = '';
            this.searchExcludeTags = '';
        }

        this.refreshFileList();
    },
    // 处理筛选变化（来自 FilterDropdown 组件）
    handleFilterChange({ type, filters }) {
        this.filters = filters;
        this.currentPage = 1; // 重置到第一页
        this.refreshFileList();
    },
    // 清除所有筛选条件
    clearFilters() {
        this.filters = {
            listType: [],
            label: [],
            tagGroup1: [], tagGroup2: [],
            fileType: [],
            channel: [],
            channelName: []
        };
        this.currentPage = 1;
        this.refreshFileList();
    },
    // 从 API 获取所有渠道名称
    async extractChannelNames() {
        try {
            const response = await fetchWithAuth('/api/channels?includeDisabled=true', {
                method: 'GET'
            });

            if (response.ok) {
                const channels = await response.json();
                const channelOptions = [];

                // 类型映射（显示名称）
                const typeLabels = {
                    telegram: 'Telegram',
                    cfr2: 'Cloudflare R2',
                    s3: 'S3',
                    discord: 'Discord',
                    huggingface: 'HuggingFace',
                    webdav: 'WebDAV'
                };

                // 按类型提取渠道名称，channel.type是类型内部存储名称（可能根据版本有变化），type是类型对外名称
                Object.entries(channels).forEach(([type, channelList]) => {
                    if (Array.isArray(channelList) && channelList.length > 0) {
                        channelList.forEach(channel => {
                            if (channel.name) {
                                channelOptions.push({
                                    name: channel.name,
                                    type: channel.type,
                                    typeLabel: typeLabels[type] || type,
                                    // 使用 channel.type:channel.name 作为唯一标识
                                    value: `${channel.type}:${channel.name}`,
                                });
                            }
                        });
                    }
                });

                // 按类型和名称排序
                channelOptions.sort((a, b) => {
                    if (a.type !== b.type) {
                        return a.type.localeCompare(b.type);
                    }
                    return a.name.localeCompare(b.name);
                });

                this.channelNameOptions = channelOptions;
            }
        } catch (error) {
            console.error('Failed to fetch channel names:', error);
        }
    },
    handleDownload(key) {
        const link = document.createElement('a');
        link.href = this.getFileLink(key);
        link.download = key;
        link.click();
    },
    openDetailDialog(index, key) {
        this.detailFile = this.paginatedTableData[index];
        this.showdetailDialog = true;
    },
    handleTabClick(tab) {
        this.activeUrlTab = tab.props.name;
    },
    handleUrlClick(event) {
        // 复制到剪贴板
        navigator.clipboard.writeText(event.target.value)
            .then(() => {
                this.$message({
                    type: 'success',
                    message: this.$t('dashboard.copySuccess')
                });
            })
            .catch(() => {
                this.$message({
                    type: 'error',
                    message: this.$t('dashboard.copyFailed')
                });
            });
    },
    handleDetailDelete(key) {
        this.$confirm(this.$t('dashboard.deleteConfirm'), this.$t('dashboard.deleteConfirmTitle'), {
        confirmButtonText: this.$t('dashboard.deleteConfirmOk'),
        cancelButtonText: this.$t('dashboard.deleteConfirmCancel'),
        type: 'warning'
        }).then(() => {
        fetchWithAuth(`/api/manage/delete/${key}`, { method: 'GET' })
            .then(response => {
            if (response.ok) {
                const fileIndex = this.tableData.findIndex(file => file.name === key);
                if (fileIndex !== -1) {
                this.tableData.splice(fileIndex, 1);
                }
            } else {
                return Promise.reject('Request failed');
            }
            })
            .then(() => {
            this.updateStats(-1, false);
            this.$message.success(this.$t('dashboard.deleteSuccess'));
            this.showdetailDialog = false;
            })
            .catch(() => this.$message.error(this.$t('dashboard.deleteFailed')));
        }).catch(() => console.log('Delete cancelled'));
    },
    handleBlock(key) {
        this.$confirm(this.$t('dashboard.blockConfirm'), this.$t('dashboard.deleteConfirmTitle'), {
            confirmButtonText: this.$t('dashboard.deleteConfirmOk'),
            cancelButtonText: this.$t('dashboard.deleteConfirmCancel'),
            type: 'warning'
        }).then(() => {
        fetchWithAuth(`/api/manage/block/${key}`, { method: 'GET' })
            .then(response => {
                if (response.ok) {
                    const fileIndex = this.tableData.findIndex(file => file.name === key);
                    if (fileIndex !== -1) {
                        this.tableData[fileIndex].metadata.ListType = 'Block';
                    }
                } else {
                    return Promise.reject('Request failed');
                }
            })
            .then(() => {
                this.$message.success(this.$t('dashboard.blockSuccess'));
            })
            .catch(() => this.$message.error(this.$t('dashboard.blockFailed')));
        }).catch(
            () => console.log('Block cancelled')
        );
    },
    handleWhite(key) {
        this.$confirm(this.$t('dashboard.whiteConfirm'), this.$t('dashboard.deleteConfirmTitle'), {
            confirmButtonText: this.$t('dashboard.deleteConfirmOk'),
            cancelButtonText: this.$t('dashboard.deleteConfirmCancel'),
            type: 'warning'
        }).then(() => {
        fetchWithAuth(`/api/manage/white/${key}`, { method: 'GET' })
            .then(response => {
                if (response.ok) {
                    const fileIndex = this.tableData.findIndex(file => file.name === key);
                    if (fileIndex !== -1) {
                        this.tableData[fileIndex].metadata.ListType = 'White';
                    }
                } else {
                    return Promise.reject('Request failed');
                }
            })
            .then(() => {
                this.$message.success(this.$t('dashboard.whiteSuccess'));
            })
            .catch(() => this.$message.error(this.$t('dashboard.whiteFailed')));
        }).catch(
            () => console.log('White cancelled')
        );
    },
    handleDelete(index, key) {
        // 判断是否为文件夹
        const isFolder = this.tableData.find(file => file.name === key).isFolder;

        this.$confirm(isFolder ? this.$t('dashboard.deleteFolderConfirm') : this.$t('dashboard.deleteFileConfirm'), this.$t('dashboard.deleteConfirmTitle'), {
        confirmButtonText: this.$t('dashboard.deleteConfirmOk'),
        cancelButtonText: this.$t('dashboard.deleteConfirmCancel'),
        type: 'warning'
        }).then(() => {
        fetchWithAuth(`/api/manage/delete/${key}?folder=${isFolder}`, { method: 'GET' })
            .then(response => {
                if (response.ok) {
                    const fileIndex = this.tableData.findIndex(file => file.name === key);
                    if (fileIndex !== -1) {
                        this.tableData.splice(fileIndex, 1);
                    }
                } else {
                    return Promise.reject('Request failed');
                }
            })
            .then(() => {
                this.updateStats(-1, false);
                fileManager.removeFile(key);
                this.$message.success(this.$t('dashboard.deleteSuccess'));
            })
            .catch(() => this.$message.error(this.$t('dashboard.deleteFailed')));
        }).catch(() => console.log('Delete cancelled'));
    },
    handleBatchDelete() {
        this.$confirm(this.$t('dashboard.batchDeleteConfirm'), this.$t('dashboard.deleteConfirmTitle'), {
        confirmButtonText: this.$t('dashboard.deleteConfirmOk'),
        cancelButtonText: this.$t('dashboard.deleteConfirmCancel'),
        type: 'warning'
        }).then(() => {
        const promises = this.selectedFiles.map(file => {
            const isFolder = file.isFolder;
            return fetchWithAuth(`/api/manage/delete/${file.name}?folder=${isFolder}`, { method: 'GET' });
        });

        Promise.all(promises)
            .then(results => {
                let successNum = 0;
                results.forEach((response, index) => {
                    if (response.ok) {
                        successNum++;
                        const fileIndex = this.tableData.findIndex(file => file.name === this.selectedFiles[index].name);
                        if (fileIndex !== -1) {
                            this.tableData.splice(fileIndex, 1);
                        }
                        fileManager.removeFile(this.selectedFiles[index].name);
                    }
                });
                this.selectedFiles = [];
                this.updateStats(-successNum, false);
                this.$message.success(this.$t('dashboard.batchDeleteSuccess'));
            })
            .catch(() => this.$message.error(this.$t('dashboard.batchDeleteFailed')));
        }).catch(() => console.log('Batch delete cancelled'));
    },
    async handleBatchCopy() {
        // 分离文件和文件夹
        const files = this.selectedFiles.filter(item => !item.isFolder);
        const folders = this.selectedFiles.filter(item => item.isFolder);
        
        // 如果有文件夹，显示加载状态
        let loading = null;
        if (folders.length > 0) {
            loading = this.$loading({
                lock: true,
                text: this.$t('dashboard.fetchingFileList')
            });
        }
        
        try {
            // 收集所有文件（包括文件夹内的文件）
            let allFiles = [...files];
            
            // 递归获取所有文件夹内的文件
            for (const folder of folders) {
                try {
                    const response = await fetchWithAuth(
                        `/api/manage/list?dir=${encodeURIComponent(folder.name)}&recursive=true&count=-1`,
                        { method: 'GET' }
                    );
                    const data = await response.json();
                    if (data.files && data.files.length > 0) {
                        allFiles = allFiles.concat(data.files);
                    }
                } catch (error) {
                    console.error(`获取文件夹 ${folder.name} 内容失败:`, error);
                }
            }
            
            if (loading) loading.close();
            
            if (allFiles.length === 0) {
                this.$message.warning(this.$t('dashboard.noLinksAvailable'));
                return;
            }
            
            // 生成所有链接
            const links = allFiles.map(file => {
                return this.generateFileLink(file.name, file.metadata);
            }).filter(link => link);
            
            if (links.length === 0) {
                this.$message.warning(this.$t('dashboard.noLinksAvailable'));
                return;
            }
            
            // 复制到剪贴板
            const text = links.join('\n');
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(text);
                this.$message.success(this.$t('dashboard.batchCopySuccess', { count: links.length }));
            } else {
                this.copyToClipboardFallback(text);
            }
        } catch (error) {
            if (loading) loading.close();
            console.error('Batch copy failed:', error);
            this.$message.error(this.$t('dashboard.batchCopyFailed'));
        }
    },
    copyToClipboardFallback(text) {
        const textarea = document.createElement('textarea');
        document.body.appendChild(textarea);
        textarea.style.position = 'fixed';
        textarea.style.clip = 'rect(0 0 0 0)';
        textarea.style.top = '10px';
        textarea.value = text;
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        this.$message.success(this.$t('dashboard.batchCopyLinksSuccess'));
    },
    handleCopy(index, key) {
        key = this.paginatedTableData[index].metadata?.FixedId || key;
        let text = '';
        if (this.paginatedTableData[index].metadata?.Channel === 'External') {
            switch (this.defaultUrlFormat) {
                case 'originUrl':
                    text = this.paginatedTableData[index].metadata?.ExternalLink;
                    break;
                case 'mdUrl':
                    text = `![${this.paginatedTableData[index].metadata?.FileName || key}](${this.paginatedTableData[index].metadata?.ExternalLink})`;
                    break;
                case 'htmlUrl':
                    text = `<img src="${this.paginatedTableData[index].metadata?.ExternalLink}" alt="${this.paginatedTableData[index].metadata?.FileName || key}" width=100%>`;
                    break;
                case 'bbUrl':
                    text = `[img]${this.paginatedTableData[index].metadata?.ExternalLink}[/img]`;
                    break;
                case 'tgId':
                    text = this.paginatedTableData[index].metadata?.TgFileId || 'none';
                    break;
                case 's3Location':
                    text = this.paginatedTableData[index].metadata?.S3Location || 'none';
                    break;
            }
        } else {
            switch (this.defaultUrlFormat) {
                case 'originUrl':
                    text = `${this.rootUrl}${key}`;
                    break;
                case 'mdUrl':
                    text = `![${this.paginatedTableData[index].metadata?.FileName || key}](${this.rootUrl}${key})`;
                    break;
                case 'htmlUrl':
                    text = `<img src="${this.rootUrl}${key}" alt="${this.paginatedTableData[index].metadata?.FileName || key}" width=100%>`;
                    break;
                case 'bbUrl':
                    text = `[img]${this.rootUrl}${key}[/img]`;
                    break;
                case 'tgId':
                    text = this.paginatedTableData[index].metadata?.TgFileId || 'none';
                    break;
                case 's3Location':
                    text = this.paginatedTableData[index].metadata?.S3Location || 'none';
                    break;
            }
        }
        navigator.clipboard ? navigator.clipboard.writeText(text).then(() => this.$message.success(this.$t('dashboard.copyFileLinkSuccess'))) :
        this.copyToClipboardFallback(text);
    },
    async loadMoreData() {
        this.loading = true;

        try {
            // 传递标签参数和筛选参数到后端
            await fileManager.loadMoreFiles(
                this.currentPath, 
                this.searchKeywords,
                this.searchIncludeTags,
                this.searchExcludeTags,
                60,
                this.filters
            );
            // 获取新的文件列表后
            await this.fetchFileList();
        } catch (error) {
            this.$message.error(this.$t('dashboard.loadMoreFailed'));
        } finally {
            this.loading = false;
        }
    },
    updateStats(num, init = false) {
        if (init) {
            this.Number = num;
        } else {
            this.Number += num;
        }
    },
    sort(command) {
        this.sortOption = command;
    },
    sortData(data) {
        // 文件夹始终在前
        const folders = data.filter(file => file.isFolder);
        const files = data.filter(file => !file.isFolder);

        if (this.sortOption === 'dateDesc') {
            // 按时间降序
            folders.sort((a, b) => new Date(b.metadata?.TimeStamp) - new Date(a.metadata?.TimeStamp));
            files.sort((a, b) => new Date(b.metadata?.TimeStamp) - new Date(a.metadata?.TimeStamp));
        } else {
            // 按文件名升序
            folders.sort((a, b) => a.name.localeCompare(b.name));
            files.sort((a, b) => a.name.localeCompare(b.name));
        }

        return folders.concat(files);
    },
    handleVideoClick(event) {
        const videoElement = event.target;
        if (videoElement.requestFullscreen) {
            videoElement.requestFullscreen();
        } else if (videoElement.webkitRequestFullscreen) {
            // Safari/Old Chrome
            videoElement.webkitRequestFullscreen();
        } else if (videoElement.mozRequestFullScreen) {
            // Firefox
            videoElement.mozRequestFullScreen();
        } else if (videoElement.msRequestFullscreen) {
            // IE/Edge
            videoElement.msRequestFullscreen();
        }
    },
    handleLogout() {
        const url = process.env.NODE_ENV === 'production' ? '/api/auth/logout' : '/api/api/auth/logout';
        fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ authType: 'admin' })
        }).finally(() => {
            this.$store.commit('setAdminLoggedIn', false);
            this.$router.push('/adminLogin');
        });
    },
    handleSelectPage() {
        if (this.selectPage) {
            this.paginatedTableData.forEach(file => file.selected = false);
        } else {
            this.paginatedTableData.forEach(file => file.selected = true);
        }
    },
    handleBatchAction(command) {
        if (!this.selectedFiles.length || this.loading) return;
        if (command === 'telegramSend') {
            this.telegramSelection = this.selectedFiles.map(file => ({ ...file, metadata: { ...file.metadata } }));
            this.showTelegramDialog = true;
        } else if (command === 'copy') {
            this.handleBatchCopy();
        } else if (command === 'delete') {
            this.handleBatchDelete();
        } else if (command === 'download') {
            this.handleBatchDownload();
        } else if (command === 'move') {
            this.handleBatchMove();
        } else if (command === 'tagManagement') {
            this.handleBatchTagManagement();
        } else if (command === 'ban') {
            this.handleBatchBlock();
        } else if (command === 'white') {
            this.handleBatchWhite();
        }
    },
    openLocalReplaceDialog(file) {
        if (!file || this.isFolder(file)) return;
        this.replaceTarget = { ...file, metadata: { ...file.metadata } };
        this.showLocalReplaceDialog = true;
    },
    openReplaceDialog(file) {
        if (!file || this.isFolder(file)) return;
        this.replaceSource = file;
        this.showReplaceDialog = true;
    },
    async handleReplaced(result) {
        if (result.sourceDeleted) fileManager.removeFile(this.replaceSource.name);
        this.selectedFiles = [];
        if (result.warnings?.length) this.$message.warning(result.warnings.join('；'));
        else this.$message.success(this.$t('replaceFile.success'));
        await this.refreshFileList();
    },
    handleMove(index, key) {
        // 打开自定义移动对话框
        this.moveFileKey = key;
        this.moveFileIndex = index;
        this.isBatchMove = false;
        this.moveTargetPath = '/';
        this.showMoveDialog = true;
    },
    handleBatchMove() {
        // 打开自定义移动对话框（批量模式）
        this.isBatchMove = true;
        this.moveTargetPath = '/';
        this.showMoveDialog = true;
    },
    // 确认移动操作
    confirmMove(targetPath) {
        const value = targetPath;
        // 使用共享验证器验证路径
        const validation = validateFolderPath(value);
        if (!validation.valid) {
            this.$message.error(validation.error);
            return;
        }
        // 去掉开头的 /，结尾若没有 /，则加上
        const newPath = value.replace(/^\/+/, '') + (value.endsWith('/') ? '' : value === '' ? '' : '/');
        // 判断目标文件夹是否是当前文件夹
        if (newPath === this.currentPath) {
            this.$message.warning(this.$t('dashboard.moveTargetSameAsCurrent'));
            return;
        }
        
        // 关闭对话框
        this.showMoveDialog = false;
        
        if (this.isBatchMove) {
            // 批量移动
            this.executeBatchMove(newPath);
        } else {
            // 单个文件移动
            this.executeSingleMove(newPath);
        }
    },
    // 执行单个文件移动
    executeSingleMove(newPath) {
        const key = this.moveFileKey;
        const isFolder = this.tableData.find(file => file.name === key)?.isFolder;
        
        fetchWithAuth(`/api/manage/move/${key}?folder=${isFolder}&dist=${encodeURIComponent(newPath)}`, { method: 'GET' })
            .then(response => {
                if (response.ok) {
                    const fileIndex = this.tableData.findIndex(file => file.name === key);
                    if (fileIndex !== -1) {
                        // 更新本地文件管理器
                        const newKey = newPath + key.split('/').pop();
                        fileManager.moveFile(key, newKey, isFolder, this.currentPath);
                        // 移除文件
                        this.tableData.splice(fileIndex, 1);
                        // 强制重新渲染内容
                        this.$nextTick(() => {
                            const tempData = [...this.tableData];
                            this.tableData = [];
                            this.$nextTick(() => {
                                this.tableData = tempData;
                            });
                        });
                    }
                    this.updateStats(-1, false);
                    this.$message.success(this.$t('dashboard.moveSuccess'));
                } else {
                    return Promise.reject('Request failed');
                }
            })
            .then(() => {
                this.refreshLocalFileList();
            })
            .catch(() => this.$message.error(this.$t('dashboard.moveFailed')));
    },
    // 执行批量移动
    executeBatchMove(newPath) {
        const promises = this.selectedFiles.map(file => {
            const isFolder = file.isFolder;
            return fetchWithAuth(`/api/manage/move/${file.name}?folder=${isFolder}&dist=${encodeURIComponent(newPath)}`, { method: 'GET' });
        });

        Promise.all(promises)
            .then(results => {
                let successNum = 0;
                results.forEach((response, index) => {
                    if (response.ok) {
                        successNum++;
                        const file = this.selectedFiles[index];
                        file.selected = false;
                        const fileIndex = this.tableData.findIndex(f => f.name === file.name);
                        if (fileIndex !== -1) {
                            // 更新本地文件管理器
                            const newKey = newPath + file.name.split('/').pop();
                            fileManager.moveFile(file.name, newKey, file.isFolder, this.currentPath);
                            // 移除文件
                            this.tableData.splice(fileIndex, 1);
                        }
                    }
                });
                // 强制重新渲染内容
                this.$nextTick(() => {
                    const tempData = [...this.tableData];
                    this.tableData = [];
                    this.$nextTick(() => {
                        this.tableData = tempData;
                    });
                });
                this.updateStats(-successNum, false);
                this.$message.success(this.$t('dashboard.moveSuccess'));
            })
            .then(() => {
                this.refreshLocalFileList();
            })
            .catch(() => this.$message.error(this.$t('dashboard.moveFailed')));
    },
    handleBatchBlock(){
        this.$confirm(this.$t('dashboard.batchBlockConfirm'), this.$t('dashboard.deleteConfirmTitle'), {
            confirmButtonText: this.$t('dashboard.deleteConfirmOk'),
            cancelButtonText: this.$t('dashboard.deleteConfirmCancel'),
            type: 'warning'
        }).then(() => {
            // 跳过文件夹
            const promises = this.selectedFiles.map(file => {
                if (file.isFolder) {
                    return Promise.resolve({ ok: false });
                }
                return fetchWithAuth(`/api/manage/block/${file.name}`, { method: 'GET' });
            });

            Promise.all(promises)
                .then(results => {
                    results.forEach((response, index) => {
                        if (response.ok) {
                            const fileIndex = this.tableData.findIndex(file => file.name === this.selectedFiles[index].name);
                            if (fileIndex !== -1) {
                                this.tableData[fileIndex].metadata.ListType = 'Block';
                            }
                        }
                    });
                    this.$message.success(this.$t('dashboard.batchBlockSuccess'));
                })
                .catch(() => this.$message.error(this.$t('dashboard.batchBlockFailed')));
        }).catch(() => console.log('Batch block cancelled'));
    },
    handleBatchWhite(){
        this.$confirm(this.$t('dashboard.batchWhiteConfirm'), this.$t('dashboard.deleteConfirmTitle'), {
            confirmButtonText: this.$t('dashboard.deleteConfirmOk'),
            cancelButtonText: this.$t('dashboard.deleteConfirmCancel'),
            type: 'warning'
        }).then(() => {
            // 跳过文件夹
            const promises = this.selectedFiles.map(file => {
                if (file.isFolder) {
                    return Promise.resolve({ ok: false });
                }
                return fetchWithAuth(`/api/manage/white/${file.name}`, { method: 'GET' });
            });

            Promise.all(promises)
                .then(results => {
                    results.forEach((response, index) => {
                        if (response.ok) {
                            const fileIndex = this.tableData.findIndex(file => file.name === this.selectedFiles[index].name);
                            if (fileIndex !== -1) {
                                this.tableData[fileIndex].metadata.ListType = 'White';
                            }
                        }
                    });
                    this.$message.success(this.$t('dashboard.batchWhiteSuccess'));
                })
                .catch(() => this.$message.error(this.$t('dashboard.batchWhiteFailed')));
        }).catch(() => console.log('Batch white cancelled'));
    },
    handleBatchDownload() {
        // 将选中文件打包成 zip 文件下载
        const zip = new JSZip();
        const folder = zip.folder('files');
        // 构造Promise数组，等待所有文件下载完成后再打包
        const fileNameCount = {}; // 用于跟踪文件名出现的次数

        const downloadPromises = this.selectedFiles.map(async file => {
            // 跳过文件夹
            if (file.isFolder) {
                return;
            }
            const response = await fetch(this.getFileLink(file.name));
            const blob = await response.blob();
            // 检查文件名是否已经存在
            let fileName = file.metadata?.FileName || file.name;
            if (fileNameCount[fileName]) {
                // 如果已经存在，则在文件名后加上编号
                const extension = fileName.substring(fileName.lastIndexOf('.'));
                const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
                fileName = `${baseName}(${fileNameCount[fileName]})${extension}`;
                fileNameCount[file.name]++;
            } else {
                // 如果不存在，则初始化为1
                fileNameCount[fileName] = 1;
            }
            // 将文件添加到 zip 文件夹中
            folder.file(fileName, blob);
        });

        Promise.all(downloadPromises)
            .then(() => zip.generateAsync({ type: 'blob' }))
            .then(blob => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'files.zip';
                link.click();
            });
    },
    isVideo(file) {
        // 排除音频文件
        if (this.isAudio(file)) return false;
        let flag = file.metadata?.FileType?.includes('video');
        // 用文件名后缀判断是否为视频文件
        if (!flag) {
            const videoExtensions = ['mp4', 'webm', 'ogg', 'avi', 'mov', 'flv', 'wmv', 'mkv', 'rmvb', '3gp', 'mpg', 'mpeg', 'm4v', 'f4v', 'rm', 'asf', 'dat', 'ts', 'vob', 'swf', 'divx', 'xvid', 'm2ts', 'mts', 'm2v', '3g2', '3gp2', '3gpp', '3gpp2', 'mpe', 'm1v', 'mpv', 'mpv2', 'mp2v', 'm2t', 'm2ts', 'm2v', 'm4v'];
            const extension = file.name.substring(file.name.lastIndexOf('.') + 1).toLowerCase();
            flag = videoExtensions.includes(extension);
        }
        return flag;
    },
    isAudio(file) {
        let flag = file.metadata?.FileType?.includes('audio');
        // 用文件名后缀判断是否为音频文件
        if (!flag) {
            const audioExtensions = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'ape', 'aiff', 'alac', 'opus', 'mid', 'midi', 'm4b', 'm4p', 'm4r', 'amr', 'au', 'ra', 'ram'];
            const extension = file.name.substring(file.name.lastIndexOf('.') + 1).toLowerCase();
            flag = audioExtensions.includes(extension);
        }
        return flag;
    },
    isImage(file) {
        let flag = file.metadata?.FileType?.includes('image');
        // 用文件名后缀判断是否为图片文件
        if (!flag) {
            const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff', 'tif', 'psd', 'ai', 'eps', 'raw', 'cr2', 'nef', 'orf', 'sr2', 'dng', 'arw', 'rw2', 'raf', 'pef', 'x3f', 'srf', 'erf', 'mrw', 'nrw', 'kdc', 'dcr', 'mef', 'mos', 'crw', 'raf', 'rwl', 'srw', '3fr', 'fff', 'iiq', 'qtk', 'bay', 'k25', 'kdc', 'dcs', 'drf', 'dng', 'erf', 'kdc', 'mdc', 'mef', 'mos', 'mrw', 'nef', 'nrw', 'orf', 'pef', 'ptx', 'pxn', 'r3d', 'raf', 'raw', 'rwl', 'rw2', 'rwz', 'sr2', 'srf', 'x3f'];
            const extension = file.name.substring(file.name.lastIndexOf('.') + 1).toLowerCase();
            flag = imageExtensions.includes(extension);
        }
        return flag;
    },
    getFileLink(filename) {
        const fileLink = process.env.NODE_ENV === 'production' ? `/file/${filename}?from=admin` : `/api/file/${filename}?from=admin`;
        const file = this.tableData.find(item => item.name === filename) || (this.detailFile?.name === filename ? this.detailFile : null);
        return file?.metadata?.ContentVersion ? fileLink + '&v=' + encodeURIComponent(file.metadata.ContentVersion) : fileLink;
    },
    async handlePageChange(page) {
        if (this.loading || page < 1 || page > this.realTotalPages) return;
        await this.loadMoreDataUntilPage(page);
        document.querySelector('.main-container')?.scrollIntoView({ behavior: 'smooth' });
    },
    // 跳转到指定页码
    handleJumpPage() {
        const page = parseInt(this.jumpPage);
        if (isNaN(page) || page < 1) {
            this.$message.warning(this.$t('dashboard.invalidPageNumber'));
            return;
        }
        if (page > this.realTotalPages) {
            this.$message.warning(this.$t('dashboard.pageExceedsMax', { max: this.realTotalPages }));
            return;
        }
        // 如果目标页超过当前已加载的页数，需要先加载更多数据
        if (page > this.totalPages) {
            this.$message.info(this.$t('dashboard.loadingData'));
            this.loadMoreDataUntilPage(page);
        } else {
            this.currentPage = page;
        }
        this.jumpPage = '';
    },
    // 加载数据直到指定页
    async loadMoreDataUntilPage(targetPage) {
        this.loading = true;
        try {
            // 计算目标页需要的文件数量（不包含文件夹）
            // 目标页最后一个项目的索引 = targetPage * pageSize
            // 需要的文件数 = 目标索引 - 已有文件夹数量
            const targetIndex = targetPage * this.pageSize;
            const currentFolderCount = this.filteredTableData.filter(item => item.isFolder).length;
            const currentFileCount = this.filteredTableData.filter(item => !item.isFolder).length;
            
            // 需要加载的文件数量 = 目标位置需要的文件数 - 当前已加载的文件数
            const neededFileCount = Math.max(0, targetIndex - currentFolderCount - currentFileCount);
            
            if (neededFileCount > 0) {
                await fileManager.loadMoreFiles(
                    this.currentPath,
                    this.searchKeywords,
                    this.searchIncludeTags,
                    this.searchExcludeTags,
                    neededFileCount,
                    this.filters
                );
                await this.fetchFileList();
            }

            this.currentPage = Math.min(targetPage, this.totalPages);
        } catch (error) {
            this.$message.error(this.$t('dashboard.loadDataFailed'));
        } finally {
            this.loading = false;
        }
    },
    // 判断是否为文件夹
    isFolder(item) {
        // 如果是已经标记为文件夹的项目，直接返回true
        if (item.isFolder) {
            return true;
        }
        
        // 获取真实的文件路径（去除URL前缀）
        let path = item.name;
        if (path.startsWith('http')) {
            path = path.split('/file/')[1];
        }
        
        // 如果文件名包含'/'，需要判断是否是当前路径下的文件
        if (path && path.includes('/')) {
            // 获取相对于当前路径的部分
            const relativePath = this.currentPath ? 
                path.substring(this.currentPath.length) : 
                path;
            
            // 如果在根目录，第一个斜杠前的部分就是文件夹
            if (this.currentPath === '') {
                return !path.split('/')[0].includes('.');
            }
            
            // 如果在子文件夹中，检查相对路径是否还包含其他文件夹
            return relativePath.includes('/');
        }
        
        return false;
    },
    
    // 获取文件夹名称
    getFolderName(path) {
        let folderName = '';
        // 如果是文件夹路径，只返回最后一级文件夹名
        if (path && path.includes('/')) {
            const parts = path.split('/');
            // 如果是根目录下的文件夹
            if (this.currentPath === '') {
                folderName = parts[0];
            } else {
                // 如果是子文件夹
                const relativePath = path.substring(this.currentPath.length);
                folderName = relativePath.split('/')[0];
            }
        } else {
            folderName = path;
        }

        const maxLength = 20; // Adjust max length as needed
        if (folderName.length > maxLength) {
            const startLength = Math.floor((maxLength - 3) / 2);
            const endLength = Math.ceil((maxLength - 3) / 2);
            return `${folderName.substring(0, startLength)}...${folderName.substring(folderName.length - endLength)}`;
        }
        return folderName;
    },
    
    // 获取文件名称（去除路径和URL前缀）
    getFileName(path) {
        let fileName = path.split('/').pop();
        const maxLength = 20; // Adjust max length as needed, ensure it fits in one line
        if (fileName.length > maxLength) {
            const startLength = Math.floor((maxLength - 3) / 2);
            const endLength = Math.ceil((maxLength - 3) / 2);
            return `${fileName.substring(0, startLength)}...${fileName.substring(fileName.length - endLength)}`;
        }
        return fileName;
    },
    
    // 获取文件名前半部分（用于中间省略效果）
    getFileNameStart(name) {
        if (!name) return '';
        // 如果文件名较短，返回全部
        if (name.length <= 30) return name;
        // 保留开头部分（约60%的长度用于显示前半部分）
        const dotIndex = name.lastIndexOf('.');
        if (dotIndex > 0) {
            // 有扩展名的情况：返回文件名主体部分
            const baseName = name.substring(0, dotIndex);
            const keepLength = Math.min(baseName.length, Math.floor(name.length * 0.6));
            return baseName.substring(0, keepLength);
        }
        // 无扩展名的情况
        return name.substring(0, Math.floor(name.length * 0.6));
    },
    
    // 获取文件名后半部分（用于中间省略效果）
    getFileNameEnd(name) {
        if (!name) return '';
        // 如果文件名较短，返回空
        if (name.length <= 30) return '';
        // 保留末尾部分（包含扩展名）
        const dotIndex = name.lastIndexOf('.');
        if (dotIndex > 0) {
            // 有扩展名的情况：返回最后几个字符 + 扩展名
            const ext = name.substring(dotIndex);
            const baseName = name.substring(0, dotIndex);
            const keepLength = Math.min(8, Math.floor(baseName.length * 0.2));
            return '…' + baseName.substring(baseName.length - keepLength) + ext;
        }
        // 无扩展名的情况
        const keepLength = Math.min(10, Math.floor(name.length * 0.3));
        return '…' + name.substring(name.length - keepLength);
    },
    
    // 进入文件夹
    enterFolder(folderPath) {
        // 确保路径末尾有 '/'
        this.currentPath = folderPath + (folderPath.endsWith('/') ? '' : '/');
        // 刷新文件列表，到指定currentPath下
        this.refreshFileList();
    },
    
    // 导航到指定文件夹
    navigateToFolder(path) {
        // 确保空路径时不添加 '/'
        this.currentPath = path ? (path + (path.endsWith('/') ? '' : '/')) : '';
        // 刷新文件列表，到指定currentPath下
        this.refreshFileList();
    },
    
    // 获取文件列表
    async fetchFileList() {
        this.loading = true;
        try {
            // 从本地存储获取数据
            const data = fileManager.getLocalFileList();
            
            // 解析返回的数据
            const folders = new Set(data.directories || []);
            const files = data.files || [];

            // 处理文件夹数据
            const folderItems = Array.from(folders).map(folder => ({
                name: folder,
                isFolder: true,
                selected: false,
                metadata: { FileName: folder.split('/').pop() }
            }));

            // 处理文件数据
            const fileItems = files.map(file => ({
                name: file.name,
                isFolder: false,
                selected: false,
                metadata: file.metadata
            }));

            // 更新表格数据
            this.tableData = [...folderItems, ...fileItems];

            // 更新统计信息
            this.updateStats(data.totalCount, true);
            
            // 更新直接文件和文件夹数量
            this.directFileCount = data.directFileCount || 0;
            this.directFolderCount = data.directFolderCount || 0;

        } catch (error) {
            console.error('Error fetching file list:', error);
            this.$message.error(this.$t('dashboard.fetchFileListFailed'));
        } finally {
            this.loading = false;
        }
    },
    // 刷新文件列表
    async refreshFileList() {
        this.loadTagOptions();
        this.refreshLoading = true;
        this.loading = true;
        try {
            // 传递标签参数和筛选参数到后端
            const success = await fileManager.refreshFileList(
                this.currentPath, 
                this.searchKeywords,
                this.searchIncludeTags,
                this.searchExcludeTags,
                this.filters
            );
            if (success) {
                await this.fetchFileList();
            } else {
                throw new Error('Refresh failed');
            }
        } catch (error) {
            // 认证失败由 fetchWithAuth 统一处理跳转，不重复提示
            if (!error.message?.includes('Unauthorized') && this.$store.state.adminLoggedIn) {
                console.error('Error refreshing file list:', error);
                this.$message.error(this.$t('dashboard.refreshFailed'));
            }
        } finally {
            this.refreshLoading = false;
            this.loading = false;
        }
    },
    // 刷新本地文件列表
    async refreshLocalFileList() {
        this.refreshLoading = true;
        this.loading = true;
        try {
            await this.fetchFileList();
        } catch (error) {
            console.error('Error refreshing local file list:', error);
            this.$message.error(this.$t('dashboard.refreshFailed'));
        } finally {
            this.refreshLoading = false;
            this.loading = false;
        }
    },
    resetListColumns() { this.visibleListColumns = [...defaultListColumns]; },
    openQuickRename(item) {
        this.renameTarget = item;
        this.renameValue = item.metadata?.FileName || item.name.split('/').pop();
        this.showRenameDialog = true;
    },
    async saveQuickRename() {
        if (this.renaming || !this.renameTarget) return;
        if (!validOverviewFileName(this.renameValue)) {
            this.$message.warning(this.$t('dashboard.invalidQuickName'));
            return;
        }
        const oldPath = this.renameTarget.name;
        this.renaming = true;
        try {
            const response = await fetchWithAuth(`/api/manage/rename/${oldPath.split('/').map(encodeURIComponent).join('/')}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newFileName: this.renameValue })
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(response.status === 409 ? this.$t('fileDetail.renameConflict') : result.message || this.$t('fileDetail.renameFailed'));
            this.handleFileRenamed(oldPath, result.newFileId, result.metadata);
            this.showRenameDialog = false;
            this.$message.success(this.$t('fileDetail.renameSuccess'));
        } catch (error) { this.$message.error(error.message || this.$t('fileDetail.renameFailed')); }
        finally { this.renaming = false; }
    },
    async loadTagOptions() {
        try {
            const response = await fetchWithAuth('/api/manage/tags/catalog');
            if (response.ok) this.tagOptions = (await response.json()).tags.map(t => t.name);
        } catch { /* Keep existing options on transient failures. */ }
    },
    async handleCatalogChanged(change) {
        for (const key of ['tagGroup1', 'tagGroup2']) {
            this.filters[key] = [...new Set((this.filters[key] || []).flatMap(tag => tag === change.name ? (change.newName ? [change.newName] : []) : [tag]))];
        }
        await this.loadTagOptions();
        this.currentPage = 1;
        await this.refreshFileList();
    },
    // Tag management methods
    handleTagManagement(fileId) {
        this.currentTagFile = fileId;
        this.showTagDialog = true;
    },
    handleBatchTagManagement() {
        if (this.selectedFiles.length === 0) {
            this.$message.warning(this.$t('dashboard.selectFilesFirst'));
            return;
        }
        this.showBatchTagDialog = true;
    },
    async handleTagsUpdated(tags) {
        // 更新本地文件数据中的标签
        const fileIndex = this.tableData.findIndex(file => file.name === this.currentTagFile);
        if (fileIndex !== -1) {
            // 更新 tableData 中的标签
            if (!this.tableData[fileIndex].metadata) {
                this.tableData[fileIndex].metadata = {};
            }
            this.tableData[fileIndex].metadata.Tags = tags;
            
            // 如果详情对话框正在显示这个文件，也更新详情数据
            if (this.showdetailDialog && this.detailFile?.name === this.currentTagFile) {
                if (!this.detailFile.metadata) {
                    this.detailFile.metadata = {};
                }
                this.detailFile.metadata.Tags = tags;
            }
        }
    },
    async handleBatchTagsUpdated() {
        // 刷新文件列表以显示更新后的标签
        await this.refreshLocalFileList();
    },
    handleMetadataUpdated(fileId, updatedMetadata) {
        // 更新 tableData 中对应文件的 metadata
        const fileIndex = this.tableData.findIndex(f => f.name === fileId);
        if (fileIndex !== -1) {
            this.tableData[fileIndex].metadata = { ...this.tableData[fileIndex].metadata, ...updatedMetadata };
        }
        // 如果 detailFile 正在显示该文件，同步更新 detailFile
        if (this.detailFile && this.detailFile.name === fileId) {
            this.detailFile.metadata = { ...this.detailFile.metadata, ...updatedMetadata };
        }
    },
    handleFileRenamed(oldFileId, newFileId, updatedMetadata) {
        // 更新 tableData 中对应文件的 name（File_ID）和 metadata
        const fileIndex = this.tableData.findIndex(f => f.name === oldFileId);
        if (fileIndex !== -1) {
            this.tableData[fileIndex].name = newFileId;
            this.tableData[fileIndex].metadata = { ...this.tableData[fileIndex].metadata, ...updatedMetadata };
        }
        // 更新 detailFile 引用并关闭/重新打开详情弹窗以刷新链接
        if (this.detailFile && this.detailFile.name === oldFileId) {
            this.detailFile.name = newFileId;
            this.detailFile.metadata = { ...this.detailFile.metadata, ...updatedMetadata };
            // 关闭详情弹窗，然后在下一个 tick 重新打开以刷新所有链接
            this.showdetailDialog = false;
            this.$nextTick(() => {
                this.showdetailDialog = true;
            });
        }
        const cached = fileManager.getMutableFileList();
        const cachedFile = cached.files.find(file => file.name === oldFileId || file.name === newFileId);
        if (cachedFile) {
            cachedFile.name = newFileId;
            cachedFile.metadata = { ...cachedFile.metadata, ...updatedMetadata };
            fileManager.updateFileListCache(cached);
        }
    },
    // 生成单个文件链接
    generateFileLink(key, metadata) {
        const isExternal = metadata?.Channel === 'External';
        const baseUrl = isExternal ? metadata?.ExternalLink : `${this.rootUrl}${metadata?.FixedId || key}`;
        const fileName = metadata?.FileName || key;
        
        switch (this.defaultUrlFormat) {
            case 'originUrl':
                return baseUrl;
            case 'mdUrl':
                return `![${fileName}](${baseUrl})`;
            case 'htmlUrl':
                return `<img src="${baseUrl}" alt="${fileName}" width=100%>`;
            case 'bbUrl':
                return `[img]${baseUrl}[/img]`;
            case 'tgId':
                return metadata?.TgFileId || '';
            case 's3Location':
                return metadata?.S3Location || '';
            default:
                return baseUrl;
        }
    },
    // 复制文件夹中所有文件的链接
    async handleFolderCopy(folderName) {
        // 显示加载状态
        const loading = this.$loading({
            lock: true,
            text: this.$t('dashboard.fetchingFileList')
        });
        
        try {
            // 调用 list API 递归获取文件夹内所有文件
            const response = await fetchWithAuth(
                `/api/manage/list?dir=${encodeURIComponent(folderName)}&recursive=true&count=-1`,
                { method: 'GET' }
            );
            
            const data = await response.json();
            loading.close();
            
            if (!data.files || data.files.length === 0) {
                this.$message.warning(this.$t('dashboard.folderEmptyNoLinks'));
                return;
            }
            
            // 根据当前链接格式生成所有文件链接
            const links = data.files.map(file => {
                return this.generateFileLink(file.name, file.metadata);
            }).filter(link => link);
            
            if (links.length === 0) {
                this.$message.warning(this.$t('dashboard.noLinksAvailable'));
                return;
            }
            
            // 复制到剪贴板
            const text = links.join('\n');
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(text);
                this.$message.success(this.$t('dashboard.copiedFileLinks', { count: links.length }));
            } else {
                this.copyToClipboardFallback(text);
                this.$message.success(this.$t('dashboard.copiedFileLinks', { count: links.length }));
            }
        } catch (error) {
            loading.close();
            console.error('Copy folder links failed:', error);
            this.$message.error(this.$t('dashboard.copyFolderLinksFailed'));
        }
    },
},
beforeUnmount() {
    clearTimeout(this.uploadRefreshTimer);
},
mounted() {
    // 初始化背景图
    this.initializeBackground('adminBkImg', '.container', false, true);

    this.loading = true;
    // 路由守卫已通过 /api/auth/sessionCheck 验证认证状态
    this.showLogoutButton = this.$store.state.adminLoggedIn;
    // 首次加载时刷新文件列表
    this.normalizeExistingNames().then(() => this.refreshFileList())
        .then(() => {
            // 获取所有渠道名称
            return this.extractChannelNames();
        })
        .catch((err) => {
            if (err.message !== 'Unauthorized') {
                this.$message.error(this.$t('dashboard.syncDataError'));
            }
        })
        .finally(() => {
            this.loading = false;
        });
    
    // 读取自定义链接设置项
    this.customUrlPrefix = this.adminUrlSettings.customUrlPrefix;
    this.useCustomUrl = this.adminUrlSettings.useCustomUrl;

    // 恢复视图模式偏好
    const savedViewMode = localStorage.getItem('viewMode');
    if (savedViewMode === 'card' || savedViewMode === 'list') {
        this.viewMode = savedViewMode;
    }
}

};
</script>

<style scoped>
.batch-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; padding: 10px 0; margin-bottom: 8px; }
.selection-count { color: var(--admin-container-color); font-size: 13px; }
.batch-header-button { border: 0; background: transparent; color: var(--admin-container-color); cursor: pointer; padding: 8px; font-size: 18px; border-radius: 8px; }
.batch-header-button:hover:not(:disabled) { color: var(--admin-purple); background: var(--el-fill-color-light); }
.batch-header-button.danger:hover:not(:disabled) { color: var(--el-color-danger); }
.batch-header-button:disabled { opacity: .35; cursor: not-allowed; }
.container {
    background: var(--admin-container-bg-color);
    min-height: 100vh;
    font-family: 'Arial', sans-serif;
    color: var(--admin-container-color);
    margin: 0;
    padding: 0;
}

/* 确保el-container和el-main不裁剪内容 */
:deep(.el-container) {
    overflow: visible;
}

:deep(.el-main) {
    overflow: visible;
}

:deep(.el-dialog) {
    border-radius: 12px;
    background-color: var(--dialog-bg-color);
    backdrop-filter: blur(10px);
    box-shadow: var(--dialog-box-shadow);
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
    
    .header-content .actions {
        gap: 10px;
    }
    
    .search-card :deep(.el-input__inner) {
        height: 28px;
        font-size: 0.85em;
        width: 50vw;
    }
    
    .search-card :deep(.el-input__wrapper) {
        padding: 0 10px;
    }
    
    .search-card :deep(.el-input__inner:focus) {
        width: 65vw;
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
    color: var(--admin-purple); /* 使用柔和的淡紫色 */
    transform: scale(1.2);
}


/* 面包屑容器，包含路径和文件数量 */
.breadcrumb-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 10px; /* 与 .content 的 padding 对齐 */
    margin-bottom: 4px; /* 与下方内容的间距 */
}

@media (max-width: 768px) {
    .breadcrumb-container {
        flex-direction: row;
        align-items: center;
        gap: 8px;
        padding: 0 5px;
        margin-bottom: 2px;
    }
}

/* 文件数量小徽章 */
.stats-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    font-weight: 500;
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color-light);
    padding: 4px 10px;
    border-radius: 12px;
    border: 1px solid var(--el-border-color-lighter);
    transition: all 0.2s ease;
    white-space: nowrap;
    flex-shrink: 0;
}

.stats-badge:hover {
    background: var(--el-fill-color);
    color: var(--admin-purple);
    border-color: var(--admin-purple);
}

.stats-badge-icon {
    font-size: 11px;
    opacity: 0.8;
}

@media (max-width: 768px) {
    .stats-badge {
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 8px;
    }
    
    .stats-badge-icon {
        font-size: 9px;
    }
}


.header-content .actions {
    display: flex;
    align-items: center;
    gap: 15px;
}

@media (max-width: 768px) {
    .header-content .actions {
        margin-top: 10px;
    }
}

.header-content .actions i {
    font-size: 1.5em;
    cursor: pointer;
    transition: color 0.3s, transform 0.3s;
    color: var(--admin-container-color);
}

.header-content .actions i:hover {
    color: var(--admin-purple); /* 使用柔和的淡紫色 */
    transform: scale(1.2);
}

.header-content .actions .el-dropdown-link i {
    color: var(--admin-container-color);
}

.header-content .actions .el-dropdown-link i:hover {
    color: var(--admin-purple); /* 使用柔和的淡紫色 */
}

.header-content .actions .disabled {
    color: #bbb;
    pointer-events: none;
}

.header-content .actions .enabled {
    color: var(--admin-purple); /* 使用柔和的淡紫色 */
}

.batch-action-item-icon {
    width: 20px;
    margin-right: 5px;
}

/* 搜索区域样式（包含搜索框和筛选按钮） */
.search-area {
    margin-left: auto;
    margin-right: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
}
@media (max-width: 768px) {
    .search-area {
        margin-right: 0;
        margin-left: 0;
        margin-top: 10px;
        gap: 6px;
    }
}

/* 搜索卡片样式 */
.search-card {
    display: flex;
    align-items: center;
}
.search-card :deep(.el-input__wrapper) {
    border-radius: 20px;
    background: var(--admin-dashboard-search-card-bg-color);
    box-shadow: var(--admin-dashboard-search-card-box-shadow);
    transition: background-color 0.3s;
}

.search-card :deep(.el-input__inner) {
    width: 280px;
    height: 40px;
    font-size: 1.2em;
    border: none;
    transition: width 0.3s;
    background: none;
}

.search-card :deep(.el-input__inner::placeholder) {
    color: var(--el-text-color-placeholder);
    font-style: italic;
    font-weight: 400;
    font-size: 14px;
    opacity: 0.6;
    letter-spacing: 0.5px;
    transition: all 0.3s ease;
}

.search-card :deep(.el-input__inner:focus::placeholder) {
    opacity: 0.4;
    transform: translateX(5px);
}
@media (max-width: 768px) {
    .search-card :deep(.el-input__inner) {
        width: 45vw;
        height: 32px;
        font-size: 1em;
    }
}
.search-card :deep(.el-input__inner:focus) {
    width: 350px;
}
@media (max-width: 768px) {
    .search-card :deep(.el-input__inner:focus) {
        width: 55vw;
    }
}
.search-icon {
    cursor: pointer;
    color: var(--admin-container-color);
    transition: all 0.3s ease;
    font-size: 1.3em;
    opacity: 0;
    transform: scale(0.8);
    pointer-events: none;
}
.search-card:focus-within .search-icon {
    opacity: 1;
    transform: scale(1);
    pointer-events: auto;
}
.search-card:focus-within .search-icon:hover {
    color: var(--admin-purple);
    transform: scale(1.2);
}
.search-card :deep(.el-input__suffix) {
    display: flex;
    align-items: center;
    right: 10px;
}

/* 主容器样式 */
.main-container {
    display: flex;
    flex-direction: column;
    padding: 20px 60px;
    min-height: calc(100vh - 80px);
}

@media (max-width: 768px) {
    .main-container {
        margin-top: 12vh;
    }
}

.content {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    grid-template-rows: repeat(3, 1fr);
    gap: 20px;
    padding: 10px;
    padding-bottom: 0px;
    flex-grow: 1;
    min-height: 80vh;
}

/* 空状态样式 */
.empty-state {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    color: var(--admin-container-color);
    opacity: 0.6;
}

.empty-icon {
    font-size: 64px;
    margin-bottom: 20px;
    color: var(--admin-container-color);
    opacity: 0.3;
}

.empty-text {
    font-size: 18px;
    font-weight: 500;
    margin: 0 0 8px 0;
}

.empty-hint {
    font-size: 14px;
    margin: 0;
    opacity: 0.7;
}

.list-empty {
    padding: 80px 20px;
}

/* 在小屏幕上，将所有内容放入一列 */
@media (max-width: 768px) {
    .content {
        grid-template-columns: 1fr; /* 将所有内容放入一列 */
        grid-template-rows: none;   /* 行根据内容高度自动调整 */
    }
}

/* 列表视图样式 - 仅保留容器和表头 */
.list-view {
    display: flex;
    flex-direction: column;
    gap: 0;
    background: var(--admin-dashboard-imgcard-bg-color);
    border-radius: 12px;
    overflow-x: auto;
    overflow-y: visible;
    box-shadow: var(--admin-dashboard-imgcard-shadow);
    margin-top: 15px;
}

.list-header {
    display: grid;
    grid-template-columns: var(--list-columns);
    padding: 12px 20px;
    background: var(--admin-dashboard-stats-bg);
    font-weight: 600;
    font-size: 13px;
    color: var(--el-text-color-secondary);
    border-bottom: 1px solid var(--el-border-color-lighter);
    min-width: var(--list-min-width);
    box-sizing: border-box;
}

.list-col {
    display: flex;
    align-items: center;
}

.list-col-checkbox {
    justify-content: center;
    min-width: 40px;
}

/* 表头自定义复选框 */
.custom-checkbox {
    width: 18px;
    height: 18px;
    border: 2px solid var(--el-border-color);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    background: transparent;
}

.custom-checkbox:hover {
    border-color: #38bdf8;
}

.custom-checkbox.checked,
.custom-checkbox.indeterminate {
    background: linear-gradient(135deg, #0ea5e9, #38bdf8);
    border-color: #38bdf8;
}

.custom-checkbox .check-icon {
    font-size: 10px;
    color: white;
}

/* 移动端列表视图 */
@media (max-width: 768px) {
    .list-header { font-size: 12px; }
}

.pagination-container {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-top: 20px;
    padding-bottom: 20px;
    gap: 15px;
    position: relative;
}

.pagination-center {
    display: flex;
    align-items: center;
    gap: 10px;
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

.pagination-right {
    display: flex;
    align-items: center;
    gap: 10px;
    position: absolute;
    right: 0;
}

/* 分页信息区域 */
.page-total {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    white-space: nowrap;
}

.page-jump {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
}

.page-jump .jump-input {
    width: 50px;
}

.page-jump .jump-input :deep(.el-input__wrapper) {
    background: var(--admin-dashboard-btn-bg-color);
    box-shadow: var(--admin-dashboard-btn-shadow);
    border-radius: 8px;
    padding: 0 8px;
    height: 28px;
}

.page-jump .jump-input :deep(.el-input__inner) {
    text-align: center;
    color: var(--el-text-color-primary);
    height: 28px;
    line-height: 28px;
}

.page-jump .jump-btn {
    background: linear-gradient(135deg, #0ea5e9, #38bdf8);
    border: none;
    border-radius: 8px;
    padding: 0 12px;
    height: 28px;
    font-size: 12px;
    font-weight: 600;
    color: white;
    box-shadow: 0 2px 8px rgba(56, 189, 248, 0.3);
    transition: all 0.3s ease;
}

.page-jump .jump-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(56, 189, 248, 0.4);
}

/* 移动端分页适配 */
@media (max-width: 768px) {
    .pagination-container {
        flex-direction: column;
        gap: 12px;
        padding-bottom: 15px;
    }
    
    .pagination-center {
        order: 0;
    }
    
    .pagination-right {
        position: static;
        width: 100%;
        justify-content: center;
        order: 1;
    }
    
    .page-jump .jump-input {
        width: 45px;
    }
}

.refresh-btn {
    cursor: pointer;
    background: var(--admin-dashboard-btn-bg-color);
    box-shadow: var(--admin-dashboard-btn-shadow);
    color: #38bdf8;
    border: none;
    border-radius: 10px;
    width: 36px;
    height: 36px;
    min-width: 36px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.refresh-btn:hover {
    transform: translateY(-2px);
    box-shadow: var(--admin-dashboard-btn-hover-shadow);
    background: linear-gradient(135deg, #0ea5e9, #38bdf8);
    color: white;
}

.load-more {
    cursor: pointer;
    background: linear-gradient(135deg, #0ea5e9, #38bdf8);
    box-shadow: 0 4px 15px rgba(56, 189, 248, 0.3);
    color: white;
    border: none;
    border-radius: 10px;
    height: 36px;
    padding: 0 16px;
    font-weight: 500;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.load-more:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(56, 189, 248, 0.5);
}

:deep(.btn-prev){
    border-radius: 100%;
    position: fixed;
    top: 50%;
    left: 8px;
    scale: 1;
    color: var(--admin-dashboard-btn-color);
}
:deep(.btn-next) {
    border-radius: 100%;
    position: fixed;
    top: 50%;
    right: 8px;
    scale: 1;
    color: var(--admin-dashboard-btn-color);
}
@media (min-width: 768px) {
    :deep(.el-pagination.is-background .btn-prev), :deep(.el-pagination.is-background .btn-next) {
        background-color: var(--admin-dashboard-btn-bg-color);
        backdrop-filter: blur(10px);
        box-shadow: var(--admin-dashboard-btn-shadow);
        transition: all 0.3s ease;
    }
    :deep(.el-pagination.is-background .btn-prev:hover), :deep(.el-pagination.is-background .btn-next:hover) {
        transform: translateY(-10%);
        box-shadow: var(--admin-dashboard-btn-hover-shadow);
    }
}

.question-icon {
    margin: 0 3px;
}

.breadcrumb {
    padding: 8px 12px;
    background-color: var(--el-bg-color);
    border-radius: 6px;
    font-size: 0.95em;
    box-shadow: var(--admin-dashboard-stats-shadow);
    transition: all 0.3s ease;
}

.breadcrumb:hover {
    transform: translateY(-1px);
    box-shadow: var(--admin-dashboard-stats-hover-shadow);
}

.breadcrumb-home-icon {
    font-size: 14px;
    color: #38bdf8;
    transition: color 0.2s ease;
}

.breadcrumb-home-icon:hover {
    color: var(--admin-purple);
}

:deep(.el-breadcrumb__item) {
    cursor: pointer;
}
:deep(.el-breadcrumb__inner:hover) {
    color: var(--el-color-primary);
}

/* 移动端目录触发按钮 */
.mobile-directory-trigger {
    display: none;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: var(--el-fill-color-light);
    border-radius: 8px;
    border: 1px solid var(--el-border-color-lighter);
    cursor: pointer;
    transition: all 0.2s ease;
}

.mobile-directory-trigger:active {
    background: var(--el-fill-color);
}

.mobile-directory-icon {
    font-size: 12px;
    color: #38bdf8;
}

.mobile-directory-path {
    font-size: 12px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.mobile-directory-arrow {
    font-size: 8px;
    color: var(--el-text-color-secondary);
}

/* 桌面端显示面包屑，隐藏移动端触发器 */
.desktop-only {
    display: block;
}

@media (max-width: 768px) {
    .mobile-directory-trigger {
        display: flex;
    }
    
    .desktop-only {
        display: none !important;
    }
    
    .breadcrumb-container {
        padding: 0;
        margin-left: 0;
    }
}

/* 框选选区矩形覆盖层 */
.drag-select-overlay {
    position: fixed;
    background: rgba(24, 144, 255, 0.1);
    border: 1px solid rgba(24, 144, 255, 0.6);
    pointer-events: none;
    z-index: 9999;
    border-radius: 2px;
}

.column-settings-btn { border: 0; background: transparent; padding: 0; cursor: pointer; }
.column-options { display: flex; flex-direction: column; margin-bottom: 12px; }
/* Compact overview: the sticky header remains in normal flow, so no viewport-sized spacer is needed. */
.container { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif; }
.container > :deep(.el-container) > .el-header { height: auto; padding: 8px 24px 0; position: sticky; top: 0; z-index: 2001; }
.header-content { position: relative; top: auto; left: auto; transform: none; width: 100%; box-sizing: border-box; min-height: 52px; padding: 8px 16px; border-radius: 12px; gap: 16px; box-shadow: 0 4px 16px rgba(0,0,0,.1); }
.header-content:hover { transform: none; box-shadow: 0 4px 16px rgba(0,0,0,.12); }
html.dark .header-content, html.dark .header-content:hover { background: rgba(28,30,34,.92); box-shadow: 0 4px 16px rgba(0,0,0,.2); }
.header-icon, .header-content :deep(.filter-trigger .header-icon) { font-size: 19px; }
.header-icon:hover { transform: none; }
.header-content .actions { gap: 14px; margin-top: 0; }
.search-area { margin-right: 0; margin-top: 0; gap: 10px; }
.search-card :deep(.el-input__wrapper) { border-radius: 9px; }
.search-card :deep(.el-input__inner), .search-card :deep(.el-input__inner:focus) { height: 32px; width: clamp(160px, 20vw, 300px); font-size: 13px; }
.search-card :deep(.el-input__inner::placeholder) { font-style: normal; letter-spacing: 0; }
.main-container { padding: 10px 24px 24px; margin-top: 0; min-height: calc(100vh - 68px); scroll-margin-top: 76px; }
.breadcrumb-container { padding: 0; gap: 10px; margin: 0 0 10px; min-height: 32px; }
.breadcrumb { min-width: 0; padding: 7px 10px; border-radius: 8px; box-shadow: none; overflow-wrap: anywhere; }
.breadcrumb:hover { transform: none; box-shadow: none; }
.batch-toolbar { margin: 0 0 0 auto; padding: 0; gap: 4px; flex-wrap: nowrap; flex-shrink: 0; }
.selection-count { white-space: nowrap; margin-right: 6px; font-size: 12px; color: var(--el-text-color-secondary); }
.batch-header-button { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; font-size: 15px; border-radius: 7px; }
.stats-badge { border-radius: 7px; padding: 4px 8px; }
.list-view { margin-top: 0; border-radius: 10px; box-shadow: none; border: 1px solid var(--el-border-color-lighter); }
.list-header { padding: 9px 16px; font-size: 12px; }
.list-view :deep(.list-item) { padding: 8px 16px; }
.content { padding: 0; gap: 14px; grid-template-rows: none; align-content: start; flex-grow: 0; min-height: 0; }
@media (max-width: 1050px) and (min-width: 769px) {
    .header-content { flex-wrap: wrap; gap: 8px 14px; }
    .header-content .actions { margin-left: auto; }
}
@media (max-width: 768px) {
    .container > :deep(.el-container) > .el-header { padding: 6px 12px 0; }
    .header-content { flex-direction: row; flex-wrap: wrap; justify-content: space-between; padding: 8px 10px; gap: 8px; width: 100%; }
    .header-content .actions { width: 100%; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
    .search-area { margin-left: auto; }
    .search-card :deep(.el-input__inner), .search-card :deep(.el-input__inner:focus) { width: clamp(80px, 20vw, 160px); height: 30px; }
    .main-container { padding: 10px 12px 20px; margin-top: 0; scroll-margin-top: 132px; }
    .breadcrumb-container { gap: 6px; flex-wrap: wrap; }
    .mobile-directory-trigger { min-width: 0; padding: 6px 8px; }
    .mobile-directory-path { max-width: 72px; }
    .batch-toolbar { gap: 2px; }
    .selection-count { margin-right: 2px; font-size: 11px; }
    .batch-header-button { width: 30px; height: 30px; font-size: 14px; }
    .stats-badge { font-size: 11px; padding: 3px 6px; }
}
@media (max-width: 420px) {
    .search-area { order: 2; width: 100%; }
    .search-card { flex: 1; }
    .search-card :deep(.el-input__inner), .search-card :deep(.el-input__inner:focus) { width: 100%; }
    .header-content .actions { order: 3; }
    .main-container { scroll-margin-top: 166px; }
}

</style>
