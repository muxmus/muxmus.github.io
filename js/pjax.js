$(document).pjax('a[date-pjax]', '#main-content', {
	fragment: '#main-content', timeout: '60000'
});

$(document).on('pjax:send', function() {
  NProgress.start();
});
$(document).on('pjax:complete', function() {
  NProgress.done();
});

$(document).on('ready pjax:end', function(event) {
	var sidebarHref = window.location.href;
	$("#sidebar-link a").each(function(){
		if($(this).attr('href') ==sidebarHref){
			$(this).css({'opacity':'.7','background-color':'#000','border-radius':'5px','padding':'2px','cursor':'not-allowed','text-decoration':'none'})
		}else{
			$(this).removeAttr("style","")
		};
	});
	hljs.highlightAll();
	hljs.initLineNumbersOnLoad();

/**
 * image-preview.js
 *
 * 用法：在页面中引入此脚本，为需要预览的 <img> 标签添加 data-preview 属性即可。
 * 可通过修改 PREVIEW_ATTR 使用不同的属性名。
 *
 * <img src="photo.jpg" data-preview alt="...">
 */
(function () {
  'use strict';

  /* ═══════════════════════════════════════════════
   * 配置
   * ═══════════════════════════════════════════════ */
  const PREVIEW_ATTR  = 'data-preview'; // 触发预览的 img 属性
  const ZOOM_FACTOR   = 1.8;            // 点击放大倍数
  const DAMPING       = 0.28;           // 拖出边界时的阻尼系数（0~1，越小阻力越大）
  const DRAG_THRESHOLD = 4;             // 判定为拖拽的最小移动像素

  /* ═══════════════════════════════════════════════
   * 设备检测
   * ═══════════════════════════════════════════════ */

  /** 是否为触摸/粗指针设备（手机 / 平板） */
  const mqlCoarse = window.matchMedia('(pointer: coarse)');
  function isMobile() { return mqlCoarse.matches; }

  /* ═══════════════════════════════════════════════
   * 原图 URL 工具
   * ═══════════════════════════════════════════════ */

  // 匹配 @<任意字符>.(webp|avif|jpg|jpeg|png|gif|ico) 结尾的压缩后缀
  const ORIG_RE = /@[^@]+\.(webp|avif|jpe?g|png|gif|ico)$/i;

  /** 若 src 含压缩后缀则返回去掉后缀的原图 URL，否则返回 null */
  function getOrigSrc(src) {
    return ORIG_RE.test(src) ? src.replace(ORIG_RE, '') : null;
  }

  /* ═══════════════════════════════════════════════
   * 运行时状态
   * ═══════════════════════════════════════════════ */
  let images   = [];   // 所有符合条件的 img 元素
  let idx      = 0;    // 当前显示的图片索引

  let isZoomed = false; // 是否处于放大态
  let isSmall  = false; // 图片自然尺寸小于视口（不允许放大缩小）

  let tx = 0, ty = 0;  // 当前图片平移量（px）
  let dW = 0, dH = 0;  // 图片在 scale=1 时的渲染宽高（px）

  /* 鼠标拖拽 */
  let isDragging = false;
  let dragX0 = 0, dragY0 = 0;   // 按下时鼠标坐标
  let dragTx0 = 0, dragTy0 = 0; // 按下时平移值
  let hasDragged = false;        // 是否真正发生了位移（区分拖拽与点击）

  /* 触摸手势 */
  let touchStartX = 0, touchStartY = 0, touchStartTime = 0;
  let touchDragTx0 = 0, touchDragTy0 = 0;
  let touchHasMoved = false;     // 触摸是否发生了明显位移
  let touchIsDragging = false;   // 放大态下正在拖动
  let touchTarget = 'bg';        // 'img' | 'bg'
  let lastTapTime = 0;           // 上次 tap 时间戳（双击检测）
  let lastTapX = 0, lastTapY = 0;
  let singleTapTimer = null;     // 单击延迟定时器（等待双击）

  /* DOM 节点 */
  let overlay, imgEl;
  let prevBtn, nextBtn, closeBtn, counterEl;
  let viewOrigBtn, dlBtn;   // 提升到模块作用域，loadImage 需要访问

  /* ═══════════════════════════════════════════════
   * 几何计算
   * ═══════════════════════════════════════════════ */

  /**
   * 计算图片在 scale=1（未放大）时的实际渲染尺寸。
   * 由于 CSS 设置了 max-width/max-height: 100vw/vh，
   * 图片会等比缩放以适应视口，但不会放大超过自然尺寸。
   */
  function computeDisplaySize() {
    const nW = imgEl.naturalWidth  || 1;
    const nH = imgEl.naturalHeight || 1;
    const vW = window.innerWidth;
    const vH = window.innerHeight;
    const ratio = Math.min(vW / nW, vH / nH); // 缩放比（可能 >= 1，代表图片比视口小）

    if (nW <= vW * 0.5 && nH <= vH * 0.5) {
      // 图片自然尺寸在视口 50% 以内 → 小图，不允许放大
      return { w: nW, h: nH, small: true };
    }
    const displayRatio = Math.min(1, ratio); // 不放大超过自然尺寸
    return { w: nW * displayRatio, h: nH * displayRatio, small: false };
  }

  /**
   * 在 ZOOM_FACTOR 放大后，计算允许平移的最大范围。
   * 返回对称范围：tx ∈ [-maxTx, maxTx]，ty ∈ [-maxTy, maxTy]
   */
  function getBounds() {
    const vW   = window.innerWidth;
    const vH   = window.innerHeight;
    const effW = dW * ZOOM_FACTOR;
    const effH = dH * ZOOM_FACTOR;
    return {
      maxTx: Math.max(0, (effW - vW) / 2),
      maxTy: Math.max(0, (effH - vH) / 2),
    };
  }

  /** 带阻尼的范围限制：超出边界时移动量按 DAMPING 比例衰减 */
  function clampDamped(val, lo, hi) {
    if (val < lo) return lo - (lo - val) * DAMPING;
    if (val > hi) return hi + (val - hi) * DAMPING;
    return val;
  }

  /** 严格限制在范围内 */
  function clamp(val, lo, hi) {
    return Math.max(lo, Math.min(hi, val));
  }

  /* ═══════════════════════════════════════════════
   * 变换应用
   * ═══════════════════════════════════════════════ */

  function applyTransform(animated) {
    const scale = isZoomed ? ZOOM_FACTOR : 1;
    imgEl.style.transition = animated
      ? 'transform 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      : 'none';
    imgEl.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  /** 将平移严格限制在边界内，可选带过渡动画（用于松手回弹） */
  function snapToBounds(animated) {
    const { maxTx, maxTy } = getBounds();
    tx = clamp(tx, -maxTx, maxTx);
    ty = clamp(ty, -maxTy, maxTy);
    applyTransform(animated);
  }

  /* ═══════════════════════════════════════════════
   * UI 状态更新
   * ═══════════════════════════════════════════════ */

  function updateCursor() {
    if (isSmall) {
      imgEl.style.cursor = 'zoom-out';
    } else if (isZoomed) {
      imgEl.style.cursor = isDragging ? 'grabbing' : 'grab';
    } else {
      imgEl.style.cursor = 'zoom-in';
    }
  }

  function updateNav() {
    const first = idx === 0;
    const last  = idx === images.length - 1;

    // 上一张：到达开头则禁用
    prevBtn.setAttribute('data-disabled', first ? '1' : '0');
    prevBtn.style.opacity = first ? '0.3' : '1';
    prevBtn.style.cursor  = first ? 'not-allowed' : 'pointer';

    // 下一张：到达末尾则禁用
    nextBtn.setAttribute('data-disabled', last ? '1' : '0');
    nextBtn.style.opacity = last ? '0.3' : '1';
    nextBtn.style.cursor  = last ? 'not-allowed' : 'pointer';

    // 计数器：只有多张图时显示
    if (images.length > 1) {
      counterEl.textContent   = `${idx + 1} / ${images.length}`;
      counterEl.style.display = 'block';
    } else {
      counterEl.style.display = 'none';
    }
  }

  /* ═══════════════════════════════════════════════
   * 图片加载与预览逻辑
   * ═══════════════════════════════════════════════ */

  function loadImage(i) {
    idx      = i;
    isZoomed = false;
    tx = 0; ty = 0;
    imgEl.style.transition = 'none';
    imgEl.style.transform  = 'translate(0,0) scale(1)';
    imgEl.removeAttribute('data-orig-loaded');
    imgEl.src = images[i].src;

    // 根据当前图片 src 决定是否显示"查看原图"按钮，并重置状态
    if (viewOrigBtn) {
      const hasOrig = !!getOrigSrc(images[i].src);
      viewOrigBtn.style.display     = hasOrig ? '' : 'none';
      viewOrigBtn.textContent       = '查看原图';
      viewOrigBtn.style.opacity     = '1';
      viewOrigBtn.style.pointerEvents = 'auto';
    }

    // 重置下载按钮文字
    if (dlBtn) {
      dlBtn.textContent        = '下载';
      dlBtn.style.opacity      = '1';
      dlBtn.style.pointerEvents = 'auto';
    }

    function onReady() {
      const info = computeDisplaySize();
      dW      = info.w;
      dH      = info.h;
      isSmall = info.small;
      updateCursor();
    }

    // 若图片已缓存则立即初始化
    if (imgEl.complete && imgEl.naturalWidth > 0) {
      onReady();
    } else {
      imgEl.onload  = onReady;
      imgEl.onerror = onReady; // 出错时也初始化，避免状态卡死
    }

    updateNav();
  }

  function openPreview(i) {
    overlay.style.display        = 'flex';
    document.body.style.overflow = 'hidden'; // 禁止背景滚动

    // 移动端（触摸设备）隐藏左右翻页按钮，改用滑动翻页
    const mobile = isMobile();
    prevBtn.style.display = mobile ? 'none' : 'flex';
    nextBtn.style.display = mobile ? 'none' : 'flex';

    loadImage(i);
  }

  function closePreview() {
    overlay.style.display        = 'none';
    document.body.style.overflow = '';
    isZoomed  = false;
    isDragging = false;
    tx = 0; ty = 0;
  }

  function goTo(i) {
    if (i < 0 || i >= images.length) return;
    loadImage(i);
  }

  /* ═══════════════════════════════════════════════
   * 事件处理
   * ═══════════════════════════════════════════════ */

  /** 点击遮罩空白处 → 关闭预览（仅桌面端） */
  function onOverlayClick(e) {
    if (isMobile()) return; // 移动端由触摸逻辑处理
    if (e.target === overlay) closePreview();
  }

  /** 点击图片：区分放大/缩小/关闭（小图）— 仅桌面端鼠标使用，移动端由触摸手势接管 */
  function onImgClick(e) {
    if (isMobile()) return; // 移动端触摸会额外合成 click，交由触摸逻辑处理，此处跳过
    e.stopPropagation();
    if (hasDragged) return; // 拖拽结束，不触发点击逻辑

    if (isSmall) {
      closePreview();
      return;
    }

    const vW = window.innerWidth;
    const vH = window.innerHeight;

    if (!isZoomed) {
      // ── 放大：以点击位置为中心 ──
      // 点击位置相对于图片中心的偏移（scale=1, 未放大坐标系）
      const clickX = e.clientX - vW / 2 - tx;
      const clickY = e.clientY - vH / 2 - ty;
      // 放大后，令该点仍位于视口中心：
      // 新平移 = -点击偏移 × (scale - 1)
      tx = -clickX * (ZOOM_FACTOR - 1);
      ty = -clickY * (ZOOM_FACTOR - 1);
      isZoomed = true;
      snapToBounds(false); // 先限制范围，再加动画
      applyTransform(true);
    } else {
      // ── 缩小：复位 ──
      isZoomed = false;
      tx = 0; ty = 0;
      applyTransform(true);
    }

    updateCursor();
  }

  /** 鼠标按下：开始拖拽（仅在放大态且非小图） */
  function onMouseDown(e) {
    if (!isZoomed || isSmall) return;
    e.preventDefault();
    isDragging = true;
    hasDragged = false;
    dragX0  = e.clientX;
    dragY0  = e.clientY;
    dragTx0 = tx;
    dragTy0 = ty;
    updateCursor();
  }

  /** 鼠标移动：拖拽图片（带边界阻尼） */
  function onMouseMove(e) {
    if (!isDragging) return;

    const dx = e.clientX - dragX0;
    const dy = e.clientY - dragY0;

    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      hasDragged = true;
    }

    const { maxTx, maxTy } = getBounds();
    tx = clampDamped(dragTx0 + dx, -maxTx, maxTx);
    ty = clampDamped(dragTy0 + dy, -maxTy, maxTy);
    applyTransform(false);
  }

  /** 鼠标松开：停止拖拽，若出界则弹回 */
  function onMouseUp() {
    if (!isDragging) return;
    isDragging = false;
    snapToBounds(true); // 动画回弹到合法范围
    updateCursor();
  }

  /** 滚轮：未放大时翻页；放大后垂直滚动图片 */
  function onWheel(e) {
    e.preventDefault();

    if (!isZoomed) {
      // 翻页（向下 → 下一张，向上 → 上一张）
      if (e.deltaY > 0) goTo(idx + 1);
      else              goTo(idx - 1);
    } else {
      // 垂直滚动图片
      const { maxTy } = getBounds();
      ty = clamp(ty - e.deltaY * 0.65, -maxTy, maxTy);
      applyTransform(false);
    }
  }

  /** 键盘快捷键 */
  function onKeyDown(e) {
    if (overlay.style.display === 'none') return;
    switch (e.key) {
      case 'Escape':      closePreview();   break;
      case 'ArrowLeft':   goTo(idx - 1);    break;
      case 'ArrowRight':  goTo(idx + 1);    break;
    }
  }

  /* ═══════════════════════════════════════════════
   * 触摸手势处理
   * ═══════════════════════════════════════════════ */

  function onTouchStart(e) {
    if (e.touches.length !== 1) {
      clearTimeout(singleTapTimer);
      return;
    }
    const t = e.touches[0];
    touchStartX    = t.clientX;
    touchStartY    = t.clientY;
    touchStartTime = Date.now();
    touchHasMoved  = false;
    touchIsDragging = false;
    touchDragTx0   = tx;
    touchDragTy0   = ty;

    // 判断触摸目标：按钮 > 图片 > 背景
    const target = e.target;
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      touchTarget = 'btn';
    } else if (imgEl.contains(target)) {
      touchTarget = 'img';
    } else {
      touchTarget = 'bg';
    }
  }

  function onTouchMove(e) {
    e.preventDefault(); // 阻止页面滚动 / iOS 橡皮筋效果
    if (e.touches.length !== 1) return;

    const t  = e.touches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;

    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      touchHasMoved   = true;
      touchIsDragging = true;
      clearTimeout(singleTapTimer); // 有移动，取消单击
    }

    // 放大态且触摸起点在图片上 → 拖动图片
    if (isZoomed && touchIsDragging) {
      const { maxTx, maxTy } = getBounds();
      tx = clampDamped(touchDragTx0 + dx, -maxTx, maxTx);
      ty = clampDamped(touchDragTy0 + dy, -maxTy, maxTy);
      applyTransform(false);
    }
  }

  function onTouchEnd(e) {
    if (e.changedTouches.length !== 1) return;

    // 触摸起点是按钮，交由按钮自身的 click 处理，不做任何手势判断
    if (touchTarget === 'btn') return;
    const t   = e.changedTouches[0];
    const dx  = t.clientX - touchStartX;
    const dy  = t.clientY - touchStartY;
    const dt  = Date.now() - touchStartTime;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    // ── 放大态拖动结束 → 回弹到边界 ──
    if (isZoomed && touchIsDragging) {
      snapToBounds(true);
      touchIsDragging = false;
      return;
    }

    // ── 未放大时左右滑动翻页（水平位移 > 50px 且比垂直大，速度 < 400ms） ──
    if (!isZoomed && adx > 50 && adx > ady * 1.5 && dt < 400) {
      if (dx < 0) goTo(idx + 1);  // 左滑 → 下一张
      else        goTo(idx - 1);  // 右滑 → 上一张
      lastTapTime = 0;             // 翻页后重置双击计时
      return;
    }

    // ── Tap 检测（轻触，几乎无位移，速度快） ──
    if (!touchHasMoved && dt < 350) {
      const now    = Date.now();
      const dtTap  = now - lastTapTime;
      const tapDx  = Math.abs(t.clientX - lastTapX);
      const tapDy  = Math.abs(t.clientY - lastTapY);
      const isDoubleTap = dtTap < 300 && tapDx < 45 && tapDy < 45;

      if (isDoubleTap) {
        // ── 双击：放大 / 缩小 ──
        clearTimeout(singleTapTimer);
        lastTapTime = 0; // 重置，防止三击继续触发

        if (!isSmall) {
          if (!isZoomed) {
            const vW  = window.innerWidth;
            const vH  = window.innerHeight;
            const tapX = t.clientX - vW / 2 - tx;
            const tapY = t.clientY - vH / 2 - ty;
            tx = -tapX * (ZOOM_FACTOR - 1);
            ty = -tapY * (ZOOM_FACTOR - 1);
            isZoomed = true;
            snapToBounds(false);
            applyTransform(true);
          } else {
            isZoomed = false;
            tx = 0; ty = 0;
            applyTransform(true);
          }
        }
      } else {
        // ── 单击：延迟执行，让双击有机会取消 ──
        lastTapTime = now;
        lastTapX    = t.clientX;
        lastTapY    = t.clientY;

        clearTimeout(singleTapTimer);
        singleTapTimer = setTimeout(() => {
          // 单击：无论点哪里都关闭预览
          closePreview();
        }, 280);
      }
    }
  }

  /* ═══════════════════════════════════════════════
   * UI 构建
   * ═══════════════════════════════════════════════ */

  /** 创建通用图标按钮（圆形） */
  function makeIconBtn(html, posStyle) {
    const btn = document.createElement('button');
    btn.innerHTML = html;
    btn.style.cssText = `
      position: absolute;
      ${posStyle}
      width: 42px; height: 42px;
      display: flex; align-items: center; justify-content: center;
      background: rgba(10, 10, 10, 0.55);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 50%;
      color: rgba(255,255,255,0.9);
      font-size: 17px; line-height: 1;
      cursor: pointer;
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      transition: background 0.18s, border-color 0.18s, opacity 0.18s;
      z-index: 10;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    `;
    btn.addEventListener('mouseover', () => {
      if (btn.getAttribute('data-disabled') !== '1') {
        btn.style.background   = 'rgba(255,255,255,0.18)';
        btn.style.borderColor  = 'rgba(255,255,255,0.35)';
      }
    });
    btn.addEventListener('mouseout', () => {
      btn.style.background  = 'rgba(10,10,10,0.55)';
      btn.style.borderColor = 'rgba(255,255,255,0.12)';
    });
    return btn;
  }

  /** 创建侧边导航大按钮 */
  function makeNavBtn(html, side) {
    const btn = document.createElement('button');
    btn.innerHTML = html;
    btn.style.cssText = `
      position: absolute;
      top: 50%; transform: translateY(-50%);
      ${side === 'left' ? 'left: 18px;' : 'right: 18px;'}
      width: 48px; height: 48px;
      display: flex; align-items: center; justify-content: center;
      background: rgba(10, 10, 10, 0.5);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 50%;
      color: rgba(255,255,255,0.9);
      font-size: 19px; line-height: 1;
      cursor: pointer;
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      transition: background 0.18s, border-color 0.18s, opacity 0.18s;
      z-index: 10;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    `;
    btn.addEventListener('mouseover', () => {
      if (btn.getAttribute('data-disabled') !== '1') {
        btn.style.background  = 'rgba(255,255,255,0.18)';
        btn.style.borderColor = 'rgba(255,255,255,0.35)';
      }
    });
    btn.addEventListener('mouseout', () => {
      btn.style.background  = 'rgba(10,10,10,0.5)';
      btn.style.borderColor = 'rgba(255,255,255,0.12)';
    });
    return btn;
  }

  /** 创建文字按钮（右下角用） */
  function makeTextBtn(text) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      background: rgba(10,10,10,0.55);
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 7px;
      color: rgba(255,255,255,0.88);
      font-size: 13px;
      font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
      padding: 8px 16px;
      cursor: pointer;
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      transition: background 0.18s, border-color 0.18s;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    `;
    btn.addEventListener('mouseover', () => {
      btn.style.background  = 'rgba(255,255,255,0.18)';
      btn.style.borderColor = 'rgba(255,255,255,0.35)';
    });
    btn.addEventListener('mouseout', () => {
      btn.style.background  = 'rgba(10,10,10,0.55)';
      btn.style.borderColor = 'rgba(255,255,255,0.18)';
    });
    return btn;
  }

  /** 构建整个预览遮罩 DOM */
  function buildOverlay() {
    /* ── 遮罩容器 ── */
    overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 2147483646;
      background: rgba(8, 8, 8, 0.93);
      display: none;
      align-items: center;
      justify-content: center;
      cursor: default;
      touch-action: none;
      -webkit-tap-highlight-color: transparent;
      overscroll-behavior: none;
    `;

    /* ── 图片元素 ── */
    imgEl = document.createElement('img');
    imgEl.style.cssText = `
      max-width: 100vw;
      max-height: 100vh;
      object-fit: contain;
      display: block;
      user-select: none;
      -webkit-user-drag: none;
      transform-origin: center center;
      transform: translate(0, 0) scale(1);
      position: relative;
      z-index: 1;
      will-change: transform;
      touch-action: none;
      -webkit-tap-highlight-color: transparent;
    `;
    overlay.appendChild(imgEl);

    /* ── 计数器（左上角） ── */
    counterEl = document.createElement('div');
    counterEl.style.cssText = `
      position: absolute;
      top: 16px; left: 16px;
      color: rgba(255,255,255,0.88);
      font-size: 13px;
      font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
      letter-spacing: 0.5px;
      background: rgba(10,10,10,0.55);
      border: 1px solid rgba(255,255,255,0.12);
      padding: 5px 13px;
      border-radius: 20px;
      pointer-events: none;
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      z-index: 10;
      display: none;
    `;
    overlay.appendChild(counterEl);

    /* ── 关闭按钮（右上角） ── */
    closeBtn = makeIconBtn('✕', 'top: 16px; right: 16px;');
    closeBtn.title = '关闭（Esc）';
    closeBtn.addEventListener('click', e => { e.stopPropagation(); closePreview(); });
    overlay.appendChild(closeBtn);

    /* ── 上一张（左侧） ── */
    prevBtn = makeNavBtn('&#10094;', 'left');
    prevBtn.title = '上一张（←）';
    prevBtn.setAttribute('data-disabled', '0');
    prevBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (prevBtn.getAttribute('data-disabled') === '1') return;
      goTo(idx - 1);
    });
    overlay.appendChild(prevBtn);

    /* ── 下一张（右侧） ── */
    nextBtn = makeNavBtn('&#10095;', 'right');
    nextBtn.title = '下一张（→）';
    nextBtn.setAttribute('data-disabled', '0');
    nextBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (nextBtn.getAttribute('data-disabled') === '1') return;
      goTo(idx + 1);
    });
    overlay.appendChild(nextBtn);

    /* ── 右下角操作按钮组 ── */
    const bottomRight = document.createElement('div');
    bottomRight.style.cssText = `
      position: absolute;
      bottom: 18px; right: 18px;
      display: flex; gap: 8px;
      z-index: 10;
    `;

    /* ── 查看原图按钮 ── */
    viewOrigBtn = makeTextBtn('查看原图');
    viewOrigBtn.addEventListener('click', e => {
      e.stopPropagation();
      const origSrc = getOrigSrc(imgEl.src);
      if (!origSrc) return;
      if (imgEl.getAttribute('data-orig-loaded') === origSrc) return;

      viewOrigBtn.textContent       = '加载中…';
      viewOrigBtn.style.opacity     = '0.6';
      viewOrigBtn.style.pointerEvents = 'none';

      const tmp = new Image();
      tmp.onload = () => {
        isZoomed = false; tx = 0; ty = 0;
        imgEl.style.transition = 'none';
        imgEl.style.transform  = 'translate(0,0) scale(1)';
        imgEl.src = origSrc;
        imgEl.setAttribute('data-orig-loaded', origSrc);

        const ready = () => {
          const info = computeDisplaySize();
          dW = info.w; dH = info.h; isSmall = info.small;
          updateCursor();
        };
        if (imgEl.complete && imgEl.naturalWidth > 0) ready();
        else imgEl.onload = ready;

        viewOrigBtn.textContent       = '已显示原图';
        viewOrigBtn.style.opacity     = '0.45';
        viewOrigBtn.style.pointerEvents = 'none';
      };
      tmp.onerror = () => {
        viewOrigBtn.textContent       = '加载失败';
        viewOrigBtn.style.opacity     = '1';
        viewOrigBtn.style.pointerEvents = 'auto';
      };
      tmp.src = origSrc;
    });

    /* ── 下载按钮 ── */
    // 优先 fetch blob + 解析响应头（Content-Disposition / Content-Type）取准确文件名；
    // 失败则 canvas 导出；最终降级 <a download>。
    dlBtn = makeTextBtn('下载');
    dlBtn.addEventListener('click', async e => {
      e.stopPropagation();
      const src = imgEl.src || images[idx].src;

      const setLoading = () => {
        dlBtn.textContent        = '下载中…';
        dlBtn.style.opacity      = '0.6';
        dlBtn.style.pointerEvents = 'none';
      };
      const setDone = () => {
        dlBtn.textContent = '已下载';
        setTimeout(() => {
          dlBtn.textContent        = '下载';
          dlBtn.style.opacity      = '1';
          dlBtn.style.pointerEvents = 'auto';
        }, 2000);
      };
      const setError = () => {
        dlBtn.textContent        = '下载失败';
        dlBtn.style.opacity      = '1';
        dlBtn.style.pointerEvents = 'auto';
        setTimeout(() => { dlBtn.textContent = '下载'; }, 2500);
      };

      /**
       * 从响应头提取最准确的下载文件名。
       * 优先级：Content-Disposition filename → URL 路径名（去压缩后缀）+ Content-Type 校正扩展名
       */
      function resolveFilename(res) {
        // ① Content-Disposition: inline; filename="01.jpg@1000h.webp"
        const cd = res.headers.get('content-disposition') || '';
        // RFC 5987 编码：filename*=UTF-8''...
        const starMatch = cd.match(/filename\*=(?:UTF-8'')?([^;\r\n]+)/i);
        if (starMatch) {
          const name = decodeURIComponent(starMatch[1].trim()).replace(ORIG_RE, '');
          if (name) return name;
        }
        // 普通 filename="..."
        const match = cd.match(/filename="?([^";\r\n]+)"?/i);
        if (match) {
          const name = match[1].trim().replace(ORIG_RE, '');
          if (name) return name;
        }

        // ② URL 路径名作为基础文件名，去掉压缩后缀
        const raw  = decodeURIComponent(src.split('/').pop().split('?')[0]);
        const base = raw.replace(ORIG_RE, '').replace(/\.[^.]*$/, '') || 'image';

        // ③ Content-Type 决定扩展名
        const ct      = (res.headers.get('content-type') || '').split(';')[0].trim();
        const extMap  = {
          'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
          'image/webp': '.webp', 'image/avif': '.avif',
          'image/svg+xml': '.svg', 'image/ico': '.ico', 'image/x-icon': '.ico',
        };
        const ext = extMap[ct] || '';
        return ext ? base + ext : (raw.replace(ORIG_RE, '') || 'image');
      }

      setLoading();

      /* ① fetch blob — 同时拿到响应头和文件内容 */
      try {
        const res = await fetch(src, { mode: 'cors', cache: 'force-cache' });
        if (!res.ok) throw new Error('fetch !ok');
        const blob     = await res.blob();
        const filename = resolveFilename(res);
        const blobUrl  = URL.createObjectURL(blob);
        triggerDownload(blobUrl, filename);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
        setDone();
        return;
      } catch (_) { /* 继续降级 */ }

      /* ② canvas 导出（对已渲染图片，绕过部分跨域限制） */
      try {
        const raw      = decodeURIComponent(src.split('/').pop().split('?')[0]);
        const filename = raw.replace(ORIG_RE, '') || 'image';
        const canvas   = document.createElement('canvas');
        canvas.width   = imgEl.naturalWidth  || 800;
        canvas.height  = imgEl.naturalHeight || 600;
        canvas.getContext('2d').drawImage(imgEl, 0, 0);
        canvas.toBlob(blob => {
          if (!blob) { setError(); return; }
          const blobUrl = URL.createObjectURL(blob);
          triggerDownload(blobUrl, filename + '.png');
          setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
          setDone();
        }, 'image/png');
        return;
      } catch (_) { /* 继续降级 */ }

      /* ③ 最终降级：<a download>（跨域时浏览器可能改为在新标签页预览） */
      const filename = decodeURIComponent(src.split('/').pop().split('?')[0]).replace(ORIG_RE, '') || 'image';
      triggerDownload(src, filename);
      setDone();
    });

    /** 触发浏览器下载 */
    function triggerDownload(href, name) {
      const a   = document.createElement('a');
      a.href     = href;
      a.download = name;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    bottomRight.appendChild(viewOrigBtn);
    bottomRight.appendChild(dlBtn);
    overlay.appendChild(bottomRight);

    /* ── 绑定事件 ── */
    overlay.addEventListener('click',  onOverlayClick);
    imgEl.addEventListener('click',    onImgClick);
    imgEl.addEventListener('mousedown', e => { e.preventDefault(); onMouseDown(e); });
    overlay.addEventListener('wheel',  onWheel, { passive: false });

    // 触摸事件（全部挂在 overlay 上，通过 touchTarget 区分图片 / 背景）
    overlay.addEventListener('touchstart', onTouchStart, { passive: true });
    overlay.addEventListener('touchmove',  onTouchMove,  { passive: false });
    overlay.addEventListener('touchend',   onTouchEnd,   { passive: false });

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
    document.addEventListener('keydown',   onKeyDown);

    document.body.appendChild(overlay);
  }

  /* ═══════════════════════════════════════════════
   * 初始化入口
   * ═══════════════════════════════════════════════ */
  function init() {
    images = Array.from(document.querySelectorAll(`img[${PREVIEW_ATTR}]`));
    if (!images.length) return;

    buildOverlay();

    // 为每张原始图片设置 zoom-in 光标并绑定点击事件
    images.forEach((img, i) => {
      img.style.cursor      = 'zoom-in';
      img.style.touchAction = 'manipulation'; // 消除移动端 300ms 点击延迟
      img.addEventListener('click', () => openPreview(i));
    });
  }

  // 支持动态插入脚本（DOM 可能已 ready）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

	twikoo.init({
		envId: 'https://twikoo.muxmus.com',
		el: '#tcomment',
		lang: 'zh-CN'
	});
});
hljs.highlightAll();
hljs.initLineNumbersOnLoad();

/**
 * image-preview.js
 *
 * 用法：在页面中引入此脚本，为需要预览的 <img> 标签添加 data-preview 属性即可。
 * 可通过修改 PREVIEW_ATTR 使用不同的属性名。
 *
 * <img src="photo.jpg" data-preview alt="...">
 */
(function () {
  'use strict';

  /* ═══════════════════════════════════════════════
   * 配置
   * ═══════════════════════════════════════════════ */
  const PREVIEW_ATTR  = 'data-preview'; // 触发预览的 img 属性
  const ZOOM_FACTOR   = 1.8;            // 点击放大倍数
  const DAMPING       = 0.28;           // 拖出边界时的阻尼系数（0~1，越小阻力越大）
  const DRAG_THRESHOLD = 4;             // 判定为拖拽的最小移动像素

  /* ═══════════════════════════════════════════════
   * 设备检测
   * ═══════════════════════════════════════════════ */

  /** 是否为触摸/粗指针设备（手机 / 平板） */
  const mqlCoarse = window.matchMedia('(pointer: coarse)');
  function isMobile() { return mqlCoarse.matches; }

  /* ═══════════════════════════════════════════════
   * 原图 URL 工具
   * ═══════════════════════════════════════════════ */

  // 匹配 @<任意字符>.(webp|avif|jpg|jpeg|png|gif|ico) 结尾的压缩后缀
  const ORIG_RE = /@[^@]+\.(webp|avif|jpe?g|png|gif|ico)$/i;

  /** 若 src 含压缩后缀则返回去掉后缀的原图 URL，否则返回 null */
  function getOrigSrc(src) {
    return ORIG_RE.test(src) ? src.replace(ORIG_RE, '') : null;
  }

  /* ═══════════════════════════════════════════════
   * 运行时状态
   * ═══════════════════════════════════════════════ */
  let images   = [];   // 所有符合条件的 img 元素
  let idx      = 0;    // 当前显示的图片索引

  let isZoomed = false; // 是否处于放大态
  let isSmall  = false; // 图片自然尺寸小于视口（不允许放大缩小）

  let tx = 0, ty = 0;  // 当前图片平移量（px）
  let dW = 0, dH = 0;  // 图片在 scale=1 时的渲染宽高（px）

  /* 鼠标拖拽 */
  let isDragging = false;
  let dragX0 = 0, dragY0 = 0;   // 按下时鼠标坐标
  let dragTx0 = 0, dragTy0 = 0; // 按下时平移值
  let hasDragged = false;        // 是否真正发生了位移（区分拖拽与点击）

  /* 触摸手势 */
  let touchStartX = 0, touchStartY = 0, touchStartTime = 0;
  let touchDragTx0 = 0, touchDragTy0 = 0;
  let touchHasMoved = false;     // 触摸是否发生了明显位移
  let touchIsDragging = false;   // 放大态下正在拖动
  let touchTarget = 'bg';        // 'img' | 'bg'
  let lastTapTime = 0;           // 上次 tap 时间戳（双击检测）
  let lastTapX = 0, lastTapY = 0;
  let singleTapTimer = null;     // 单击延迟定时器（等待双击）

  /* DOM 节点 */
  let overlay, imgEl;
  let prevBtn, nextBtn, closeBtn, counterEl;
  let viewOrigBtn, dlBtn;   // 提升到模块作用域，loadImage 需要访问

  /* ═══════════════════════════════════════════════
   * 几何计算
   * ═══════════════════════════════════════════════ */

  /**
   * 计算图片在 scale=1（未放大）时的实际渲染尺寸。
   * 由于 CSS 设置了 max-width/max-height: 100vw/vh，
   * 图片会等比缩放以适应视口，但不会放大超过自然尺寸。
   */
  function computeDisplaySize() {
    const nW = imgEl.naturalWidth  || 1;
    const nH = imgEl.naturalHeight || 1;
    const vW = window.innerWidth;
    const vH = window.innerHeight;
    const ratio = Math.min(vW / nW, vH / nH); // 缩放比（可能 >= 1，代表图片比视口小）

    if (nW <= vW * 0.5 && nH <= vH * 0.5) {
      // 图片自然尺寸在视口 50% 以内 → 小图，不允许放大
      return { w: nW, h: nH, small: true };
    }
    const displayRatio = Math.min(1, ratio); // 不放大超过自然尺寸
    return { w: nW * displayRatio, h: nH * displayRatio, small: false };
  }

  /**
   * 在 ZOOM_FACTOR 放大后，计算允许平移的最大范围。
   * 返回对称范围：tx ∈ [-maxTx, maxTx]，ty ∈ [-maxTy, maxTy]
   */
  function getBounds() {
    const vW   = window.innerWidth;
    const vH   = window.innerHeight;
    const effW = dW * ZOOM_FACTOR;
    const effH = dH * ZOOM_FACTOR;
    return {
      maxTx: Math.max(0, (effW - vW) / 2),
      maxTy: Math.max(0, (effH - vH) / 2),
    };
  }

  /** 带阻尼的范围限制：超出边界时移动量按 DAMPING 比例衰减 */
  function clampDamped(val, lo, hi) {
    if (val < lo) return lo - (lo - val) * DAMPING;
    if (val > hi) return hi + (val - hi) * DAMPING;
    return val;
  }

  /** 严格限制在范围内 */
  function clamp(val, lo, hi) {
    return Math.max(lo, Math.min(hi, val));
  }

  /* ═══════════════════════════════════════════════
   * 变换应用
   * ═══════════════════════════════════════════════ */

  function applyTransform(animated) {
    const scale = isZoomed ? ZOOM_FACTOR : 1;
    imgEl.style.transition = animated
      ? 'transform 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      : 'none';
    imgEl.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  /** 将平移严格限制在边界内，可选带过渡动画（用于松手回弹） */
  function snapToBounds(animated) {
    const { maxTx, maxTy } = getBounds();
    tx = clamp(tx, -maxTx, maxTx);
    ty = clamp(ty, -maxTy, maxTy);
    applyTransform(animated);
  }

  /* ═══════════════════════════════════════════════
   * UI 状态更新
   * ═══════════════════════════════════════════════ */

  function updateCursor() {
    if (isSmall) {
      imgEl.style.cursor = 'zoom-out';
    } else if (isZoomed) {
      imgEl.style.cursor = isDragging ? 'grabbing' : 'grab';
    } else {
      imgEl.style.cursor = 'zoom-in';
    }
  }

  function updateNav() {
    const first = idx === 0;
    const last  = idx === images.length - 1;

    // 上一张：到达开头则禁用
    prevBtn.setAttribute('data-disabled', first ? '1' : '0');
    prevBtn.style.opacity = first ? '0.3' : '1';
    prevBtn.style.cursor  = first ? 'not-allowed' : 'pointer';

    // 下一张：到达末尾则禁用
    nextBtn.setAttribute('data-disabled', last ? '1' : '0');
    nextBtn.style.opacity = last ? '0.3' : '1';
    nextBtn.style.cursor  = last ? 'not-allowed' : 'pointer';

    // 计数器：只有多张图时显示
    if (images.length > 1) {
      counterEl.textContent   = `${idx + 1} / ${images.length}`;
      counterEl.style.display = 'block';
    } else {
      counterEl.style.display = 'none';
    }
  }

  /* ═══════════════════════════════════════════════
   * 图片加载与预览逻辑
   * ═══════════════════════════════════════════════ */

  function loadImage(i) {
    idx      = i;
    isZoomed = false;
    tx = 0; ty = 0;
    imgEl.style.transition = 'none';
    imgEl.style.transform  = 'translate(0,0) scale(1)';
    imgEl.removeAttribute('data-orig-loaded');
    imgEl.src = images[i].src;

    // 根据当前图片 src 决定是否显示"查看原图"按钮，并重置状态
    if (viewOrigBtn) {
      const hasOrig = !!getOrigSrc(images[i].src);
      viewOrigBtn.style.display     = hasOrig ? '' : 'none';
      viewOrigBtn.textContent       = '查看原图';
      viewOrigBtn.style.opacity     = '1';
      viewOrigBtn.style.pointerEvents = 'auto';
    }

    // 重置下载按钮文字
    if (dlBtn) {
      dlBtn.textContent        = '下载';
      dlBtn.style.opacity      = '1';
      dlBtn.style.pointerEvents = 'auto';
    }

    function onReady() {
      const info = computeDisplaySize();
      dW      = info.w;
      dH      = info.h;
      isSmall = info.small;
      updateCursor();
    }

    // 若图片已缓存则立即初始化
    if (imgEl.complete && imgEl.naturalWidth > 0) {
      onReady();
    } else {
      imgEl.onload  = onReady;
      imgEl.onerror = onReady; // 出错时也初始化，避免状态卡死
    }

    updateNav();
  }

  function openPreview(i) {
    overlay.style.display        = 'flex';
    document.body.style.overflow = 'hidden'; // 禁止背景滚动

    // 移动端（触摸设备）隐藏左右翻页按钮，改用滑动翻页
    const mobile = isMobile();
    prevBtn.style.display = mobile ? 'none' : 'flex';
    nextBtn.style.display = mobile ? 'none' : 'flex';

    loadImage(i);
  }

  function closePreview() {
    overlay.style.display        = 'none';
    document.body.style.overflow = '';
    isZoomed  = false;
    isDragging = false;
    tx = 0; ty = 0;
  }

  function goTo(i) {
    if (i < 0 || i >= images.length) return;
    loadImage(i);
  }

  /* ═══════════════════════════════════════════════
   * 事件处理
   * ═══════════════════════════════════════════════ */

  /** 点击遮罩空白处 → 关闭预览（仅桌面端） */
  function onOverlayClick(e) {
    if (isMobile()) return; // 移动端由触摸逻辑处理
    if (e.target === overlay) closePreview();
  }

  /** 点击图片：区分放大/缩小/关闭（小图）— 仅桌面端鼠标使用，移动端由触摸手势接管 */
  function onImgClick(e) {
    if (isMobile()) return; // 移动端触摸会额外合成 click，交由触摸逻辑处理，此处跳过
    e.stopPropagation();
    if (hasDragged) return; // 拖拽结束，不触发点击逻辑

    if (isSmall) {
      closePreview();
      return;
    }

    const vW = window.innerWidth;
    const vH = window.innerHeight;

    if (!isZoomed) {
      // ── 放大：以点击位置为中心 ──
      // 点击位置相对于图片中心的偏移（scale=1, 未放大坐标系）
      const clickX = e.clientX - vW / 2 - tx;
      const clickY = e.clientY - vH / 2 - ty;
      // 放大后，令该点仍位于视口中心：
      // 新平移 = -点击偏移 × (scale - 1)
      tx = -clickX * (ZOOM_FACTOR - 1);
      ty = -clickY * (ZOOM_FACTOR - 1);
      isZoomed = true;
      snapToBounds(false); // 先限制范围，再加动画
      applyTransform(true);
    } else {
      // ── 缩小：复位 ──
      isZoomed = false;
      tx = 0; ty = 0;
      applyTransform(true);
    }

    updateCursor();
  }

  /** 鼠标按下：开始拖拽（仅在放大态且非小图） */
  function onMouseDown(e) {
    if (!isZoomed || isSmall) return;
    e.preventDefault();
    isDragging = true;
    hasDragged = false;
    dragX0  = e.clientX;
    dragY0  = e.clientY;
    dragTx0 = tx;
    dragTy0 = ty;
    updateCursor();
  }

  /** 鼠标移动：拖拽图片（带边界阻尼） */
  function onMouseMove(e) {
    if (!isDragging) return;

    const dx = e.clientX - dragX0;
    const dy = e.clientY - dragY0;

    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      hasDragged = true;
    }

    const { maxTx, maxTy } = getBounds();
    tx = clampDamped(dragTx0 + dx, -maxTx, maxTx);
    ty = clampDamped(dragTy0 + dy, -maxTy, maxTy);
    applyTransform(false);
  }

  /** 鼠标松开：停止拖拽，若出界则弹回 */
  function onMouseUp() {
    if (!isDragging) return;
    isDragging = false;
    snapToBounds(true); // 动画回弹到合法范围
    updateCursor();
  }

  /** 滚轮：未放大时翻页；放大后垂直滚动图片 */
  function onWheel(e) {
    e.preventDefault();

    if (!isZoomed) {
      // 翻页（向下 → 下一张，向上 → 上一张）
      if (e.deltaY > 0) goTo(idx + 1);
      else              goTo(idx - 1);
    } else {
      // 垂直滚动图片
      const { maxTy } = getBounds();
      ty = clamp(ty - e.deltaY * 0.65, -maxTy, maxTy);
      applyTransform(false);
    }
  }

  /** 键盘快捷键 */
  function onKeyDown(e) {
    if (overlay.style.display === 'none') return;
    switch (e.key) {
      case 'Escape':      closePreview();   break;
      case 'ArrowLeft':   goTo(idx - 1);    break;
      case 'ArrowRight':  goTo(idx + 1);    break;
    }
  }

  /* ═══════════════════════════════════════════════
   * 触摸手势处理
   * ═══════════════════════════════════════════════ */

  function onTouchStart(e) {
    if (e.touches.length !== 1) {
      clearTimeout(singleTapTimer);
      return;
    }
    const t = e.touches[0];
    touchStartX    = t.clientX;
    touchStartY    = t.clientY;
    touchStartTime = Date.now();
    touchHasMoved  = false;
    touchIsDragging = false;
    touchDragTx0   = tx;
    touchDragTy0   = ty;

    // 判断触摸目标：按钮 > 图片 > 背景
    const target = e.target;
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      touchTarget = 'btn';
    } else if (imgEl.contains(target)) {
      touchTarget = 'img';
    } else {
      touchTarget = 'bg';
    }
  }

  function onTouchMove(e) {
    e.preventDefault(); // 阻止页面滚动 / iOS 橡皮筋效果
    if (e.touches.length !== 1) return;

    const t  = e.touches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;

    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      touchHasMoved   = true;
      touchIsDragging = true;
      clearTimeout(singleTapTimer); // 有移动，取消单击
    }

    // 放大态且触摸起点在图片上 → 拖动图片
    if (isZoomed && touchIsDragging) {
      const { maxTx, maxTy } = getBounds();
      tx = clampDamped(touchDragTx0 + dx, -maxTx, maxTx);
      ty = clampDamped(touchDragTy0 + dy, -maxTy, maxTy);
      applyTransform(false);
    }
  }

  function onTouchEnd(e) {
    if (e.changedTouches.length !== 1) return;

    // 触摸起点是按钮，交由按钮自身的 click 处理，不做任何手势判断
    if (touchTarget === 'btn') return;
    const t   = e.changedTouches[0];
    const dx  = t.clientX - touchStartX;
    const dy  = t.clientY - touchStartY;
    const dt  = Date.now() - touchStartTime;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    // ── 放大态拖动结束 → 回弹到边界 ──
    if (isZoomed && touchIsDragging) {
      snapToBounds(true);
      touchIsDragging = false;
      return;
    }

    // ── 未放大时左右滑动翻页（水平位移 > 50px 且比垂直大，速度 < 400ms） ──
    if (!isZoomed && adx > 50 && adx > ady * 1.5 && dt < 400) {
      if (dx < 0) goTo(idx + 1);  // 左滑 → 下一张
      else        goTo(idx - 1);  // 右滑 → 上一张
      lastTapTime = 0;             // 翻页后重置双击计时
      return;
    }

    // ── Tap 检测（轻触，几乎无位移，速度快） ──
    if (!touchHasMoved && dt < 350) {
      const now    = Date.now();
      const dtTap  = now - lastTapTime;
      const tapDx  = Math.abs(t.clientX - lastTapX);
      const tapDy  = Math.abs(t.clientY - lastTapY);
      const isDoubleTap = dtTap < 300 && tapDx < 45 && tapDy < 45;

      if (isDoubleTap) {
        // ── 双击：放大 / 缩小 ──
        clearTimeout(singleTapTimer);
        lastTapTime = 0; // 重置，防止三击继续触发

        if (!isSmall) {
          if (!isZoomed) {
            const vW  = window.innerWidth;
            const vH  = window.innerHeight;
            const tapX = t.clientX - vW / 2 - tx;
            const tapY = t.clientY - vH / 2 - ty;
            tx = -tapX * (ZOOM_FACTOR - 1);
            ty = -tapY * (ZOOM_FACTOR - 1);
            isZoomed = true;
            snapToBounds(false);
            applyTransform(true);
          } else {
            isZoomed = false;
            tx = 0; ty = 0;
            applyTransform(true);
          }
        }
      } else {
        // ── 单击：延迟执行，让双击有机会取消 ──
        lastTapTime = now;
        lastTapX    = t.clientX;
        lastTapY    = t.clientY;

        clearTimeout(singleTapTimer);
        singleTapTimer = setTimeout(() => {
          // 单击：无论点哪里都关闭预览
          closePreview();
        }, 280);
      }
    }
  }

  /* ═══════════════════════════════════════════════
   * UI 构建
   * ═══════════════════════════════════════════════ */

  /** 创建通用图标按钮（圆形） */
  function makeIconBtn(html, posStyle) {
    const btn = document.createElement('button');
    btn.innerHTML = html;
    btn.style.cssText = `
      position: absolute;
      ${posStyle}
      width: 42px; height: 42px;
      display: flex; align-items: center; justify-content: center;
      background: rgba(10, 10, 10, 0.55);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 50%;
      color: rgba(255,255,255,0.9);
      font-size: 17px; line-height: 1;
      cursor: pointer;
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      transition: background 0.18s, border-color 0.18s, opacity 0.18s;
      z-index: 10;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    `;
    btn.addEventListener('mouseover', () => {
      if (btn.getAttribute('data-disabled') !== '1') {
        btn.style.background   = 'rgba(255,255,255,0.18)';
        btn.style.borderColor  = 'rgba(255,255,255,0.35)';
      }
    });
    btn.addEventListener('mouseout', () => {
      btn.style.background  = 'rgba(10,10,10,0.55)';
      btn.style.borderColor = 'rgba(255,255,255,0.12)';
    });
    return btn;
  }

  /** 创建侧边导航大按钮 */
  function makeNavBtn(html, side) {
    const btn = document.createElement('button');
    btn.innerHTML = html;
    btn.style.cssText = `
      position: absolute;
      top: 50%; transform: translateY(-50%);
      ${side === 'left' ? 'left: 18px;' : 'right: 18px;'}
      width: 48px; height: 48px;
      display: flex; align-items: center; justify-content: center;
      background: rgba(10, 10, 10, 0.5);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 50%;
      color: rgba(255,255,255,0.9);
      font-size: 19px; line-height: 1;
      cursor: pointer;
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      transition: background 0.18s, border-color 0.18s, opacity 0.18s;
      z-index: 10;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    `;
    btn.addEventListener('mouseover', () => {
      if (btn.getAttribute('data-disabled') !== '1') {
        btn.style.background  = 'rgba(255,255,255,0.18)';
        btn.style.borderColor = 'rgba(255,255,255,0.35)';
      }
    });
    btn.addEventListener('mouseout', () => {
      btn.style.background  = 'rgba(10,10,10,0.5)';
      btn.style.borderColor = 'rgba(255,255,255,0.12)';
    });
    return btn;
  }

  /** 创建文字按钮（右下角用） */
  function makeTextBtn(text) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      background: rgba(10,10,10,0.55);
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 7px;
      color: rgba(255,255,255,0.88);
      font-size: 13px;
      font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
      padding: 8px 16px;
      cursor: pointer;
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      transition: background 0.18s, border-color 0.18s;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    `;
    btn.addEventListener('mouseover', () => {
      btn.style.background  = 'rgba(255,255,255,0.18)';
      btn.style.borderColor = 'rgba(255,255,255,0.35)';
    });
    btn.addEventListener('mouseout', () => {
      btn.style.background  = 'rgba(10,10,10,0.55)';
      btn.style.borderColor = 'rgba(255,255,255,0.18)';
    });
    return btn;
  }

  /** 构建整个预览遮罩 DOM */
  function buildOverlay() {
    /* ── 遮罩容器 ── */
    overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 2147483646;
      background: rgba(8, 8, 8, 0.93);
      display: none;
      align-items: center;
      justify-content: center;
      cursor: default;
      touch-action: none;
      -webkit-tap-highlight-color: transparent;
      overscroll-behavior: none;
    `;

    /* ── 图片元素 ── */
    imgEl = document.createElement('img');
    imgEl.style.cssText = `
      max-width: 100vw;
      max-height: 100vh;
      object-fit: contain;
      display: block;
      user-select: none;
      -webkit-user-drag: none;
      transform-origin: center center;
      transform: translate(0, 0) scale(1);
      position: relative;
      z-index: 1;
      will-change: transform;
      touch-action: none;
      -webkit-tap-highlight-color: transparent;
    `;
    overlay.appendChild(imgEl);

    /* ── 计数器（左上角） ── */
    counterEl = document.createElement('div');
    counterEl.style.cssText = `
      position: absolute;
      top: 16px; left: 16px;
      color: rgba(255,255,255,0.88);
      font-size: 13px;
      font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
      letter-spacing: 0.5px;
      background: rgba(10,10,10,0.55);
      border: 1px solid rgba(255,255,255,0.12);
      padding: 5px 13px;
      border-radius: 20px;
      pointer-events: none;
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      z-index: 10;
      display: none;
    `;
    overlay.appendChild(counterEl);

    /* ── 关闭按钮（右上角） ── */
    closeBtn = makeIconBtn('✕', 'top: 16px; right: 16px;');
    closeBtn.title = '关闭（Esc）';
    closeBtn.addEventListener('click', e => { e.stopPropagation(); closePreview(); });
    overlay.appendChild(closeBtn);

    /* ── 上一张（左侧） ── */
    prevBtn = makeNavBtn('&#10094;', 'left');
    prevBtn.title = '上一张（←）';
    prevBtn.setAttribute('data-disabled', '0');
    prevBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (prevBtn.getAttribute('data-disabled') === '1') return;
      goTo(idx - 1);
    });
    overlay.appendChild(prevBtn);

    /* ── 下一张（右侧） ── */
    nextBtn = makeNavBtn('&#10095;', 'right');
    nextBtn.title = '下一张（→）';
    nextBtn.setAttribute('data-disabled', '0');
    nextBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (nextBtn.getAttribute('data-disabled') === '1') return;
      goTo(idx + 1);
    });
    overlay.appendChild(nextBtn);

    /* ── 右下角操作按钮组 ── */
    const bottomRight = document.createElement('div');
    bottomRight.style.cssText = `
      position: absolute;
      bottom: 18px; right: 18px;
      display: flex; gap: 8px;
      z-index: 10;
    `;

    /* ── 查看原图按钮 ── */
    viewOrigBtn = makeTextBtn('查看原图');
    viewOrigBtn.addEventListener('click', e => {
      e.stopPropagation();
      const origSrc = getOrigSrc(imgEl.src);
      if (!origSrc) return;
      if (imgEl.getAttribute('data-orig-loaded') === origSrc) return;

      viewOrigBtn.textContent       = '加载中…';
      viewOrigBtn.style.opacity     = '0.6';
      viewOrigBtn.style.pointerEvents = 'none';

      const tmp = new Image();
      tmp.onload = () => {
        isZoomed = false; tx = 0; ty = 0;
        imgEl.style.transition = 'none';
        imgEl.style.transform  = 'translate(0,0) scale(1)';
        imgEl.src = origSrc;
        imgEl.setAttribute('data-orig-loaded', origSrc);

        const ready = () => {
          const info = computeDisplaySize();
          dW = info.w; dH = info.h; isSmall = info.small;
          updateCursor();
        };
        if (imgEl.complete && imgEl.naturalWidth > 0) ready();
        else imgEl.onload = ready;

        viewOrigBtn.textContent       = '已显示原图';
        viewOrigBtn.style.opacity     = '0.45';
        viewOrigBtn.style.pointerEvents = 'none';
      };
      tmp.onerror = () => {
        viewOrigBtn.textContent       = '加载失败';
        viewOrigBtn.style.opacity     = '1';
        viewOrigBtn.style.pointerEvents = 'auto';
      };
      tmp.src = origSrc;
    });

    /* ── 下载按钮 ── */
    // 优先 fetch blob + 解析响应头（Content-Disposition / Content-Type）取准确文件名；
    // 失败则 canvas 导出；最终降级 <a download>。
    dlBtn = makeTextBtn('下载');
    dlBtn.addEventListener('click', async e => {
      e.stopPropagation();
      const src = imgEl.src || images[idx].src;

      const setLoading = () => {
        dlBtn.textContent        = '下载中…';
        dlBtn.style.opacity      = '0.6';
        dlBtn.style.pointerEvents = 'none';
      };
      const setDone = () => {
        dlBtn.textContent = '已下载';
        setTimeout(() => {
          dlBtn.textContent        = '下载';
          dlBtn.style.opacity      = '1';
          dlBtn.style.pointerEvents = 'auto';
        }, 2000);
      };
      const setError = () => {
        dlBtn.textContent        = '下载失败';
        dlBtn.style.opacity      = '1';
        dlBtn.style.pointerEvents = 'auto';
        setTimeout(() => { dlBtn.textContent = '下载'; }, 2500);
      };

      /**
       * 从响应头提取最准确的下载文件名。
       * 优先级：Content-Disposition filename → URL 路径名（去压缩后缀）+ Content-Type 校正扩展名
       */
      function resolveFilename(res) {
        // ① Content-Disposition: inline; filename="01.jpg@1000h.webp"
        const cd = res.headers.get('content-disposition') || '';
        // RFC 5987 编码：filename*=UTF-8''...
        const starMatch = cd.match(/filename\*=(?:UTF-8'')?([^;\r\n]+)/i);
        if (starMatch) {
          const name = decodeURIComponent(starMatch[1].trim()).replace(ORIG_RE, '');
          if (name) return name;
        }
        // 普通 filename="..."
        const match = cd.match(/filename="?([^";\r\n]+)"?/i);
        if (match) {
          const name = match[1].trim().replace(ORIG_RE, '');
          if (name) return name;
        }

        // ② URL 路径名作为基础文件名，去掉压缩后缀
        const raw  = decodeURIComponent(src.split('/').pop().split('?')[0]);
        const base = raw.replace(ORIG_RE, '').replace(/\.[^.]*$/, '') || 'image';

        // ③ Content-Type 决定扩展名
        const ct      = (res.headers.get('content-type') || '').split(';')[0].trim();
        const extMap  = {
          'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
          'image/webp': '.webp', 'image/avif': '.avif',
          'image/svg+xml': '.svg', 'image/ico': '.ico', 'image/x-icon': '.ico',
        };
        const ext = extMap[ct] || '';
        return ext ? base + ext : (raw.replace(ORIG_RE, '') || 'image');
      }

      setLoading();

      /* ① fetch blob — 同时拿到响应头和文件内容 */
      try {
        const res = await fetch(src, { mode: 'cors', cache: 'force-cache' });
        if (!res.ok) throw new Error('fetch !ok');
        const blob     = await res.blob();
        const filename = resolveFilename(res);
        const blobUrl  = URL.createObjectURL(blob);
        triggerDownload(blobUrl, filename);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
        setDone();
        return;
      } catch (_) { /* 继续降级 */ }

      /* ② canvas 导出（对已渲染图片，绕过部分跨域限制） */
      try {
        const raw      = decodeURIComponent(src.split('/').pop().split('?')[0]);
        const filename = raw.replace(ORIG_RE, '') || 'image';
        const canvas   = document.createElement('canvas');
        canvas.width   = imgEl.naturalWidth  || 800;
        canvas.height  = imgEl.naturalHeight || 600;
        canvas.getContext('2d').drawImage(imgEl, 0, 0);
        canvas.toBlob(blob => {
          if (!blob) { setError(); return; }
          const blobUrl = URL.createObjectURL(blob);
          triggerDownload(blobUrl, filename + '.png');
          setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
          setDone();
        }, 'image/png');
        return;
      } catch (_) { /* 继续降级 */ }

      /* ③ 最终降级：<a download>（跨域时浏览器可能改为在新标签页预览） */
      const filename = decodeURIComponent(src.split('/').pop().split('?')[0]).replace(ORIG_RE, '') || 'image';
      triggerDownload(src, filename);
      setDone();
    });

    /** 触发浏览器下载 */
    function triggerDownload(href, name) {
      const a   = document.createElement('a');
      a.href     = href;
      a.download = name;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    bottomRight.appendChild(viewOrigBtn);
    bottomRight.appendChild(dlBtn);
    overlay.appendChild(bottomRight);

    /* ── 绑定事件 ── */
    overlay.addEventListener('click',  onOverlayClick);
    imgEl.addEventListener('click',    onImgClick);
    imgEl.addEventListener('mousedown', e => { e.preventDefault(); onMouseDown(e); });
    overlay.addEventListener('wheel',  onWheel, { passive: false });

    // 触摸事件（全部挂在 overlay 上，通过 touchTarget 区分图片 / 背景）
    overlay.addEventListener('touchstart', onTouchStart, { passive: true });
    overlay.addEventListener('touchmove',  onTouchMove,  { passive: false });
    overlay.addEventListener('touchend',   onTouchEnd,   { passive: false });

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
    document.addEventListener('keydown',   onKeyDown);

    document.body.appendChild(overlay);
  }

  /* ═══════════════════════════════════════════════
   * 初始化入口
   * ═══════════════════════════════════════════════ */
  function init() {
    images = Array.from(document.querySelectorAll(`img[${PREVIEW_ATTR}]`));
    if (!images.length) return;

    buildOverlay();

    // 为每张原始图片设置 zoom-in 光标并绑定点击事件
    images.forEach((img, i) => {
      img.style.cursor      = 'zoom-in';
      img.style.touchAction = 'manipulation'; // 消除移动端 300ms 点击延迟
      img.addEventListener('click', () => openPreview(i));
    });
  }

  // 支持动态插入脚本（DOM 可能已 ready）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
