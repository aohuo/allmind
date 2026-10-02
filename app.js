/*
 * AIM 几何标志动画
 * ----------------
 * 这个文件只负责“几何线条”的播放顺序；背景噪点、扫描线、辉光等装饰动画
 * 放在 style.css 中完成。
 *
 * 播放顺序：
 * 1. 外部三角形
 * 2. 左右两条 A 的内斜线（同时）
 * 3. A 的横线
 * 4. M 的两条内斜线（同时）
 * 5. I 的中间竖线
 * 6. 完整标志短暂闪烁两次（不能单击跳过）
 * 7. 登录与注册入口与闪烁同时出现，闪烁结束后才开放点击
 *
 * 线条动画的核心原理是：
 * - stroke-dasharray 把 SVG 线条设置成“一个实线段 + 一个空白段”；
 * - 两段的长度都等于路径总长度；
 * - stroke-dashoffset 从路径总长度变为 0 时，线条就像被逐步画出来一样。
 */

/*
 * ==================== JavaScript 声明语句基础 ====================
 *
 * 下面多次出现这种语句：
 *
 *     const scene = document.querySelector("#scene");
 *
 * 可以按照“声明关键字—变量名—赋值—表达式—语句结束”拆解：
 *
 * - const：声明一个块级作用域常量绑定；
 * - scene：程序员自定义的变量名，使用小驼峰命名法；
 * - =：赋值运算符，把右侧计算结果保存到左侧变量；
 * - document.querySelector("#scene")：调用函数并产生一个 DOM 元素；
 * - ;：表示这条语句结束。
 *
 * JavaScript 的 const 规范：
 *
 * 1. const 声明时必须立即赋初值，不能只写 const scene;
 * 2. const 变量之后不能重新指向另一个值，例如不能再写 scene = otherElement;
 * 3. 如果 const 保存的是对象，并不代表对象内部完全只读。
 *    例如 scene.classList.add(...) 是允许的，因为 scene 仍指向同一个元素，
 *    改变的是这个元素的状态，而不是让 scene 指向另一个对象；
 * 4. 能用 const 时优先使用 const。只有变量确实需要重新赋值时才使用 let；
 * 5. 不建议使用旧式 var。var 的函数作用域和变量提升更容易造成误解。
 *
 * 这与 C 语言的 const 不完全相同：
 * - C 的 const 主要限制“能否通过当前名称修改值”；
 * - JavaScript 的 const 限制的是“变量绑定能否重新赋值”。
 */

/*
 * document 是浏览器提供的全局对象，代表当前 HTML 文档。
 *
 * querySelector(selector) 接收一个 CSS 选择器字符串，并返回第一个匹配元素：
 * - "#scene" 中 # 表示按 id 查找；
 * - ".outer-triangle" 中 . 表示按 class 查找；
 * - 如果没有找到元素，它会返回 null。
 *
 * 本项目把 <script> 放在 body 末尾，所以执行到这里时 HTML 已经加载，
 * 对应元素应当存在。大型项目仍可检查 null，或使用 TypeScript增强类型检查。
 */

// 缓存页面元素，避免每次播放动画时重复查询 DOM。
const scene = document.querySelector("#scene");
const replay = document.querySelector("#replay");

// 让完整标志一起闪烁；背景层和账号按钮不包含在这个容器内。
const markWrap = document.querySelector(".mark-wrap");

/*
 * 登录和注册按钮的共同容器。
 * HTML 中使用 id="auth-actions"，所以这里用 #auth-actions 按唯一 id 查找。
 */
const authActions = document.querySelector("#auth-actions");

// 外部三角形。
const outerTriangle = document.querySelector(".outer-triangle");

// A 的两条内斜线。
const innerLeft = document.querySelector(".inner-left");
const innerRight = document.querySelector(".inner-right");

// A 的横线。
const crossbar = document.querySelector(".a-bar");

// M 中间向下汇合的两条线。
const mLeft = document.querySelector(".m-left");
const mRight = document.querySelector(".m-right");

// I 的垂直线。
const iStem = document.querySelector(".i-stem");

/*
 * sequenceId 是本次播放的编号。
 *
 * 用户可能在动画尚未结束时再次点击重播。每次调用 runSequence() 都会让
 * sequenceId 加 1。异步函数完成一个阶段后会检查自己的编号是否仍然有效；
 * 如果编号已经变化，说明新的播放已经开始，旧动画就不再继续后续阶段。
 *
 * let 与 const 的区别：
 * - sequenceId 会执行 ++sequenceId，因此数值会改变，必须使用 let；
 * - activeAnimations 重播后会被赋值为新数组 []，也必须使用 let；
 * - 如果只是向数组 push()，而从不把变量换成另一个数组，则可以使用 const。
 *
 * 变量作用域：
 * 这里声明在所有函数外部，因此属于本 ES 脚本的顶层作用域，下面每个函数
 * 都能访问它们。函数内部声明的 currentSequence 则只能在函数内部使用。
 */
let sequenceId = 0;

/*
 * isSequencePlaying 记录“主几何动画目前是否仍在播放”。
 *
 * boolean（布尔值）只有 true 和 false 两种值：
 * - true：单击画面应当跳过动画并显示最终结果；
 * - false：动画已经结束，单击画面不执行任何操作。
 *
 * 这个变量会在播放开始、正常结束和手动跳过时改变，因此使用 let。
 * 变量名使用 is... 开头，是布尔变量的常见命名规范，读起来像一个问题：
 * “is sequence playing?”（序列是否正在播放？）。
 */
let isSequencePlaying = false;

/*
 * isFinalePlaying 记录不可跳过的收尾阶段，与可跳过的几何绘制分开管理。
 * 闪烁开始后设为 true，完整播放两次后才恢复 false。
 * 单击、双击和重播入口都检查这个状态，避免连续点击中断或重复启动闪烁。
 */
let isFinalePlaying = false;

/*
 * [] 是数组字面量，表示创建一个空数组。
 * 数组用于按顺序保存多个值，下标从 0 开始：
 * activeAnimations[0] 表示第一项。
 *
 * 保存由 Web Animations API 创建的动画，重播时可以逐一 cancel()。
 */
let activeAnimations = [];

/*
 * ==================== 箭头函数和 Promise ====================
 *
 * const wait = (milliseconds) => ... 声明一个箭头函数：
 * - wait：保存函数的变量名；
 * - milliseconds：形参，调用者传入的毫秒数会保存在这里；
 * - =>：箭头函数符号；
 * - 没有大括号时，箭头右侧表达式会被自动作为返回值。
 *
 * new Promise(...) 创建一个 Promise 对象。
 * Promise 表示“现在还没有结果，但未来会完成或失败”的异步任务。
 *
 * resolve 是由 Promise 提供的函数；setTimeout 到时后调用 resolve，
 * Promise 就从等待状态变为完成状态，等待它的 await 才会继续向下执行。
 *
 * window.setTimeout(resolve, milliseconds) 的两个实参分别是：
 * 1. 到时后要调用的函数；
 * 2. 等待的毫秒数。
 */
const wait = (milliseconds) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

/**
 * 取消当前仍存在的所有几何动画。
 *
 * animation.cancel() 不只会停止动画，还会移除 fill: "forwards" 留下的最终效果，
 * 因而重播时不会看到上一轮动画残留的横线或斜线。
 *
 * function cancelActiveAnimations() 是函数声明：
 * - function：声明普通函数的关键字；
 * - cancelActiveAnimations：函数名，采用“动词 + 对象”的命名方式；
 * - ()：参数列表为空，表示调用时无需传入数据；
 * - { ... }：函数体；
 * - 此函数没有显式 return，因此默认返回 undefined。
 */
function cancelActiveAnimations() {
  /*
   * forEach 是数组方法，会为数组中的每个元素调用一次回调函数。
   *
   * (animation) => animation.cancel()
   * 表示接收当前数组项，将它命名为 animation，然后调用其 cancel 方法。
   * 它等价于写一个普通循环，但这里的“对每项执行同一操作”语义更直接。
   */
  activeAnimations.forEach((animation) => animation.cancel());

  /*
   * = 是重新赋值，不是比较。
   * 用一个新的空数组替换旧数组，旧数组随后会由垃圾回收器自动回收。
   */
  activeAnimations = [];
}

/**
 * 把所有几何元素恢复到播放前的隐藏状态。
 *
 * 注意：这里同时修改 visibility 和虚线属性。visibility 负责彻底防止首帧闪烁；
 * strokeDasharray 则为下一次路径绘制准备一个明确的空白状态。
 */
function resetGeometry() {
  // 函数调用使用“函数名(实参)”语法；这里没有实参。
  cancelActiveAnimations();

  /*
   * 去掉上一轮的三个最终状态：
   * - is-complete：完整显示 AIM 几何图形；
   * - show-auth-actions：把登录/注册按钮移到页面中线；
   * - skip-auth-motion：单击跳过时关闭按钮过渡。
   */
  scene.classList.remove("is-complete", "show-auth-actions", "skip-auth-motion");

  /*
   * inert 是 HTML 元素的布尔属性。
   * 设置为 true 后，按钮组及其内部链接不能被点击或通过 Tab 键聚焦。
   * aria-hidden 则告诉屏幕阅读器：动画完成前不需要朗读这组入口。
   */
  authActions.inert = true;
  authActions.setAttribute("aria-hidden", "true");

  /*
   * [outerTriangle, ...] 是数组字面量，用于临时组合所有可绘制路径。
   *
   * for (const path of array) 是 for...of 循环：
   * - 每轮从数组取出一个元素；
   * - 当前元素保存在只用于本轮的 const path 中；
   * - path 是元素本身，不是数组下标。
   *
   * 这些 path 都使用相同的“描边绘制”动画，因此可以统一重置。
   * 当多个对象需要相同操作时，用循环比复制六遍语句更不容易漏改。
   */
  for (const path of [outerTriangle, innerLeft, innerRight, mLeft, mRight, iStem]) {
    /*
     * element.style.property = value 会写入元素的行内样式。
     * JavaScript 属性名使用小驼峰，因此 CSS 的 stroke-dasharray
     * 在 JS 中写作 strokeDasharray。
     */
    path.style.visibility = "hidden";
    path.style.strokeDasharray = "0 9999";
    path.style.strokeDashoffset = "0";
  }

  // 横线使用横向缩放动画，不使用 stroke-dashoffset，所以单独重置。
  crossbar.style.visibility = "hidden";
  crossbar.style.transform = "scaleX(0)";
}

/**
 * 从路径起点到终点绘制一条 SVG path。
 *
 * @param {SVGPathElement} path 要绘制的 SVG 路径
 * @param {number} duration 动画时长，单位为毫秒
 * @param {string} easing Web Animations API 使用的缓动函数
 * @param {number} currentSequence 调用者所属的播放编号
 * @returns {Promise<boolean>} true 表示正常完成；false 表示被新一轮播放取消
 *
 * async function 表示“异步函数”：
 * - 它内部可以使用 await；
 * - 无论 return 后面写什么，调用结果都会包装为 Promise；
 * - return true 实际上相当于返回一个最终得到 true 的 Promise；
 * - 直接 return; 则最终值为 undefined。
 *
 * 上面的 @param/@returns 使用 JSDoc 语法。编辑器可以读取这些注释，
 * 在鼠标悬停或自动补全时显示参数说明；它不会改变浏览器运行结果。
 */
async function drawPath(path, duration, easing, currentSequence) {
  /*
   * !== 是“严格不等于”：
   * 它同时比较值和类型，不会像 != 那样先进行隐式类型转换。
   * JavaScript 项目通常优先使用 === 和 !==，减少 "1" 与 1 被当作相等的意外。
   *
   * 单行 if 没有大括号时，只控制紧随其后的一个语句。
   * return false 会立即结束本函数，后面的绘制代码不会执行。
   */
  if (currentSequence !== sequenceId) return false;

  /*
   * getTotalLength() 由浏览器根据 path 的 d 属性计算真实长度。
   * 不能手写一个固定长度：SVG 在不同窗口宽度下会缩放，固定值可能覆盖不完整，
   * 造成动画开始时路径末端提前露出，或动画结束时路径还没有完全闭合。
   */
  const length = path.getTotalLength();

  /*
   * dasharray = “路径长度 路径长度”
   * 表示一个完整路径长度的实线段，后接一个同样长度的空白段。
   *
   * dashoffset = 路径长度
   * 将实线段整体移出可见区域，形成动画的初始隐藏状态。
   */
  path.style.visibility = "visible";
  /*
   * 反引号 `...` 创建“模板字符串”。
   * ${length} 会把 length 的数值插入字符串。
   *
   * 如果 length 是 177：
   * `${length} ${length}` 的结果就是字符串 "177 177"。
   */
  path.style.strokeDasharray = `${length} ${length}`;
  path.style.strokeDashoffset = `${length}`;

  /*
   * Element.animate() 是 Web Animations API。
   * fill: "forwards" 表示动画完成后暂时保留最后一帧，避免 await 返回时线条闪回。
   */
  const animation = path.animate(
    /*
     * 第一个实参是关键帧数组。
     * 数组内每个 { ... } 是对象字面量；属性名 strokeDashoffset
     * 对应要进行插值的 CSS 属性。
     */
    [
      { strokeDashoffset: `${length}` },
      { strokeDashoffset: "0" },
    ],
    /*
     * 第二个实参是选项对象。
     * { duration, easing, fill: "forwards" } 使用了对象属性简写：
     * duration 等价于 duration: duration；
     * easing 等价于 easing: easing。
     */
    { duration, easing, fill: "forwards" },
  );

  // push() 把新动画追加到数组末尾，并会返回新的数组长度（这里不需要该返回值）。
  activeAnimations.push(animation);

  try {
    // animation.finished 是一个 Promise，只有这条线真正画完才会继续。
    await animation.finished;
  } catch {
    // cancel() 会让 finished Promise 被拒绝；这是重播时的正常情况。
    return false;
  }

  // 等待期间可能已经开始了新一轮播放，因此完成后再次检查编号。
  if (currentSequence !== sequenceId) return false;

  /*
   * 动画结束后移除虚线模式，变成普通完整实线。
   * 这样可以避免浏览器对小数路径长度进行取整时在末端留下细小缝隙。
   */
  path.style.strokeDasharray = "none";
  path.style.strokeDashoffset = "0";
  return true;
}

/**
 * 展开 A 的横线。
 *
 * 横线从中心向左右展开，所以使用 scaleX，而不是 stroke-dashoffset。
 * transform-origin: center 和 transform-box: fill-box 在 CSS 中设置。
 */
async function revealCrossbar(currentSequence) {
  if (currentSequence !== sequenceId) return false;

  crossbar.style.visibility = "visible";

  /*
   * animate() 不仅能插值 SVG 描边，也可以插值普通 CSS transform。
   * scaleX(0) 表示横向宽度缩小到 0；scaleX(1) 表示恢复原宽度。
   */
  const animation = crossbar.animate(
    [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
    { duration: 550, easing: "ease-out", fill: "forwards" },
  );
  activeAnimations.push(animation);

  try {
    await animation.finished;
  } catch {
    // 用户在横线展开过程中重播时，会进入这里并结束旧序列。
    return false;
  }

  if (currentSequence !== sequenceId) return false;
  crossbar.style.transform = "scaleX(1)";
  return true;
}

/**
 * 播放不能跳过的两次短暂闪烁，同时让账号入口上升。
 * 正常绘制结束与单击跳过绘制，都必须经过这个共同的收尾步骤。
 *
 * @param {number} currentSequence 当前播放编号，防止旧序列启动收尾
 * @param {boolean} skipButtonMotion 是否省略后续按钮上升动画
 */
async function finishWithBlink(currentSequence, skipButtonMotion = false) {
  if (currentSequence !== sequenceId || isFinalePlaying) return;

  // 先关闭可跳过阶段，再锁住收尾；这两句在第一个 await 之前同步执行。
  isSequencePlaying = false;
  isFinalePlaying = true;
  replay.disabled = true;
  scene.classList.add("is-complete", "is-finalizing");

  // 跳过绘制时仍省略按钮上升；正常播放时按钮与第一次闪烁同步开始移动。
  if (skipButtonMotion) scene.classList.add("skip-auth-motion");
  scene.classList.add("show-auth-actions");

  /*
   * show-auth-actions 只负责外观和位置，按钮仍保持 inert 和 aria-hidden。
   * 必须等闪烁结束才解除这些限制，避免在上升过程中跳转页面而中断闪烁。
   */

  /*
   * matchMedia() 读取系统偏好；减少动态效果时使用较轻的亮度变化，
   * 仍保留两次闪烁的顺序和时长。
   * const 绑定不再重新赋值，条件运算符“条件 ? 值1 : 值2”选出最低透明度。
   */
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dimOpacity = reduceMotion ? 0.75 : 0.18;

  /*
   * 一轮为“正常 → 变暗 → 恢复”，duration: 220 表示每轮 220 毫秒；
   * iterations: 2 让同一组关键帧播放两遍，总计约 440 毫秒。
   * offset 表示一轮内的时间比例，不是页面位置。
   * 0.36 和 0.8 让变暗、恢复仍分别约为 80ms 和 96ms，
   * 两轮间保持正常亮度的停顿从原先约 144ms 缩短到约 44ms。
   *
   * 此动画故意不加入 activeAnimations：那个数组用于取消可跳过的几何动画，
   * 而本阶段必须等待 finished 完成，才允许恢复重播和点击账号入口。
   */
  const blink = markWrap.animate(
    [
      { opacity: 1, offset: 0 },
      { opacity: dimOpacity, offset: 0.36 },
      { opacity: 1, offset: 0.8 },
      { opacity: 1, offset: 1 },
    ],
    { duration: 220, iterations: 2, easing: "linear" },
  );

  try {
    await blink.finished;
  } finally {
    // finally 在等待结束时负责清理状态，避免按钮一直停留在禁用状态。
    blink.cancel();
    scene.classList.remove("is-finalizing");
    isFinalePlaying = false;
    replay.disabled = false;
  }

  if (currentSequence !== sequenceId) return;
  // 两次闪烁完成后开放入口；按钮的位置过渡由 CSS 自行继续到终点。
  authActions.inert = false;
  authActions.removeAttribute("aria-hidden");
}

/**
 * 按设计顺序播放完整动画。
 *
 * 串行阶段直接使用 await；
 * 需要同时绘制的左右对称线使用 Promise.all()。
 *
 * “串行”与“并行”：
 * - await drawPath(a); await drawPath(b); 表示 a 完成后才开始 b；
 * - await Promise.all([drawPath(a), drawPath(b)]) 表示 a、b 立即一起开始，
 *   等两者都完成后才继续。
 */
async function runSequence() {
  // 收尾闪烁期间不启动新一轮，保证两次闪烁能够完整播放。
  if (isFinalePlaying) return;

  /*
   * ++sequenceId 是前置自增：
   * 先让 sequenceId 加 1，再把新值赋给 currentSequence。
   *
   * const currentSequence 是函数内部局部变量，每次调用 runSequence()
   * 都会创建独立的一份，因此旧调用能记住自己开始时的编号。
   */
  const currentSequence = ++sequenceId;

  // 新一轮序列开始。从现在起，用户单击画面可以直接跳到最终状态。
  isSequencePlaying = true;
  resetGeometry();

  /*
   * 重新触发 CSS 装饰动画：
   * 1. 添加 .restarting，临时把相关 animation 设为 none；
   * 2. 读取 offsetWidth，强制浏览器立即计算一次布局；
   * 3. 移除 .restarting，CSS 动画便会从头播放。
   *
   * “void”表示我们只需要触发布局读取，不使用 offsetWidth 的返回值。
   */
  scene.classList.add("restarting");
  void scene.offsetWidth;
  scene.classList.remove("restarting");

  // 留出 200ms 空白，让页面背景先出现，再开始绘制图形。
  await wait(200);
  if (
    !(await drawPath(
      outerTriangle,
      2150,
      "cubic-bezier(.55,.05,.36,1)",
      currentSequence,
    ))
  ) return;

  // 外三角形真正完成后才进入下一阶段，不依赖容易重叠的绝对 CSS 延迟。
  await wait(180);

  // 两条内斜线分别从底边 1/4、3/4 处同时向顶点绘制。
  const innerResults = await Promise.all([
    drawPath(innerLeft, 1250, "ease-in-out", currentSequence),
    drawPath(innerRight, 1250, "ease-in-out", currentSequence),
  ]);

  /*
   * innerResults 是布尔值数组，例如 [true, true]。
   * some(callback) 只要发现一项让回调返回 true，整体就返回 true。
   *
   * completed => !completed 中 ! 是逻辑取反：
   * completed 为 false 时，!completed 为 true，表示至少有动画未完成。
   */
  if (innerResults.some((completed) => !completed)) return;

  // 两条 A 斜线都完成后，横线才从中心向左右展开。
  await wait(140);
  if (!(await revealCrossbar(currentSequence))) return;

  await wait(140);
  // 从横线两端同时向底边中点绘制，和内斜线下半段组合成 M。
  const mResults = await Promise.all([
    drawPath(mLeft, 850, "ease-in-out", currentSequence),
    drawPath(mRight, 850, "ease-in-out", currentSequence),
  ]);
  if (mResults.some((completed) => !completed)) return;

  await wait(140);

  // 从横线中点垂直向下连接到三角形底边中点。
  if (!(await drawPath(iStem, 700, "ease-out", currentSequence))) return;

  /*
   * 最终锁定完整图形。
   * 只有当前播放编号仍然有效时才添加，防止旧动画覆盖新一轮播放。
   */
  if (currentSequence === sequenceId) {
    /*
     * 原先这里直接锁定完整 AIM 并显示按钮；现在同时启动收尾闪烁和按钮上升。
     * 正常完成时没有 skip-auth-motion，所以 CSS 的 .9s 上升过渡仍会执行。
     */
    await finishWithBlink(currentSequence);
  }
}

/**
 * 在动画播放期间，将所有元素立即切换为最终状态。
 *
 * 这里不能只添加 .is-complete：resetGeometry() 给尚未播放的路径写入了
 * visibility: hidden 行内样式，而行内样式的优先级高于普通 CSS 类。
 * 因此本函数会同时把每条路径的行内样式改成最终值。
 *
 * @param {MouseEvent} event 浏览器在用户单击时创建的鼠标事件对象
 */
async function finishSequenceImmediately(event) {
  /*
   * ! 是逻辑取反运算符。
   * 当 isSequencePlaying 为 false 时，!false 得到 true，于是立即 return。
   * 这样动画结束后的普通单击不会反复执行重置，也不会意外重新播放。
   */
  if (isFinalePlaying || !isSequencePlaying) return;

  /*
   * 重播按钮自身已经通过 stopPropagation() 阻止事件冒泡。
   * 这里再做一次目标检查，防止以后修改 HTML 事件结构时，按钮点击被误判为跳过。
   *
   * instanceof Element 用于确认 event.target 是可以调用 closest() 的 DOM 元素；
   * closest("#replay") 会从被点击元素向祖先查找重播按钮。
   */
  if (event.target instanceof Element && event.target.closest("#replay")) return;

  /*
   * 让序列编号加一，使当前 runSequence() 和其中尚在等待的异步阶段全部失效。
   * 例如点击发生在 await wait(180) 期间，等待结束后旧函数会发现编号不一致，
   * 从而不会再次启动后续动画。
   */
  sequenceId += 1;
  isSequencePlaying = false;

  // 取消当前正在运行的 Web Animations API 动画，并清空动画数组。
  cancelActiveAnimations();

  /*
   * 无论用户在哪一个阶段点击，都统一将全部 SVG 路径设置为普通完整实线。
   * - visibility = "visible"：显示元素；
   * - strokeDasharray = "none"：取消虚线结构；
   * - strokeDashoffset = "0"：消除路径偏移。
   */
  for (const path of [outerTriangle, innerLeft, innerRight, mLeft, mRight, iStem]) {
    path.style.visibility = "visible";
    path.style.strokeDasharray = "none";
    path.style.strokeDashoffset = "0";
  }

  // 横线使用缩放动画，因此恢复方式与使用虚线描边的路径不同。
  crossbar.style.visibility = "visible";
  crossbar.style.transform = "scaleX(1)";

  /*
   * 移除可能短暂存在的重播重置类，再添加最终状态类。
   * classList 是 DOMTokenList，可以用 add/remove 操作 class，而无需手写整个
   * class="..." 字符串，因此不会误删 scene 原本的类名。
   */
  scene.classList.remove("restarting");

  /*
   * skip-auth-motion 负责取消按钮的 transition；show-auth-actions 负责把 top
   * 直接设置为“页面中线下方 7.25rem”。现在由共同收尾函数统一处理：
   * 开始闪烁时就让按钮直接到达最终位置，但闪烁结束前不能点击。
   * 第二个实参 true 表示“只跳过后续按钮上升，不跳过收尾闪烁”。
   */
  await finishWithBlink(sequenceId, true);
}

/**
 * 重播入口。
 * stopPropagation() 防止点击按钮时事件继续冒泡到 scene。
 *
 * event?.stopPropagation() 使用“可选链” ?.：
 * - 有 event 时调用 stopPropagation()；
 * - event 为 null/undefined 时跳过，不抛出错误。
 *
 * runSequence() 首次自动调用时没有事件对象，因此这种写法可让函数同时适用于
 * 事件回调和普通调用。
 */
function replaySequence(event) {
  event?.stopPropagation();
  // 禁用按钮只能阻止按钮点击；这里还要拦住冒泡到场景的双击重播。
  if (isFinalePlaying) return;
  runSequence();
}

/*
 * addEventListener(事件名称, 回调函数) 注册事件监听器。
 *
 * 这里传入 replaySequence，而不是 replaySequence()：
 * - replaySequence 表示“把函数交给浏览器，以后点击时调用”；
 * - replaySequence() 表示“现在立刻调用，并把返回值交给浏览器”，不符合需求。
 */
// 单击右下角按钮重播。
replay.addEventListener("click", replaySequence);

/*
 * 单击主场景时尝试跳过动画。
 * finishSequenceImmediately 内部会检查 isSequencePlaying，所以动画结束后单击无效。
 * 重播按钮的 click 事件会先在按钮上执行，并由 stopPropagation() 阻止冒泡到这里。
 */
scene.addEventListener("click", finishSequenceImmediately);

// 双击画面任意非按钮区域也可重播。
scene.addEventListener("dblclick", replaySequence);

// 页面脚本加载完成后自动播放一次。
runSequence();
