// 表格渲染工具
const TableRenderer = {
  displayedCount: 0,
  isLoading: false,
  filteredIndicesMap: null,
  currentDisplayedData: [], // 当前已显示的数据

  // 显示骨架屏
  showSkeleton() {
    document.getElementById('skeletonWrapper').style.display = 'block';
    document.getElementById('tableWrapper').style.display = 'none';
    document.getElementById('emptyState').style.display = 'none';
    
    const skeletonContent = document.getElementById('skeletonContent');
    skeletonContent.innerHTML = '';
    
    for (let i = 0; i < 10; i++) {
      const row = document.createElement('div');
      row.className = 'skeleton-row';
      row.innerHTML = `
        <div class="skeleton-cell image"></div>
        <div class="skeleton-cell short"></div>
        <div class="skeleton-cell medium"></div>
        <div class="skeleton-cell medium"></div>
        <div class="skeleton-cell"></div>
        <div class="skeleton-cell short"></div>
        <div class="skeleton-cell short"></div>
        <div class="skeleton-cell short"></div>
        <div class="skeleton-cell short"></div>
        <div class="skeleton-cell short"></div>
      `;
      skeletonContent.appendChild(row);
    }
  },

  // 渲染表格（一次性渲染所有数据）
  renderLazy(productData, filteredIndicesMap) {
    this.displayedCount = productData.length;
    this.isLoading = false;
    this.filteredIndicesMap = filteredIndicesMap || null;
    this.currentDisplayedData = [...productData]; // 保存当前显示的数据
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    
    document.getElementById('loadingOverlay').style.display = 'flex';
    
    // 使用 requestAnimationFrame 优化渲染性能
    requestAnimationFrame(() => {
      const fragment = document.createDocumentFragment();
      
      // 一次性渲染所有数据
      productData.forEach((product, index) => {
        const tr = this.createTableRow(product, index);
        
        // 检查是否已选中
        const originalIndex = this.filteredIndicesMap ? 
          (this.filteredIndicesMap.get(index) !== undefined ? this.filteredIndicesMap.get(index) : index) : 
          index;
        
        if (App.selectedRows.has(originalIndex)) {
          tr.classList.add('selected');
          const checkbox = tr.querySelector('input[type="checkbox"]');
          if (checkbox) {
            checkbox.checked = true;
          }
        }
        
        fragment.appendChild(tr);
      });
      
      tbody.appendChild(fragment);
      
      // 隐藏加载提示
      document.getElementById('loadingOverlay').style.display = 'none';
      
      // 更新全选和删除按钮状态
      setTimeout(() => {
        App.updateSelectAllCheckbox();
        App.updateDeleteButton();
      }, 100);
    });
  },

  // 获取当前已显示的数据（只获取可见的行）
  getCurrentDisplayedData() {
    const tbody = document.getElementById('tableBody');
    const rows = tbody.querySelectorAll('tr');
    const displayedData = [];
    
    rows.forEach((row, index) => {
      // 只获取当前可见的行（没有被隐藏的）
      if (row.style.display === 'none') return;
      
      const dataIndex = row.dataset.index;
      if (dataIndex !== undefined) {
        const filteredIndex = parseInt(dataIndex);
        if (this.currentDisplayedData && this.currentDisplayedData[filteredIndex]) {
          displayedData.push(this.currentDisplayedData[filteredIndex]);
        }
      }
    });
    
    return displayedData;
  },

  // 筛选当前显示的数据（隐藏/显示行）
  filterDisplayedRows(filterState) {
    const tbody = document.getElementById('tableBody');
    const rows = tbody.querySelectorAll('tr');
    
    if (rows.length === 0) return 0;
    
    // 获取当前已显示的数据（包括被隐藏的）
    const allDisplayedData = [];
    rows.forEach((row) => {
      const dataIndex = row.dataset.index;
      if (dataIndex !== undefined) {
        const filteredIndex = parseInt(dataIndex);
        if (this.currentDisplayedData && this.currentDisplayedData[filteredIndex]) {
          allDisplayedData.push({
            row: row,
            product: this.currentDisplayedData[filteredIndex],
            index: filteredIndex
          });
        }
      }
    });
    
    if (allDisplayedData.length === 0) return 0;
    
    // 提取产品数据
    const displayedProducts = allDisplayedData.map(item => item.product);
    
    // 对已显示的数据进行筛选
    const filteredData = FilterService.applyFilters(displayedProducts, filterState);
    
    // 创建匹配数据的索引 Set 用于快速查找
    const matchedIndices = new Set();
    filteredData.forEach(filteredItem => {
      // 通过索引匹配
      allDisplayedData.forEach((item, idx) => {
        if (item.product === filteredItem) {
          matchedIndices.add(item.index);
        }
      });
    });
    
    // 遍历所有行，根据筛选结果显示/隐藏
    let visibleCount = 0;
    allDisplayedData.forEach(item => {
      if (matchedIndices.has(item.index)) {
        item.row.style.display = '';
        visibleCount++;
      } else {
        item.row.style.display = 'none';
      }
    });
    
    return visibleCount;
  },

  // 加载下一批数据
  loadNextBatch(productData) {
    if (this.isLoading || this.displayedCount >= productData.length) {
      document.getElementById('loadingOverlay').style.display = 'none';
      this.isLoading = false;
      
      if (this.displayedCount >= productData.length && App.selectedRows.size > 0) {
        const tbody = document.getElementById('tableBody');
        const rows = tbody.querySelectorAll('tr');
        rows.forEach((row, filteredIndex) => {
          const originalIndex = this.filteredIndicesMap ? 
            (this.filteredIndicesMap.get(filteredIndex) !== undefined ? this.filteredIndicesMap.get(filteredIndex) : filteredIndex) : 
            filteredIndex;
          if (App.selectedRows.has(originalIndex)) {
            row.classList.add('selected');
            const checkbox = row.querySelector('input[type="checkbox"]');
            if (checkbox) {
              checkbox.checked = true;
            }
          }
        });
        App.updateSelectAllCheckbox();
        App.updateDeleteButton();
      }
      return;
    }

    this.isLoading = true;
    const tbody = document.getElementById('tableBody');
    const endIndex = Math.min(this.displayedCount + BATCH_SIZE, productData.length);

    const fragment = document.createDocumentFragment();
    
    for (let i = this.displayedCount; i < endIndex; i++) {
      const product = productData[i];
      const tr = this.createTableRow(product, i);
      
      if (App.selectedRows.has(i)) {
        tr.classList.add('selected');
        const checkbox = tr.querySelector('input[type="checkbox"]');
        if (checkbox) {
          checkbox.checked = true;
        }
      }
      
      fragment.appendChild(tr);
    }

    tbody.appendChild(fragment);
    this.displayedCount = endIndex;

    if (this.displayedCount < productData.length) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          this.loadNextBatch(productData);
        }, 10);
      });
    } else {
      document.getElementById('loadingOverlay').style.display = 'none';
      this.isLoading = false;
    }
  },

  // 创建表格行
  createTableRow(product, index) {
    const tr = document.createElement('tr');
    tr.dataset.index = index;
    
    // 复选框单元格
    const checkboxCell = document.createElement('td');
    checkboxCell.className = 'checkbox-cell';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.index = index;
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      App.toggleRowSelection(index, checkbox.checked);
    });
    checkboxCell.appendChild(checkbox);
    tr.appendChild(checkboxCell);
    
    const imgCell = document.createElement('td');
    if (product.imageUrl) {
      const img = document.createElement('img');
      img.src = product.imageUrl;
      img.className = 'product-image';
      img.loading = 'lazy';
      img.onerror = function() {
        this.className = 'product-image error';
        this.alt = '图片加载失败';
        this.style.display = 'flex';
        this.style.alignItems = 'center';
        this.style.justifyContent = 'center';
        this.textContent = '无图';
      };
      imgCell.appendChild(img);
    } else {
      imgCell.innerHTML = '<div class="product-image error">无图</div>';
    }

    imgCell.className = 'center-cell';
    tr.appendChild(imgCell);
    tr.appendChild(this.createCell(product.supplierCode || '-', true));
    tr.appendChild(this.createCell(product.skc || '-', true));
    tr.appendChild(this.createCell(product.sku || '-', true));
    tr.appendChild(this.createCell(product.attributes || '-', true));
    tr.appendChild(this.createCell(product.qualityLevel || '-', true));
    tr.appendChild(this.createNumberCell(product.sheinStock, '', true));
    
    const dailySalesValue = (product.dailySales && !isNaN(product.dailySales) && isFinite(product.dailySales)) 
      ? Number(product.dailySales).toFixed(2) 
      : '0.00';
    tr.appendChild(this.createNumberCell(dailySalesValue, '', true));
    
    const actualSuggestedOrderValue = (product.actualSuggestedOrder !== undefined && !isNaN(product.actualSuggestedOrder) && isFinite(product.actualSuggestedOrder))
      ? product.actualSuggestedOrder
      : 0;
    tr.appendChild(this.createNumberCell(actualSuggestedOrderValue, 'actual-suggested-order', true));
    
    const suggestedOrderValue = (product.suggestedOrder && !isNaN(product.suggestedOrder) && isFinite(product.suggestedOrder))
      ? product.suggestedOrder
      : 0;
    tr.appendChild(this.createNumberCell(suggestedOrderValue, 'suggested-order', true, true));

    return tr;
  },

  // 创建单元格
  createCell(text, center = false) {
    const td = document.createElement('td');
    td.className = 'data-cell';
    td.textContent = text;
    if (center) {
      td.className += ' center-cell';
    }
    return td;
  },

  // 创建数字单元格
  createNumberCell(value, className = '', center = false, isSuggestedOrder = false) {
    const td = document.createElement('td');
    td.className = 'data-cell number-cell ' + className;
    if (center) {
      td.className += ' center-cell';
    }
    if (isSuggestedOrder && typeof value === 'number' && value > 10) {
      td.className += ' high-value';
    }
    td.textContent = value;
    return td;
  }
};
