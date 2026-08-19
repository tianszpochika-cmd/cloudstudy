import os
import sys
import pptx
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def create_deck():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Colors
    C_NAVY = RGBColor(15, 23, 42)       # #0f172a
    C_DARK_BLUE = RGBColor(30, 41, 59)  # #1e293b
    C_ACCENT = RGBColor(37, 99, 235)    # #2563eb
    C_CYAN = RGBColor(14, 165, 233)     # #0ea5e9
    C_WHITE = RGBColor(255, 255, 255)
    C_GRAY_BG = RGBColor(248, 250, 252) # #f8fafc
    C_CARD_BG = RGBColor(255, 255, 255)
    C_TEXT_MAIN = RGBColor(30, 41, 59)
    C_TEXT_MUTED = RGBColor(100, 116, 139)
    C_GREEN = RGBColor(16, 185, 129)
    C_ORANGE = RGBColor(249, 115, 22)
    C_PURPLE = RGBColor(139, 92, 246)
    C_BORDER = RGBColor(226, 232, 240)

    def add_header(slide, title, category="ENGLISHFLOW · 方案总览", dark=False):
        # Category pill/text
        cat_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.7), Inches(0.35))
        tf_c = cat_box.text_frame
        tf_c.word_wrap = True
        p_c = tf_c.paragraphs[0]
        p_c.text = category.upper()
        p_c.font.size = Pt(11)
        p_c.font.bold = True
        p_c.font.color.rgb = C_CYAN if dark else C_ACCENT

        # Title
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.75), Inches(11.7), Inches(0.6))
        tf_t = title_box.text_frame
        tf_t.word_wrap = True
        p_t = tf_t.paragraphs[0]
        p_t.text = title
        p_t.font.size = Pt(22)
        p_t.font.bold = True
        p_t.font.color.rgb = C_WHITE if dark else C_NAVY

    def set_bg(slide, color):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
        bg.fill.solid()
        bg.fill.fore_color.rgb = color
        bg.line.fill.background()
        return bg

    def create_card(slide, left, top, width, height, title, items, badge="", badge_color=C_ACCENT, bg_color=C_WHITE, border_color=C_BORDER):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(left), Inches(top), Inches(width), Inches(height))
        card.fill.solid()
        card.fill.fore_color.rgb = bg_color
        card.line.color.rgb = border_color
        card.line.width = Pt(1)

        # Title & Badge
        t_box = slide.shapes.add_textbox(Inches(left + 0.2), Inches(top + 0.15), Inches(width - 0.4), Inches(0.45))
        tf = t_box.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = title
        p.font.size = Pt(14)
        p.font.bold = True
        p.font.color.rgb = C_NAVY

        if badge:
            p_b = tf.add_paragraph()
            p_b.text = badge
            p_b.font.size = Pt(9.5)
            p_b.font.bold = True
            p_b.font.color.rgb = badge_color
            p_b.space_before = Pt(2)

        # Items
        c_box = slide.shapes.add_textbox(Inches(left + 0.2), Inches(top + 0.7), Inches(width - 0.4), Inches(height - 0.8))
        tf_c = c_box.text_frame
        tf_c.word_wrap = True
        for i, itm in enumerate(items):
            p_itm = tf_c.paragraphs[0] if i == 0 else tf_c.add_paragraph()
            p_itm.text = "• " + itm
            p_itm.font.size = Pt(11)
            p_itm.font.color.rgb = C_TEXT_MAIN
            p_itm.space_after = Pt(4)
            p_itm.space_before = Pt(2)

    # ----------------------------------------------------
    # SLIDE 1: Cover Slide
    # ----------------------------------------------------
    s1 = prs.slides.add_slide(blank_layout)
    set_bg(s1, C_NAVY)

    # Main Title Box
    t_box = s1.shapes.add_textbox(Inches(1.2), Inches(2.0), Inches(11), Inches(2.5))
    tf1 = t_box.text_frame
    tf1.word_wrap = True
    
    p_sub = tf1.paragraphs[0]
    p_sub.text = "ENGLISHFLOW PRODUCT & BUSINESS BLUEPRINT"
    p_sub.font.size = Pt(13)
    p_sub.font.bold = True
    p_sub.font.color.rgb = C_CYAN
    p_sub.space_after = Pt(8)

    p1 = tf1.add_paragraph()
    p1.text = "EnglishFlow 全栈 AI 英语学习系统"
    p1.font.size = Pt(36)
    p1.font.bold = True
    p1.font.color.rgb = C_WHITE
    p1.space_after = Pt(12)

    p2 = tf1.add_paragraph()
    p2.text = "产品全景需求 · 商业模式定价 · 云资源算力开销 · 深圳落地与合规风控"
    p2.font.size = Pt(18)
    p2.font.color.rgb = RGBColor(203, 213, 225)

    # Footer info
    f_box = s1.shapes.add_textbox(Inches(1.2), Inches(5.8), Inches(11), Inches(0.8))
    tf_f = f_box.text_frame
    p_f = tf_f.paragraphs[0]
    p_f.text = "矩阵覆盖: 微信小程序 · iOS/Android App · Web端 · 官网 · 运营中台 | 核心引擎: LLM + 实时WebRTC + 3D数字人"
    p_f.font.size = Pt(11)
    p_f.font.color.rgb = C_TEXT_MUTED

    # ----------------------------------------------------
    # SLIDE 2: Product Positioning & Monorepo Architecture
    # ----------------------------------------------------
    s2 = prs.slides.add_slide(blank_layout)
    set_bg(s2, C_GRAY_BG)
    add_header(s2, "产品全景架构与全端矩阵", "01. 产品定位与架构设计")

    create_card(s2, 0.8, 1.6, 3.6, 5.2, "多端协同矩阵 (Apps)", [
        "微信小程序: 碎片打卡与词汇记忆",
        "iOS / Android: WebRTC 实时音视频数字人",
        "Learner Web: 语法树分析与模考精批",
        "Official Web: 品牌官网与 SEO 获客",
        "Admin Web: 教研排课、Prompt 管理与合规中台"
    ], badge="MULTI-PLATFORM CLIENTS", badge_color=C_ACCENT)

    create_card(s2, 4.8, 1.6, 3.6, 5.2, "核心微服务群 (Services)", [
        "core-api: 用户鉴权、会员订单、战队系统",
        "ai-orchestrator: Prompt 路由、作文批改、语法解析",
        "realtime-voice: <800ms 流式 ASR/TTS/RTC",
        "content-worker: 教材向量化、RAG 检索与题库更新"
    ], badge="MODULAR BACKEND ARCHITECTURE", badge_color=C_GREEN)

    create_card(s2, 8.8, 1.6, 3.6, 5.2, "通用底层引擎 (Packages & DB)", [
        "记忆引擎: 改进版 SM-2 + 艾宾浩斯动态调度",
        "知识图谱: 12,000+ 词汇与 800+ 语法拓扑树",
        "安全围栏: 双向内容过滤与权威语法锚定",
        "数据存储: PG Relational + Qdrant 向量检索"
    ], badge="FOUNDATION & KNOWLEDGE GRAPH", badge_color=C_PURPLE)

    # ----------------------------------------------------
    # SLIDE 3: Phase 1 (K12)
    # ----------------------------------------------------
    s3 = prs.slides.add_slide(blank_layout)
    set_bg(s3, C_GRAY_BG)
    add_header(s3, "第一阶段：中小学启蒙与教材同步体系", "02. PHASE 1 · K12 中小学")

    create_card(s3, 0.8, 1.6, 2.7, 5.2, "自然拼读与音标", [
        "48个国际音标 3D 口腔图解",
        "音素级发音评测与重音纠偏",
        "Phonics 自然拼读法则树",
        "220个高频词 Sight Words 动画"
    ], badge="PHONICS & IPA LAB", badge_color=C_ACCENT)

    create_card(s3, 3.8, 1.6, 2.7, 5.2, "主流教材逐课同步", [
        "覆盖人教/牛津/外研/北京等",
        "小学一年级至初三全学期覆盖",
        "逐课四维: 单词/课文/语法/自测",
        "角色扮演 AI 智能分角色对练"
    ], badge="TEXTBOOK SYNCHRONIZATION", badge_color=C_GREEN)

    create_card(s3, 6.8, 1.6, 2.7, 5.2, "卡通数字人伴学", [
        "魔法猫咪/机器人等卡通 IP",
        "<800ms 低延迟语音自然通话",
        "支持随时插话与自然打断",
        "少儿安全词汇合规严控"
    ], badge="CARTOON AI COMPANION", badge_color=C_ORANGE)

    create_card(s3, 9.8, 1.6, 2.7, 5.2, "趣味游戏与战队", [
        "单词保卫战/拼装火车等轻游戏",
        "3-6 人学习小队共育能量树",
        "组内天梯排位赛与跨队周考",
        "全英留言板与语法实时纠错"
    ], badge="GAMIFICATION & SQUADS", badge_color=C_PURPLE)

    # ----------------------------------------------------
    # SLIDE 4: Phase 2 (High School & College)
    # ----------------------------------------------------
    s4 = prs.slides.add_slide(blank_layout)
    set_bg(s4, C_GRAY_BG)
    add_header(s4, "第二阶段：高中与大学学术突破体系", "03. PHASE 2 · 高中与大学")

    create_card(s4, 0.8, 1.6, 2.7, 5.2, "抗焦虑与微学习", [
        "5-8分钟番茄高能微课",
        "暗黑极简纯净刷题模式",
        "高考侦探剧情逆袭任务",
        "AI 考前心理疏导与正向暗示"
    ], badge="ANTI-ANXIETY & IMMERSION", badge_color=C_ACCENT)

    create_card(s4, 3.8, 1.6, 2.7, 5.2, "语法树与长难句", [
        "长难句即时结构树拆解",
        "从句/非谓语动词智能高亮",
        "错题动态红点弱项图谱",
        "自适应推送同类考点变式题"
    ], badge="SYNTAX TREE & X-RAY", badge_color=C_GREEN)

    create_card(s4, 6.8, 1.6, 2.7, 5.2, "高考提分与机考", [
        "读后续写 AI 三阶词句升格",
        "倒装句/独立主格高级句型注入",
        "广东/北京等各省听说机考模考",
        "全真题型与官方机考评分标准"
    ], badge="GAOKAO ESSAY & SPEAKING", badge_color=C_ORANGE)

    create_card(s4, 9.8, 1.6, 2.7, 5.2, "四六级/考研/学术", [
        "四六级无损变速与听写挖空",
        "考研手译本英汉采分点比对",
        "考研复试英语面试多专业模拟",
        "外企 STAR 面试与 SCI 润色"
    ], badge="COLLEGE & RESEARCH", badge_color=C_PURPLE)

    # ----------------------------------------------------
    # SLIDE 5: Phase 3 (Career & Study Abroad)
    # ----------------------------------------------------
    s5 = prs.slides.add_slide(blank_layout)
    set_bg(s5, C_GRAY_BG)
    add_header(s5, "第三阶段：职场商务、出海实战与留学考培", "04. PHASE 3 · 职场与出海留学")

    create_card(s5, 0.8, 1.6, 3.6, 5.2, "职场与跨国商务实战", [
        "全场景国际会议模拟（美/英/印/新口音）",
        "跨境谈判沙盒：价格博弈与交期索赔",
        "邮件即时润色：正式/委婉/坚定/简短4档",
        "行业术语库：跨境电商、外贸、科技金融"
    ], badge="GLOBAL BUSINESS & TALK", badge_color=C_ACCENT)

    create_card(s5, 4.8, 1.6, 3.6, 5.2, "海外生存与文化沉浸", [
        "全真沙盒：海关盘问/租房签约/就医急诊",
        "突发应对：银行开户/餐厅退换菜等实景",
        "跨文化交际避坑：Small Talk 社交边界",
        "海外地道俚语与文化禁忌指引"
    ], badge="OVERSEAS SURVIVAL SANDBOX", badge_color=C_GREEN)

    create_card(s5, 8.8, 1.6, 3.6, 5.2, "雅思/托福高分冲刺", [
        "当季口语换题库每周实时同步更新",
        "官方4维诊断：流利度/词汇/语法/发音",
        "大小作文智能精批与中式英语重写",
        "全真倒计时机考考场还原"
    ], badge="IELTS & TOEFL OFFICIAL MOCK", badge_color=C_PURPLE)

    # ----------------------------------------------------
    # SLIDE 6: Pricing & Unit Economics
    # ----------------------------------------------------
    s6 = prs.slides.add_slide(blank_layout)
    set_bg(s6, C_GRAY_BG)
    add_header(s6, "商业化模式与云资源成本测算", "05. 商业模式与经济测算")

    create_card(s6, 0.8, 1.6, 5.6, 5.2, "阶梯会员体系与定价 (Pricing Tiers)", [
        "免费版 (¥0): 1本教材 + 每日5分钟数字人体验 + 基础自测",
        "基础版 (¥29/月, 年费¥268): 全教材 + 每日30分通话 + 语法树 + 读后续写批改",
        "尊享版 (¥88/月, 年费¥698): 无限通话 + 雅思托福精批 + SCI/商务沙盒",
        "企业/机构版 (¥199-399/人/年): 机构定制助教 + 批量题库与学情导出"
    ], badge="COMMERCIALIZATION TIERS", badge_color=C_ACCENT)

    create_card(s6, 6.8, 1.6, 5.7, 5.2, "云资源与 AI 算力支出 (5,000 DAU 测算)", [
        "固定基础: 域名证书 + ECS*2 + RDS + Redis + OSS + 短信 ≈ ¥3,610/月",
        "AI 动态: 3000万 Tokens + 2500小时 ASR + 1500万字 TTS + RTC ≈ ¥5,250/月",
        "渠道年费: Apple ($99) + Google Play ($25) + 微信认证 (¥300) ≈ ¥1,200/年",
        "单用户服务成本: 动态算力单月成本低至 ¥1.05 / 活跃用户，毛利空间健康"
    ], badge="MONTHLY UNIT ECONOMICS", badge_color=C_GREEN)

    # ----------------------------------------------------
    # SLIDE 7: Legal, Shenzhen Setup & Compliance
    # ----------------------------------------------------
    s7 = prs.slides.add_slide(blank_layout)
    set_bg(s7, C_GRAY_BG)
    add_header(s7, "深圳公司落地、法定资质与合规风控", "06. 公司建设与合规风控")

    create_card(s7, 0.8, 1.6, 3.6, 5.2, "深圳落地与主体设立", [
        "选址推荐: 南山区高新园 或 前海深港合作区 (享双15%税收优惠)",
        "经营范围: 软件开发、AI基础软件开发、网络安全、留学咨询",
        "资本建议: 认缴 100万 - 500万元，开立本地银行基本户"
    ], badge="SHENZHEN COMPANY SETUP", badge_color=C_ACCENT)

    create_card(s7, 4.8, 1.6, 3.6, 5.2, "国内全套牌照清单", [
        "ICP 备案 (广东通管局 / 7-14天)",
        "增值电信业务许可证 ICP/EDI (线上付费必备)",
        "生成式人工智能服务备案 (国家网信办)",
        "深度合成服务算法备案 (数字人/语音克隆)",
        "公安联网备案 (上线30日内) + 软件著作权 (安卓上架)"
    ], badge="REGULATORY LICENSES", badge_color=C_GREEN)

    create_card(s7, 8.8, 1.6, 3.6, 5.2, "四大核心风控与避坑", [
        "双减政策: 定位 AI 辅助工具，禁用名师/提分包过宣传",
        "教材版权: 知识点结构化提取，商业化获取官方电子授权",
        "未成年保护: 青少年守护模式，限时防沉迷与监护人明示授权",
        "内容安全: 接入天御/阿里安全审核，数字人画面添加合成标识"
    ], badge="RISK MITIGATION", badge_color=C_PURPLE)

    # ----------------------------------------------------
    # SLIDE 8: Summary & Roadmap
    # ----------------------------------------------------
    s8 = prs.slides.add_slide(blank_layout)
    set_bg(s8, C_NAVY)
    add_header(s8, "EnglishFlow 实施路线与交付展望", "07. 路线图与实施规划", dark=True)

    create_card(s8, 0.8, 1.6, 3.6, 5.2, "M1: 基础建设与 K12 (1-2月)", [
        "搭建 Monorepo 与微服务底座",
        "完成人教/牛津主流教材 OCR 入库",
        "完成卡通数字人 WebRTC 通话跑通",
        "上线 2 款拼读游戏与战队打卡"
    ], badge="PHASE 1 DELIVERABLES", badge_color=C_CYAN, bg_color=C_DARK_BLUE, border_color=C_CYAN)

    create_card(s8, 4.8, 1.6, 3.6, 5.2, "M2: 升学突破与多端 (3-4月)", [
        "上线动态语法树与长难句 X 光机",
        "接入高考读后续写 AI 升格导师",
        "完成微信小程序与 iOS/Android 双端上架",
        "取得 ICP/EDI 牌照并接入合规内容审核"
    ], badge="PHASE 2 DELIVERABLES", badge_color=C_GREEN, bg_color=C_DARK_BLUE, border_color=C_GREEN)

    create_card(s8, 8.8, 1.6, 3.6, 5.2, "M3: 职场出海与商业化 (5-6月)", [
        "上线国际商务谈判与外企 STAR 面试",
        "集成雅思/托福官方多维评分与题库",
        "开启会员付费与机构定制推广",
        "构建完整的 AI 英语自适应学习闭环"
    ], badge="PHASE 3 DELIVERABLES", badge_color=C_PURPLE, bg_color=C_DARK_BLUE, border_color=C_PURPLE)

    # Adjust text colors inside dark cards
    for shape in s8.shapes:
        if shape.has_text_frame:
            for p in shape.text_frame.paragraphs:
                if p.text.startswith("• "):
                    p.font.color.rgb = RGBColor(226, 232, 240)
                elif p.font.size and p.font.size.pt == 14:
                    p.font.color.rgb = C_WHITE

    output_pptx = os.path.join("docs", "presentation", "EnglishFlow_Product_Presentation.pptx")
    prs.save(output_pptx)
    print(f"Presentation saved successfully: {output_pptx} ({os.path.getsize(output_pptx)} bytes)")

if __name__ == "__main__":
    create_deck()
