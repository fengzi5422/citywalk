# -*- coding: utf-8 -*-
"""把 stage1/final_draft.md 转成 business-report 版式的完整 HTML。"""
import re, io

SRC = r"D:\Users\3392\Desktop\wan\ly\output\20261103-travelapp\stage1\final_draft.md"
OUT = r"D:\Users\3392\Desktop\wan\ly\output\20261103-travelapp\stage2\formatted-城市自由行App产品需求与规划设计.html"

INTRO = {
    "一、文档说明": "本章界定文档的读者、产品定义与首版假设。后续所有设计都建立在 1.3 节的范围假设之上，假设变化时相关章节需要同步修订。",
    "二、需求整理：从想法到可执行需求": "本章把初始想法拆成可验收的需求。重点是识别四个缺口：条件采集、可修改性、现场可用性与内容时效，它们共同决定了首版的功能边界。",
    "三、目标用户与核心使用场景": "本章确定首版服务谁、不服务谁，并用具体场景描述产品在真实一天中的使用方式。场景是后续流程与页面设计的依据。",
    "四、核心功能清单与优先级": "本章给出功能全景与优先级判断。P0 的取舍标准只有一条：缺少它，用户无法完成一趟旅行。",
    "五、关键用户流程": "本章描述六条主流程及其异常分支。每条流程都对应明确的系统行为与用户可见反馈，可直接转为交互稿与测试用例。",
    "六、信息架构与主要页面规划": "本章确定导航结构、页面清单与三个核心页面的信息层级。页面规划遵循“一屏一决策”，避免把攻略全文搬进手机。",
    "七、数据来源与更新策略": "本章回答三个问题：数据从哪来、多久更新一次、能用到什么程度。内容时效性直接决定行程在现场是否可执行。",
    "八、个性化推荐逻辑": "本章把推荐拆成召回、排序、排程三层，并给出首版可实现的算法与参数。目标不是最优解，而是可解释、可校验、可降级。",
    "九、免责声明与内容合规边界": "本章界定产品责任边界，并提供可直接使用的免责文案与上线检查清单。合规工作的价值在于提前排除会导致下架的风险。",
    "十、技术架构与关键设计": "本章给出支撑前述功能的架构与数据结构，重点在双 ID、版本控制、异步任务与降级四件事。首版保持单体，模块边界清晰即可。",
    "十一、分阶段开发里程碑": "本章把工作量拆成五个阶段，每阶段有明确的出门条件与验收标准。排期按两人全职估算，单人开发需按 11.7 节换算。",
    "十二、验收标准": "本章给出可执行的验收方式：功能清单、一条端到端黄金场景、十条例边界用例与非功能指标。全部通过才算首版完成。",
}

lines = io.open(SRC, encoding="utf-8").read().split("\n")


def inline(t):
    t = t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"`(.+?)`", r'<span class="mono">\1</span>', t)
    return t


CALLOUT_PREFIX = ("设计红线：", "关键约束：", "两条必须从第一天做好的约定：",
                  "降级的第一原则是", "目标层只有一句话：", "关键判断：")

blocks = []
toc = []
i = 0
sec = 0
sub = 0

while i < len(lines):
    ln = lines[i]
    s = ln.strip()

    if not s:
        i += 1
        continue

    if s.startswith("```"):
        i += 1
        buf = []
        while i < len(lines) and not lines[i].strip().startswith("```"):
            buf.append(lines[i].rstrip())
            i += 1
        i += 1
        blocks.append(("pre", "\n".join(buf)))
        continue

    if s.startswith("# ") and not s.startswith("## "):
        i += 1
        continue

    if s.startswith("## "):
        sec += 1
        sub = 0
        sid = "section-%d" % sec
        txt = s[3:].strip()
        blocks.append(("h2", (txt, sid)))
        toc.append((2, txt, sid))
        if txt in INTRO:
            blocks.append(("p", INTRO[txt]))
        i += 1
        continue

    if s.startswith("### "):
        sub += 1
        txt = s[4:].strip()
        sid = "section-%d-%d" % (sec, sub)
        blocks.append(("h3", (txt, sid)))
        toc.append((3, txt, sid))
        i += 1
        continue

    if s.startswith("> "):
        items = []
        while i < len(lines) and lines[i].strip().startswith(">"):
            items.append(lines[i].strip().lstrip(">").strip())
            i += 1
        blocks.append(("quote", " ".join(items)))
        continue

    if s.startswith("|"):
        rows = []
        while i < len(lines) and lines[i].strip().startswith("|"):
            row = lines[i].strip().strip("|")
            cells = [c.strip() for c in row.split("|")]
            if not all(re.fullmatch(r":?-{2,}:?", c) for c in cells):
                rows.append(cells)
            i += 1
        if rows:
            blocks.append(("table", rows))
        continue

    if re.match(r"^- ", s):
        items = []
        while i < len(lines) and re.match(r"^- ", lines[i].strip()):
            items.append(lines[i].strip()[2:])
            i += 1
        blocks.append(("ul", items))
        continue

    if re.match(r"^\d+\. ", s):
        items = []
        while i < len(lines) and re.match(r"^\d+\. ", lines[i].strip()):
            items.append(re.sub(r"^\d+\.\s*", "", lines[i].strip()))
            i += 1
        blocks.append(("ol", items))
        continue

    buf = [s]
    i += 1
    while i < len(lines):
        nxt = lines[i].strip()
        if (not nxt or nxt.startswith("#") or nxt.startswith("|")
                or nxt.startswith("- ") or re.match(r"^\d+\. ", nxt)
                or nxt.startswith("```")):
            break
        buf.append(nxt)
        i += 1
    blocks.append(("p", " ".join(buf)))

body = []
for kind, payload in blocks:
    if kind == "h2":
        txt, sid = payload
        body.append('<h2 id="%s">%s</h2>' % (sid, inline(txt)))
    elif kind == "h3":
        txt, sid = payload
        body.append('<h3 id="%s"><span class="h3-mark">\u258e</span> %s</h3>' % (sid, inline(txt)))
    elif kind == "p":
        cls = ""
        lead = ""
        for p in CALLOUT_PREFIX:
            if payload.startswith("**" + p) or payload.startswith(p):
                cls = ' class="callout"'
                lead = "&nbsp;&nbsp;"
                break
        body.append("<p%s>%s%s</p>" % (cls, lead, inline(payload)))
    elif kind == "ul":
        body.append('<ul class="list">%s</ul>' % "".join("<li>%s</li>" % inline(x) for x in payload))
    elif kind == "ol":
        body.append('<ol class="list">%s</ol>' % "".join("<li>%s</li>" % inline(x) for x in payload))
    elif kind == "pre":
        body.append('<pre class="tree">%s</pre>' % inline(payload))
    elif kind == "quote":
        body.append('<p class="quote">&nbsp;&nbsp;%s</p>' % inline(payload))
    elif kind == "table":
        head, rows = payload[0], payload[1:]
        h = "".join("<th>%s</th>" % inline(c) for c in head)
        b = "".join("<tr>" + "".join("<td>%s</td>" % inline(c) for c in r) + "</tr>" for r in rows)
        body.append('<table class="grid"><thead><tr>%s</tr></thead><tbody>%s</tbody></table>' % (h, b))

BODY = "\n".join(body)

toc_html, open_sub = [], False
for level, txt, sid in toc:
    if level == 2:
        if open_sub:
            toc_html.append("</ol></li>")
        toc_html.append('<li class="toc-l1"><a href="#%s">%s</a><ol class="toc-sub">' % (sid, txt))
        open_sub = True
    else:
        toc_html.append('<li class="toc-l2"><a href="#%s">%s</a></li>' % (sid, txt))
if open_sub:
    toc_html.append("</ol></li>")
TOC = "\n".join(toc_html)

TITLE = "城市自由行 App 产品需求与规划设计"

HTML = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="docx-page-size" content="A4">
<title>%(title)s</title>
<style>
/* 页面规则：正文页脚居中页码，封面不显示页脚 */
@page {
  @bottom-center { content: counter(page); }
}
@page cover {
  @bottom-center { content: none; }
}
section[role="cover"] { page: cover; }

:root {
  --ff-heading: "Microsoft YaHei", "微软雅黑", sans-serif;
  --ff-body: "SimSun", "宋体", serif;
  --ff-mono: "Consolas", "Courier New", monospace;

  --fs-cover-title: 34pt;
  --fs-cover-sub: 17pt;
  --fs-kicker: 10.5pt;
  --fs-lead: 12pt;
  --fs-meta: 9.5pt;
  --fs-toc-title: 20pt;
  --fs-toc-l1: 10.5pt;
  --fs-toc-l2: 9.5pt;
  --fs-h2: 16pt;
  --fs-h3: 13pt;
  --fs-body: 12pt;
  --fs-table: 9.5pt;
  --fs-mono: 10.5pt;
  --fs-pre: 8.5pt;
  --fs-summary: 20pt;

  --color-bg: #FFFFFF;
  --color-white: #FFFFFF;
  --color-text: #1F2329;
  --color-strong: #10305C;
  --color-muted: #5F6B7A;
  --color-border: #D9E1EC;
  --color-surface: #F2F6FB;
  --color-highlight: #EEF3FA;
  --color-primary: #1565C0;
  --color-deep: #12386B;
  --color-accent: #00897B;
  --color-pre-bg: #F7F9FC;
  --color-pre-text: #24405F;
  --color-quote-bar: #9AA7B8;
  --color-quote-bg: #F7F9FC;
  --color-quote-text: #3D4A5C;
  --fs-quote: 10.5pt;

  --sp-0: 1px;
  --sp-1: 2px;
  --sp-2: 4px;
  --sp-3: 5px;
  --sp-4: 6px;
  --sp-5: 7px;
  --sp-6: 8px;
  --sp-7: 9px;
  --sp-8: 10px;
  --sp-9: 12px;
  --sp-10: 14px;
  --sp-11: 16px;
  --sp-12: 18px;
  --sp-13: 20px;
  --sp-14: 30px;
  --sp-15: 40px;
  --sp-16: 44px;
  --sp-17: 46px;
  --sp-18: 118px;
  --sp-em-15: 1.5em;
  --sp-em-21: 2.1em;

  --lh-tight: 1.25;
  --lh-head: 1.4;
  --lh-sub: 1.5;
  --lh-body: 1.72;
  --lh-compact: 1.42;

  --spacing-paragraph: 0.62em;
  --page-content-width: 15.6cm;
}

* { box-sizing: border-box; }
body {
  font-family: var(--ff-body);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  color: var(--color-text);
  background: var(--color-bg);
  max-width: var(--page-content-width);
  margin-left: auto;
  margin-right: auto;
}

/* 封面 */
.cover-kicker {
  font-family: var(--ff-heading); font-size: var(--fs-kicker); font-weight: 700;
  color: var(--color-primary); letter-spacing: 0.22em;
  text-align: left; text-indent: 0;
  margin-top: var(--sp-18); margin-bottom: var(--sp-8);
}
.cover-title {
  font-family: var(--ff-heading); font-size: var(--fs-cover-title); font-weight: 700;
  color: var(--color-deep); line-height: var(--lh-tight);
  text-align: left; text-indent: 0;
  margin-top: 0; margin-bottom: var(--sp-4);
}
.cover-sub {
  font-family: var(--ff-heading); font-size: var(--fs-cover-sub); font-weight: 400;
  color: var(--color-muted); letter-spacing: 0.04em;
  text-align: left; text-indent: 0;
  margin-top: 0; margin-bottom: var(--sp-16);
}
.cover-lead {
  font-family: var(--ff-body); font-size: var(--fs-lead); color: var(--color-text);
  line-height: var(--lh-body); text-align: left; text-indent: 0;
  margin-top: 0; margin-bottom: var(--sp-15);
}
.cover-meta-line {
  font-family: var(--ff-heading); font-size: var(--fs-meta); color: var(--color-muted);
  text-align: left; text-indent: 0;
  padding-top: var(--sp-3); padding-bottom: var(--sp-3);
  margin-top: 0; margin-bottom: 0;
  border-bottom: 0.5pt solid var(--color-border);
}
.cover-meta-line strong { color: var(--color-primary); font-weight: 700; }
.cover-foot {
  font-family: var(--ff-heading); font-size: var(--fs-meta); color: var(--color-muted);
  letter-spacing: 0.06em; text-align: left; text-indent: 0;
  margin-top: var(--sp-17);
}

/* 目录 */
.doc-toc { padding-top: var(--sp-14); }
.toc-title {
  font-family: var(--ff-heading); font-size: var(--fs-toc-title); font-weight: 700;
  color: var(--color-deep); letter-spacing: 0.12em;
  text-align: left; text-indent: 0;
  margin-top: 0; margin-bottom: var(--sp-12);
}
.toc-list, .toc-list ol, .toc-list ul {
  list-style: none; list-style-type: none; padding-left: 0; margin: 0;
}
.toc-l1 {
  font-family: var(--ff-heading); font-size: var(--fs-toc-l1); font-weight: 700;
  color: var(--color-deep); text-indent: 0;
  margin-top: var(--sp-7); margin-bottom: var(--sp-1);
}
.toc-l2 {
  font-family: var(--ff-body); font-size: var(--fs-toc-l2); color: var(--color-text);
  text-indent: 0; margin-top: var(--sp-0); margin-bottom: var(--sp-0);
}
.toc-sub { margin-top: var(--sp-1); margin-bottom: var(--sp-2); padding-left: var(--sp-em-15); }
.toc-list a { color: inherit; text-decoration: none; }

/* 内容提要 */
.executive-summary {
  background: var(--color-surface);
  border-left: 4px solid var(--color-primary);
  padding-top: var(--sp-10); padding-bottom: var(--sp-10);
  padding-left: var(--sp-11); padding-right: var(--sp-11);
  margin-top: var(--sp-11); margin-bottom: var(--sp-13);
}
.summary-title {
  font-family: var(--ff-heading); font-size: var(--fs-summary); font-weight: 700;
  color: var(--color-deep); text-align: left; text-indent: 0;
  margin-top: 0; margin-bottom: var(--sp-9);
}
.summary-text {
  font-family: var(--ff-body); font-size: var(--fs-body); color: var(--color-text);
  line-height: var(--lh-body); text-align: justify; text-indent: 2em;
  margin-top: var(--sp-8); margin-bottom: 0;
}

/* 正文 */
.report-body { padding-top: var(--sp-4); }
p {
  font-family: var(--ff-body); font-size: var(--fs-body); color: var(--color-text);
  line-height: var(--lh-body); text-align: justify; text-indent: 2em;
  margin-top: 0; margin-bottom: var(--spacing-paragraph);
}
h2 {
  font-family: var(--ff-heading); font-size: var(--fs-h2); font-weight: 700;
  color: var(--color-deep); background: var(--color-highlight);
  border-left: 6px solid var(--color-primary);
  padding-top: var(--sp-6); padding-bottom: var(--sp-6);
  padding-left: var(--sp-9); padding-right: var(--sp-9);
  line-height: var(--lh-head); text-align: left; text-indent: 0;
  margin-top: var(--sp-14); margin-bottom: var(--sp-10);
}
h3 {
  font-family: var(--ff-heading); font-size: var(--fs-h3); font-weight: 700;
  color: var(--color-deep); line-height: var(--lh-sub);
  text-align: left; text-indent: 0;
  margin-top: var(--sp-13); margin-bottom: var(--sp-6);
}
.h3-mark { color: var(--color-primary); font-weight: 700; }
strong { font-weight: 700; color: var(--color-strong); }
.mono { font-family: var(--ff-mono); font-size: var(--fs-mono); }

ul.list, ol.list {
  margin-top: var(--sp-2); margin-bottom: var(--sp-9); padding-left: var(--sp-em-21);
}
ul.list li, ol.list li {
  font-family: var(--ff-body); font-size: var(--fs-body); color: var(--color-text);
  line-height: var(--lh-sub); text-align: justify; text-indent: 0;
  margin-bottom: var(--sp-2);
}

.callout {
  border-left: 4px solid var(--color-primary);
  background: var(--color-surface);
  padding-top: var(--sp-7); padding-bottom: var(--sp-7);
  padding-left: var(--sp-9); padding-right: var(--sp-9);
  margin-top: var(--sp-8); margin-bottom: var(--sp-10);
}

.quote {
  font-family: var(--ff-body); font-size: var(--fs-quote); color: var(--color-quote-text);
  line-height: var(--lh-sub); text-align: justify; text-indent: 0;
  border-left: 3px solid var(--color-quote-bar);
  background: var(--color-quote-bg);
  padding-top: var(--sp-7); padding-bottom: var(--sp-7);
  padding-left: var(--sp-9); padding-right: var(--sp-9);
  margin-top: var(--sp-6); margin-bottom: var(--sp-10);
}

pre.tree {
  font-family: var(--ff-mono); font-size: var(--fs-pre); color: var(--color-pre-text);
  background: var(--color-pre-bg); border: 0.5pt solid var(--color-border);
  line-height: var(--lh-compact); text-indent: 0;
  padding-top: var(--sp-8); padding-bottom: var(--sp-8);
  padding-left: var(--sp-9); padding-right: var(--sp-9);
  margin-top: var(--sp-6); margin-bottom: var(--sp-10);
}

table.grid, table.summary-metrics {
  width: 100%%; border-collapse: collapse;
  margin-top: var(--sp-6); margin-bottom: var(--sp-11);
  font-family: var(--ff-heading);
}
table.grid th, table.summary-metrics th {
  font-family: var(--ff-heading); font-size: var(--fs-table); font-weight: 700;
  color: var(--color-white); background: var(--color-primary);
  border: 0.5pt solid var(--color-primary); line-height: var(--lh-sub);
  padding-top: var(--sp-3); padding-bottom: var(--sp-3);
  padding-left: var(--sp-5); padding-right: var(--sp-5);
  text-align: left; text-indent: 0;
}
table.grid td, table.summary-metrics td {
  font-family: var(--ff-heading); font-size: var(--fs-table); color: var(--color-text);
  border: 0.5pt solid var(--color-border); line-height: var(--lh-sub);
  padding-top: var(--sp-3); padding-bottom: var(--sp-3);
  padding-left: var(--sp-5); padding-right: var(--sp-5);
  text-align: left; vertical-align: top; text-indent: 0;
}
table.summary-metrics { margin-top: 0; margin-bottom: var(--sp-2); }
</style>
</head>
<body>

<section role="cover">
  <p class="cover-kicker">产品规划 · PRODUCT PLANNING</p>
  <p class="cover-title">城市自由行 App</p>
  <p class="cover-sub">产品需求与规划设计</p>
  <p class="cover-lead">把“做攻略”从用户身上转移到系统身上。</p>
  <p class="cover-lead">一份路线合理、可以随时修改、旅行中能直接用、行程能长期保存的按天日程。</p>
  <p class="cover-meta-line"><strong>文档版本</strong>　　v1.0　规划稿</p>
  <p class="cover-meta-line"><strong>适用阶段</strong>　　需求确认 · 设计评审 · 开发排期</p>
  <p class="cover-meta-line"><strong>首版范围</strong>　　国内单城试点 · 1—5 天自由行 · Android 内测</p>
  <p class="cover-meta-line"><strong>编制日期</strong>　　2026 年 11 月</p>
  <p class="cover-foot">一人一座城，一趟可执行的旅行</p>
</section>

<section role="cover">
<nav class="doc-toc" aria-label="文档目录">
  <p class="toc-title">目录</p>
  <ol class="toc-list">
%(toc)s
  </ol>
</nav>
</section>

<section role="body" class="report-body" data-page-restart="1">

<div class="executive-summary">
  <p class="summary-title">内容提要</p>
  <table class="summary-metrics">
    <thead>
      <tr><th>试点城市</th><th>行程长度</th><th>首版 P0 功能</th><th>开发周期</th></tr>
    </thead>
    <tbody>
      <tr><td>1 座</td><td>1—5 天</td><td>14 项</td><td>8—10 周</td></tr>
    </tbody>
  </table>
  <p class="summary-text">这份规划把“按城市推荐路线、生成日程”的初始想法，收敛为一个可执行的命题：让用户在一座城市完成从发现地点到途中调整的完整闭环。首版刻意放弃交易、社区与多城联程，把资源集中在内容时效、排程可信与编辑顺畅三件事上。判断成败的标准不是功能多少，而是用户是否真的照着这份日程走完了一趟旅行。</p>
</div>

%(body)s
</section>

</body>
</html>
""" % {"title": TITLE, "toc": TOC, "body": BODY}

io.open(OUT, "w", encoding="utf-8", newline="\n").write(HTML)
print("OK", OUT)
print("chars", len(HTML), "toc", len(toc), "blocks", len(blocks))
