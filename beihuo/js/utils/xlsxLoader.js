// SheetJS库动态加载器
const XLSXLoader = {
  currentCDNIndex: 0,
  xlsxLoadAttempts: 0,

  // 获取最大尝试次数
  get maxAttempts() {
    return XLSX_CDN_SOURCES ? XLSX_CDN_SOURCES.length : 3;
  },

  // 动态加载SheetJS库
  load() {
    if (typeof XLSX !== 'undefined') {
      return;
    }

    if (!XLSX_CDN_SOURCES || this.currentCDNIndex >= this.maxAttempts) {
      this.showError();
      return;
    }

    const script = document.createElement('script');
    script.src = XLSX_CDN_SOURCES[this.currentCDNIndex];
    script.async = true;
    
    script.onload = () => {
      setTimeout(() => {
        if (typeof XLSX !== 'undefined') {
          console.log('✅ SheetJS库加载成功');
          this.updateUIOnSuccess();
        } else {
          this.tryNext();
        }
      }, 100);
    };

    script.onerror = () => {
      this.tryNext();
    };

    document.head.appendChild(script);
  },

  // 尝试下一个CDN源
  tryNext() {
    this.currentCDNIndex++;
    this.xlsxLoadAttempts++;
    
    if (this.currentCDNIndex < this.maxAttempts) {
      this.load();
    } else {
      this.showError();
    }
  },

  // 显示错误提示
  showError() {
    const errorMsg = 'Excel解析库加载失败，请检查网络连接后刷新页面重试。';
    const details = ['1. 检查网络连接', '2. 尝试使用VPN或代理', '3. 联系技术支持'];
    
    // 使用全局错误提示函数（如果已定义）
    if (typeof window.showError === 'function') {
      window.showError('Excel解析库加载失败', errorMsg, details);
    } else {
      // 降级到alert（仅在showError未定义时）
      alert(errorMsg + '\n\n如果问题持续存在，请：\n' + details.join('\n'));
    }
    
    const emptyStateIcon = document.getElementById('emptyStateIcon');
    const emptyStateText = document.getElementById('emptyStateText');
    if (emptyStateIcon && emptyStateText) {
      emptyStateIcon.textContent = '⚠️';
      emptyStateText.innerHTML = `
        <div style="color: #d1242f; font-weight: 600; margin-bottom: 8px;">Excel解析库加载失败</div>
        <div style="font-size: 13px; color: #656d76; margin-bottom: 12px;">请检查网络连接后刷新页面重试</div>
        <button class="btn btn-primary" onclick="location.reload()" style="margin-top: 8px;">刷新页面</button>
      `;
    }
  },

  // 更新UI显示加载成功
  updateUIOnSuccess() {
    const emptyStateIcon = document.getElementById('emptyStateIcon');
    const emptyStateText = document.getElementById('emptyStateText');
    if (emptyStateIcon && emptyStateText) {
      emptyStateIcon.textContent = '📊';
      emptyStateText.textContent = '请上传Excel文件开始计算';
    }
  },

  // 检查XLSX库是否加载完成
  checkLoaded() {
    return typeof XLSX !== 'undefined';
  }
};
