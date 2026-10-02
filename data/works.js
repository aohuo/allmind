/*
 * 站点内容数据
 * ==============
 * 纯静态方案下,数据通过 <script> 标签加载(而不是 fetch 一个 JSON 文件),
 * 因为用 file:// 直接双击打开时,浏览器会拦截对本地 JSON 的 fetch(CORS 限制),
 * 而 <script src> 没有这个问题。部署到 GitHub Pages 等 HTTP 环境同样可用。
 *
 * 这个文件暴露一个全局对象 window.APP_DATA,包含两类数据:
 *   - works: 成果条目(视频 / 图片);
 *   - notes: 作者预置的便签批注,通过 anchorId 钉在对应的成果卡片上。
 *
 * 作者更新内容的两种方式:
 *   1. 直接编辑下面的数组;
 *   2. 在 notebook.html 打开「编辑模式」(URL 加 ?edit),拖好便签后点
 *      「导出 JSON」,把得到的内容覆盖到这里,再提交部署。
 */

window.APP_DATA = {
  /* ==================== 成果条目 ==================== */

  works: [
    {
      id: "guitar-2026-03", // 全局唯一 id,便签靠它锚定,不要重复
      type: "video",        // "video" | "image"
      title: "指弹练习 · 2026-03",
      date: "2026-03",
      category: "音乐",
      tags: ["吉他", "指弹"],
      desc: "一段指弹练习录像,记录近期进度。",

      // 视频有两种放法,二选一:
      //   kind: "embed" + src 填 B 站 / YouTube 的嵌入地址;
      //   kind: "file"  + src 填 assets 目录里的 mp4 相对路径。
      video: { kind: "embed", src: "" },

      // 封面图(可选):视频未播放时展示。留空字符串则显示默认占位。
      poster: "assets/media/guitar-2026-03.jpg",
    },

    {
      id: "flute-2025-12",
      type: "video",
      title: "长笛练习片段",
      date: "2025-12",
      category: "音乐",
      tags: ["长笛", "吹奏"],
      desc: "吹奏练习片段,仍在打基础。",
      video: { kind: "embed", src: "" },
      poster: "",
    },

    {
      id: "project-notes-wall",
      type: "image",
      title: "便签墙项目",
      date: "2026-01",
      category: "项目",
      tags: ["前端", "原生 JS"],
      desc: "一个可拖拽便签墙的小项目。",
      image: "assets/media/notes-wall.jpg",
    },

    {
      id: "project-palette",
      type: "image",
      title: "配色方案",
      date: "2025-11",
      category: "项目",
      tags: ["设计"],
      desc: "某个界面的配色截图。",
      image: "assets/media/palette.jpg",
    },
  ],

  /* ==================== 预置便签批注 ==================== */

  /*
   * 便签的 x / y 是“相对它所锚定卡片左上角”的偏移,单位为像素。
   * 所以卡片在响应式布局中换行、换位置,便签都会跟着走,不会错位。
   * x / y 允许为负数或超过卡片尺寸——便签可以部分悬在卡片外面。
   *
   * size:  "small" | "medium" | "large"
   * color: "yellow" | "pink" | "green" | "blue" | "gray"
   * tilt:  倾斜角度(度),正数顺时针,负数逆时针。
   * text:  批注内容,\n 表示换行。
   */
  notes: [
    {
      id: "n-guitar-1",
      anchorId: "guitar-2026-03",
      x: -26,
      y: -30,
      size: "small",
      color: "yellow",
      tilt: -1.4,
      text: "这段扫弦在第 2 小节有点抢拍\n下次先跟节拍器慢练 70% 速度",
    },
    {
      id: "n-flute-1",
      anchorId: "flute-2025-12",
      x: 22,
      y: -20,
      size: "small",
      color: "green",
      tilt: 1.1,
      text: "气息还是不够稳,长音再练两周",
    },
    {
      id: "n-notes-1",
      anchorId: "project-notes-wall",
      x: -18,
      y: 18,
      size: "medium",
      color: "pink",
      tilt: 0.9,
      text: "这个小项目 3 天做完\nCanvas + 原生 JS",
    },
    {
      id: "n-palette-1",
      anchorId: "project-palette",
      x: 12,
      y: 12,
      size: "small",
      color: "blue",
      tilt: -0.7,
      text: "这版配色是最终稿吗?\n对比度再高一点",
    },
  ],
};
