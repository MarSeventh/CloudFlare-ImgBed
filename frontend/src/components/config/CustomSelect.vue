<template>
    <div class="custom-select" :class="{ 'is-open': isOpen }" :style="{ width: width }">
        <div class="custom-select-trigger" @click="toggleDropdown">
            <span class="custom-select-value" :class="{ 'is-placeholder': !modelValue }">
                {{ displayLabel }}
            </span>
            <font-awesome-icon icon="chevron-down" class="custom-select-arrow" />
        </div>
        <transition name="dropdown-fade">
            <div class="custom-select-dropdown" v-show="isOpen" @click.stop>
                <div 
                    v-for="option in options" 
                    :key="option.value"
                    class="custom-select-option"
                    :class="{ 'is-selected': modelValue === option.value }"
                    @click="selectOption(option.value)"
                >
                    <slot name="option" :option="option">
                        <font-awesome-icon v-if="option.icon" :icon="option.icon" class="option-icon"/>
                        <span>{{ option.label }}</span>
                    </slot>
                </div>
            </div>
        </transition>
    </div>
</template>

<script>
export default {
    name: 'CustomSelect',
    props: {
        modelValue: {
            type: [String, Number],
            default: ''
        },
        options: {
            type: Array,
            required: true,
            // 格式: [{ value: '', label: '', icon?: '' }]
        },
        placeholder: {
            type: String,
            default: '请选择'
        },
        width: {
            type: String,
            default: '160px'
        }
    },
    emits: ['update:modelValue', 'change'],
    data() {
        return {
            isOpen: false
        };
    },
    computed: {
        displayLabel() {
            const selected = this.options.find(opt => opt.value === this.modelValue);
            return selected ? selected.label : this.placeholder;
        }
    },
    mounted() {
        document.addEventListener('click', this.handleClickOutside);
    },
    beforeUnmount() {
        document.removeEventListener('click', this.handleClickOutside);
    },
    methods: {
        toggleDropdown() {
            this.isOpen = !this.isOpen;
        },
        selectOption(value) {
            this.$emit('update:modelValue', value);
            this.$emit('change', value);
            this.isOpen = false;
        },
        handleClickOutside(e) {
            if (!this.$el.contains(e.target)) {
                this.isOpen = false;
            }
        }
    }
};
</script>

<style scoped>
.custom-select {
    position: relative;
}

.custom-select-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 32px;
    padding: 0 12px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    box-sizing: border-box;
}

.custom-select-trigger:hover {
    border-color: var(--el-color-primary-light-5);
}

.custom-select.is-open .custom-select-trigger {
    border-color: var(--el-color-primary);
}

.custom-select-value {
    font-size: 14px;
    color: var(--el-text-color-regular);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.custom-select-value.is-placeholder {
    color: var(--el-text-color-placeholder);
}

.custom-select-arrow {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    transition: transform 0.2s ease;
    flex-shrink: 0;
    margin-left: 8px;
}

.custom-select.is-open .custom-select-arrow {
    transform: rotate(180deg);
}

.custom-select-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    width: 100%;
    background: var(--el-bg-color-overlay);
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    box-shadow: var(--el-box-shadow-light);
    z-index: 2000;
    overflow: hidden;
}

.custom-select-option {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 34px;
    padding: 0 12px;
    font-size: 14px;
    color: var(--el-text-color-regular);
    cursor: pointer;
    transition: background 0.2s ease;
}

.custom-select-option:hover {
    background: var(--el-fill-color-light);
}

.custom-select-option.is-selected {
    color: var(--el-color-primary);
    font-weight: 500;
}

.option-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
}

/* 下拉框动画 */
.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
    transition: opacity 0.2s ease, transform 0.2s ease;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
    opacity: 0;
    transform: translateY(-8px);
}
</style>
