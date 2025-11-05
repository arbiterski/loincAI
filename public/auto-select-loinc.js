// Auto-select suggested LOINC code checkbox
// 當 AI Mapping Suggestions 或 Ask Stan 回應包含建議的 LOINC 代碼時，自動選中對應的 checkbox

function autoSelectSuggestedLoinc(suggestedLoincCode) {
    if (!suggestedLoincCode) {
        console.log('No suggested LOINC code provided');
        return;
    }

    console.log('Auto-selecting LOINC code:', suggestedLoincCode);

    // 查找對應的 checkbox
    const checkbox = document.querySelector(`input[type="checkbox"][value="${suggestedLoincCode}"]`);
    
    if (checkbox) {
        // 選中 checkbox
        checkbox.checked = true;
        
        // 觸發 change 事件，確保相關的 JavaScript 邏輯被執行
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        
        // 可選：添加視覺反饋
        checkbox.closest('tr')?.classList.add('suggested-loinc');
        
        console.log('Successfully selected LOINC code:', suggestedLoincCode);
        
        // 顯示提示訊息
        showNotification(`已自動選中建議的 LOINC 代碼: ${suggestedLoincCode}`, 'success');
    } else {
        console.warn('Checkbox not found for LOINC code:', suggestedLoincCode);
        showNotification(`找不到 LOINC 代碼 ${suggestedLoincCode} 的 checkbox`, 'warning');
    }
}

// 顯示通知訊息
function showNotification(message, type = 'info') {
    // 創建通知元素
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // 添加樣式
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 4px;
        color: white;
        font-weight: bold;
        z-index: 10000;
        max-width: 300px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease-out;
    `;
    
    // 根據類型設置背景色
    switch (type) {
        case 'success':
            notification.style.backgroundColor = '#4CAF50';
            break;
        case 'warning':
            notification.style.backgroundColor = '#FF9800';
            break;
        case 'error':
            notification.style.backgroundColor = '#F44336';
            break;
        default:
            notification.style.backgroundColor = '#2196F3';
    }
    
    // 添加到頁面
    document.body.appendChild(notification);
    
    // 3秒後自動移除
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// 添加 CSS 動畫
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .suggested-loinc {
        background-color: #e8f5e8 !important;
        border-left: 4px solid #4CAF50 !important;
    }
`;
document.head.appendChild(style);

// 導出函數供外部使用
window.autoSelectSuggestedLoinc = autoSelectSuggestedLoinc;
window.showNotification = showNotification;
