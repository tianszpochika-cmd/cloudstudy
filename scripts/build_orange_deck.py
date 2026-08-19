import os
import subprocess
import sys

def get_svg_icons():
    return {
        "sparkles": '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>',
        "cpu": '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>',
        "mic": '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>',
        "book": '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 2v20"/></svg>',
        "bot": '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>',
        "gamepad": '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" x2="10" y1="12" y2="12"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="15" x2="15.01" y1="13" y2="13"/><line x1="18" x2="18.01" y1="11" y2="11"/><rect width="20" height="12" x="2" y="6" rx="6"/></svg>',
        "shield": '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
        "tree": '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1"/><rect width="8" height="4" x="2" y="18" rx="1"/><rect width="8" height="4" x="14" y="18" rx="1"/><path d="M12 6v6"/><path d="M6 18v-3a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v3"/></svg>',
        "pen": '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
        "award": '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>',
        "briefcase": '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
        "plane": '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>',
        "target": '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
        "dollar": '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
        "server": '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>',
        "legal": '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 13-7.5 7.5c-.8.8-2 .8-2.8 0l-.2-.2c-.8-.8-.8-2 0-2.8L11 10"/><path d="m16 16 6-6"/><path d="m8 8 6-6"/><path d="m9 7 8 8"/><path d="m21 11-8-8"/></svg>',
        "check": '<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
        "zap": '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
        "chart": '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>',
        "devices": '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/></svg>',
        "layers": '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>'
    }

def get_css():
    return """
    @page {
      size: 1920px 1080px;
      margin: 0;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .slide {
        page-break-after: always !important;
        break-after: page !important;
      }
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", Roboto, sans-serif;
      background: #0f172a;
      color: #1e293b;
    }
    .slide {
      width: 1920px;
      height: 1080px;
      position: relative;
      overflow: hidden;
      background: #FFFDF9;
      padding: 60px 80px 45px 80px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .slide.dark {
      background: radial-gradient(circle at 80% 20%, #1e293b 0%, #0f172a 70%, #090d16 100%);
      color: #f8fafc;
    }
    
    /* Top Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
    }
    .header-left {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .tag-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      padding: 5px 14px;
      border-radius: 999px;
      width: fit-content;
    }
    .tag-orange {
      background: #FFF0E6;
      color: #EA580C;
      border: 1px solid #FFD8C2;
    }
    .tag-dark-orange {
      background: rgba(255, 107, 0, 0.15);
      color: #FF8533;
      border: 1px solid rgba(255, 107, 0, 0.3);
    }
    .slide-title {
      font-size: 34px;
      font-weight: 800;
      color: #0F172A;
      letter-spacing: -0.5px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .slide.dark .slide-title {
      color: #FFFFFF;
    }
    .slide-subtitle {
      font-size: 17px;
      color: #64748B;
      font-weight: 400;
    }
    .slide.dark .slide-subtitle {
      color: #94A3B8;
    }
    .header-badge {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      padding: 8px 16px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      color: #475569;
    }
    .slide.dark .header-badge {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.1);
      color: #CBD5E1;
    }

    /* Content Grid Layouts */
    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 20px;
      justify-content: center;
    }
    
    .grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
    }
    .grid-4 {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 28px;
    }
    .grid-2-1 {
      display: grid;
      grid-template-columns: 1.8fr 1fr;
      gap: 24px;
    }
    .grid-1-2 {
      display: grid;
      grid-template-columns: 1fr 1.8fr;
      gap: 24px;
    }

    /* Card Components */
    .card {
      background: #FFFFFF;
      border: 1px solid #F1E5D8;
      border-radius: 18px;
      padding: 24px 28px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 20px -2px rgba(234, 88, 12, 0.05);
      position: relative;
    }
    .card-highlight {
      background: linear-gradient(145deg, #FFF9F5 0%, #FFF3EB 100%);
      border: 1.5px solid #FFCBB0;
    }
    .slide.dark .card {
      background: rgba(30, 41, 59, 0.7);
      border-color: rgba(255, 107, 0, 0.2);
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
    }
    .slide.dark .card-highlight {
      background: linear-gradient(145deg, rgba(255, 107, 0, 0.15) 0%, rgba(30, 41, 59, 0.9) 100%);
      border-color: #FF8533;
    }
    
    .card-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
    }
    .icon-box {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: #FFF0E6;
      color: #EA580C;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .slide.dark .icon-box {
      background: rgba(255, 107, 0, 0.2);
      color: #FF9E58;
    }
    .card-title {
      font-size: 20px;
      font-weight: 700;
      color: #0F172A;
    }
    .slide.dark .card-title {
      color: #FFFFFF;
    }
    .card-desc {
      font-size: 15px;
      line-height: 1.6;
      color: #475569;
      margin-bottom: 14px;
    }
    .slide.dark .card-desc {
      color: #94A3B8;
    }
    
    .feature-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .feature-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 14.5px;
      line-height: 1.5;
      color: #334155;
    }
    .slide.dark .feature-item {
      color: #CBD5E1;
    }
    .bullet-icon {
      color: #EA580C;
      flex-shrink: 0;
      margin-top: 3px;
    }
    .slide.dark .bullet-icon {
      color: #FF8533;
    }
    
    /* Metric / Pill Rows */
    .kpi-row {
      display: flex;
      gap: 16px;
      margin-top: auto;
      padding-top: 14px;
      border-top: 1px solid #F1E5D8;
    }
    .slide.dark .kpi-row {
      border-top-color: rgba(255, 255, 255, 0.1);
    }
    .kpi-item {
      flex: 1;
      background: #F8FAFC;
      border-radius: 10px;
      padding: 8px 12px;
      display: flex;
      flex-direction: column;
    }
    .slide.dark .kpi-item {
      background: rgba(255, 255, 255, 0.05);
    }
    .kpi-label {
      font-size: 12px;
      color: #64748B;
      font-weight: 500;
    }
    .slide.dark .kpi-label {
      color: #94A3B8;
    }
    .kpi-val {
      font-size: 17px;
      font-weight: 800;
      color: #EA580C;
    }
    .slide.dark .kpi-val {
      color: #FF9E58;
    }

    /* Pipeline Flow / Step Strip */
    .flow-strip {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #FFFFFF;
      border: 1px solid #F1E5D8;
      border-radius: 16px;
      padding: 16px 20px;
      box-shadow: 0 2px 12px rgba(234, 88, 12, 0.04);
    }
    .slide.dark .flow-strip {
      background: rgba(30, 41, 59, 0.6);
      border-color: rgba(255, 107, 0, 0.2);
    }
    .flow-step {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
      position: relative;
    }
    .step-num {
      font-size: 12px;
      font-weight: 800;
      color: #EA580C;
      text-transform: uppercase;
    }
    .step-name {
      font-size: 15px;
      font-weight: 700;
      color: #0F172A;
    }
    .slide.dark .step-name {
      color: #F8FAFC;
    }
    .step-detail {
      font-size: 13px;
      color: #64748B;
      line-height: 1.4;
    }
    .slide.dark .step-detail {
      color: #94A3B8;
    }
    .flow-arrow {
      color: #CBD5E1;
      font-size: 18px;
      font-weight: bold;
    }

    /* Table Styles */
    .custom-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid #F1E5D8;
      background: #FFFFFF;
    }
    .slide.dark .custom-table {
      background: rgba(30, 41, 59, 0.6);
      border-color: rgba(255, 255, 255, 0.1);
    }
    .custom-table th {
      background: #FFF7ED;
      color: #EA580C;
      font-weight: 700;
      font-size: 14px;
      padding: 14px 18px;
      text-align: left;
      border-bottom: 1px solid #FFEDD5;
    }
    .slide.dark .custom-table th {
      background: rgba(255, 107, 0, 0.15);
      color: #FF9E58;
      border-bottom-color: rgba(255, 255, 255, 0.1);
    }
    .custom-table td {
      padding: 13px 18px;
      font-size: 14px;
      color: #334155;
      border-bottom: 1px solid #F1F5F9;
    }
    .slide.dark .custom-table td {
      color: #CBD5E1;
      border-bottom-color: rgba(255, 255, 255, 0.05);
    }
    .custom-table tr:last-child td {
      border-bottom: none;
    }
    
    /* Footer Bar */
    .footer-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 16px;
      border-top: 1px solid #EFEAE3;
      font-size: 13px;
      color: #94A3B8;
      font-weight: 500;
    }
    .slide.dark .footer-bar {
      border-top-color: rgba(255, 255, 255, 0.1);
      color: #64748B;
    }
    .footer-logo {
      font-weight: 800;
      color: #EA580C;
      letter-spacing: 0.5px;
    }
    .slide.dark .footer-logo {
      color: #FF8533;
    }

    .icon {
      width: 24px;
      height: 24px;
    }
    .icon-sm {
      width: 16px;
      height: 16px;
    }
    """
