// 文件管理器工具类
import fetchWithAuth from '@/utils/fetchWithAuth';
import { ElMessage } from 'element-plus';

class FileManager {
    constructor() {
        this.FILE_LIST_PATH = 'data/fileList.json';
    }

    // 从本地存储读取文件列表
    getLocalFileList() {
        try {
            const fileList = localStorage.getItem(this.FILE_LIST_PATH);
            return fileList ? JSON.parse(fileList) : { files: [], directories: [] };
        } catch (error) {
            console.error('Error reading local file list:', error);
            return { files: [], directories: [] };
        }
    }

    // 保存文件列表到本地存储
    saveFileList(fileList) {
        try {
            localStorage.setItem(this.FILE_LIST_PATH, JSON.stringify(fileList));
            return true;
        } catch (error) {
            console.error('Error saving file list:', error);
            return false;
        }
    }

    // 添加新文件到列表
    addFile(newFile) {
        try {
            const fileList = this.getLocalFileList();
            fileList.files.push(newFile);
            return this.saveFileList(fileList);
        } catch (error) {
            console.error('Error adding file:', error);
            return false;
        }
    }

    // 添加新文件夹
    addFolder(folderName) {
        try {
            const fileList = this.getLocalFileList();
            if (!fileList.directories.includes(folderName)) {
                fileList.directories.push(folderName);
                return this.saveFileList(fileList);
            }
            return false; // 文件夹已存在
        } catch (error) {
            console.error('Error adding folder:', error);
            return false;
        }
    }

    // 移动文件或文件夹
    moveFile(oldPath, newPath, isFolder = false, currentPath = '') {
        try {
            let fileList = this.getLocalFileList();
            
            if (isFolder) {
                // 更新目录列表
                const oldFolderIndex = fileList.directories.indexOf(oldPath);
                if (oldFolderIndex !== -1) {
                    fileList.directories.splice(oldFolderIndex, 1);
                }

            } else {
                // 移动单个文件
                const fileIndex = fileList.files.findIndex(file => file.name === oldPath);
                if (fileIndex !== -1) {
                    // 从旧位置移除
                    fileList.files.splice(fileIndex, 1);
                }

            }

            // 如果新路径包含当前目录的直接子目录，则添加直接子目录
            if (newPath.startsWith(currentPath)) {
                const pathArray = newPath.substring(currentPath.length).split('/');
                if (pathArray.length > 1) {
                    const newFolder = currentPath + pathArray[0];
                    if (!fileList.directories.includes(newFolder)) {
                        fileList.directories.push(newFolder);
                    }
                }
            }

            return this.saveFileList(fileList);
        } catch (error) {
            console.error('Error moving file:', error);
            return false;
        }
    }

    // 从列表中删除文件
    removeFile(fileName) {
        try {
            let fileList = this.getLocalFileList();
            fileList.files = fileList.files.filter(file => file.name !== fileName);
            return this.saveFileList(fileList);
        } catch (error) {
            console.error('Error removing file:', error);
            return false;
        }
    }

    // 从列表中删除文件夹（同时删除该文件夹下的所有文件）
    removeFolder(folderName) {
        try {
            let fileList = this.getLocalFileList();
            fileList.files = fileList.files.filter(file => !file.name.startsWith(folderName + '/'));
            fileList.directories = fileList.directories.filter(dir => dir !== folderName);
            return this.saveFileList(fileList);
        } catch (error) {
            console.error('Error removing folder:', error);
            return false;
        }
    }

    // 获取指定目录下的文件和子目录
    getFilesInFolder(folderName) {
        try {
            const fileList = this.getLocalFileList();
            const files = fileList.files.filter(file => file.name.startsWith(folderName + '/'));
            const subdirectories = fileList.directories.filter(dir => dir.startsWith(folderName + '/'));
            return { files, directories: subdirectories };
        } catch (error) {
            console.error('Error getting files in folder:', error);
            return { files: [], directories: [] };
        }
    }

    // 构建筛选参数URL
    buildFilterParams(filters) {
        let params = '';
        // 访问状态筛选（综合判断）
        if (filters.accessStatus && filters.accessStatus.length > 0) {
            params += `&accessStatus=${encodeURIComponent(filters.accessStatus.join(','))}`;
        }
        // 黑白名单筛选（直接使用 ListType 字段）
        if (filters.listType && filters.listType.length > 0) {
            params += `&listType=${encodeURIComponent(filters.listType.join(','))}`;
        }
        if (filters.label && filters.label.length > 0) {
            params += `&label=${encodeURIComponent(filters.label.join(','))}`;
        }
        if (filters.fileType && filters.fileType.length > 0) {
            params += `&fileType=${encodeURIComponent(filters.fileType.join(','))}`;
        }
        if (filters.channel && filters.channel.length > 0) {
            params += `&channel=${encodeURIComponent(filters.channel.join(','))}`;
        }
        if (filters.channelName && filters.channelName.length > 0) {
            params += `&channelName=${encodeURIComponent(filters.channelName.join(','))}`;
        }
        return params;
    }

    // 更新文件列表
    async refreshFileList(dir, search = '', includeTags = '', excludeTags = '', filters = {}) {
        search = search.trim();
        try {
            let url = `/api/manage/list?count=60&dir=${dir}&search=${encodeURIComponent(search)}`;
            if (includeTags) {
                url += `&includeTags=${encodeURIComponent(includeTags)}`;
            }
            if (excludeTags) {
                url += `&excludeTags=${encodeURIComponent(excludeTags)}`;
            }
            // 添加筛选参数（支持多选）
            url += this.buildFilterParams(filters);
            
            const response = await fetchWithAuth(url, {
                method: 'GET',
            });
            const newFileList = await response.json();
            if (!newFileList.isIndexedResponse) {
                ElMessage.warning('索引构建中，当前搜索和排序结果可能不准确，请稍后再试。');
            }
            // 保存包含新字段的完整数据
            return this.saveFileList(newFileList);
        } catch (error) {
            console.error('Error refreshing file list:', error);
            return false;
        }
    }

    // 读取更多数据
    async loadMoreFiles(dir, search = '', includeTags = '', excludeTags = '', count = 60, filters = {}) {
        search = search.trim();
        try {
            const fileList = this.getLocalFileList();
            const start = fileList.files.length;

            let url = `/api/manage/list?dir=${dir}&start=${start}&count=${count}&search=${encodeURIComponent(search)}`;
            if (includeTags) {
                url += `&includeTags=${encodeURIComponent(includeTags)}`;
            }
            if (excludeTags) {
                url += `&excludeTags=${encodeURIComponent(excludeTags)}`;
            }
            // 添加筛选参数（支持多选）
            url += this.buildFilterParams(filters);

            const response = await fetchWithAuth(url, {
                method: 'GET',
            });
           
            const moreFiles = await response.json();
            fileList.files.push(...moreFiles.files);
            return this.saveFileList(fileList);
        } catch (error) {
            console.error('Error loading more files:', error);
            return { files: [], directories: [] };
        }
    }
}

export const fileManager = new FileManager();
