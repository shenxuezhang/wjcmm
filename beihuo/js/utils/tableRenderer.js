// 表格渲染工具
const TableRenderer = {
  displayedCount: 0,
  isLoading: false,
  filteredIndicesMap: null,

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

  // 懒加载渲染表格
  renderLazy(productData, filteredIndicesMap) {
    this.displayedCount = 0;
    this.isLoading = false;
    this.filteredIndicesMap = filteredIndicesMap || null;
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    
    document.getElementById('loadingOverlay').style.display = 'flex';
    
    requestAnimationFrame(() => {
      this.loadNextBatch(productData);
    });
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
