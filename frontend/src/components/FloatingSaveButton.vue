<template>
    <transition name="fade-up">
        <div 
            v-show="visible"
            class="floating-save-btn" 
            :class="{ 'is-loading': loading }"
            @click="handleClick"
        >
            <font-awesome-icon v-if="loading" icon="spinner" spin />
            <font-awesome-icon v-else icon="save" />
            <span class="save-text">{{ loading ? '保存中' : '保存' }}</span>
        </div>
    </transition>
</template>

<script>
export default {
    name: 'FloatingSaveButton',
    props: {
        loading: {
            type: Boolean,
            default: false
        },
        show: {
            type: Boolean,
            default: true
        }
    },
    data() {
        return {
            visible: false
        };
    },
    watch: {
        show: {
            immediate: true,
            handler(val) {
                if (val) {
                    // 延迟显示，等待 Element Plus 加载遮罩淡出动画完成
                    setTimeout(() => {
                        this.visible = true;
                    }, 600);
                } else {
                    this.visible = false;
                }
            }
        }
    },
    methods: {
        handleClick() {
            if (!this.loading) {
                this.$emit('click');
            }
        }
    }
};
</script>

<style scoped>
.floating-save-btn {
    position: fixed;
    right: var(--floating-btn-right, 24px);
    bottom: var(--floating-btn-bottom, 24px);
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 18px;
    background: var(--floating-btn-bg);
    color: var(--floating-btn-color);
    border-radius: 50px;
    cursor: pointer;
    box-shadow: var(--floating-btn-shadow);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 100;
    font-weight: 500;
    font-size: 13px;
    user-select: none;
}

.floating-save-btn:hover {
    transform: translateY(-2px);
    box-shadow: var(--floating-btn-shadow-hover);
}

.floating-save-btn:active {
    transform: translateY(-1px);
    box-shadow: var(--floating-btn-shadow);
}

.floating-save-btn.is-loading {
    cursor: not-allowed;
    opacity: 0.8;
}

.floating-save-btn.is-loading:hover {
    transform: none;
}

.floating-save-btn svg {
    font-size: 14px;
}

/* 淡入上移动画 */
.fade-up-enter-active {
    transition: all 0.3s ease-out;
}

.fade-up-leave-active {
    transition: all 0.2s ease-in;
}

.fade-up-enter-from {
    opacity: 0;
    transform: translateY(20px);
}

.fade-up-leave-to {
    opacity: 0;
    transform: translateY(10px);
}

/* 移动端适配 */
@media (max-width: 768px) {
    .floating-save-btn {
        right: 16px;
        bottom: 16px;
        padding: 10px 16px;
        font-size: 12px;
    }
    
    .floating-save-btn svg {
        font-size: 12px;
    }
}

@media (max-width: 480px) {
    .floating-save-btn {
        right: 12px;
        bottom: 12px;
        padding: 12px;
        border-radius: 50%;
    }
    
    .save-text {
        display: none;
    }
    
    .floating-save-btn svg {
        font-size: 16px;
    }
}
</style>
