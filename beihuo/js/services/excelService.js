// Excel导出服务
const ExcelService = {
  // 导出Excel文件
  exportToExcel(productData) {
    if (productData.length === 0) {
      return;
    }

    if (!XLSXLoader.checkLoaded()) {
      alert('Excel导出库未加载，请刷新页面重试');
      return;
    }

    try {
      const exportData = productData.map(product => ({
        'SKC': product.skc || '',
        'SKU': product.sku || '',
        '属性集': product.attributes || '',
        '下单数量': product.suggestedOrder || 0,
        '下单备注': ''
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '下单数据');

      const fileName = `SHEIN备货下单_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xls`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败：' + error.message);
    }
  }
};
