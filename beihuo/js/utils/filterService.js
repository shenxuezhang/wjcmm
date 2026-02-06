// 筛选服务
const FilterService = {
  // 提取字段唯一值
  extractUniqueValues(data, field) {
    if (!data || data.length === 0) return [];
    const values = new Set();
    data.forEach(item => {
      const value = item[field];
      if (value !== undefined && value !== null && value !== '') {
        values.add(String(value));
      }
    });
    return Array.from(values).sort();
  },

  // 质量等级筛选（多选）
  filterByQualityLevel(data, selectedLevels) {
    if (!selectedLevels || selectedLevels.length === 0) return data;
    return data.filter(item => selectedLevels.includes(item.qualityLevel));
  },

  // 实际建议单数筛选
  filterByActualOrder(data, operator, value) {
    if (value === null || value === '' || value === undefined) return data;
    const numValue = Number(value);
    if (isNaN(numValue)) return data;
    
    return data.filter(item => {
      // 严格检查：确保只筛选已通过淘汰机制的数据（rawSuggestedOrder >= 淘汰阈值）
      const rawOrder = item.rawSuggestedOrder;
      const threshold = App.getEliminationThreshold();
      if (rawOrder === undefined || rawOrder === null || 
          typeof rawOrder !== 'number' || 
          isNaN(rawOrder) || 
          !isFinite(rawOrder) || 
          rawOrder < threshold) {
        return false;
      }
      
      const actual = item.actualSuggestedOrder || 0;
      switch(operator) {
        case '=': return actual === numValue;
        case '>': return actual > numValue;
        case '<': return actual < numValue;
        case '>=': return actual >= numValue;
        case '<=': return actual <= numValue;
        default: return true;
      }
    });
  },

  // 供货方号搜索
  searchBySupplierCode(data, keyword) {
    if (!keyword || keyword.trim() === '') return data;
    const lowerKeyword = keyword.toLowerCase().trim();
    return data.filter(item => {
      const fieldValue = String(item.supplierCode || '').toLowerCase();
      return fieldValue.includes(lowerKeyword);
    });
  },

  // SKC搜索
  searchBySKC(data, keyword) {
    if (!keyword || keyword.trim() === '') return data;
    const lowerKeyword = keyword.toLowerCase().trim();
    return data.filter(item => {
      const fieldValue = String(item.skc || '').toLowerCase();
      return fieldValue.includes(lowerKeyword);
    });
  },

  // 应用所有筛选和搜索条件
  applyFilters(data, filterState) {
    // 首先过滤掉已淘汰的数据（rawSuggestedOrder < 淘汰阈值）
    const threshold = App.getEliminationThreshold();
    let result = data.filter(item => {
      const rawOrder = item.rawSuggestedOrder;
      return rawOrder !== undefined && 
             rawOrder !== null && 
             typeof rawOrder === 'number' && 
             !isNaN(rawOrder) && 
             isFinite(rawOrder) && 
             rawOrder >= threshold;
    });
    
    if (!filterState) return result;
    
    if (filterState.qualityLevels && filterState.qualityLevels.length > 0) {
      result = this.filterByQualityLevel(result, filterState.qualityLevels);
    }
    
    if (filterState.actualSuggestedOrder && filterState.actualSuggestedOrder.value !== null && filterState.actualSuggestedOrder.value !== '') {
      result = this.filterByActualOrder(
        result, 
        filterState.actualSuggestedOrder.operator, 
        filterState.actualSuggestedOrder.value
      );
    }
    
    if (filterState.search) {
      if (filterState.search.supplierCode && filterState.search.supplierCode.trim() !== '') {
        result = this.searchBySupplierCode(result, filterState.search.supplierCode);
      }
      if (filterState.search.skc && filterState.search.skc.trim() !== '') {
        result = this.searchBySKC(result, filterState.search.skc);
      }
    }
    
    return result;
  }
};
