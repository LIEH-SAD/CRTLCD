/*
 * 车内 LCD 的版面绘制。
 *
 * 版面按 1617×280 设计，实际画布尺寸由 config.json 的 lcdSize 决定，
 * 里面所有尺寸都按 SX / SY 换算，换屏幕比例时只改 lcdSize 即可。
 * 版面拆成若干模块（见「模块化布局」一节），右侧屏按模块镜像，
 * 站序、面板排布、箭头朝向跟着翻，文字始终保持正向。
 *
 * 调用入口：drawScreen()（整页）与 drawDoorPanel() / drawCoachNumberPlate()（逐节车厢补画）。
 */

importPackage(java.awt);
importPackage(java.awt.geom);

include("js_util.js");

/* ============================== 配置 ============================== */

const CONFIG = JSON.parse(Resources.readString(Resources.id("mtr:cqlcd/config.json")));
// 每页显示时长（秒）
const PAGE_DURATION = (CONFIG.pageDuration == null) ? 10 : CONFIG.pageDuration;
// 右上角服务类型徽标，格式为「中文|English」
const SERVICE_TYPE = (CONFIG.serviceType == null) ? "普通|Local" : CONFIG.serviceType;
// 是否显示编组车厢数
const SHOW_COACH_NUMBER = (CONFIG.showCoachNumber == null) ? true : CONFIG.showCoachNumber;
// 是否每节车厢各显示自己的车厢编号（改为 false 时全列共用一张贴图，只显示编组总数）
const PER_CAR_COACH_NUMBER = (CONFIG.perCarCoachNumber == null) ? true : CONFIG.perCarCoachNumber;
// 是否交换左右侧车门提示所依据的车门状态（贴图与实际左右相反时改为 true）
const FLIP_DOOR_SIDES = (CONFIG.flipDoorSides == null) ? false : CONFIG.flipDoorSides;
// 是否在左侧站名条中显示行驶方向箭头（部分线路的 LCD 没有此箭头）
const SHOW_STRIP_ARROW = (CONFIG.showStripArrow == null) ? true : CONFIG.showStripArrow;
// 是否播放开门动画（本侧车门将开启时，两扇门 1 秒一次开合）
const DOOR_ANIMATION = (CONFIG.doorAnimation == null) ? true : CONFIG.doorAnimation;
// 开门动画每秒重画次数（性能不够时调小）
const DOOR_ANIMATION_FPS = (CONFIG.doorAnimationFps == null) ? 10 : CONFIG.doorAnimationFps;
// 开门动画一个循环的时长（秒）
const DOOR_ANIMATION_PERIOD = 1.0;
// 出站换乘（同一站换乘，但要出站走到隔壁车站）徽标的画法：
//   "gray"    灰底实心 + 白字（默认）
//   "outline" 浅底 + 线路色描边 + 深色字（原来的画法）
// 站内换乘一律用线路色实心，不受这里影响。
const CONNECTING_BADGE_STYLE = (CONFIG.connectingBadgeStyle == null) ? "gray" : String(CONFIG.connectingBadgeStyle);
// 出站换乘徽标的底色（[R,G,B]）。白字要配足够深的灰才看得清，调浅了字会糊。
const CONNECTING_BADGE_GRAY_RGB = (CONFIG.connectingBadgeGray == null) ? [110, 117, 124] : CONFIG.connectingBadgeGray;
// 是否走出站换乘的灰底白字款
const GRAY_CONNECTING_BADGE = (CONNECTING_BADGE_STYLE == "gray");
// 一个站换乘线路很多时，徽标是否横向排成一行（这样只占一行高度，站名可以画大）
const HORIZONTAL_HUB_BADGES = (CONFIG.hubBadgesHorizontal == null) ? true : CONFIG.hubBadgesHorizontal;

/* ============================== 页面 ============================== */

const SCREEN_FULL_ROUTE_MAP = "full_route_map";
const SCREEN_NEXT_STATION = "next_station";
const SCREEN_ARRIVED = "arrived";

/* ============================== 尺寸 ============================== */

/**
 * 版面按 1617×280 设计，实际画布尺寸由 config.json 的 lcdSize 决定。
 * 换用比例不同的 LCD 时只需改 lcdSize（配合 main.js 里的显示屏位置），
 * 下面所有尺寸都按 SX / SY 换算，图不会跑出屏幕或白色卡片。
 */
const REF_WIDTH = 1617;
const REF_HEIGHT = 280;
const WIDTH = (CONFIG.lcdSize == null) ? REF_WIDTH : CONFIG.lcdSize[0];
const HEIGHT = (CONFIG.lcdSize == null) ? REF_HEIGHT : CONFIG.lcdSize[1];
const SX = WIDTH / REF_WIDTH;   // 横向缩放
const SY = HEIGHT / REF_HEIGHT; // 纵向缩放

/** 按屏幕高度换算字号。 */
function sz(size) {
    return size * SY;
}

/** 按两个方向中较小的缩放比例换算（圆角、圆点等需要保持形状的尺寸）。 */
function sr(size) {
    return size * Math.min(SX, SY);
}

const HEADER_HEIGHT = 56 * SY;      // 顶部色条高
const MARGIN = 20 * SX;             // 屏幕左右边距
const PANEL_TOP = 87 * SY;          // 信息面板顶部
const PANEL_HEIGHT = 179 * SY;      // 信息面板高
const PANEL_LEFT = 433 * SX;        // 信息面板左侧（左侧站名条的右端）
const PANEL_RADIUS = 12 * sr(1);    // 面板圆角
const DOOR_PANEL_LEFT = 1157 * SX;  // 车门提示面板左侧
const PANEL_GAP = 10 * SX;          // 两个面板之间的空隙
const STRIP_BAND_TOP = 130 * SY;    // 左侧站名条浅色条顶部
const STRIP_BAND_HEIGHT = 46 * SY;  // 浅色条高
const STRIP_BAND_LEFT = 96 * SX;    // 浅色条左端
const STRIP_DOT_X = 189 * SX;       // 更早车站（实心圆点）中心 x
const STRIP_RING_X = 341 * SX;      // 刚驶离（空心圆圈）车站中心 x
const CARD_RADIUS = 10 * sr(1);     // 线路图白色卡片圆角
const CARD_BOTTOM_MARGIN = 18 * SY; // 线路图白色卡片距屏幕底部
const CIRCLE_ROW_Y = 90 * SY;       // 线路图圆点中心 y（白色卡片顶部下方约 34）
const CIRCLE_MAX_RADIUS = 12 * SY;  // 线路图圆点最大半径（站少时按站距缩小）
const MAX_NAME_SIZE = 30 * SY;      // 线路图站名最大字号
const MAX_PINYIN_SIZE = 15 * SY;    // 线路图拼音最大字号
const BAND_HEIGHT = 34 * SY;        // 线路图圆点所在浅色带的高
const MAP_MARGIN = 34 * SX;         // 线路图与白色卡片左右边缘的距离
const BADGE_HEIGHT = 21 * SY;       // 换乘徽标高
const BADGE_RADIUS = 4 * sr(1);     // 换乘徽标圆角
const NAME_RESERVED_BADGES = 2;     // 站名按最多两颗换乘徽标预留高度（更多的车站由它自己的站名让位）
const HORIZONTAL_BADGE_MIN = 3;     // 一个站换乘 3 条以上时，徽标横向排成一行
const BADGE_GAP = 4 * SX;           // 横向排列时徽标之间的间距

/* ============================== 颜色 ============================== */

const COLOR_PANEL = rgb(202, 208, 213);
const COLOR_PANEL_EDGE = rgb(233, 237, 240);
const COLOR_TEXT = rgb(34, 40, 47);
const COLOR_TEXT_GRAY = rgb(122, 130, 138);
const COLOR_LABEL = rgb(0, 110, 184);       // 「下一站／开往／已到达」等蓝色标签
const COLOR_DIVIDER = rgb(168, 176, 183);
const COLOR_CARD = rgb(255, 255, 255);      // 线路图白色卡片
const COLOR_TEAL = rgb(52, 152, 158);       // 未到站圆点
const COLOR_MAP_DOT_PASSED = rgb(226, 231, 235);    // 已过站圆点
const COLOR_MAP_TEXT_PASSED = rgb(178, 186, 194);   // 已过站站名
const COLOR_MAP_PINYIN_PASSED = rgb(202, 208, 214); // 已过站拼音
const COLOR_ARROW = rgb(226, 0, 24);        // 方向箭头尖端（红）
const COLOR_ARROW_TAIL = rgb(255, 200, 90); // 方向箭头尾部（黄，向末端淡出）
const COLOR_RING_ARROW = rgb(27, 60, 110);  // 换乘站的环形双向箭头
const COLOR_RING_ARROW_PASSED = rgb(172, 184, 196); // 已过站的环形箭头
const COLOR_STRIP_BAND = rgba(255, 255, 255, 150);  // 站名条浅色带
const COLOR_STRIP_BAND_EDGE = rgba(255, 255, 255, 235); // 站名条白色描边
const COLOR_DOOR_FRAME = rgb(246, 248, 250);
const COLOR_DOOR_GLASS = rgb(58, 180, 194);
const COLOR_DOOR_BAN = rgb(214, 16, 32);    // 车门禁止符号（红）
const COLOR_BADGE_GRAY = rgb(CONNECTING_BADGE_GRAY_RGB[0], CONNECTING_BADGE_GRAY_RGB[1], CONNECTING_BADGE_GRAY_RGB[2]); // 出站换乘徽标底色
const COLOR_DOT_GRAY = rgb(201, 206, 211);  // 灰底徽标上方三个连接点的颜色（浅灰，画在白色卡片上）

/* ============================== 字体 ============================== */

const ROBOTO_REGULAR = Resources.readFont(Resources.id("mtr:cqlcd/fonts/roboto/roboto-regular.ttf"));
const ROBOTO_BOLD = Resources.readFont(Resources.id("mtr:cqlcd/fonts/roboto/roboto-bold.ttf"));
const SHS_REGULAR = Resources.readFont(Resources.id("mtr:cqlcd/fonts/source-han-sans-cn/source-han-sans-cn-regular.otf"));
const SHS_BOLD = Resources.readFont(Resources.id("mtr:cqlcd/fonts/source-han-sans-cn/source-han-sans-cn-bold.otf"));

/* ============================== 颜色工具 ============================== */

/** 由 R、G、B 创建颜色，避免 Rhino 中 Color 构造方法重载的问题。 */
function rgb(r, g, b) {
    return new Color(((r & 0xFF) << 16) | ((g & 0xFF) << 8) | (b & 0xFF));
}

/** 由 R、G、B、A 创建颜色。 */
function rgba(r, g, b, a) {
    return new Color(((a & 0xFF) << 24) | ((r & 0xFF) << 16) | ((g & 0xFF) << 8) | (b & 0xFF), true);
}

/** 调整明度：factor 大于 0 变暗，小于 0 变亮。 */
function shade(color, factor) {
    let r = Math.max(0, Math.min(255, Math.round(color.getRed() * (1 - factor))));
    let g = Math.max(0, Math.min(255, Math.round(color.getGreen() * (1 - factor))));
    let b = Math.max(0, Math.min(255, Math.round(color.getBlue() * (1 - factor))));
    return rgb(r, g, b);
}

/** 按比例混合两种颜色，t 为 colorB 所占比例（0～1）。 */
function blend(colorA, colorB, t) {
    let r = Math.round(colorA.getRed() * (1 - t) + colorB.getRed() * t);
    let g = Math.round(colorA.getGreen() * (1 - t) + colorB.getGreen() * t);
    let b = Math.round(colorA.getBlue() * (1 - t) + colorB.getBlue() * t);
    return rgb(Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b)));
}

/** 判断颜色是否偏亮，用于决定徽标上的文字用黑色还是白色。 */
/** 判断颜色是否偏亮，用于决定线路色徽标上的文字用黑色还是白色。 */
function isLightColor(color) {
    let darkness = 1 - (0.299 * color.getRed() + 0.587 * color.getGreen() + 0.114 * color.getBlue()) / 255;
    return darkness < 0.5;
}

/* ============================== 模块化布局 ============================== */

/**
 * 版面拆成若干模块，镜像以「模块」为单位进行，每个模块可以选择：
 *   "off"      两块屏完全一致
 *   "position" 只把模块整体挪到屏幕另一侧的对应位置，内部排布不动
 *   "full"     位置与内部排布一起镜像（文字仍然正向书写，不会被翻转）
 * 所有模块都取同一个策略时，右侧屏就是左侧屏的镜像：站点、站序、面板排布、箭头朝向
 * 全部翻到另一侧，只有文字仍然正向书写（中文、拼音、英文都不会被颠倒）。
 * 需要「线路信息两块屏完全一致」时，把对应模块（如 routeMap）改成 "off" 即可。
 *
 * 模块一览（括号内是模块 id）：
 *   顶部色条 headerBar、重庆轨道交通标识 logo、路线名 routeName、服务类型徽标 serviceType、
 *   全线线路图 routeMap、左侧站名条 stationStrip、信息面板 infoPanel（车厢编号也用它）、
 *   车门提示面板 doorPanel。每块屏独立绘制时（main.js 逐节车厢补画车门面板与车厢编号）
 *   会传入同一个布局对象，保证补画的部分与底图位置一致。
 */
const MIRROR_RIGHT_SCREEN = (CONFIG.mirrorRightScreen == null) ? true : CONFIG.mirrorRightScreen;

// 各模块默认的镜像方式，可用 config.json 的 mirrorModules 逐项覆盖
const MODULE_MIRROR_DEFAULT = {
    "headerBar": "off",         // 顶部色条：通版，镜像没有意义
    "logo": "off",              // 重庆轨道交通标识：两块屏都固定在左上角
    "routeName": "off",         // 路线名居中，镜像前后位置相同
    "serviceType": "off",       // 普通／快速徽标：两块屏都固定在右上角
    "routeMap": "full",         // 全线线路图：站序整体镜像，站名/拼音/徽标文字仍正向
    "stationStrip": "full",     // 左侧站名条：整条带子镜像（圆点顺序、斜切与箭头一起翻）
    "infoPanel": "full",        // 下一站／已到达信息面板（车厢编号跟着它走）
    "doorPanel": "full"         // 车门提示面板
};

/** 取某个模块的镜像方式。 */
function getModuleMirrorMode(moduleId) {
    let overrides = CONFIG.mirrorModules;
    if (overrides != null) {
        let value = overrides[moduleId];
        if (value != null) {
            return String(value);
        }
    }
    let fallback = MODULE_MIRROR_DEFAULT[moduleId];
    return (fallback == null) ? "off" : fallback;
}

/** 一块屏的布局：mirrorScreen 为真时按模块镜像。 */
function createLayout(mirrorScreen) {
    let mirrored = (mirrorScreen == true);
    return {
        "mirrored": mirrored,
        "mode": function (moduleId) {
            return mirrored ? getModuleMirrorMode(moduleId) : "off";
        }
    };
}

// 不做任何镜像的布局（列车左侧屏，或关闭镜像时的两块屏）
const LAYOUT_NORMAL = createLayout(false);

// 各模块的横向区间 [左, 宽]，用设计坐标表示
const MODULE_BOX = {
    "headerBar": function (g, ctx) { return [0, WIDTH]; },
    "logo": function (g, ctx) { return [SX * 36, logoWidth()]; },
    "routeName": function (g, ctx) { return routeNameBox(g, ctx.routeInfo); },
    "serviceType": function (g, ctx) { return serviceTypeBox(g); },
    "routeMap": function (g, ctx) { return [MARGIN, WIDTH - MARGIN * 2]; },
    "stationStrip": function (g, ctx) { return [stripBoxLeft(), stripBoxWidth()]; },
    "infoPanel": function (g, ctx) { return [PANEL_LEFT, infoPanelWidth()]; },
    "doorPanel": function (g, ctx) { return [DOOR_PANEL_LEFT, WIDTH - MARGIN - DOOR_PANEL_LEFT]; }
};

/**
 * 按模块绘制：先算出模块区间，再按策略把整个模块平移到屏幕另一侧的对应位置。
 * drawFn 的形式是 drawFn(g, ctx, box, inner)，inner 表示模块内部是否也要按镜像排布。
 *
 * 这里用「正向平移 + 反向平移」还原，而不是 getTransform()/setTransform()：
 * 在 NTE 的脚本环境里 getTransform() 有可能拿到 undefined，一调用就会让整帧报错。
 */
function withModule(g, layout, moduleId, ctx, drawFn) {
    let box = MODULE_BOX[moduleId](g, ctx);
    let mode = layout.mode(moduleId);
    let offset = (mode == "off") ? 0 : (WIDTH - 2 * box[0] - box[1]);
    if (offset != 0) {
        g.translate(offset, 0);
    }
    drawFn(g, ctx, box, (mode == "full"));
    if (offset != 0) {
        g.translate(-offset, 0);
    }
}

/**
 * 模块内部的横向定位：inner 为真时按模块区间镜像。
 * 左对齐的元素要把自身宽度传进来（镜像后仍保持原来的边距），居中的元素传 0。
 */
function moduleInnerX(box, inner, x, elementWidth) {
    if (!inner) {
        return x;
    }
    let width = (elementWidth == null) ? 0 : elementWidth;
    return box[0] + box[0] + box[1] - x - width;
}

/** 取 [left, right] 区间在模块内部镜像后的区间（保证左端小于右端，居中的元素用）。 */
function moduleInnerRange(box, inner, left, right) {
    let a = moduleInnerX(box, inner, left, 0);
    let b = moduleInnerX(box, inner, right, 0);
    return [(a < b) ? a : b, (a < b) ? b : a];
}

/**
 * 只由图形（没有文字）组成的子图形，镜像时以自身中心左右翻转即可。
 * 箭头、斜切带子这类朝向性的图形用这个方法，形状会跟着镜像一起翻过来。
 */
function drawMirroredShape(g, centerX, mirrored, drawFn) {
    if (!mirrored) {
        drawFn();
        return;
    }
    g.translate(2 * centerX, 0);
    g.scale(-1, 1);
    drawFn();
    g.scale(-1, 1);          // 反向缩放回来
    g.translate(-2 * centerX, 0);
}

/** 取行进方向：1 表示朝线路图序号增大的方向，-1 表示朝序号减小的方向。两块屏取值相同。 */
function getScreenDirection(routeInfo) {
    return getDrawDirection(routeInfo);
}

/* ============================== 绘图工具 ============================== */

/** 绘制文本（统一入口，便于以后调整文字渲染）。 */
function drawText(g, text, x, baselineY) {
    g.drawString(text, Math.round(x), baselineY);
}

/** 绘制图片（统一入口）。 */
function drawImageAt(g, image, x, y, width, height) {
    g.drawImage(image, Math.round(x), Math.round(y), Math.round(width), Math.round(height), null);
}

/** 计算在给定宽高限制下最合适的字号。 */
function fitFontSize(g, baseFont, text, maxWidth, maxHeight, maxSize, minSize) {
    let size = maxSize;
    while (size > minSize) {
        let metrics = g.getFontMetrics(baseFont.deriveFont(size * 1.0));
        let fitsWidth = (maxWidth <= 0) || (metrics.stringWidth(text) <= maxWidth);
        let fitsHeight = (maxHeight <= 0) || (metrics.getHeight() <= maxHeight);
        if (fitsWidth && fitsHeight) {
            return size;
        }
        size -= 1;
    }
    return minSize;
}

/** 绘制水平居中的文本。 */
function drawStringCentered(g, text, centerX, baselineY) {
    drawText(g, text, Math.round(centerX - g.getFontMetrics().stringWidth(text) / 2), baselineY);
}

/** 按空格把文本拆成若干行。 */
function wrapWords(g, font, text, maxWidth) {
    let metrics = g.getFontMetrics(font);
    let words = text.split(" ");
    let lines = [];
    let current = "";
    for (let i = 0; i < words.length; i++) {
        let candidate = (current.length == 0) ? words[i] : current + " " + words[i];
        if (current.length == 0 || metrics.stringWidth(candidate) <= maxWidth) {
            current = candidate;
        } else {
            lines.push(current);
            current = words[i];
        }
    }
    if (current.length > 0) {
        lines.push(current);
    }
    return lines;
}

/** 给路线名中的数字两侧补空格，例如「重庆轨道交通5号线」→「重庆轨道交通 5 号线」。 */
function formatRouteCjkName(name) {
    return String(name).replace(/([0-9]+)/g, " $1 ").replace(/\s+/g, " ").trim();
}

/** 把 Java 字符串转成 JavaScript 字符串，以便安全地使用 JS 的字符串方法。 */
function toJsString(value) {
    return (value == null) ? "" : String(value);
}

/** 取列车的行驶方向：1 表示朝线路图序号增大的方向，-1 表示朝序号减小的方向，判断不出来时按 1 处理。 */
function getDrawDirection(routeInfo) {
    if (routeInfo != null && routeInfo.travelDirection < 0) {
        return -1;
    }
    return 1;
}

/** 游戏运行时间（秒），供动画使用。不同 NTE 版本提供的对象不一样，逐个试。 */
function getGameTime() {
    try {
        if (typeof Timing != "undefined") {
            return Timing.elapsed();
        }
    } catch (error) {
        // 没有 Timing 时试下一个
    }
    try {
        if (typeof TimingUtil != "undefined") {
            return TimingUtil.elapsed();
        }
    } catch (error) {
        // 都没有时用系统时间
    }
    return java.lang.System.currentTimeMillis() / 1000.0;
}

/** 开门动画当前的开度：0（关闭）→1（全开）→0 循环，周期 1 秒。 */
function getDoorAnimationFraction() {
    let phase = getGameTime() % DOOR_ANIMATION_PERIOD;
    if (phase < 0) {
        phase += DOOR_ANIMATION_PERIOD;
    }
    return (phase < 0.5) ? (phase * 2) : (2 - phase * 2);
}

/*
 * 重庆轨道交通标识（白色版），取自资源包里的 sign/logo.png。
 * 注意 Resources.idr() 只能在脚本顶层调用，写进函数里会抛 "Cannot use idr in functions"，
 * 所以这里在顶层用带命名空间的绝对路径读取，读不到就画不出标识。
 */
let LOGO = null;
try {
    LOGO = Resources.readBufferedImage(Resources.id("mtr:cqlcd/lcd_logo.png"));
} catch (error) {
    print("LCD：无法读取 lcd_logo.png，" + error);
    LOGO = null;
}

/** 取已读取好的重庆轨道交通标识，读取失败时返回 null。 */
function getLogo() {
    return LOGO;
}

/* ============================== 入口 ============================== */

/**
 * 绘制一整页 LCD。
 * @param {Graphics2D} g 绘图对象。
 * @param {RouteInfo} routeInfo 路线信息，见 mtr_util.js 的 getRouteInfo。
 * @param {String} trainStatus 列车状态，见 mtr_util.js 的 STATUS_* 常量。
 * @param {String} screenType 页面类型，见上面的 SCREEN_* 常量。
 * @param {Boolean} thisSideDoorWillOpen 行车途中本侧车门是否将开启。
 * @param {Boolean} thisSideDoorOpenNow 停站时本侧车门是否已开启。
 * @param {Number} coachNumber 要显示的车厢编号，0 表示不画。
 * @param {Boolean} includeDoorPanel 是否在本页里画车门面板，逐节车厢单独播放开门动画时由 main.js 自己画，这里传 false。
 * @param {Boolean} mirrorLayout 是否按模块镜像整块屏，列车右侧屏传 true，见 config.json 的 mirrorRightScreen。
 */
function drawScreen(g, routeInfo, trainStatus, screenType, thisSideDoorWillOpen, thisSideDoorOpenNow, coachNumber, includeDoorPanel, mirrorLayout) {
    if (includeDoorPanel === undefined) {
        includeDoorPanel = true;
    }
    if (mirrorLayout === undefined) {
        mirrorLayout = false;
    }
    g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
    g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
    g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
    g.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE);
    g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);

    g.setColor(Color.WHITE);
    g.fillRect(0, 0, WIDTH, HEIGHT);

    if (trainStatus == STATUS_NO_ROUTE || routeInfo == null) {
        drawNoRouteScreen(g);
        return;
    }

    const routeColor = routeInfo.routeColor;
    const layout = createLayout(mirrorLayout);
    const ctx = {
        "routeInfo": routeInfo,
        "routeColor": routeColor,
        "trainStatus": trainStatus,
        "page": screenType,
        "coachNumber": coachNumber
    };

    // 背景
    g.setColor(routeColor);
    g.fillRect(0, 0, WIDTH, HEIGHT);

    // 页面内容
    if (trainStatus == STATUS_ARRIVED) {
        drawArrivedScreen(g, layout, ctx);
    } else if (screenType == SCREEN_FULL_ROUTE_MAP) {
        drawFullRouteMapScreen(g, layout, ctx);
    } else {
        drawNextStationScreen(g, layout, ctx);
    }

    // 车门提示面板，静止状态的开门开度；开门动画由 main.js 逐帧传入开度重画
    let doorMode = getDoorMode(trainStatus == STATUS_ARRIVED, thisSideDoorWillOpen, thisSideDoorOpenNow);
    if (includeDoorPanel && screenType != SCREEN_FULL_ROUTE_MAP) {
        drawDoorPanel(g, routeColor, doorMode, getStaticDoorFraction(doorMode), layout);
    }

    // 车厢编号，逐节车厢的贴图各自补画
    drawCoachNumberPlate(g, (trainStatus == STATUS_ARRIVED) ? SCREEN_ARRIVED : screenType, coachNumber, layout);

    // 顶部区域：色条 → 标识 → 路线名 → 服务类型徽标
    withModule(g, layout, "headerBar", ctx, drawHeaderBarModule);
    withModule(g, layout, "logo", ctx, drawLogoModule);
    withModule(g, layout, "routeName", ctx, drawRouteNameModule);
    withModule(g, layout, "serviceType", ctx, drawServiceTypeModule);
}

/* ============================== 顶部区域（按模块拆分） ============================== */

/** 取路线名的中文／英文部分。 */
function getRouteNameParts(routeInfo) {
    let routeName = toJsString(routeInfo.routeName);
    let cjkName = formatRouteCjkName(getMatching(routeName, true));
    let enName = toJsString(getMatching(routeName, false));
    if (enName == cjkName) {
        enName = "";
    }
    return {"cjk": cjkName, "en": enName};
}

function getRouteNameCjkFont() { return SHS_BOLD.deriveFont(sz(27)); }
function getRouteNameEnFont() { return ROBOTO_REGULAR.deriveFont(sz(25)); }

/** 路线名模块的横向区间（居中）。 */
function routeNameBox(g, routeInfo) {
    let parts = getRouteNameParts(routeInfo);
    let cjkWidth = (parts.cjk.length == 0) ? 0 : g.getFontMetrics(getRouteNameCjkFont()).stringWidth(parts.cjk);
    let enWidth = (parts.en.length == 0) ? 0 : g.getFontMetrics(getRouteNameEnFont()).stringWidth(parts.en);
    let separatorWidth = (cjkWidth > 0 && enWidth > 0) ? SX * 36 : 0;
    let width = cjkWidth + enWidth + separatorWidth;
    return [Math.round((WIDTH - width) / 2), width];
}

/** 取服务类型徽标的中文／英文部分。 */
function getServiceTypeParts() {
    return {
        "cjk": toJsString(getMatching(toJsString(SERVICE_TYPE), true)),
        "en": toJsString(getMatching(toJsString(SERVICE_TYPE), false))
    };
}

function getServiceTypeCjkFont() { return SHS_BOLD.deriveFont(sz(20)); }
function getServiceTypeEnFont() { return ROBOTO_BOLD.deriveFont(sz(20)); }

/** 服务类型徽标模块的横向区间（靠右边距）。 */
function serviceTypeBox(g) {
    let parts = getServiceTypeParts();
    let cjkWidth = (parts.cjk.length == 0) ? 0 : g.getFontMetrics(getServiceTypeCjkFont()).stringWidth(parts.cjk);
    let enWidth = (parts.en.length == 0) ? 0 : g.getFontMetrics(getServiceTypeEnFont()).stringWidth(parts.en);
    let textWidth = cjkWidth + ((cjkWidth > 0 && enWidth > 0) ? SX * 8 : 0) + enWidth;
    let width = textWidth + SX * 26;
    return [WIDTH - MARGIN - SX * 10 - width, width];
}

/** 重庆轨道交通标识的宽度（按原图比例），读取失败时为 0。 */
function logoWidth() {
    let logo = getLogo();
    if (logo == null) {
        return 0;
    }
    return Math.round(logo.getWidth() * sz(34) / logo.getHeight());
}

/** 顶部色条。 */
function drawHeaderBarModule(g, ctx, box, inner) {
    let routeColor = ctx.routeColor;
    // 蓝条（自上而下渐亮）
    g.setPaint(new GradientPaint(0, 0, shade(routeColor, 0.45), 0, HEADER_HEIGHT, shade(routeColor, 0.10)));
    g.fillRect(0, 0, WIDTH, HEADER_HEIGHT);
    g.setColor(rgba(255, 255, 255, 80));
    g.fillRect(0, HEADER_HEIGHT - 2, WIDTH, 2);
}

/** 重庆轨道交通标识，白底透明图，画在顶部色条左上角。 */
function drawLogoModule(g, ctx, box, inner) {
    let logo = getLogo();
    if (logo == null) {
        return;
    }
    let logoHeight = sz(34);
    drawImageAt(g, logo, SX * 36, Math.round((HEADER_HEIGHT - logoHeight) / 2), logoWidth(), logoHeight);
}

/** 路线名（中文 + 英文）。 */
function drawRouteNameModule(g, ctx, box, inner) {
    let parts = getRouteNameParts(ctx.routeInfo);
    let cjkFont = getRouteNameCjkFont();
    let enFont = getRouteNameEnFont();
    let cjkWidth = (parts.cjk.length == 0) ? 0 : g.getFontMetrics(cjkFont).stringWidth(parts.cjk);
    let enWidth = (parts.en.length == 0) ? 0 : g.getFontMetrics(enFont).stringWidth(parts.en);
    let separatorWidth = (cjkWidth > 0 && enWidth > 0) ? SX * 36 : 0;
    let x = box[0];   // 模块本身居中，镜像前后位置相同
    let baselineY = Math.round(HEADER_HEIGHT / 2 + sz(10));

    g.setColor(Color.WHITE);
    g.setFont(cjkFont);
    drawText(g, parts.cjk, x, baselineY);
    x += cjkWidth;
    if (separatorWidth > 0) {
        g.setColor(rgba(255, 255, 255, 170));
        g.fillRect(Math.round(x + SX * 16), Math.round(baselineY - sz(23)), Math.max(2, Math.round(SX * 3)), Math.round(sz(27)));
        x += separatorWidth;
    }
    if (enWidth > 0) {
        g.setColor(Color.WHITE);
        g.setFont(enFont);
        drawText(g, parts.en, x, baselineY);
    }
}

/** 服务类型徽标（普通／快速）。 */
function drawServiceTypeModule(g, ctx, box, inner) {
    let parts = getServiceTypeParts();
    let cjkFont = getServiceTypeCjkFont();
    let enFont = getServiceTypeEnFont();
    let cjkWidth = (parts.cjk.length == 0) ? 0 : g.getFontMetrics(cjkFont).stringWidth(parts.cjk);
    let enWidth = (parts.en.length == 0) ? 0 : g.getFontMetrics(enFont).stringWidth(parts.en);
    let badgeWidth = box[1];
    let badgeHeight = sz(32);
    let badgeX = box[0];
    let badgeY = Math.round((HEADER_HEIGHT - badgeHeight) / 2);

    g.setColor(rgba(14, 18, 24, 190));
    g.fillRoundRect(Math.round(badgeX), badgeY, Math.round(badgeWidth), Math.round(badgeHeight), sr(6), sr(6));
    g.setColor(Color.WHITE);
    let badgeTextX = badgeX + SX * 13;
    let badgeBaseline = badgeY + Math.round((badgeHeight + sz(15)) / 2);
    if (cjkWidth > 0) {
        g.setFont(cjkFont);
        drawText(g, parts.cjk, Math.round(badgeTextX), badgeBaseline);
        badgeTextX += cjkWidth + SX * 8;
    }
    if (enWidth > 0) {
        g.setFont(enFont);
        drawText(g, parts.en, Math.round(badgeTextX), badgeBaseline);
    }
}

/* ============================== 无路线提示 ============================== */

function drawNoRouteScreen(g) {
    g.setColor(rgb(0, 46, 96));
    g.fillRect(0, 0, WIDTH, HEIGHT);

    g.setColor(Color.WHITE);
    g.setFont(SHS_BOLD.deriveFont(sz(34)));
    drawText(g, "本车厂没有设置有效路线", MARGIN * 2, Math.round(sz(96)));

    g.setColor(rgba(255, 255, 255, 210));
    g.setFont(SHS_REGULAR.deriveFont(sz(24)));
    drawText(g, "请在铁路仪表板中刷新路线，然后清除列车。", MARGIN * 2, Math.round(sz(148)));

    g.setColor(rgba(255, 255, 255, 170));
    g.setFont(ROBOTO_REGULAR.deriveFont(sz(20)));
    drawText(g, "This depot has not set a valid route. Please refresh the route in the Railway Dashboard and then clear the train.", MARGIN * 2, Math.round(sz(192)));
}

/* ============================== 方向箭头与换乘标记 ============================== */

/**
 * 绘制指示行驶方向的渐变箭头（尖端红色，尾部渐变为黄色并淡出）。
 * @param {Number} tipX 箭头尖端 x。
 * @param {Number} centerY 箭头中线 y。
 * @param {Number} direction 1 表示指向右，-1 表示指向左。
 * @param {Number} length 箭头总长。
 * @param {Number} headHeight 箭头头部高。
 * @param {Number} shaftHeight 箭杆高。
 * @param {Color} backgroundColor 箭头所在底色，用于让尾部淡出到背景。
 */
function drawDirectionArrow(g, tipX, centerY, direction, length, headHeight, shaftHeight, backgroundColor) {
    let headLength = length * 0.45;
    let tailX = tipX - direction * length;
    let headBackX = tipX - direction * headLength;
    let halfHead = headHeight / 2;
    let halfShaft = shaftHeight / 2;
    let tailColor = blend(COLOR_ARROW_TAIL, backgroundColor, 0.45);

    let path = new GeneralPath();
    path.moveTo(tipX, centerY);
    path.lineTo(headBackX, centerY - halfHead);
    path.lineTo(headBackX, centerY - halfShaft);
    path.lineTo(tailX, centerY - halfShaft);
    path.lineTo(tailX, centerY + halfShaft);
    path.lineTo(headBackX, centerY + halfShaft);
    path.lineTo(headBackX, centerY + halfHead);
    path.closePath();

    g.setPaint(new GradientPaint(tipX, centerY, COLOR_ARROW, tailX, centerY, tailColor));
    g.fill(path);
    g.setColor(COLOR_ARROW);
}

/**
 * 绘制换乘站标记：白色圆环 + 圆点 + 深蓝色环形双向箭头（仅换乘站有）。
 * @param {Number} centerX 圆心 x。
 * @param {Number} centerY 圆心 y。
 * @param {Number} radius 圆点半径。
 * @param {Color} dotColor 圆点颜色。
 * @param {Color} ringColor 环形箭头颜色。
 */
function drawInterchangeRing(g, centerX, centerY, radius, dotColor, ringColor) {
    let ringRadius = radius + Math.max(sr(1.5), radius * 0.24);
    let ringStroke = Math.max(sr(2), radius * 0.26);
    let whiteRadius = ringRadius + ringStroke;

    g.setColor(Color.WHITE);
    g.fillOval(Math.round(centerX - whiteRadius), Math.round(centerY - whiteRadius),
        Math.round(whiteRadius * 2), Math.round(whiteRadius * 2));

    g.setColor(dotColor);
    g.fillOval(Math.round(centerX - radius), Math.round(centerY - radius), radius * 2, radius * 2);

    g.setStroke(new BasicStroke(ringStroke, BasicStroke.CAP_BUTT, BasicStroke.JOIN_MITER));
    drawRingArc(g, centerX, centerY, ringRadius, 148, 152, ringStroke, ringColor);
    drawRingArc(g, centerX, centerY, ringRadius, 328, 152, ringStroke, ringColor);
    g.setStroke(new BasicStroke(1));
}

/** 绘制环形箭头的一段圆弧，并在圆弧末端画箭头。 */
function drawRingArc(g, centerX, centerY, radius, startDeg, extentDeg, strokeWidth, color) {
    g.setColor(color);
    g.draw(new Arc2D.Double(centerX - radius, centerY - radius, radius * 2, radius * 2, startDeg, extentDeg, Arc2D.OPEN));

    let endRad = (startDeg + extentDeg) * Math.PI / 180;
    let x = centerX + radius * Math.cos(endRad);
    let y = centerY - radius * Math.sin(endRad);
    let tangentX = -Math.sin(endRad);
    let tangentY = -Math.cos(endRad);
    let size = Math.max(sr(2.5), strokeWidth * 1.2);

    g.setColor(color);
    g.fillPolygon(
        [Math.round(x + tangentX * size), Math.round(x - tangentY * size * 0.9), Math.round(x + tangentY * size * 0.9)],
        [Math.round(y + tangentY * size), Math.round(y + tangentX * size * 0.9), Math.round(y - tangentX * size * 0.9)], 3);
}

/* ============================== 全线线路图 ============================== */

/**
 * 全线线路图整块是一个模块。镜像时整排车站左右对调（站序镜像），
 * 每个站的竖排站名、拼音与换乘徽标文字仍然正向书写，方向箭头跟着站序一起翻。
 */
function drawFullRouteMapScreen(g, layout, ctx) {
    withModule(g, layout, "routeMap", ctx, drawRouteMapModule);
}

/** 全线线路图模块：白色卡片、浅色带、车站圆点、竖排站名、换乘徽标与方向箭头。 */
function drawRouteMapModule(g, ctx, box, inner) {
    const routeInfo = ctx.routeInfo;
    const routeColor = ctx.routeColor;
    const stations = routeInfo.stationInfoList;
    const count = stations.length;
    if (count <= 0) {
        return;
    }

    // 白色卡片
    const cardLeft = MARGIN;
    const cardRight = WIDTH - MARGIN;
    const cardTop = HEADER_HEIGHT;
    const cardBottom = HEIGHT - CARD_BOTTOM_MARGIN;
    g.setColor(COLOR_CARD);
    g.fillRoundRect(cardLeft, cardTop, cardRight - cardLeft, cardBottom - cardTop, CARD_RADIUS, CARD_RADIUS);

    // 标记站是列车正在前往（或正停靠）的下一站；已过站与未到站按行驶方向分在它两侧
    const direction = getScreenDirection(routeInfo);
    const markerIndex = Math.max(0, Math.min(routeInfo.nextStationIndex, count - 1));

    // 车站沿整张卡片均分排开（站少时会显得疏朗，这是允许的）
    const columnWidth = (cardRight - cardLeft - MAP_MARGIN * 2) / count;
    const mapLeft = cardLeft + MAP_MARGIN;
    const radius = Math.max(6, Math.min(CIRCLE_MAX_RADIUS, columnWidth * 0.20));

    // 圆点所在的浅色带（路线色的浅色版）；两端再兜底收进白色卡片内
    const bandTop = CIRCLE_ROW_Y - BAND_HEIGHT / 2;
    const bandLeft = Math.max(cardLeft + sr(6), mapLeft + columnWidth * 0.5 - columnWidth * 0.58);
    const bandRight = Math.min(cardRight - sr(6), mapLeft + columnWidth * (count - 0.5) + columnWidth * 0.58);
    const bandColor = blend(routeColor, Color.WHITE, 0.80);
    g.setColor(bandColor);
    g.fillRect(Math.round(bandLeft), Math.round(bandTop), Math.round(bandRight - bandLeft), BAND_HEIGHT);

    // 每站换乘徽标的排布先规划好（换乘多的站会横着排成几行），
    // 站名留多高、徽标怎么画都用这份结果，两边不会各算各的。
    const badgeBottom = cardBottom - SY * 14;
    const nameTop = Math.round(bandTop + BAND_HEIGHT + SY * 10);
    let badgePlans = [];
    let maxPlanHeight = 0;
    for (let i = 0; i < count; i++) {
        let plan = planStationBadges(g, stations, i, columnWidth);
        badgePlans.push(plan);
        maxPlanHeight = Math.max(maxPlanHeight, plan.height);
    }
    // 站名可用高度按最多两颗徽标预留，个别换乘特别多的站不会把整排站名一起压小
    const nameAvailable = Math.max(SY * 24,
        badgeBottom - Math.min(maxPlanHeight, NAME_RESERVED_BADGES * BADGE_HEIGHT) - SY * 24 - nameTop);
    // 模块内部镜像时，整排车站左右对调（站序镜像），每个站的站名/拼音/徽标仍正向书写
    const ix = function (x, elementWidth) { return moduleInnerX(box, inner, x, elementWidth); };

    for (let i = 0; i < count; i++) {
        let centerX = ix(mapLeft + columnWidth * (i + 0.5), 0);
        // 未到达的车站要落在前进方向那一侧：
        // 朝序号增大方向行驶时，标记站右侧为未到达；朝序号减小方向行驶时相反。
        let passed = (direction > 0) ? (i < markerIndex) : (i > markerIndex);
        let current = (i == markerIndex);

        let interchangeInfo = stations[i].interchangeInfo;
        let interchange = (interchangeInfo != null && interchangeInfo.length > 0);
        let dotColor = passed ? COLOR_MAP_DOT_PASSED : (current ? routeColor : COLOR_TEAL);

        if (interchange) { // 换乘站：白环 + 环形双向箭头
            drawInterchangeRing(g, centerX, CIRCLE_ROW_Y, radius, dotColor,
                passed ? COLOR_RING_ARROW_PASSED : COLOR_RING_ARROW);
        } else {
            g.setColor(Color.WHITE);
            g.fillOval(Math.round(centerX - radius - sr(3)), Math.round(CIRCLE_ROW_Y - radius - sr(3)), radius * 2 + sr(6), radius * 2 + sr(6));
            g.setColor(dotColor);
            g.fillOval(Math.round(centerX - radius), Math.round(CIRCLE_ROW_Y - radius), radius * 2, radius * 2);
            if (current) {
                g.setColor(rgba(96, 108, 120, 190));
                g.setStroke(new BasicStroke(sr(2)));
                g.drawOval(Math.round(centerX - radius - sr(3)), Math.round(CIRCLE_ROW_Y - radius - sr(3)), radius * 2 + sr(6), radius * 2 + sr(6));
                g.setStroke(new BasicStroke(1));
            }
        }

        // 站名
        // 这一站自己的站名高度：换乘线路多的站单独收窄，别的站不受影响
        let ownNameAvailable = Math.max(SY * 16, badgeBottom - badgePlans[i].height - SY * 24 - nameTop);
        drawRouteMapStationName(g, stations[i], centerX, nameTop,
            Math.min(nameAvailable, ownNameAvailable), columnWidth, passed, inner);

        // 换乘信息
        drawRouteMapInterchange(g, stations[i], badgePlans[i], centerX, badgeBottom);
    }

    // 方向箭头：画在下一站的后方（列车驶来的那一侧），指向列车的行驶方向；随站序一起镜像
    let arrowLength = Math.max(sr(14), Math.min(sr(26), columnWidth * 0.40));
    let arrowDirection = inner ? -direction : direction;
    let arrowCenterX = ix(mapLeft + columnWidth * (markerIndex + 0.5) - direction * columnWidth * 0.5, 0);
    let arrowTipX = arrowCenterX + arrowDirection * arrowLength / 2;
    // 不让箭头越出线路图（例如列车还没有驶离首站时）
    let arrowTailX = arrowTipX - arrowDirection * arrowLength;
    let lo = Math.min(arrowTailX, arrowTipX);
    let hi = Math.max(arrowTailX, arrowTipX);
    if (lo < bandLeft + sr(6)) {
        arrowTipX += bandLeft + sr(6) - lo;
    } else if (hi > bandRight - sr(6)) {
        arrowTipX -= hi - (bandRight - sr(6));
    }
    drawDirectionArrow(g, arrowTipX, CIRCLE_ROW_Y, arrowDirection, arrowLength,
        Math.max(sr(12), Math.round(arrowLength * 0.78)), Math.max(sr(6), Math.round(arrowLength * 0.38)), bandColor);
}

/**
 * 绘制线路图中的竖排站名（中文竖排，拼音旋转 90° 置于一侧）。
 * inner 为真时整个站名块左右对调（拼音换到另一侧），文字本身仍然正向书写。
 */
function drawRouteMapStationName(g, station, centerX, top, availableHeight, columnWidth, passed, inner) {
    let stationName = toJsString(station.stationName);
    let cjkName = toJsString(TextUtil.getCjkParts(stationName));
    let enName = toJsString(TextUtil.getNonCjkParts(stationName));
    if (cjkName.length == 0) {
        cjkName = enName;
        enName = "";
    }
    if (cjkName.length == 0) {
        return;
    }
    if (enName == cjkName) {
        enName = "";
    }

    let cjkSize = 0;
    let cjkFont = null;
    let cjkLineHeight = 0;
    if (cjkName.length > 0) {
        let charHeight = availableHeight / cjkName.length;
        cjkSize = Math.max(sz(8), Math.min(MAX_NAME_SIZE, columnWidth * 0.48, charHeight * 0.94));
        cjkFont = SHS_BOLD.deriveFont(cjkSize * 1.0);
        cjkLineHeight = Math.min(cjkSize * 1.06, charHeight);
    }

    let enSize = 0;
    let enFont = null;
    if (enName.length > 0) {
        enSize = Math.max(sz(7), Math.min(MAX_PINYIN_SIZE, cjkSize * 0.60));
        enFont = ROBOTO_REGULAR.deriveFont(enSize * 1.0);
        while (enSize > sz(7) && g.getFontMetrics(enFont).stringWidth(enName) > availableHeight - sr(4)) {
            enSize -= 1;
            enFont = ROBOTO_REGULAR.deriveFont(enSize * 1.0);
        }
    }

    let cjkWidth = (cjkFont == null) ? 0 : cjkSize;
    let enWidth = (enFont == null) ? 0 : g.getFontMetrics(enFont).getAscent();
    let totalWidth = cjkWidth + ((enWidth > 0) ? sr(5) + enWidth : 0);
    let startX = centerX - totalWidth / 2;
    // 站名块内部的横向定位：镜像时左右对调（中文与拼音互换位置），文字仍然正向
    let blockLeft = startX;
    let blockRight = startX + totalWidth;
    let blockX = function (x, elementWidth) {
        return inner ? (blockLeft + blockRight - x - elementWidth) : x;
    };
    let cjkX = blockX(startX, cjkWidth);
    let enX = blockX(startX + cjkWidth + sr(5), enWidth);

    if (cjkFont != null) {
        g.setFont(cjkFont);
        g.setColor(passed ? COLOR_MAP_TEXT_PASSED : COLOR_TEXT);
        let y = top + g.getFontMetrics(cjkFont).getAscent();
        for (let k = 0; k < cjkName.length; k++) {
            drawStringCentered(g, cjkName.substring(k, k + 1), cjkX + cjkWidth / 2, Math.round(y));
            y += cjkLineHeight;
        }
    }

    if (enFont != null) {
        g.setFont(enFont);
        g.setColor(passed ? COLOR_MAP_PINYIN_PASSED : COLOR_TEXT_GRAY);
        // 拼音竖排：转 90° 画完再转回来（不用 getTransform，见 withModule 的说明）
        let rotate = new AffineTransform();
        rotate.setToRotation(Math.PI / 2, enX, top);
        g.transform(rotate);
        drawText(g, enName, Math.round(enX), Math.round(top));
        rotate.setToRotation(-Math.PI / 2, enX, top);
        g.transform(rotate);
    }
}

/**
 * 取某车站实际会画出来的换乘徽标，顺便把名字拆成「数字 + 号线 + 英文」。
 * 站名的高度预留和徽标绘制都用这一份结果，保证两边算出来的数量一致。
 */
function collectInterchangeBadges(interchangeInfo) {
    let badges = [];
    if (interchangeInfo == null) {
        return badges;
    }
    for (let k = 0; k < interchangeInfo.length; k++) {
        let interchangeRoute = interchangeInfo[k];
        if (interchangeRoute == null) {
            continue;
        }
        let label = toJsString(interchangeRoute.name);
        let cjkName = toJsString(TextUtil.getCjkParts(label));
        let enName = toJsString(TextUtil.getNonCjkParts(label));
        if (cjkName.length == 0) {
            cjkName = enName;
            enName = "";
        }
        if (cjkName.length == 0) {
            continue;
        }
        if (enName == cjkName) {
            enName = "";
        }
        // 「10号线」拆成数字「10」+「号线」，英文同样去掉数字（参考重庆轨道交通 LCD 的换乘徽标）
        let number = "";
        let cjkText = cjkName;
        let match = /^([0-9]+)(.*)$/.exec(cjkName);
        if (match != null && match[2].length > 0) {
            number = match[1];
            cjkText = match[2];
        }
        let enText = enName.replace(/[0-9]+/g, "").replace(/[ \t]+/g, " ").trim();
        badges.push({route: interchangeRoute, number: number, cjkText: cjkText, enText: enText});
    }
    return badges;
}

/**
 * 规划一个车站的换乘徽标怎么摆。
 *
 * 3 条以内竖着摞；3 条以上改成横着排，能排多宽取决于左右两侧最近的、
 * 同样有换乘徽标的车站（不能压到人家头上），放不下就换一行。
 * 返回的 rows 是每一行要画的徽标，height 是整组占的高度。
 */
function planStationBadges(g, stations, index, columnWidth) {
    let badges = collectInterchangeBadges(stations[index].interchangeInfo);
    let plan = {badges: badges, rows: [], height: 0, maxWidth: SX * 92};
    if (badges.length == 0) {
        return plan;
    }
    if (!HORIZONTAL_HUB_BADGES || badges.length < HORIZONTAL_BADGE_MIN) {
        plan.maxWidth = Math.min(columnWidth + SX * 18, SX * 92); // 竖排：宽度受本站列宽限制
        for (let i = 0; i < badges.length; i++) {
            plan.rows.push([badges[i]]); // 竖排：一行一颗
        }
        plan.height = badges.length * BADGE_HEIGHT;
        return plan;
    }

    // 左右各能伸出多宽：碰到相邻的换乘站就停，否则最远到这一侧的车站边缘
    let limitLeft = (index + 0.5) * columnWidth;
    let limitRight = (stations.length - index - 0.5) * columnWidth;
    for (let j = 0; j < stations.length; j++) {
        if (j == index) {
            continue;
        }
        if (collectInterchangeBadges(stations[j].interchangeInfo).length == 0) {
            continue;
        }
        let distance = (j - index) * columnWidth;
        if (distance < 0) {
            limitLeft = Math.min(limitLeft, -distance - columnWidth * 0.5);
        } else {
            limitRight = Math.min(limitRight, distance - columnWidth * 0.5);
        }
    }
    let allowedWidth = Math.max(columnWidth, limitLeft + limitRight);

    // 逐行填：同一行的徽标左右排开
    let row = [];
    let rowWidth = 0;
    for (let k = 0; k < badges.length; k++) {
        let badge = badges[k];
        let width = layoutRouteMapBadge(g, SX * 92, badge.number, badge.cjkText, badge.enText).width;
        let needed = (row.length > 0) ? (rowWidth + BADGE_GAP + width) : width;
        if (row.length > 0 && needed > allowedWidth) {
            plan.rows.push(row);
            row = [];
            needed = width;
        }
        row.push(badge);
        rowWidth = needed;
    }
    if (row.length > 0) {
        plan.rows.push(row);
    }
    plan.height = plan.rows.length * BADGE_HEIGHT;
    return plan;
}

/**
 * 绘制线路图中某车站下方的换乘徽标（按 planStationBadges 的排布），
 * 并在整组上方画三个连接点。
 */
function drawRouteMapInterchange(g, station, plan, centerX, badgeBottom) {
    let badges = plan.badges;
    if (badges.length == 0) {
        return;
    }
    // 连接点的颜色跟着最上面那颗徽标走：灰底款用浅灰，线路色款用线路色
    let topDotColor = (GRAY_CONNECTING_BADGE && badges[0].route.isConnectingStation)
        ? COLOR_DOT_GRAY : badges[0].route.color;

    let bottom = badgeBottom;
    for (let r = plan.rows.length - 1; r >= 0; r--) {
        drawBadgeRow(g, plan.rows[r], centerX, bottom, plan.maxWidth);
        bottom -= BADGE_HEIGHT;
    }

    // 徽标上方的三个连接点
    let dotSize = Math.max(2, Math.round(sr(5)));
    g.setColor(topDotColor);
    for (let i = 0; i < 3; i++) {
        let dotY = bottom - sr(6) - i * sr(8);
        g.fillOval(Math.round(centerX) - dotSize / 2, Math.round(dotY) - dotSize / 2, dotSize, dotSize);
    }
}

/** 画一行换乘徽标：这一行整体以车站为中心排开，靠边时收进白色卡片内。 */
function drawBadgeRow(g, badges, centerX, bottom, maxWidth) {
    let layouts = [];
    let totalWidth = 0;
    for (let i = 0; i < badges.length; i++) {
        let badge = badges[i];
        let layout = layoutRouteMapBadge(g, maxWidth, badge.number, badge.cjkText, badge.enText);
        layouts.push(layout);
        totalWidth += layout.width + ((i > 0) ? BADGE_GAP : 0);
    }

    let x = centerX - totalWidth / 2;
    let cardLeft = MARGIN + sr(6);
    let cardRight = WIDTH - MARGIN - sr(6);
    if (x < cardLeft) {
        x = cardLeft;
    }
    if (x + totalWidth > cardRight) {
        x = cardRight - totalWidth;
    }

    let y = Math.round(bottom - BADGE_HEIGHT);
    for (let i = 0; i < badges.length; i++) {
        let badge = badges[i];
        paintRouteMapBadge(g, badge.route, layouts[i], badge.number, badge.cjkText, badge.enText,
            x + layouts[i].width / 2, Math.round(x), y);
        x += layouts[i].width + BADGE_GAP;
    }
}

/** 算出一颗换乘徽标要多宽，并把它用到的字体准备好（横向排列要先知道宽度才能居中排开）。 */
function layoutRouteMapBadge(g, maxWidth, number, cjkText, enText) {
    let leftFont = null;
    let leftWidth = 0;
    let smallCjkFont = null;
    let smallEnFont = null;
    let smallWidth = 0;

    if (number.length > 0) {
        let leftSize = fitFontSize(g, ROBOTO_BOLD, number, maxWidth * 0.45, 0, sz(15), sz(7));
        leftFont = ROBOTO_BOLD.deriveFont(leftSize * 1.0);
        leftWidth = g.getFontMetrics(leftFont).stringWidth(number);
        let smallMax = Math.max(SX * 8, maxWidth - leftWidth - SX * 14);
        let cjkSize = fitFontSize(g, SHS_BOLD, cjkText, smallMax, 0, sz(8), sz(5));
        smallCjkFont = SHS_BOLD.deriveFont(cjkSize * 1.0);
        smallWidth = g.getFontMetrics(smallCjkFont).stringWidth(cjkText);
        if (enText.length > 0) {
            let enSize = fitFontSize(g, ROBOTO_BOLD, enText, smallMax, 0, sz(7), sz(4));
            smallEnFont = ROBOTO_BOLD.deriveFont(enSize * 1.0);
            smallWidth = Math.max(smallWidth, g.getFontMetrics(smallEnFont).stringWidth(enText));
        }
    } else {
        let size = fitFontSize(g, SHS_BOLD, cjkText, maxWidth - SX * 12, 0, sz(13), sz(7));
        leftFont = SHS_BOLD.deriveFont(size * 1.0);
        leftWidth = g.getFontMetrics(leftFont).stringWidth(cjkText);
    }

    let textWidth = (number.length > 0) ? (leftWidth + SX * 4 + smallWidth) : leftWidth;
    return {
        width: Math.min(maxWidth, textWidth + SX * 12),
        leftFont: leftFont,
        leftWidth: leftWidth,
        smallCjkFont: smallCjkFont,
        smallEnFont: smallEnFont
    };
}

/** 在指定位置画一颗换乘徽标：数字在左，线路名与英文在右。 */
function paintRouteMapBadge(g, interchangeRoute, layout, number, cjkText, enText, centerX, x, y) {
    let color = interchangeRoute.color;
    let width = Math.round(layout.width);
    let textColor = Color.WHITE;

    if (GRAY_CONNECTING_BADGE && interchangeRoute.isConnectingStation) {
        // 出站换乘：灰底实心 + 白字，和站内换乘的线路色块区分开
        g.setColor(COLOR_BADGE_GRAY);
        g.fillRoundRect(x, y, width, Math.round(BADGE_HEIGHT), BADGE_RADIUS, BADGE_RADIUS);
        textColor = Color.WHITE;
    } else if (interchangeRoute.isConnectingStation) { // 需出站换乘的连接车站：浅色底 + 线路色描边与文字
        g.setColor(blend(color, Color.WHITE, 0.88));
        g.fillRoundRect(x, y, width, Math.round(BADGE_HEIGHT), BADGE_RADIUS, BADGE_RADIUS);
        g.setColor(color);
        g.setStroke(new BasicStroke(sr(2)));
        g.drawRoundRect(x, y, width, Math.round(BADGE_HEIGHT), BADGE_RADIUS, BADGE_RADIUS);
        g.setStroke(new BasicStroke(1));
        textColor = shade(color, 0.1);
    } else { // 站内换乘：线路色实心块
        g.setColor(color);
        g.fillRoundRect(x, y, width, Math.round(BADGE_HEIGHT), BADGE_RADIUS, BADGE_RADIUS);
        textColor = isLightColor(color) ? Color.BLACK : Color.WHITE; // 浅色线路用黑字
    }

    // 徽标内部（数字在左、「号线／Line」在右）始终常规排列
    g.setColor(textColor);

    if (number.length == 0) {
        let metrics = g.getFontMetrics(layout.leftFont);
        g.setFont(layout.leftFont);
        drawStringCentered(g, cjkText, centerX,
            Math.round(y + (BADGE_HEIGHT + metrics.getAscent() - metrics.getDescent()) / 2));
        return;
    }

    // 数字
    let leftMetrics = g.getFontMetrics(layout.leftFont);
    g.setFont(layout.leftFont);
    drawText(g, number, Math.round(x + SX * 6),
        Math.round(y + (BADGE_HEIGHT + leftMetrics.getAscent() - leftMetrics.getDescent()) / 2));

    // 右侧两行小字：「号线」与「Line」
    let textX = Math.round(x + SX * 6 + layout.leftWidth + SX * 4);
    let cjkMetrics = g.getFontMetrics(layout.smallCjkFont);
    g.setFont(layout.smallCjkFont);
    let lineHeight = (BADGE_HEIGHT - SY * 4) / 2;
    drawText(g, cjkText, textX,
        Math.round(y + SY * 2 + cjkMetrics.getAscent() + (lineHeight - cjkMetrics.getHeight()) / 2));
    if (layout.smallEnFont != null) {
        let enMetrics = g.getFontMetrics(layout.smallEnFont);
        g.setFont(layout.smallEnFont);
        drawText(g, enText, textX,
            Math.round(y + SY * 2 + lineHeight + enMetrics.getAscent() + (lineHeight - enMetrics.getHeight()) / 2));
    }
}
/* ============================== 「下一站」页 ============================== */

function drawNextStationScreen(g, layout, ctx) {
    withModule(g, layout, "stationStrip", ctx, drawStationStripModule);
    withModule(g, layout, "infoPanel", ctx, drawNextStationPanelModule);
}

/* ============================== 「已到达」页 ============================== */

function drawArrivedScreen(g, layout, ctx) {
    withModule(g, layout, "stationStrip", ctx, drawStationStripModule);
    withModule(g, layout, "infoPanel", ctx, drawArrivedPanelModule);
}

/**
 * 在已经画好的页面上补画本车厢的车厢编号（每节车厢的动态贴图各自调用一次）。
 * 编号画在信息面板里，所以共用信息面板的模块区间与镜像策略，始终贴在面板内。
 * @param {Graphics2D} g 绘图对象。
 * @param {String} screenType 页面类型，见 SCREEN_* 常量。
 * @param {Number} coachNumber 车厢编号（1 起）。
 * @param {Object} layout 本屏布局，省略时不镜像。
 */
function drawCoachNumberPlate(g, screenType, coachNumber, layout) {
    if (layout === undefined) {
        layout = LAYOUT_NORMAL;
    }
    if (!SHOW_COACH_NUMBER || coachNumber == null || coachNumber <= 0) {
        return;
    }
    withModule(g, layout, "infoPanel", {"screenType": screenType, "coachNumber": coachNumber},
        drawCoachNumberPlateModule);
}

/** 车厢编号模块。 */
function drawCoachNumberPlateModule(g, ctx, box, inner) {
    const right = box[0] + box[1] - SX * 24;
    const anchorX = moduleInnerX(box, inner, right, 0);
    if (ctx.screenType == SCREEN_ARRIVED) {
        drawCoachNumber(g, ctx.coachNumber, anchorX, PANEL_TOP + PANEL_HEIGHT / 2, false, inner);
    } else if (ctx.screenType == SCREEN_NEXT_STATION) {
        drawCoachNumber(g, ctx.coachNumber, anchorX, PANEL_TOP + PANEL_HEIGHT - SY * 16, true, inner);
    }
}

/* ============================== 左侧站名条 ============================== */

/** 站名条浅色带左端斜切的深度。 */
function stripDepth() {
    return Math.round(STRIP_BAND_HEIGHT * 0.78);
}

/** 站名条模块区间的左端（含带子左侧的独立箭头）。 */
function stripBoxLeft() {
    return STRIP_BAND_LEFT - stripDepth() - SX * 8;
}

/** 站名条模块区间的宽度。 */
function stripBoxWidth() {
    return PANEL_LEFT + SX * 4 - stripBoxLeft();
}

function drawStationStripModule(g, ctx, box, inner) {
    const routeInfo = ctx.routeInfo;
    const routeColor = ctx.routeColor;
    const stations = routeInfo.stationInfoList;
    const nextIndex = routeInfo.nextStationIndex;
    const bandY = STRIP_BAND_TOP;
    const bandHeight = STRIP_BAND_HEIGHT;
    const bandCenterY = Math.round(bandY + bandHeight / 2);
    const direction = getDrawDirection(routeInfo);          // 列车实际朝哪边走
    const screenDirection = getScreenDirection(routeInfo);  // 带子和箭头朝哪边
    const depth = stripDepth();
    const ribbonWidth = PANEL_LEFT + SX * 4 - STRIP_BAND_LEFT;
    const ix = function (x, elementWidth) { return moduleInnerX(box, inner, x, elementWidth); };

    // 刚驶离的车站（空心圆圈）与更早的车站（实心圆点），按实际行驶方向取
    let ringIndex = (direction > 0) ? (nextIndex - 1) : (nextIndex + 1);
    let dotIndex = (direction > 0) ? (nextIndex - 2) : (nextIndex + 2);

    // 两个槽位：靠近信息面板的一侧放「刚驶离」的空心圈，另一侧放更早的实心点
    let dotRawX = (screenDirection > 0) ? STRIP_DOT_X : STRIP_RING_X;
    let ringRawX = (screenDirection > 0) ? STRIP_RING_X : STRIP_DOT_X;
    let dotX = ix(dotRawX, 0);
    let ringX = ix(ringRawX, 0);

    // 浅色带（一端按行驶方向切成箭头形；镜像时整条带子连同切口一起翻到另一头）
    let ribbonX = ix(STRIP_BAND_LEFT, ribbonWidth);
    drawMirroredShape(g, ribbonX + ribbonWidth / 2, inner, function () {
        drawStripRibbon(g, ribbonX, bandY, ribbonWidth, bandHeight, depth, screenDirection);
    });

    // 带子外侧的独立箭头
    let chevronWidth = depth;
    let chevronX = ix(STRIP_BAND_LEFT - depth - SX * 8, chevronWidth);
    drawMirroredShape(g, chevronX + chevronWidth / 2, inner, function () {
        drawStripChevron(g, chevronX, bandY, chevronWidth, bandHeight, screenDirection);
    });

    // 行车方向箭头（位于两个圆点之间，指向行驶方向；随整条带子一起镜像）
    if (SHOW_STRIP_ARROW) {
        let arrowLength = SX * 42;
        let arrowCenterX = ix((dotRawX + ringRawX) / 2, 0);
        let arrowDirection = inner ? -screenDirection : screenDirection;
        let tipX = Math.round(arrowCenterX + arrowDirection * arrowLength / 2);
        drawDirectionArrow(g, tipX, bandCenterY, arrowDirection, arrowLength, sz(34), sz(18),
            blend(routeColor, Color.WHITE, 0.59));
    }

    if (dotIndex >= 0 && dotIndex < stations.length) {
        g.setColor(rgba(255, 255, 255, 170));
        g.fillOval(Math.round(dotX - sr(11)), Math.round(bandCenterY - sr(11)), sr(22), sr(22));
    }
    if (ringIndex >= 0 && ringIndex < stations.length) {
        g.setColor(rgba(255, 255, 255, 90));
        g.fillOval(Math.round(ringX - sr(15)), Math.round(bandCenterY - sr(15)), sr(30), sr(30));
        g.setStroke(new BasicStroke(Math.max(1.5, sr(3))));
        g.setColor(rgba(30, 40, 50, 200));
        g.drawOval(Math.round(ringX - sr(15)), Math.round(bandCenterY - sr(15)), sr(30), sr(30));
        g.setStroke(new BasicStroke(1));
    }

    // 站名
    let nameTop = bandY + bandHeight + SY * 8;
    drawStripStationName(g, stations, dotIndex, dotX, nameTop, SX * 130);
    drawStripStationName(g, stations, ringIndex, ringX, nameTop, SX * 130);
}

/**
 * 绘制站名条的浅色带，左端按行驶方向切成箭头形。
 */
function drawStripRibbon(g, x, y, width, height, depth, direction) {
    let centerY = y + height / 2;
    let path = new GeneralPath();
    if (direction < 0) { // 左端为箭尖
        path.moveTo(x, centerY);
        path.lineTo(x + depth, y);
        path.lineTo(x + width, y);
        path.lineTo(x + width, y + height);
        path.lineTo(x + depth, y + height);
    } else {             // 左端为凹口
        path.moveTo(x, y);
        path.lineTo(x + depth, centerY);
        path.lineTo(x, y + height);
        path.lineTo(x + width, y + height);
        path.lineTo(x + width, y);
    }
    path.closePath();

    g.setColor(COLOR_STRIP_BAND);
    g.fill(path);
    g.setColor(COLOR_STRIP_BAND_EDGE);
    g.setStroke(new BasicStroke(2));
    g.draw(path);
    g.setStroke(new BasicStroke(1));
}

/**
 * 绘制站名条左侧的独立箭头。
 */
function drawStripChevron(g, x, y, width, height, direction) {
    let centerY = y + height / 2;
    let edge = height * 0.26;
    let inner = width * 0.55;
    let path = new GeneralPath();
    if (direction < 0) { // 指向左
        path.moveTo(x + width, y);
        path.lineTo(x, centerY);
        path.lineTo(x + width, y + height);
        path.lineTo(x + width, y + height - edge);
        path.lineTo(x + inner, centerY);
        path.lineTo(x + width, y + edge);
    } else {             // 指向右
        path.moveTo(x, y);
        path.lineTo(x + width, centerY);
        path.lineTo(x, y + height);
        path.lineTo(x, y + height - edge);
        path.lineTo(x + width - inner, centerY);
        path.lineTo(x, y + edge);
    }
    path.closePath();

    g.setColor(COLOR_STRIP_BAND);
    g.fill(path);
    g.setColor(COLOR_STRIP_BAND_EDGE);
    g.setStroke(new BasicStroke(2));
    g.draw(path);
    g.setStroke(new BasicStroke(1));
}

function drawStripStationName(g, stations, index, centerX, top, maxWidth) {
    if (index < 0 || index >= stations.length) {
        return;
    }
    let stationName = toJsString(stations[index].stationName);
    let cjkName = toJsString(TextUtil.getCjkParts(stationName));
    let enName = toJsString(TextUtil.getNonCjkParts(stationName));
    let cjkFont = SHS_BOLD.deriveFont(sz(27));
    let y = top;

    g.setColor(Color.WHITE);
    if (cjkName.length > 0) {
        let size = fitFontSize(g, SHS_BOLD, cjkName, maxWidth, sz(34), sz(27), sz(13));
        cjkFont = SHS_BOLD.deriveFont(size * 1.0);
        g.setFont(cjkFont);
        y += g.getFontMetrics(cjkFont).getAscent();
        drawStringCentered(g, cjkName, centerX, Math.round(y));
    }
    if (enName.length > 0 && enName != cjkName) {
        let size = fitFontSize(g, ROBOTO_REGULAR, enName, maxWidth, sz(26), sz(18), sz(10));
        let enFont = ROBOTO_REGULAR.deriveFont(size * 1.0);
        g.setFont(enFont);
        g.setColor(rgba(255, 255, 255, 220));
        y += (cjkName.length == 0 ? 0 : g.getFontMetrics(cjkFont).getDescent()) + g.getFontMetrics(enFont).getAscent() + SY * 4;
        drawStringCentered(g, enName, centerX, Math.round(y));
    }
}

/* ============================== 信息面板：下一站 ============================== */

/** 信息面板模块的宽度。 */
function infoPanelWidth() {
    return DOOR_PANEL_LEFT - PANEL_GAP - PANEL_LEFT;
}

/** 蓝色小标签块的宽度（内部镜像时用来保持标签块在面板内的边距）。 */
function labelBlockWidth(g, cjkText, enText, cjkSize, enSize) {
    let cjkWidth = g.getFontMetrics(SHS_BOLD.deriveFont(cjkSize)).stringWidth(cjkText);
    let enWidth = g.getFontMetrics(ROBOTO_REGULAR.deriveFont(enSize)).stringWidth(enText);
    return Math.max(cjkWidth, enWidth);
}

function drawNextStationPanelModule(g, ctx, box, inner) {
    const routeInfo = ctx.routeInfo;
    const x0 = box[0];
    const width = box[1];
    const centerY = PANEL_TOP + PANEL_HEIGHT / 2;
    const ix = function (x, elementWidth) { return moduleInnerX(box, inner, x, elementWidth); };

    drawPanelBackground(g, x0, width);

    // 「下一站」
    let labelCjkSize = sz(34);
    let labelEnSize = sz(20);
    drawLabelBlock(g, ix(x0 + SX * 30, labelBlockWidth(g, "下一站", "The Next", labelCjkSize, labelEnSize)),
        centerY, "下一站", "The Next", labelCjkSize, labelEnSize);

    // 分隔线
    let dividerWidth = Math.max(1, Math.round(SX * 2));
    let rawDividerX = Math.round(x0 + width * 0.50);
    let dividerX = ix(rawDividerX, dividerWidth);
    g.setColor(COLOR_DIVIDER);
    g.fillRect(dividerX, Math.round(PANEL_TOP + SY * 18), dividerWidth, Math.round(PANEL_HEIGHT - SY * 36));

    // 下一站站名
    let nextStation = getStationInfo(routeInfo, routeInfo.nextStationIndex);
    let nextName = (nextStation == null) ? routeInfo.destination : nextStation.stationName;
    let nextRange = moduleInnerRange(box, inner, x0 + SX * 150, rawDividerX - SX * 14);
    drawBigStationName(g, nextName, nextRange[0], nextRange[1], centerY);

    // 「开往」
    let destinationX = rawDividerX + SX * 22;
    let destinationCjkSize = sz(26);
    let destinationEnSize = sz(17);
    drawLabelBlock(g, ix(destinationX, labelBlockWidth(g, "开往", "Bound for", destinationCjkSize, destinationEnSize)),
        centerY, "开往", "Bound for", destinationCjkSize, destinationEnSize);

    // 终点站
    let destinationRange = moduleInnerRange(box, inner, destinationX + SX * 92, x0 + width - SX * 24);
    drawBigStationName(g, routeInfo.destination, destinationRange[0], destinationRange[1], centerY);
}

/* ============================== 信息面板：已到达 ============================== */

function drawArrivedPanelModule(g, ctx, box, inner) {
    const routeInfo = ctx.routeInfo;
    const x0 = box[0];
    const width = box[1];
    const centerY = PANEL_TOP + PANEL_HEIGHT / 2;
    const ix = function (x, elementWidth) { return moduleInnerX(box, inner, x, elementWidth); };

    drawPanelBackground(g, x0, width);

    // 「已到达」
    let labelCjkSize = sz(34);
    let labelEnSize = sz(20);
    drawLabelBlock(g, ix(x0 + SX * 30, labelBlockWidth(g, "已到达", "Arrived", labelCjkSize, labelEnSize)),
        centerY, "已到达", "Arrived", labelCjkSize, labelEnSize);

    // 当前站名
    let currentStation = getStationInfo(routeInfo, routeInfo.nextStationIndex);
    let currentName = (currentStation == null) ? routeInfo.destination : currentStation.stationName;
    let currentRange = moduleInnerRange(box, inner, x0 + SX * 170, x0 + width - SX * 210);
    drawBigStationName(g, currentName, currentRange[0], currentRange[1], centerY);
}

/* ============================== 面板公共部分 ============================== */

function drawPanelBackground(g, x0, width) {
    g.setColor(COLOR_PANEL);
    g.fillRoundRect(Math.round(x0), Math.round(PANEL_TOP), Math.round(width), Math.round(PANEL_HEIGHT), PANEL_RADIUS, PANEL_RADIUS);
    g.setColor(COLOR_PANEL_EDGE);
    g.setStroke(new BasicStroke(sr(2)));
    g.drawRoundRect(Math.round(x0 + sr(1)), Math.round(PANEL_TOP + sr(1)), Math.round(width - sr(2)), Math.round(PANEL_HEIGHT - sr(2)), PANEL_RADIUS, PANEL_RADIUS);
    g.setStroke(new BasicStroke(1));
}

/** 绘制「下一站／The Next」这类蓝色小标签。 */
function drawLabelBlock(g, x, centerY, cjkText, enText, cjkSize, enSize) {
    let cjkFont = SHS_BOLD.deriveFont(cjkSize);
    let enFont = ROBOTO_REGULAR.deriveFont(enSize);
    let cjkMetrics = g.getFontMetrics(cjkFont);
    let enMetrics = g.getFontMetrics(enFont);
    let blockHeight = cjkMetrics.getHeight() + enMetrics.getHeight() - sz(4);
    let y = centerY - blockHeight / 2;

    g.setColor(COLOR_LABEL);
    g.setFont(cjkFont);
    y += cjkMetrics.getAscent();
    drawText(g, cjkText, x, Math.round(y));
    y += cjkMetrics.getDescent() + enMetrics.getAscent() - sz(4);
    g.setFont(enFont);
    drawText(g, enText, x, Math.round(y));
}

/** 绘制大号站名（中文 + 拼音）。 */
function drawBigStationName(g, stationName, left, right, centerY) {
    let cjkName = toJsString(TextUtil.getCjkParts(toJsString(stationName)));
    let enName = toJsString(TextUtil.getNonCjkParts(toJsString(stationName)));
    if (cjkName.length == 0) {
        cjkName = enName;
        enName = "";
    }
    if (cjkName.length == 0) {
        return;
    }

    let maxWidth = Math.max(SX * 60, right - left);
    let centerX = (left + right) / 2;
    let cjkSize = fitFontSize(g, SHS_BOLD, cjkName, maxWidth, sz(76), sz(66), sz(20));
    let cjkFont = SHS_BOLD.deriveFont(cjkSize * 1.0);
    let cjkMetrics = g.getFontMetrics(cjkFont);

    let enFont = null;
    let enMetrics = null;
    if (enName.length > 0) {
        let enSize = fitFontSize(g, ROBOTO_BOLD, enName, maxWidth, sz(30), sz(24), sz(10));
        enFont = ROBOTO_BOLD.deriveFont(enSize * 1.0);
        enMetrics = g.getFontMetrics(enFont);
    }

    let blockHeight = cjkMetrics.getHeight() + ((enMetrics == null) ? 0 : enMetrics.getHeight() + sz(2));
    let y = centerY - blockHeight / 2;

    g.setColor(COLOR_TEXT);
    g.setFont(cjkFont);
    y += cjkMetrics.getAscent();
    drawStringCentered(g, cjkName, centerX, Math.round(y));

    if (enMetrics != null) {
        y += cjkMetrics.getDescent() + enMetrics.getAscent() + sz(2);
        g.setColor(COLOR_TEXT);
        g.setFont(enFont);
        drawStringCentered(g, enName, centerX, Math.round(y));
    }
}

/**
 * 绘制「N 车厢 NO. N Coach」。
 * @param {Number} anchorX 锚点 x。
 * @param {Boolean} singleLine 为 true 时排成一行。
 * @param {Boolean} alignLeft 为 true 时从锚点向右书写（模块内部镜像后靠另一侧对齐）。
 */
function drawCoachNumber(g, coachNumber, anchorX, baselineY, singleLine, alignLeft) {
    if (!SHOW_COACH_NUMBER || coachNumber == null || coachNumber <= 0) {
        return;
    }
    let cjkText = coachNumber + "车厢";
    let enText = "NO. " + coachNumber + " Coach";
    let cjkFont = SHS_BOLD.deriveFont(sz(24));
    let enFont = ROBOTO_BOLD.deriveFont(sz(19));
    let cjkWidth = g.getFontMetrics(cjkFont).stringWidth(cjkText);
    let enWidth = g.getFontMetrics(enFont).stringWidth(enText);
    // 右对齐时从锚点向左排，镜像后改为从锚点向右排
    let lineX = function (textWidth) {
        return alignLeft ? anchorX : (anchorX - textWidth);
    };

    if (singleLine) {
        let gap = SX * 10;
        let startX = lineX(cjkWidth + gap + enWidth);
        g.setColor(COLOR_TEXT);
        g.setFont(cjkFont);
        drawText(g, cjkText, Math.round(startX), baselineY);
        g.setColor(COLOR_TEXT_GRAY);
        g.setFont(enFont);
        drawText(g, enText, Math.round(startX + cjkWidth + gap), baselineY);
        return;
    }

    g.setColor(COLOR_TEXT);
    g.setFont(cjkFont);
    drawText(g, cjkText, Math.round(lineX(cjkWidth)), baselineY);
    g.setColor(COLOR_TEXT_GRAY);
    g.setFont(enFont);
    drawText(g, enText, Math.round(lineX(enWidth)), Math.round(baselineY + sz(24)));
}

/* ============================== 车门提示面板 ============================== */

// 车门提示面板的四种状态
const DOOR_MODE_OPEN = "open";                      // 到站，本侧车门已开启
const DOOR_MODE_OPENING = "opening";                // 行车中，本侧车门将开启（播放开门动画）
const DOOR_MODE_BLOCKED = "blocked";                // 行车中，本侧车门不开启
const DOOR_MODE_ARRIVED_CLOSED = "arrived_closed";  // 到站，本侧车门未开启

/**
 * 由列车的到站状态与车门状态得出车门提示面板要显示的状态。
 * @param {Boolean} arrived 是否已到站。
 * @param {Boolean} willOpen 行车途中本侧车门是否将开启。
 * @param {Boolean} openNow 本侧车门当前是否已开启。
 * @return {String} 见 DOOR_MODE_* 常量。
 */
function getDoorMode(arrived, willOpen, openNow) {
    if (arrived) {
        return openNow ? DOOR_MODE_OPEN : DOOR_MODE_ARRIVED_CLOSED;
    }
    return willOpen ? DOOR_MODE_OPENING : DOOR_MODE_BLOCKED;
}

/** 某状态下车门静止时两扇门的开度：0 关闭、1 全开。 */
function getStaticDoorFraction(mode) {
    return (mode == DOOR_MODE_OPEN) ? 1 : 0;
}

/**
 * 取某状态下车门实际要显示的开度。
 * 只有「本侧车门已开启」才播放开门动画；「将开启」时门是静止的。
 * @param {String} mode 见 DOOR_MODE_* 常量。
 * @param {Number} animFraction 动画当前开度。
 */
function getDoorFraction(mode, animFraction) {
    if (mode != DOOR_MODE_OPEN) {
        return 0;
    }
    return DOOR_ANIMATION ? animFraction : 1;
}

/** 取车门提示面板的文字。 */
function getDoorPanelText(mode) {
    if (mode == DOOR_MODE_OPEN) {
        return {cjk: "本侧车门已开启，\n请由此门下车", en: "Doors have been opened. Please get off from this side."};
    }
    if (mode == DOOR_MODE_OPENING) {
        return {cjk: "将开启本侧车门", en: "Doors on this side will be opened"};
    }
    if (mode == DOOR_MODE_ARRIVED_CLOSED) {
        return {cjk: "本侧车门不开启，\n请到对门下车", en: "Doors on the opposite side have been opened."};
    }
    return {cjk: "本侧车门不开启，\n请到对门等候下车", en: "Doors on the opposite side will be opened."};
}

/**
 * 绘制车门提示面板。
 * @param {Graphics2D} g 绘图对象。
 * @param {Color} routeColor 路线色（面板底色与文字色都由它派生）。
 * @param {String} mode 见 DOOR_MODE_* 常量。
 * @param {Number} openFraction 两扇门的开度，0 关闭、1 全开；开启中状态由动画逐帧传入。
 */
function drawDoorPanel(g, routeColor, mode, openFraction, layout) {
    if (layout === undefined) {
        layout = LAYOUT_NORMAL;
    }
    withModule(g, layout, "doorPanel",
        {"routeColor": routeColor, "mode": mode, "openFraction": openFraction}, drawDoorPanelModule);
}

/** 车门提示面板模块：路线色淡染的面板 + 两扇门 + 禁止符号 + 提示文字。 */
function drawDoorPanelModule(g, ctx, box, inner) {
    const routeColor = ctx.routeColor;
    const mode = ctx.mode;
    const openFraction = ctx.openFraction;
    const x0 = box[0];
    const width = box[1];
    const ix = function (x, elementWidth) { return moduleInnerX(box, inner, x, elementWidth); };
    const tint = blend(routeColor, Color.WHITE, 0.80);   // 面板底色：路线色淡染
    const textColor = shade(routeColor, 0.42);            // 文字：加深的路线色

    g.setColor(tint);
    g.fillRoundRect(Math.round(x0), Math.round(PANEL_TOP), Math.round(width), Math.round(PANEL_HEIGHT), PANEL_RADIUS, PANEL_RADIUS);
    g.setColor(rgba(255, 255, 255, 210));
    g.setStroke(new BasicStroke(sr(2)));
    g.drawRoundRect(Math.round(x0 + sr(1)), Math.round(PANEL_TOP + sr(1)), Math.round(width - sr(2)), Math.round(PANEL_HEIGHT - sr(2)), PANEL_RADIUS, PANEL_RADIUS);
    g.setStroke(new BasicStroke(1));

    // 两扇门：关闭时贴合，openFraction 控制向外滑开的距离
    const doorWidth = SX * 84;
    const doorHeight = SY * 140;
    const gapMax = SX * 18;
    const leaf1 = ix(x0 + SX * 26 - openFraction * gapMax / 2, doorWidth);
    const leaf2 = ix(x0 + SX * 26 + doorWidth + openFraction * gapMax / 2, doorWidth);
    const doorY = Math.round(PANEL_TOP + (PANEL_HEIGHT - doorHeight) / 2);

    let leafX = [leaf1, leaf2];
    for (let i = 0; i < 2; i++) {
        let x = Math.round(leafX[i]);
        g.setColor(rgba(0, 0, 0, 40));
        g.fillRoundRect(x + sr(2), doorY + sr(3), Math.round(doorWidth), Math.round(doorHeight), sr(6), sr(6));
        g.setColor(COLOR_DOOR_FRAME);
        g.fillRoundRect(x, doorY, Math.round(doorWidth), Math.round(doorHeight), sr(6), sr(6));
        g.setColor(rgba(120, 132, 142, 90));
        g.setStroke(new BasicStroke(sr(1)));
        g.drawRoundRect(x, doorY, Math.round(doorWidth), Math.round(doorHeight), sr(6), sr(6));
        g.setStroke(new BasicStroke(1));
        g.setColor(COLOR_DOOR_GLASS);
        g.fillRoundRect(Math.round(x + sr(9)), Math.round(doorY + SY * 11), Math.round(doorWidth - sr(18)), Math.round(doorHeight - SY * 22), sr(4), sr(4));
    }

    // 本侧不开启时叠加禁止符号
    if (mode == DOOR_MODE_BLOCKED || mode == DOOR_MODE_ARRIVED_CLOSED) {
        let centerX = ix(x0 + SX * 26 + doorWidth, 0);
        let centerY = doorY + doorHeight / 2;
        let radius = SY * 58;
        g.setColor(COLOR_DOOR_BAN);
        g.setStroke(new BasicStroke(Math.max(2, sr(11)), BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
        g.drawOval(Math.round(centerX - radius), Math.round(centerY - radius), Math.round(radius * 2), Math.round(radius * 2));
        g.drawLine(Math.round(centerX - radius * 0.70), Math.round(centerY + radius * 0.70),
            Math.round(centerX + radius * 0.70), Math.round(centerY - radius * 0.70));
        g.setStroke(new BasicStroke(1));
    }

    // 提示文字
    const text = getDoorPanelText(mode);
    const rawTextX = x0 + SX * 26 + doorWidth * 2 + gapMax + SX * 30;
    const textWidth = x0 + width - rawTextX - SX * 10;
    const textX = Math.round(ix(rawTextX, textWidth));
    let cjkLines = text.cjk.split("\n");
    let longestCjk = cjkLines[0];
    for (let i = 1; i < cjkLines.length; i++) {
        if (cjkLines[i].length > longestCjk.length) {
            longestCjk = cjkLines[i];
        }
    }
    let cjkSize = fitFontSize(g, SHS_BOLD, longestCjk, textWidth, 0, sz(27), sz(13));
    let cjkFont = SHS_BOLD.deriveFont(cjkSize * 1.0);
    let enFont = ROBOTO_REGULAR.deriveFont(sz(17));
    let enLines = wrapWords(g, enFont, text.en, textWidth);
    let cjkMetrics = g.getFontMetrics(cjkFont);
    let enMetrics = g.getFontMetrics(enFont);

    let blockHeight = cjkLines.length * cjkMetrics.getHeight() + SY * 10 + enLines.length * enMetrics.getHeight();
    let y = Math.round(PANEL_TOP + ((PANEL_HEIGHT - blockHeight) / 2));

    g.setColor(textColor);
    g.setFont(cjkFont);
    for (let i = 0; i < cjkLines.length; i++) {
        y += cjkMetrics.getAscent();
        drawText(g, cjkLines[i], Math.round(textX), y);
        y += cjkMetrics.getDescent();
    }
    y += SY * 10;
    g.setFont(enFont);
    for (let i = 0; i < enLines.length; i++) {
        y += enMetrics.getAscent();
        drawText(g, enLines[i], Math.round(textX), y);
        y += enMetrics.getDescent();
    }
}

/* ============================== 杂项 ============================== */

/** 取车站信息，索引越界时返回 null。 */
function getStationInfo(routeInfo, index) {
    let stations = routeInfo.stationInfoList;
    if (stations == null || index < 0 || index >= stations.length) {
        return null;
    }
    return stations[index];
}
