// 主应用逻辑
const App = {
  productData: [],
  headerMap: {},
  selectedRows: new Set(),
  dragState: {
    isDragging: false,
    startIndex: null,
    startChecked: null
  },
  filterState: {
    qualityLevels: [],
    actualSuggestedOrder: {
      operator: '=',
      value: null
    },
    search: {
      supplierCode: '',
      skc: ''
    }
  },
  filteredIndicesMap: new Map(),

  // 初始化应用
  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
    } else {
      this.setupEventListeners();
    }
  },

  // 设置事件监听器
  setupEventListeners() {
    document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileSelect(e));

    const uploadSection = document.getElementById('uploadSection');
    uploadSection.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadSection.classList.add('dragover');
    });
    uploadSection.addEventListener('dragleave', () => {
      uploadSection.classList.remove('dragover');
    });
    uploadSection.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadSection.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length > 0 && (files[0].name.endsWith('.xls') || files[0].name.endsWith('.xlsx'))) {
        this.handleFile(files[0]);
      }
    });

    // 设置tooltip位置计算
    this.setupTooltipPositioning();
    
    // 设置复选框拖动选择
    this.setupCheckboxDrag();
    
    // 设置筛选和搜索事件监听
    this.setupFilterListeners();
  },

  // 设置tooltip位置计算
  setupTooltipPositioning() {
    let scrollHandler = null;
    let resizeHandler = null;
    let currentIcon = null;

    const handleMouseEnter = (e) => {
      const icon = e.target.closest('.formula-icon');
      if (icon && icon !== currentIcon) {
        currentIcon = icon;
        const tooltip = icon.querySelector('.formula-tooltip');
        if (tooltip) {
          const updatePosition = () => {
            const rect = icon.getBoundingClientRect();
            tooltip.style.visibility = 'visible';
            const tooltipHeight = tooltip.offsetHeight || 100;
            const left = rect.left + rect.width / 2;
            const top = rect.top - tooltipHeight - 8;
            
            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';
            tooltip.style.transform = 'translateX(-50%)';
          };

          setTimeout(() => {
            updatePosition();
            
            scrollHandler = () => updatePosition();
            resizeHandler = () => updatePosition();
            window.addEventListener('scroll', scrollHandler, true);
            window.addEventListener('resize', resizeHandler);
          }, 10);
        }
      }
    };

    const handleMouseLeave = (e) => {
      const icon = e.target.closest('.formula-icon');
      if (icon && icon === currentIcon) {
        currentIcon = null;
        const tooltip = icon.querySelector('.formula-tooltip');
        if (tooltip) {
          tooltip.style.visibility = 'hidden';
        }
        if (scrollHandler) {
          window.removeEventListener('scroll', scrollHandler, true);
          scrollHandler = null;
        }
        if (resizeHandler) {
          window.removeEventListener('resize', resizeHandler);
          resizeHandler = null;
        }
      }
    };

    document.addEventListener('mouseenter', handleMouseEnter, true);
    document.addEventListener('mouseleave', handleMouseLeave, true);
  },

  // 文件选择处理
  handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
      this.handleFile(file);
    }
  },

  // 处理Excel文件
  handleFile(file) {
    if (!XLSXLoader.checkLoaded()) {
      document.getElementById('skeletonWrapper').style.display = 'none';
      document.getElementById('emptyState').style.display = 'block';
      alert('Excel解析库未加载，请刷新页面重试');
      return;
    }

    TableRenderer.showSkeleton();
    TableRenderer.displayedCount = 0;
    TableRenderer.isLoading = false;
    this.updateFileButtonCount(0);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        if (typeof XLSX === 'undefined') {
          throw new Error('SheetJS库未加载，请刷新页面重试');
        }

        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellText: false, cellDates: false });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false, defval: '' });
        
        if (jsonData.length < 2) {
          this.updateFileButtonCount(0);
          return;
        }

        const headers = jsonData[0];
        this.headerMap = FileParser.parseHeaders(headers);

        const validation = FileParser.validateRequiredFields(this.headerMap);
        if (!validation.isValid) {
          this.updateFileButtonCount(0);
          return;
        }

        this.productData = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;

          const product = FileParser.parseProductRow(row, this.headerMap, firstSheet, i);
          Calculator.calculateSuggestedOrder(product);
          
          if (product.rawSuggestedOrder >= 0) {
            this.productData.push(product);
          }
        }

        if (this.productData.length === 0) {
          document.getElementById('skeletonWrapper').style.display = 'none';
          document.getElementById('emptyState').style.display = 'block';
          this.updateFileButtonCount(0);
          return;
        }

        this.selectedRows.clear();
        this.resetFilterState();
        this.updateFileButtonCount(this.productData.length);
        document.getElementById('skeletonWrapper').style.display = 'none';
        document.getElementById('tableWrapper').style.display = 'block';
        document.getElementById('filterSection').style.display = 'block';
        document.getElementById('exportBtn').style.display = 'inline-block';
        document.getElementById('deleteBtn').style.display = 'inline-block';
        
        this.initFilterUI();
        this.applyFiltersAndRender();
        
        setTimeout(() => {
          this.updateSelectAllCheckbox();
          this.updateDeleteButton();
        }, 100);
      } catch (error) {
        this.updateFileButtonCount(0);
        document.getElementById('skeletonWrapper').style.display = 'none';
        document.getElementById('emptyState').style.display = 'block';
        console.error('文件处理失败:', error);
        const errorMsg = error.message || '文件处理失败，请检查文件格式是否正确';
        alert('导入失败：' + errorMsg);
      }
    };
    reader.readAsArrayBuffer(file);
  },

  // 更新文件选择按钮显示的数据条数
  updateFileButtonCount(count) {
    const countDisplay = document.getElementById('dataCountDisplay');
    if (count && count > 0) {
      countDisplay.textContent = `（${count}条）`;
    } else {
      countDisplay.textContent = '';
    }
  },

  // 清空数据
  clearData() {
    this.productData = [];
    this.headerMap = {};
    this.selectedRows.clear();
    this.resetFilterState();
    TableRenderer.displayedCount = 0;
    TableRenderer.isLoading = false;
    document.getElementById('tableWrapper').style.display = 'none';
    document.getElementById('skeletonWrapper').style.display = 'none';
    document.getElementById('filterSection').style.display = 'none';
    document.getElementById('emptyState').style.display = 'block';
    document.getElementById('fileInput').value = '';
    document.getElementById('exportBtn').style.display = 'none';
    document.getElementById('deleteBtn').style.display = 'none';
    document.getElementById('selectAllCheckbox').checked = false;
    this.updateFileButtonCount(0);
    this.updateDeleteButton();
  },

  // 切换行选中状态
  toggleRowSelection(index, checked) {
    const originalIndex = this.getOriginalIndex(index);
    if (checked) {
      this.selectedRows.add(originalIndex);
    } else {
      this.selectedRows.delete(originalIndex);
    }
    this.updateRowStyle(index, checked);
    this.updateSelectAllCheckbox();
    this.updateDeleteButton();
  },

  // 获取原始数据索引
  getOriginalIndex(filteredIndex) {
    if (this.filteredIndicesMap && this.filteredIndicesMap.has(filteredIndex)) {
      return this.filteredIndicesMap.get(filteredIndex);
    }
    return filteredIndex;
  },

  // 更新行样式
  updateRowStyle(index, selected) {
    const tbody = document.getElementById('tableBody');
    const row = tbody.querySelector(`tr[data-index="${index}"]`);
    if (row) {
      if (selected) {
        row.classList.add('selected');
      } else {
        row.classList.remove('selected');
      }
      const checkbox = row.querySelector('input[type="checkbox"]');
      if (checkbox) {
        checkbox.checked = selected;
      }
    }
  },

  // 更新全选复选框状态
  updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (!selectAllCheckbox) return;
    
    const filteredData = FilterService.applyFilters(this.productData, this.filterState);
    const filteredCount = filteredData.length;
    
    let selectedInFiltered = 0;
    if (this.filteredIndicesMap) {
      filteredData.forEach((item, filteredIndex) => {
        const originalIndex = this.filteredIndicesMap.get(filteredIndex);
        if (this.selectedRows.has(originalIndex)) {
          selectedInFiltered++;
        }
      });
    } else {
      filteredData.forEach((item, index) => {
        if (this.selectedRows.has(index)) {
          selectedInFiltered++;
        }
      });
    }
    
    if (filteredCount === 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    } else if (selectedInFiltered === 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    } else if (selectedInFiltered === filteredCount) {
      selectAllCheckbox.checked = true;
      selectAllCheckbox.indeterminate = false;
    } else {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = true;
    }
  },

  // 全选/取消全选
  toggleSelectAll(checked) {
    const tbody = document.getElementById('tableBody');
    const checkboxes = tbody.querySelectorAll('input[type="checkbox"]');
    
    checkboxes.forEach((checkbox) => {
      const filteredIndex = parseInt(checkbox.dataset.index);
      if (filteredIndex !== undefined && !isNaN(filteredIndex)) {
        checkbox.checked = checked;
        const originalIndex = this.getOriginalIndex(filteredIndex);
        if (checked) {
          this.selectedRows.add(originalIndex);
        } else {
          this.selectedRows.delete(originalIndex);
        }
        this.updateRowStyle(filteredIndex, checked);
      }
    });
    
    this.updateDeleteButton();
  },

  // 更新删除按钮状态
  updateDeleteButton() {
    const deleteBtn = document.getElementById('deleteBtn');
    const selectedCount = this.selectedRows.size;
    
    if (selectedCount > 0) {
      deleteBtn.disabled = false;
      deleteBtn.textContent = `删除选中（${selectedCount}条）`;
      deleteBtn.style.display = 'inline-block';
    } else {
      deleteBtn.disabled = true;
      deleteBtn.textContent = '删除选中';
    }
  },

  // 设置复选框拖动选择
  setupCheckboxDrag() {
    let isDragging = false;
    let startIndex = null;
    let startChecked = null;
    let lastProcessedIndex = null;
    let startY = null;
    let startX = null;
    let hasMoved = false;

    const handleMouseDown = (e) => {
      const checkboxCell = e.target.closest('.checkbox-cell');
      if (!checkboxCell) return;
      
      const checkbox = checkboxCell.querySelector('input[type="checkbox"]');
      if (!checkbox) return;
      
      const index = parseInt(checkbox.dataset.index);
      if (isNaN(index)) return;
      
      isDragging = true;
      startIndex = index;
      startChecked = checkbox.checked;
      lastProcessedIndex = index;
      startY = e.clientY;
      startX = e.clientX;
      hasMoved = false;
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e) => {
      if (!isDragging) return;
      
      const deltaY = Math.abs(e.clientY - startY);
      const deltaX = Math.abs(e.clientX - startX);
      
      if (deltaY < 5 && deltaX < 5) {
        return;
      }
      
      hasMoved = true;
      
      if (deltaX > deltaY) {
        return;
      }
      
      const checkboxCell = e.target.closest('.checkbox-cell');
      if (!checkboxCell) return;
      
      const checkbox = checkboxCell.querySelector('input[type="checkbox"]');
      if (!checkbox) return;
      
      const currentIndex = parseInt(checkbox.dataset.index);
      if (isNaN(currentIndex)) return;
      
      if (currentIndex === lastProcessedIndex) return;
      
      const minIndex = Math.min(startIndex, currentIndex);
      const maxIndex = Math.max(startIndex, currentIndex);
      const tbody = document.getElementById('tableBody');
      const checkboxes = tbody.querySelectorAll('.checkbox-cell input[type="checkbox"]');
      
      checkboxes.forEach((checkbox) => {
        const index = parseInt(checkbox.dataset.index);
        if (index >= minIndex && index <= maxIndex) {
          const shouldBeChecked = !startChecked;
          if (checkbox.checked !== shouldBeChecked) {
            checkbox.checked = shouldBeChecked;
            this.toggleRowSelection(index, shouldBeChecked);
          }
        }
      });
      
      lastProcessedIndex = currentIndex;
    };

    const handleMouseUp = () => {
      isDragging = false;
      startIndex = null;
      startChecked = null;
      lastProcessedIndex = null;
      startY = null;
      startX = null;
      hasMoved = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousedown', handleMouseDown);
  },

  // 删除选中的行
  deleteSelectedRows() {
    const selectedCount = this.selectedRows.size;
    if (selectedCount === 0) return;
    
    const confirmMsg = selectedCount === 1 
      ? '确定要删除这条数据吗？'
      : `确定要删除选中的 ${selectedCount} 条数据吗？`;
    
    if (!confirm(confirmMsg)) {
      return;
    }
    
    const sortedIndices = Array.from(this.selectedRows).sort((a, b) => b - a);
    
    sortedIndices.forEach((index) => {
      this.productData.splice(index, 1);
    });
    
    this.selectedRows.clear();
    
    if (this.productData.length === 0) {
      this.clearData();
      return;
    }
    
    this.updateFileButtonCount(this.productData.length);
    this.applyFiltersAndRender();
  },

  // 重置筛选状态
  resetFilterState() {
    this.filterState = {
      qualityLevels: [],
      actualSuggestedOrder: {
        operator: '=',
        value: null
      },
      search: {
        supplierCode: '',
        skc: ''
      }
    };
  },

  // 初始化筛选UI
  initFilterUI() {
    const qualityLevels = FilterService.extractUniqueValues(this.productData, 'qualityLevel');
    const qualityOptions = document.getElementById('qualityLevelOptions');
    qualityOptions.innerHTML = '';
    
    qualityLevels.forEach(level => {
      const optionDiv = document.createElement('div');
      optionDiv.className = 'quality-level-option';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `quality-${level}`;
      checkbox.value = level;
      checkbox.addEventListener('change', () => {
        this.updateQualityLevelSelection();
      });
      
      const label = document.createElement('label');
      label.htmlFor = `quality-${level}`;
      label.textContent = level;
      
      optionDiv.appendChild(checkbox);
      optionDiv.appendChild(label);
      qualityOptions.appendChild(optionDiv);
    });
    
    this.updateQualityLevelButtonText();
  },

  // 更新质量等级选择
  updateQualityLevelSelection() {
    const checkboxes = document.querySelectorAll('#qualityLevelOptions input[type="checkbox"]');
    const selected = Array.from(checkboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.value);
    
    this.filterState.qualityLevels = selected;
    this.updateQualityLevelButtonText();
    this.applyFiltersAndRender();
  },

  // 更新质量等级按钮文本
  updateQualityLevelButtonText() {
    const countEl = document.getElementById('qualityLevelCount');
    const count = this.filterState.qualityLevels.length;
    
    if (count > 0) {
      countEl.textContent = `（已选${count}项）`;
    } else {
      countEl.textContent = '';
    }
  },

  // 全选质量等级
  selectAllQualityLevels() {
    const checkboxes = document.querySelectorAll('#qualityLevelOptions input[type="checkbox"]');
    checkboxes.forEach(cb => {
      cb.checked = true;
    });
    this.updateQualityLevelSelection();
  },

  // 清空质量等级选择
  clearQualityLevels() {
    const checkboxes = document.querySelectorAll('#qualityLevelOptions input[type="checkbox"]');
    checkboxes.forEach(cb => {
      cb.checked = false;
    });
    this.updateQualityLevelSelection();
  },

  // 设置筛选和搜索事件监听
  setupFilterListeners() {
    // 点击外部关闭质量等级下拉
    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('qualityLevelDropdown');
      const toggle = document.getElementById('qualityLevelToggle');
      if (dropdown && toggle && !dropdown.contains(e.target) && !toggle.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });

    const actualOrderOperator = document.getElementById('actualOrderOperator');
    const actualOrderValue = document.getElementById('actualOrderValue');
    if (actualOrderOperator && actualOrderValue) {
      actualOrderOperator.addEventListener('change', () => {
        this.filterState.actualSuggestedOrder.operator = actualOrderOperator.value;
        this.applyFiltersAndRender();
      });
      actualOrderValue.addEventListener('input', () => {
        const value = actualOrderValue.value === '' ? null : Number(actualOrderValue.value);
        this.filterState.actualSuggestedOrder.value = value;
        this.applyFiltersAndRender();
      });
    }

    const supplierCodeSearch = document.getElementById('supplierCodeSearch');
    if (supplierCodeSearch) {
      supplierCodeSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.searchAll();
        }
      });
    }

    const skcSearch = document.getElementById('skcSearch');
    if (skcSearch) {
      skcSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.searchAll();
        }
      });
    }
  },

  // 应用筛选和搜索并渲染
  applyFiltersAndRender() {
    const filteredData = FilterService.applyFilters(this.productData, this.filterState);
    
    const filteredIndices = new Map();
    filteredData.forEach((item, filteredIndex) => {
      const originalIndex = this.productData.indexOf(item);
      if (originalIndex !== -1) {
        filteredIndices.set(filteredIndex, originalIndex);
      }
    });
    
    this.filteredIndicesMap = filteredIndices;
    
    this.updateFileButtonCount(filteredData.length);
    TableRenderer.renderLazy(filteredData, filteredIndices);
    
    setTimeout(() => {
      this.updateSelectAllCheckbox();
      this.updateDeleteButton();
    }, 100);
  },

  // 清除筛选
  clearFilters() {
    this.filterState.qualityLevels = [];
    this.filterState.actualSuggestedOrder = {
      operator: '=',
      value: null
    };
    
    const checkboxes = document.querySelectorAll('#qualityLevelOptions input[type="checkbox"]');
    checkboxes.forEach(cb => {
      cb.checked = false;
    });
    
    const actualOrderValue = document.getElementById('actualOrderValue');
    if (actualOrderValue) {
      actualOrderValue.value = '';
    }
    
    this.updateQualityLevelButtonText();
    this.applyFiltersAndRender();
  },

  // 统一搜索（同时搜索供货方号和SKC）
  searchAll() {
    const supplierCodeInput = document.getElementById('supplierCodeSearch');
    const skcInput = document.getElementById('skcSearch');
    
    if (supplierCodeInput) {
      this.filterState.search.supplierCode = supplierCodeInput.value;
    }
    if (skcInput) {
      this.filterState.search.skc = skcInput.value;
    }
    
    this.applyFiltersAndRender();
  },

  // 清除搜索
  clearSearch() {
    this.filterState.search.supplierCode = '';
    this.filterState.search.skc = '';
    
    const supplierCodeInput = document.getElementById('supplierCodeSearch');
    if (supplierCodeInput) {
      supplierCodeInput.value = '';
    }
    
    const skcInput = document.getElementById('skcSearch');
    if (skcInput) {
      skcInput.value = '';
    }
    
    this.applyFiltersAndRender();
  },

  // 导出Excel（导出当前筛选后的数据）
  exportToExcel() {
    const filteredData = FilterService.applyFilters(this.productData, this.filterState);
    ExcelService.exportToExcel(filteredData);
  }
};

// 全局函数（供HTML调用）
function clearData() {
  App.clearData();
}

function exportToExcel() {
  App.exportToExcel();
}

function toggleSelectAll(checked) {
  App.toggleSelectAll(checked);
}

function deleteSelectedRows() {
  App.deleteSelectedRows();
}

function clearFilters() {
  App.clearFilters();
}

function searchAll() {
  App.searchAll();
}

function clearSearch() {
  App.clearSearch();
}

function toggleQualityLevelDropdown() {
  const dropdown = document.getElementById('qualityLevelDropdown');
  const toggle = document.getElementById('qualityLevelToggle');
  
  if (!dropdown || !toggle) return;
  
  const isVisible = dropdown.style.display === 'block';
  
  if (isVisible) {
    dropdown.style.display = 'none';
    window.removeEventListener('scroll', updateQualityDropdownPosition, true);
    window.removeEventListener('resize', updateQualityDropdownPosition);
  } else {
    updateQualityDropdownPosition();
    dropdown.style.display = 'block';
    window.addEventListener('scroll', updateQualityDropdownPosition, true);
    window.addEventListener('resize', updateQualityDropdownPosition);
  }
}

// 更新质量等级下拉框位置
function updateQualityDropdownPosition() {
  const dropdown = document.getElementById('qualityLevelDropdown');
  const toggle = document.getElementById('qualityLevelToggle');
  
  if (!dropdown || !toggle || dropdown.style.display === 'none') return;
  
  const toggleRect = toggle.getBoundingClientRect();
  const dropdownHeight = dropdown.offsetHeight || 300;
  const viewportHeight = window.innerHeight;
  
  let top = toggleRect.bottom + 4;
  let left = toggleRect.left;
  
  // 如果下方空间不足，显示在上方
  if (top + dropdownHeight > viewportHeight) {
    top = toggleRect.top - dropdownHeight - 4;
  }
  
  // 确保不超出视口右边界
  const dropdownWidth = dropdown.offsetWidth || 200;
  if (left + dropdownWidth > window.innerWidth) {
    left = window.innerWidth - dropdownWidth - 10;
  }
  
  // 确保不超出视口左边界
  if (left < 10) {
    left = 10;
  }
  
  dropdown.style.top = top + 'px';
  dropdown.style.left = left + 'px';
}

function selectAllQualityLevels() {
  App.selectAllQualityLevels();
}

function clearQualityLevels() {
  App.clearQualityLevels();
}

// 初始化SheetJS库加载
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    XLSXLoader.load();
    App.init();
  });
} else {
  XLSXLoader.load();
  App.init();
}
