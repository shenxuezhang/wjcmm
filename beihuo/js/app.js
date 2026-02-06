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
      operator: '<',
      value: null
    },
    search: {
      supplierCode: '',
      skc: ''
    }
  },
  filteredIndicesMap: new Map(),
  statistics: {
    totalImported: 0,      // 导入总数据量
    eliminated: 0,         // 淘汰数据量
    qualified: 0,          // 入围数据量（当前productData.length）
    deleted: 0            // 已删除数据量
  },
  eliminationThreshold: 0, // 淘汰阈值，默认0
  filterDebounceTimer: null, // 筛选防抖定时器
  _processingStats: { totalRows: 0, qualifiedCount: 0 }, // 数据处理统计（临时）

  // 初始化应用
  init() {
    // 从localStorage加载设置
    this.loadSettings();
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
    } else {
      this.setupEventListeners();
    }
  },

  // 加载设置
  loadSettings() {
    const savedThreshold = localStorage.getItem('eliminationThreshold');
    if (savedThreshold !== null) {
      const threshold = Number(savedThreshold);
      if (!isNaN(threshold) && isFinite(threshold)) {
        this.eliminationThreshold = threshold;
      }
    }
  },

  // 保存设置
  saveSettings(threshold) {
    const numThreshold = Number(threshold);
    if (!isNaN(numThreshold) && isFinite(numThreshold)) {
      this.eliminationThreshold = numThreshold;
      localStorage.setItem('eliminationThreshold', numThreshold.toString());
      return true;
    }
    return false;
  },

  // 获取淘汰阈值
  getEliminationThreshold() {
    return this.eliminationThreshold;
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
    
    // 设置输入框清除按钮
    this.setupInputClearButtons();
  },

  // 设置输入框清除按钮
  setupInputClearButtons() {
    const inputs = ['supplierCodeSearch', 'skcSearch', 'actualOrderValue'];
    inputs.forEach(inputId => {
      const input = document.getElementById(inputId);
      if (input) {
        // 初始状态
        this.updateInputClearButton(inputId);
        
        // 输入时更新
        input.addEventListener('input', () => {
          this.updateInputClearButton(inputId);
        });
        
        // 失去焦点时更新
        input.addEventListener('blur', () => {
          setTimeout(() => this.updateInputClearButton(inputId), 100);
        });
      }
    });
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
            
            // 先临时显示tooltip以获取实际尺寸
            tooltip.style.visibility = 'visible';
            tooltip.style.opacity = '0';
            tooltip.style.left = '0';
            tooltip.style.top = '0';
            
            // 获取tooltip的实际尺寸
            const tooltipRect = tooltip.getBoundingClientRect();
            const tooltipWidth = tooltipRect.width || tooltip.offsetWidth || 300;
            const tooltipHeight = tooltipRect.height || tooltip.offsetHeight || 100;
            
            // 获取视口尺寸
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // 计算初始位置（图标中心上方）
            let left = rect.left + rect.width / 2;
            let top = rect.top - tooltipHeight - 8;
            
            // 边界检测和调整
            const padding = 10; // 距离视口边缘的最小距离
            
            // 水平方向调整：确保tooltip不超出左右边界
            const tooltipHalfWidth = tooltipWidth / 2;
            if (left - tooltipHalfWidth < padding) {
              // 超出左边界，调整到左边界
              left = tooltipHalfWidth + padding;
            } else if (left + tooltipHalfWidth > viewportWidth - padding) {
              // 超出右边界，调整到右边界
              left = viewportWidth - tooltipHalfWidth - padding;
            }
            
            // 垂直方向调整：确保tooltip不超出上下边界
            let showBelow = false;
            if (top < padding) {
              // 超出上边界，显示在图标下方
              top = rect.bottom + 8;
              showBelow = true;
              
              // 如果下方也超出，调整到视口内
              if (top + tooltipHeight > viewportHeight - padding) {
                top = viewportHeight - tooltipHeight - padding;
                showBelow = false;
              }
            } else if (top + tooltipHeight > viewportHeight - padding) {
              // 超出下边界，调整到视口内
              top = viewportHeight - tooltipHeight - padding;
              showBelow = false;
            }
            
            // 根据显示位置调整箭头
            if (showBelow) {
              tooltip.classList.add('tooltip-below');
            } else {
              tooltip.classList.remove('tooltip-below');
            }
            
            // 设置最终位置并显示
            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';
            tooltip.style.transform = 'translateX(-50%)';
            tooltip.style.opacity = '1';
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
      showError('Excel解析库未加载', 'Excel解析库未加载，请刷新页面重试。', '如果问题持续存在，请检查网络连接或联系技术支持。');
      return;
    }

    TableRenderer.showSkeleton();
    TableRenderer.currentDisplayedData = [];
    this.updateFileButtonCount(0);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
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
          document.getElementById('skeletonWrapper').style.display = 'none';
          document.getElementById('emptyState').style.display = 'block';
          showError('文件数据为空', '导入的Excel文件没有数据行，请检查文件内容。', 'Excel文件必须包含表头和数据行，至少需要2行（1行表头 + 1行数据）。');
          return;
        }

        const headers = jsonData[0];
        this.headerMap = FileParser.parseHeaders(headers);
        const validation = FileParser.validateRequiredFields(this.headerMap);
        if (!validation.isValid) {
          this.updateFileButtonCount(0);
          document.getElementById('skeletonWrapper').style.display = 'none';
          document.getElementById('emptyState').style.display = 'block';
          const missingFieldNames = validation.missingFields.map(field => FIELD_NAME_MAP[field] || field);
          showError('文件验证失败', 'Excel文件缺少必需字段，请检查表头是否正确。', missingFieldNames);
          return;
        }

        this.productData = [];
        let totalRows = 0; // 统计总数据行数（不包括表头）
        let qualifiedCount = 0; // 统计符合条件的数据量
        
        // 显示进度条
        const totalDataRows = jsonData.length - 1; // 总数据行数（不包括表头）
        this.showProgressBar();
        this.updateProgress(0, totalDataRows, '正在解析数据...');
        
        // 分批处理数据，避免阻塞UI
        await this.processDataWithProgress(jsonData, firstSheet, totalDataRows);
        
        // 从进度中获取统计结果
        totalRows = this._processingStats.totalRows || 0;
        qualifiedCount = this._processingStats.qualifiedCount || 0;

        // 更新统计数据
        this.statistics.totalImported = totalRows;
        this.statistics.eliminated = totalRows - qualifiedCount;
        this.statistics.qualified = qualifiedCount;
        this.statistics.deleted = 0; // 每次导入时重置已删除数据量

        if (this.productData.length === 0) {
          document.getElementById('skeletonWrapper').style.display = 'none';
          document.getElementById('emptyState').style.display = 'block';
          this.updateFileButtonCount(0);
          this.updateStatisticsDisplay();
          return;
        }

        this.selectedRows.clear();
        this.resetFilterState();
        this.updateFileButtonCount(this.productData.length);
        this.updateFileNameDisplay(file.name);
        document.getElementById('skeletonWrapper').style.display = 'none';
        document.getElementById('tableWrapper').style.display = 'block';
        document.getElementById('filterSection').style.display = 'block';
        document.getElementById('statisticsSection').style.display = 'block';
        document.getElementById('exportBtn').style.display = 'inline-block';
        document.getElementById('deleteBtn').style.display = 'inline-block';
        
        // 隐藏进度条
        this.hideProgressBar();
        
        this.initFilterUI();
        this.applyFiltersAndRender();
        this.updateStatisticsDisplay();
        
        setTimeout(() => {
          this.updateSelectAllCheckbox();
          this.updateDeleteButton();
        }, 100);
      } catch (error) {
        this.hideProgressBar();
        this.updateFileButtonCount(0);
        document.getElementById('skeletonWrapper').style.display = 'none';
        document.getElementById('emptyState').style.display = 'block';
        console.error('文件处理失败:', error);
        const errorMsg = error.message || '文件处理失败，请检查文件格式是否正确';
        showError('文件导入失败', errorMsg, '请确保文件格式为.xls或.xlsx，且文件未损坏。');
      }
    };
    reader.readAsArrayBuffer(file);
  },

  // 更新文件名显示
  updateFileNameDisplay(fileName) {
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    if (fileNameDisplay && fileName) {
      fileNameDisplay.textContent = fileName;
      fileNameDisplay.title = fileName; // 添加完整文件名的提示
    } else if (fileNameDisplay) {
      fileNameDisplay.textContent = '';
      fileNameDisplay.title = '';
    }
  },

  // 显示进度条
  showProgressBar() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    const progressBarWrapper = document.getElementById('progressBarWrapper');
    const loadingText = document.getElementById('loadingText');
    
    if (loadingOverlay) {
      loadingOverlay.style.display = 'flex';
    }
    if (progressBarWrapper) {
      progressBarWrapper.style.display = 'flex';
    }
    if (loadingText) {
      loadingText.textContent = '正在处理数据...';
    }
  },

  // 更新进度
  updateProgress(current, total, message) {
    const progressBarFill = document.getElementById('progressBarFill');
    const progressText = document.getElementById('progressText');
    const loadingText = document.getElementById('loadingText');
    
    if (total === 0) return;
    
    const percentage = Math.min(100, Math.round((current / total) * 100));
    
    if (progressBarFill) {
      progressBarFill.style.width = percentage + '%';
    }
    if (progressText) {
      progressText.textContent = `${percentage}%`;
    }
    if (loadingText && message) {
      loadingText.textContent = message;
    }
  },

  // 隐藏进度条
  hideProgressBar() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    const progressBarWrapper = document.getElementById('progressBarWrapper');
    
    if (loadingOverlay) {
      loadingOverlay.style.display = 'none';
    }
    if (progressBarWrapper) {
      progressBarWrapper.style.display = 'none';
    }
  },

  // 分批处理数据并显示进度
  async processDataWithProgress(jsonData, firstSheet, totalDataRows) {
    this._processingStats = { totalRows: 0, qualifiedCount: 0 };
    const batchSize = 50; // 每批处理50行
    
    for (let i = 1; i < jsonData.length; i += batchSize) {
      const endIndex = Math.min(i + batchSize, jsonData.length);
      
      // 处理当前批次
      for (let j = i; j < endIndex; j++) {
        const row = jsonData[j];
        if (!row || row.length === 0) continue;
        
        this._processingStats.totalRows++;
        
        const product = FileParser.parseProductRow(row, this.headerMap, firstSheet, j);
        
        // 淘汰机制1：检查"低销尾品不允许下单"字段
        const lowSalesValue = product.lowSalesNotAllowed;
        if (lowSalesValue !== undefined && lowSalesValue !== null && lowSalesValue !== '') {
          const trimmedValue = String(lowSalesValue).trim();
          if (trimmedValue.includes('是')) {
            continue; // 淘汰该行数据
          }
        }
        
        Calculator.calculateSuggestedOrder(product);
        
        // 淘汰机制2：严格检查 rawSuggestedOrder
        const rawOrder = product.rawSuggestedOrder;
        const threshold = this.getEliminationThreshold();
        if (rawOrder !== undefined && rawOrder !== null && 
            typeof rawOrder === 'number' && 
            !isNaN(rawOrder) && 
            isFinite(rawOrder) && 
            rawOrder >= threshold) {
          this.productData.push(product);
          this._processingStats.qualifiedCount++;
        }
      }
      
      // 更新进度
      const processed = Math.min(endIndex - 1, totalDataRows);
      const progressMessage = `正在处理数据... (${processed}/${totalDataRows})`;
      this.updateProgress(processed, totalDataRows, progressMessage);
      
      // 让出控制权，避免阻塞UI
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    // 完成时更新到100%
    this.updateProgress(totalDataRows, totalDataRows, '数据处理完成！');
    await new Promise(resolve => setTimeout(resolve, 200));
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

  // 更新统计数据显示
  updateStatisticsDisplay() {
    const totalImported = this.statistics.totalImported;
    const eliminated = this.statistics.eliminated;
    const qualified = this.statistics.qualified;
    const deleted = this.statistics.deleted;
    
    document.getElementById('statTotalImported').innerHTML = totalImported + ' <span style="font-size: 14px; font-weight: 400; color: #656d76;">条</span>';
    document.getElementById('statEliminated').innerHTML = eliminated + ' <span style="font-size: 14px; font-weight: 400; color: #656d76;">条</span>';
    document.getElementById('statQualified').innerHTML = qualified + ' <span style="font-size: 14px; font-weight: 400; color: #656d76;">条</span>';
    document.getElementById('statDeleted').innerHTML = deleted + ' <span style="font-size: 14px; font-weight: 400; color: #656d76;">条</span>';
    
    // 更新占比进度条
    if (totalImported > 0) {
      const eliminatedPercent = Math.round((eliminated / totalImported) * 100);
      const qualifiedPercent = Math.round((qualified / totalImported) * 100);
      
      const eliminatedProgress = document.getElementById('statEliminatedProgress');
      const eliminatedProgressFill = document.getElementById('statEliminatedProgressFill');
      const eliminatedProgressText = document.getElementById('statEliminatedProgressText');
      
      if (eliminatedProgress && eliminatedProgressFill && eliminatedProgressText) {
        eliminatedProgress.style.display = 'flex';
        eliminatedProgressFill.style.width = eliminatedPercent + '%';
        eliminatedProgressText.textContent = eliminatedPercent + '%';
      }
      
      const qualifiedProgress = document.getElementById('statQualifiedProgress');
      const qualifiedProgressFill = document.getElementById('statQualifiedProgressFill');
      const qualifiedProgressText = document.getElementById('statQualifiedProgressText');
      
      if (qualifiedProgress && qualifiedProgressFill && qualifiedProgressText) {
        qualifiedProgress.style.display = 'flex';
        qualifiedProgressFill.style.width = qualifiedPercent + '%';
        qualifiedProgressText.textContent = qualifiedPercent + '%';
      }
    } else {
      const eliminatedProgress = document.getElementById('statEliminatedProgress');
      const qualifiedProgress = document.getElementById('statQualifiedProgress');
      if (eliminatedProgress) eliminatedProgress.style.display = 'none';
      if (qualifiedProgress) qualifiedProgress.style.display = 'none';
    }
  },

  // 清空数据
  clearData() {
    const tableWrapper = document.getElementById('tableWrapper');
    if (tableWrapper && tableWrapper.style.display !== 'none') {
      // 添加缩放动画
      tableWrapper.classList.add('scaling');
      setTimeout(() => {
        tableWrapper.classList.remove('scaling');
      }, 300);
    }
    
    this.productData = [];
    this.headerMap = {};
    this.selectedRows.clear();
    this.resetFilterState();
    TableRenderer.currentDisplayedData = [];
    this.filteredIndicesMap.clear(); // 清空索引映射
    
    // 重置统计数据
    this.statistics.totalImported = 0;
    this.statistics.eliminated = 0;
    this.statistics.qualified = 0;
    this.statistics.deleted = 0;
    
    document.getElementById('tableWrapper').style.display = 'none';
    document.getElementById('skeletonWrapper').style.display = 'none';
    document.getElementById('filterSection').style.display = 'none';
    document.getElementById('statisticsSection').style.display = 'none';
    document.getElementById('emptyState').style.display = 'block';
    document.getElementById('fileInput').value = '';
    document.getElementById('exportBtn').style.display = 'none';
    document.getElementById('deleteBtn').style.display = 'none';
    document.getElementById('selectAllCheckbox').checked = false;
    this.updateFileButtonCount(0);
    this.updateFileNameDisplay('');
    this.updateStatisticsDisplay();
    this.updateDeleteButton();
  },

  // 切换行选中状态
  toggleRowSelection(index, checked) {
    const originalIndex = this.getOriginalIndex(index);
    if (originalIndex === -1 || originalIndex === undefined) return;
    
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
    // 如果 currentDisplayedData 存在，说明是筛选后的数据，需要通过产品对象查找原始索引
    if (TableRenderer.currentDisplayedData && TableRenderer.currentDisplayedData.length > 0) {
      const product = TableRenderer.currentDisplayedData[filteredIndex];
      if (product) {
        const originalIndex = this.productData.findIndex(p => p === product);
        if (originalIndex !== -1) {
          return originalIndex;
        }
      }
    }
    
    // 否则使用 filteredIndicesMap 或直接返回 filteredIndex
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

  // 更新全选复选框状态（基于所有筛选后的数据）
  updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (!selectAllCheckbox) return;
    
    // 获取所有筛选后的数据
    const filteredData = FilterService.applyFilters(this.productData, this.filterState);
    const filteredCount = filteredData.length;
    
    if (filteredCount === 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
      return;
    }
    
    // 统计所有筛选后数据中已选中的数量
    let selectedInFiltered = 0;
    filteredData.forEach((item) => {
      const originalIndex = this.productData.indexOf(item);
      if (originalIndex !== -1 && this.selectedRows.has(originalIndex)) {
        selectedInFiltered++;
      }
    });
    
    // 更新已显示行的复选框状态
    const tbody = document.getElementById('tableBody');
    const rows = tbody ? tbody.querySelectorAll('tr') : [];
    rows.forEach((row) => {
      if (row.style.display === 'none') return;
      
      const checkbox = row.querySelector('input[type="checkbox"]');
      if (checkbox) {
        const filteredIndex = parseInt(checkbox.dataset.index);
        if (filteredIndex !== undefined && !isNaN(filteredIndex)) {
          const product = TableRenderer.currentDisplayedData[filteredIndex];
          if (product) {
            const originalIndex = this.productData.indexOf(product);
            if (originalIndex !== -1) {
              checkbox.checked = this.selectedRows.has(originalIndex);
              if (checkbox.checked) {
                row.classList.add('selected');
              } else {
                row.classList.remove('selected');
              }
            }
          }
        }
      }
    });
    
    // 更新全选复选框状态
    if (selectedInFiltered === 0) {
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

  // 全选/取消全选（选中所有数据，包括未加载的）
  toggleSelectAll(checked) {
    // 如果当前有筛选条件，全选应该选中所有筛选后的数据
    // 如果当前没有筛选条件，全选应该选中所有 productData
    const filteredData = FilterService.applyFilters(this.productData, this.filterState);
    
    if (checked) {
      // 全选：选中所有筛选后的数据
      filteredData.forEach((item) => {
        const originalIndex = this.productData.indexOf(item);
        if (originalIndex !== -1) {
          this.selectedRows.add(originalIndex);
        }
      });
      
      // 更新所有已显示的行
      const tbody = document.getElementById('tableBody');
      const rows = tbody ? tbody.querySelectorAll('tr') : [];
      rows.forEach((row) => {
        if (row.style.display === 'none') return;
        
        const checkbox = row.querySelector('input[type="checkbox"]');
        if (checkbox) {
          const filteredIndex = parseInt(checkbox.dataset.index);
          if (filteredIndex !== undefined && !isNaN(filteredIndex)) {
            checkbox.checked = true;
            this.updateRowStyle(filteredIndex, true);
          }
        }
      });
    } else {
      // 取消全选：清空所有选中
      this.selectedRows.clear();
      
      // 更新所有已显示的行
      const tbody = document.getElementById('tableBody');
      const rows = tbody ? tbody.querySelectorAll('tr') : [];
      rows.forEach((row) => {
        if (row.style.display === 'none') return;
        
        const checkbox = row.querySelector('input[type="checkbox"]');
        if (checkbox) {
          const filteredIndex = parseInt(checkbox.dataset.index);
          if (filteredIndex !== undefined && !isNaN(filteredIndex)) {
            checkbox.checked = false;
            this.updateRowStyle(filteredIndex, false);
          }
        }
      });
    }
    
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
    
    showConfirm(confirmMsg, () => {
      this.executeDelete();
    });
  },

  // 执行删除操作
  executeDelete() {
    // 先关闭确认弹窗
    if (typeof window.closeConfirmModal === 'function') {
      window.closeConfirmModal();
    }
    
    const selectedCount = this.selectedRows.size;
    
    // 从大到小排序，避免删除时索引变化影响
    const sortedIndices = Array.from(this.selectedRows).sort((a, b) => b - a);
    
    // 使用filteredIndicesMap获取原始索引
    const originalIndicesToDelete = sortedIndices.map(index => {
      // 如果当前有筛选，需要通过filteredIndicesMap找到原始索引
      if (this.filteredIndicesMap && this.filteredIndicesMap.size > 0) {
        // 查找filteredIndicesMap中value等于index的key
        for (const [filteredIndex, originalIndex] of this.filteredIndicesMap.entries()) {
          if (originalIndex === index) {
            return originalIndex;
          }
        }
        return index;
      }
      return index;
    });
    
    // 从productData中删除
    originalIndicesToDelete.forEach(index => {
      if (index >= 0 && index < this.productData.length) {
        this.productData.splice(index, 1);
      }
    });
    
    // 更新统计数据：增加已删除数量，减少入围数量
    this.statistics.deleted += selectedCount;
    this.statistics.qualified = this.productData.length;
    
    // 清空选中状态
    this.selectedRows.clear();
    
    // 如果全部删除，显示空状态
    if (this.productData.length === 0) {
      this.clearData();
      return;
    }
    
    // 重置表格渲染状态，强制重新渲染
    TableRenderer.currentDisplayedData = [];
    
    // 更新数据条数
    this.updateFileButtonCount(this.productData.length);
    
    // 更新统计显示
    this.updateStatisticsDisplay();
    
    // 强制重新渲染（不使用筛选当前显示数据的方式）
    this.forceRerender();
  },

  // 强制重新渲染表格（删除后使用）
  forceRerender() {
    // 基于全部 productData 重新筛选和渲染
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

  // 重置筛选状态
  resetFilterState() {
    this.filterState = {
      qualityLevels: [],
      actualSuggestedOrder: {
        operator: '<',
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
      // 设置默认值为"小于"
      actualOrderOperator.value = '<';
      this.filterState.actualSuggestedOrder.operator = '<';
      
      actualOrderOperator.addEventListener('change', () => {
        this.filterState.actualSuggestedOrder.operator = actualOrderOperator.value;
        this.applyFiltersAndRender();
      });
      actualOrderValue.addEventListener('input', () => {
        const value = actualOrderValue.value === '' ? null : Number(actualOrderValue.value);
        this.filterState.actualSuggestedOrder.value = value;
        // 防抖处理：延迟300ms执行筛选，避免频繁触发
        this.debounceFilter();
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

  // 防抖筛选（延迟执行，避免频繁触发）
  debounceFilter() {
    if (this.filterDebounceTimer) {
      clearTimeout(this.filterDebounceTimer);
    }
    this.filterDebounceTimer = setTimeout(() => {
      this.applyFiltersAndRender();
      this.filterDebounceTimer = null;
    }, 300); // 300ms延迟
  },

  // 应用筛选和搜索并渲染
  applyFiltersAndRender() {
    // 清除防抖定时器（如果存在）
    if (this.filterDebounceTimer) {
      clearTimeout(this.filterDebounceTimer);
      this.filterDebounceTimer = null;
    }
    // 如果表格已有数据显示且 currentDisplayedData 存在，则只筛选当前显示的数据
    const tbody = document.getElementById('tableBody');
    const rows = tbody ? tbody.querySelectorAll('tr') : [];
    const hasDisplayedRows = rows.length > 0;
    
    // 检查 currentDisplayedData 是否与 productData 同步（防止删除后数据不一致）
    // 如果 currentDisplayedData 为空，或者其中的数据不在 productData 中，说明需要重新渲染
    const isDataSynced = TableRenderer.currentDisplayedData.length > 0 && 
                         TableRenderer.currentDisplayedData.every(item => this.productData.includes(item));
    
    if (hasDisplayedRows && TableRenderer.currentDisplayedData.length > 0 && isDataSynced) {
      // 筛选当前已显示的数据（隐藏/显示行）
      const visibleCount = TableRenderer.filterDisplayedRows(this.filterState);
      this.updateFileButtonCount(visibleCount);
      
      setTimeout(() => {
        this.updateSelectAllCheckbox();
        this.updateDeleteButton();
      }, 100);
    } else {
      // 首次加载、没有显示数据或数据不同步时，基于全部 productData 重新筛选和渲染
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
    }
  },

  // 清除筛选
  clearFilters() {
    // 如果表格已有数据显示，则显示所有行
    const tbody = document.getElementById('tableBody');
    const rows = tbody ? tbody.querySelectorAll('tr') : [];
    
    if (rows.length > 0) {
      // 显示Toast提示
      this.showToast('筛选条件已清除', 'success');
      // 显示所有行
      rows.forEach(row => {
        row.style.display = '';
      });
      this.updateFileButtonCount(rows.length);
    }
    
    this.filterState.qualityLevels = [];
    this.filterState.actualSuggestedOrder = {
      operator: '<',
      value: null
    };
    
    const checkboxes = document.querySelectorAll('#qualityLevelOptions input[type="checkbox"]');
    checkboxes.forEach(cb => {
      cb.checked = false;
    });
    
    const actualOrderValue = document.getElementById('actualOrderValue');
    if (actualOrderValue) {
      actualOrderValue.value = '';
      this.updateInputClearButton('actualOrderValue');
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
      this.updateInputClearButton('supplierCodeSearch');
    }
    if (skcInput) {
      this.filterState.search.skc = skcInput.value;
      this.updateInputClearButton('skcSearch');
    }
    
    this.applyFiltersAndRender();
    this.showToast('搜索完成', 'success');
  },

  // 清除搜索
  clearSearch() {
    this.filterState.search.supplierCode = '';
    this.filterState.search.skc = '';
    
    const supplierCodeInput = document.getElementById('supplierCodeSearch');
    if (supplierCodeInput) {
      supplierCodeInput.value = '';
      this.updateInputClearButton('supplierCodeSearch');
    }
    
    const skcInput = document.getElementById('skcSearch');
    if (skcInput) {
      skcInput.value = '';
      this.updateInputClearButton('skcSearch');
    }
    
    this.applyFiltersAndRender();
    this.showToast('搜索条件已清除', 'success');
  },

  // Toast提示功能
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
      success: '✓',
      error: '✕',
      info: 'ℹ'
    };
    
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(toast);
    
    // 自动消失（2秒）
    setTimeout(() => {
      toast.classList.add('hiding');
      setTimeout(() => {
        if (toast.parentElement) {
          toast.remove();
        }
      }, 300);
    }, 2000);
  },

  // 更新输入框清除按钮显示状态
  updateInputClearButton(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    const wrapper = input.closest('.input-wrapper');
    if (!wrapper) return;
    
    if (input.value.trim() !== '') {
      wrapper.classList.add('has-value');
    } else {
      wrapper.classList.remove('has-value');
    }
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

// 清除输入框内容
function clearSearchInput(inputId) {
  const input = document.getElementById(inputId);
  if (input) {
    input.value = '';
    App.updateInputClearButton(inputId);
    if (inputId === 'supplierCodeSearch' || inputId === 'skcSearch') {
      App.filterState.search[inputId === 'supplierCodeSearch' ? 'supplierCode' : 'skc'] = '';
      App.applyFiltersAndRender();
    }
  }
}

function clearFilterInput(inputId) {
  const input = document.getElementById(inputId);
  if (input) {
    input.value = '';
    App.updateInputClearButton(inputId);
    if (inputId === 'actualOrderValue') {
      App.filterState.actualSuggestedOrder.value = null;
      App.debounceFilter();
    }
  }
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

// 错误提示和确认提示相关函数
let confirmModalCallback = null;

// 显示错误提示（全局函数）
window.showError = function(title, message, details) {
  const modal = document.getElementById('errorModal');
  const titleEl = document.getElementById('errorModalTitle');
  const messageEl = document.getElementById('errorModalMessage');
  const detailsEl = document.getElementById('errorModalDetails');
  
  if (titleEl) titleEl.textContent = title || '错误';
  if (messageEl) messageEl.textContent = message || '发生未知错误';
  
  if (details && detailsEl) {
    detailsEl.style.display = 'block';
    if (Array.isArray(details)) {
      detailsEl.innerHTML = '<strong>详细信息：</strong><ul>' + 
        details.map(item => `<li>${item}</li>`).join('') + '</ul>';
    } else {
      detailsEl.innerHTML = `<strong>详细信息：</strong><div>${details}</div>`;
    }
  } else {
    if (detailsEl) detailsEl.style.display = 'none';
  }
  
  if (modal) modal.style.display = 'flex';
};

// 关闭错误提示
window.closeErrorModal = function() {
  const modal = document.getElementById('errorModal');
  if (modal) modal.style.display = 'none';
};

// 显示确认提示
window.showConfirm = function(message, callback) {
  const modal = document.getElementById('confirmModal');
  const messageEl = document.getElementById('confirmModalMessage');
  
  if (messageEl) messageEl.textContent = message || '确定要执行此操作吗？';
  confirmModalCallback = callback;
  
  if (modal) modal.style.display = 'flex';
};

// 确认提示回调
window.confirmModalCallback = function() {
  if (confirmModalCallback) {
    confirmModalCallback();
    confirmModalCallback = null;
  }
  window.closeConfirmModal();
};

// 关闭确认提示
window.closeConfirmModal = function() {
  const modal = document.getElementById('confirmModal');
  if (modal) modal.style.display = 'none';
  confirmModalCallback = null;
}

// 字段名到中文名称映射（用于显示缺失字段）
const FIELD_NAME_MAP = {
  'sku': 'SKU',
  'sales7Days': '近7天销量',
  'leadTime': '货期',
  'bufferDays': '备货天数',
  'pendingShipment': '待发货',
  'inTransit': '在途',
  'pendingShelf': '待上架',
  'sheinStock': 'SHEIN仓库存'
};

// 设置相关全局函数
function openSettingsModal() {
  const modal = document.getElementById('settingsModal');
  const thresholdInput = document.getElementById('thresholdInput');
  if (modal && thresholdInput) {
    thresholdInput.value = App.getEliminationThreshold();
    modal.style.display = 'flex';
  }
}

function closeSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function saveSettings() {
  const thresholdInput = document.getElementById('thresholdInput');
  if (thresholdInput) {
    const threshold = thresholdInput.value;
    if (App.saveSettings(threshold)) {
      closeSettingsModal();
      
      // 如果有数据，重新应用筛选
      if (App.productData.length > 0) {
        App.applyFiltersAndRender();
      }
      
      // 成功提示（使用简单的提示，不需要错误模态框）
      const successMsg = '淘汰阈值设置已成功保存。';
      if (typeof window.showError === 'function') {
        window.showError('设置已保存', successMsg, '');
      } else {
        alert(successMsg);
      }
    } else {
      if (typeof window.showError === 'function') {
        window.showError('输入无效', '请输入有效的数值。', '淘汰阈值必须是数字，可以包含小数。');
      } else {
        alert('请输入有效的数值！');
      }
    }
  }
}

// 点击模态框外部关闭
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeSettingsModal();
      }
    });
  }
});

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
