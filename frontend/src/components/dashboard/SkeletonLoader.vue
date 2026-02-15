<template>
    <!-- 卡片视图骨架屏 -->
    <template v-if="type === 'card'">
        <div v-for="i in count" :key="'skeleton-' + i" class="skeleton-card">
            <div class="skeleton-image"></div>
            <div class="skeleton-info">
                <div class="skeleton-text"></div>
            </div>
        </div>
    </template>
    
    <!-- 列表视图骨架屏 -->
    <template v-else-if="type === 'list'">
        <div v-for="i in count" :key="'list-skeleton-' + i" class="list-item skeleton-list-item">
            <div class="list-col list-col-checkbox">
                <div class="skeleton-checkbox"></div>
            </div>
            <div class="list-col list-col-preview">
                <div class="skeleton-preview"></div>
            </div>
            <div class="list-col list-col-name">
                <div class="skeleton-text-long"></div>
            </div>
            <div class="list-col list-col-tags">
                <div class="skeleton-tag"></div>
            </div>
            <div class="list-col list-col-channel">
                <div class="skeleton-text-short"></div>
            </div>
            <div class="list-col list-col-channel-name">
                <div class="skeleton-text-short"></div>
            </div>
            <div class="list-col list-col-address">
                <div class="skeleton-text-short"></div>
            </div>
            <div class="list-col list-col-size">
                <div class="skeleton-text-tiny"></div>
            </div>
            <div class="list-col list-col-date">
                <div class="skeleton-text-short"></div>
            </div>
            <div class="list-col list-col-actions">
                <div class="skeleton-actions"></div>
            </div>
        </div>
    </template>
</template>

<script>
export default {
    name: 'SkeletonLoader',
    props: {
        type: {
            type: String,
            default: 'card',
            validator: value => ['card', 'list'].includes(value)
        },
        count: {
            type: Number,
            default: 15
        }
    }
}
</script>

<style scoped>
/* 骨架屏动画 */
@keyframes skeleton-shimmer {
    0% {
        background-position: -200% 0;
    }
    100% {
        background-position: 200% 0;
    }
}

@keyframes skeleton-pulse {
    0%, 100% {
        opacity: 0.4;
    }
    50% {
        opacity: 0.8;
    }
}

/* 卡片骨架屏 */
.skeleton-card {
    width: 100%;
    height: 22vh;
    background: var(--admin-dashboard-imgcard-bg-color);
    border-radius: 12px;
    box-shadow: var(--admin-dashboard-imgcard-shadow);
    overflow: hidden;
    position: relative;
}

.skeleton-image {
    width: 100%;
    height: 100%;
    background: linear-gradient(
        90deg,
        var(--skeleton-bg-color) 25%,
        color-mix(in srgb, var(--skeleton-bg-color) 70%, var(--skeleton-shimmer-color)) 50%,
        var(--skeleton-bg-color) 75%
    );
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.skeleton-info {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 15px;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.5));
}

.skeleton-text {
    height: 14px;
    width: 60%;
    margin: 0 auto;
    border-radius: 4px;
    background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0.1) 25%,
        rgba(255, 255, 255, 0.25) 50%,
        rgba(255, 255, 255, 0.1) 75%
    );
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

/* 列表骨架屏 */
.skeleton-list-item {
    animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.skeleton-checkbox {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    background: var(--skeleton-bg-color);
}

.skeleton-preview {
    width: 40px;
    height: 40px;
    border-radius: 6px;
    background: linear-gradient(
        90deg,
        var(--skeleton-bg-color) 25%,
        color-mix(in srgb, var(--skeleton-bg-color) 70%, var(--skeleton-shimmer-color)) 50%,
        var(--skeleton-bg-color) 75%
    );
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.skeleton-text-long {
    height: 14px;
    width: 80%;
    border-radius: 4px;
    background: linear-gradient(
        90deg,
        var(--skeleton-bg-color) 25%,
        color-mix(in srgb, var(--skeleton-bg-color) 70%, var(--skeleton-shimmer-color)) 50%,
        var(--skeleton-bg-color) 75%
    );
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.skeleton-text-short {
    height: 14px;
    width: 60px;
    border-radius: 4px;
    background: linear-gradient(
        90deg,
        var(--skeleton-bg-color) 25%,
        color-mix(in srgb, var(--skeleton-bg-color) 70%, var(--skeleton-shimmer-color)) 50%,
        var(--skeleton-bg-color) 75%
    );
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.skeleton-text-tiny {
    height: 14px;
    width: 40px;
    border-radius: 4px;
    background: linear-gradient(
        90deg,
        var(--skeleton-bg-color) 25%,
        color-mix(in srgb, var(--skeleton-bg-color) 70%, var(--skeleton-shimmer-color)) 50%,
        var(--skeleton-bg-color) 75%
    );
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.skeleton-tag {
    height: 20px;
    width: 50px;
    border-radius: 10px;
    background: linear-gradient(
        90deg,
        var(--skeleton-bg-color) 25%,
        color-mix(in srgb, var(--skeleton-bg-color) 70%, var(--skeleton-shimmer-color)) 50%,
        var(--skeleton-bg-color) 75%
    );
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.skeleton-actions {
    height: 28px;
    width: 80px;
    border-radius: 6px;
    background: var(--skeleton-bg-color);
}

/* 列表项布局继承 */
.list-item {
    display: grid;
    grid-template-columns: 50px 60px minmax(180px, 1fr) 130px 100px 110px 130px 80px 100px 120px;
    padding: 12px 20px;
    align-items: center;
    border-bottom: 1px solid var(--el-border-color-lighter);
}

.list-col {
    display: flex;
    align-items: center;
}

.list-col-checkbox {
    justify-content: center;
}

.list-col-preview {
    justify-content: center;
}

/* 移动端适配 */
@media (max-width: 768px) {
    .list-item {
        grid-template-columns: 28px 40px 1fr auto;
        padding: 10px 8px;
        gap: 8px;
    }
    
    .list-col-tags,
    .list-col-channel,
    .list-col-channel-name,
    .list-col-address,
    .list-col-size,
    .list-col-date {
        display: none;
    }
}
</style>
