/*
 * 车内 LCD 版面绘制。
 *
 * 设计稿坐标：1024×768；贴图尺寸由 config.json 的 lcdSize 决定（当前 1123×843）。
 * 车上屏幕按 targetAspect（16:9）横向拉伸。
 */

importPackage(java.awt);
importPackage(java.awt.geom);

include("js_util.js");

/* ============================== 配置 ============================== */

const CONFIG = JSON.parse(Resources.readString(Resources.id("mtr:cqlcd/config.json")));

const PAGE_DURATION = (CONFIG.pageDuration == null) ? 8 : CONFIG.pageDuration;
const TARGET_ASPECT = (CONFIG.targetAspect == null) ? (16 / 9) : Number(CONFIG.targetAspect);
const SHOW_COACH_NUMBER = (CONFIG.showCoachNumber == null) ? true : CONFIG.showCoachNumber;
const PER_CAR_COACH_NUMBER = (CONFIG.perCarCoachNumber == null) ? true : CONFIG.perCarCoachNumber;
const FLIP_DOOR_SIDES = (CONFIG.flipDoorSides == null) ? false : CONFIG.flipDoorSides;
const DOOR_ANIMATION = (CONFIG.doorAnimation == null) ? true : CONFIG.doorAnimation;
const DOOR_ANIMATION_FPS = (CONFIG.doorAnimationFps == null) ? 10 : CONFIG.doorAnimationFps;
const DOOR_ANIMATION_PERIOD = 1.0;
const CONSIST_CARS = Math.max(1, Math.min(12, (CONFIG.consistCars == null) ? 6 : (CONFIG.consistCars | 0)));
const DRAW_DEBUG_LOG = (CONFIG.debugLog == true);

function printDebug(message) {
    if (DRAW_DEBUG_LOG) {
        print("LCD：" + message);
    }
}

/* ============================== 页面 ============================== */

const SCREEN_FULL_ROUTE_MAP = "full_route_map";
const SCREEN_NEXT_STATION = "next_station";
const SCREEN_CONSIST = "consist";
const SCREEN_DOOR = "door";
const SCREEN_ARRIVED = "arrived";

function isArrivedPage(screenType) {
    return screenType == SCREEN_ARRIVED;
}

/* ============================== 尺寸 ============================== */

const REF_WIDTH = 1024;
const REF_HEIGHT = 768;
const WIDTH = (CONFIG.lcdSize == null) ? 1123 : CONFIG.lcdSize[0];
const HEIGHT = (CONFIG.lcdSize == null) ? 843 : CONFIG.lcdSize[1];
const SX = WIDTH / REF_WIDTH;
const SY = HEIGHT / REF_HEIGHT;
const SR = Math.min(SX, SY);

function sx(v) { return v * SX; }
function sy(v) { return v * SY; }
function sr(v) { return v * SR; }

// 车顶压条会遮住贴图最上方；安全区只填线路色，内容整体下移并轻微压缩。
const SAFE_TOP = (CONFIG.topSafe == null) ? 0 : Math.max(0, Math.min(140, Number(CONFIG.topSafe)));
const SAFE_BOTTOM = (CONFIG.bottomSafe == null) ? 0 : Math.max(0, Math.min(140, Number(CONFIG.bottomSafe)));

function withSafeArea(g, drawFn) {
    if (SAFE_TOP <= 0 && SAFE_BOTTOM <= 0) {
        drawFn(g);
        return;
    }
    let safeGraphics = g.create();
    try {
        safeGraphics.translate(0, SAFE_TOP);
        safeGraphics.scale(1, (HEIGHT - SAFE_TOP - SAFE_BOTTOM) / HEIGHT);
        drawFn(safeGraphics);
    } finally {
        safeGraphics.dispose();
    }
}

const TITLE_HEIGHT = sy(64);
const DIRECTION_TOP = TITLE_HEIGHT;
const DIRECTION_HEIGHT = sy(64);
const HEADER_HEIGHT = TITLE_HEIGHT + DIRECTION_HEIGHT;

const PANEL_LEFT = sx(14);
const PANEL_TOP = sy(128);
const PANEL_WIDTH = WIDTH - PANEL_LEFT * 2;
const PANEL_HEIGHT = sy(224);
const PANEL_RADIUS = sr(24);
const PANEL_RIGHT = PANEL_LEFT + PANEL_WIDTH;
const PANEL_BOTTOM = PANEL_TOP + PANEL_HEIGHT;

const BOTTOM_TOP = sy(422);
const RED_BOTTOM = BOTTOM_TOP;

/* ============================== 颜色 ============================== */

const COLOR_TEXT = rgb(28, 26, 27);
const COLOR_TEXT_SOFT = rgb(72, 64, 66);
const COLOR_WHITE = rgb(255, 255, 255);
const COLOR_MAP_BAND = rgb(247, 221, 207);
const COLOR_MAP_BAND_EDGE = rgb(238, 202, 184);
const COLOR_PANEL_LINE = rgb(211, 122, 122);
const COLOR_BAN = rgb(227, 8, 20);
const COLOR_GREEN = rgb(42, 158, 70);
const COLOR_TEXT_RED = rgb(176, 0, 10);
const COLOR_TEXT_RED_SOFT = rgb(222, 108, 102);
const LINE_RED = rgb(226, 0, 24);

let CURRENT_ROUTE_COLOR = rgb(226, 0, 24);

/* ============================== 字体 ============================== */

// 字体体积较大，延迟到真正开始画 LCD 时再读取，避免标题界面资源重载时卡死。
let CHIRON_800 = null;
let SANS_MEDIUM = null;

function ensureFonts() {
    if (CHIRON_800 == null) {
        CHIRON_800 = Resources.readFont(Resources.id("mtr:cqlcd/fonts/chiron/chiron-go-round-tc-800eb.ttf"));
    }
    if (SANS_MEDIUM == null) {
        SANS_MEDIUM = Resources.readFont(Resources.id("mtr:cqlcd/fonts/source-han-sans-cn/source-han-sans-cn-medium.ttf"));
    }
}

function roundFont(size) { ensureFonts(); return CHIRON_800.deriveFont(size * 1.0); }
function sansFont(size) { ensureFonts(); return SANS_MEDIUM.deriveFont(size * 1.0); }
function mapFont(size) { ensureFonts(); return SANS_MEDIUM.deriveFont(size * 1.0); }

/* ============================== 颜色工具 ============================== */

function rgb(r, g, b) {
    return new Color(((r & 0xFF) << 16) | ((g & 0xFF) << 8) | (b & 0xFF));
}

function rgba(r, g, b, a) {
    return new Color(((a & 0xFF) << 24) | ((r & 0xFF) << 16) | ((g & 0xFF) << 8) | (b & 0xFF), true);
}

function shade(color, factor) {
    let r = Math.max(0, Math.min(255, Math.round(color.getRed() * (1 - factor))));
    let g = Math.max(0, Math.min(255, Math.round(color.getGreen() * (1 - factor))));
    let b = Math.max(0, Math.min(255, Math.round(color.getBlue() * (1 - factor))));
    return rgb(r, g, b);
}

function blend(colorA, colorB, t) {
    let r = Math.round(colorA.getRed() * (1 - t) + colorB.getRed() * t);
    let g = Math.round(colorA.getGreen() * (1 - t) + colorB.getGreen() * t);
    let b = Math.round(colorA.getBlue() * (1 - t) + colorB.getBlue() * t);
    return rgb(Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b)));
}

/* ============================== 绘图工具 ============================== */

function drawText(g, text, x, baselineY) {
    g.drawString(String(text), Math.round(x), Math.round(baselineY));
}

function drawStringCentered(g, text, centerX, baselineY) {
    drawText(g, text, centerX - g.getFontMetrics().stringWidth(String(text)) / 2, baselineY);
}

/** 手动字距，居中。tracking 为输出像素。 */
function drawSpacedText(g, text, centerX, baselineY, tracking) {
    let s = String(text);
    let widths = [];
    let total = 0;
    for (let i = 0; i < s.length; i++) {
        let w = g.getFontMetrics().stringWidth(s.charAt(i));
        widths.push(w);
        total += w;
    }
    total += tracking * Math.max(0, s.length - 1);
    let x = centerX - total / 2;
    for (let i = 0; i < s.length; i++) {
        drawText(g, s.charAt(i), x, baselineY);
        x += widths[i] + tracking;
    }
}

/** 手动字距，左对齐。 */
function drawSpacedTextLeft(g, text, x, baselineY, tracking) {
    let s = String(text);
    for (let i = 0; i < s.length; i++) {
        drawText(g, s.charAt(i), x, baselineY);
        x += g.getFontMetrics().stringWidth(s.charAt(i)) + tracking;
    }
}

function fitFontSize(g, baseFont, text, maxWidth, maxHeight, maxSize, minSize) {
    let size = maxSize;
    while (size > minSize) {
        let metrics = g.getFontMetrics(baseFont.deriveFont(size * 1.0));
        let fitsWidth = (maxWidth <= 0) || (metrics.stringWidth(String(text)) <= maxWidth);
        let fitsHeight = (maxHeight <= 0) || (metrics.getHeight() <= maxHeight);
        if (fitsWidth && fitsHeight) {
            return size;
        }
        size -= 1;
    }
    return minSize;
}

function toJsString(value) {
    return (value == null) ? "" : String(value);
}

function formatRouteCjkName(name) {
    return String(name);
}

function getStationInfo(routeInfo, index) {
    if (routeInfo == null || routeInfo.stationInfoList == null) {
        return null;
    }
    let stations = routeInfo.stationInfoList;
    if (index < 0 || index >= stations.length) {
        return null;
    }
    return stations[index];
}

function getStationCjk(station) {
    if (station == null) {
        return "";
    }
    let name = toJsString(station.stationName);
    let cjk = toJsString(TextUtil.getCjkParts(name));
    return (cjk.length == 0) ? toJsString(TextUtil.getNonCjkParts(name)) : cjk;
}

function getStationEn(station) {
    if (station == null) {
        return "";
    }
    let name = toJsString(station.stationName);
    let en = toJsString(TextUtil.getNonCjkParts(name));
    if (en == toJsString(TextUtil.getCjkParts(name))) {
        return "";
    }
    return en;
}

function getRouteCjkName(routeInfo) {
    let name = toJsString(routeInfo.routeName);
    let cjk = toJsString(TextUtil.getCjkParts(name));
    cjk = formatRouteCjkName((cjk.length == 0) ? name : cjk);
    // 线路名原样显示；只有纯数字“1”补成“1号线”，不再自动加“重庆轨道交通”。
    if (/^[0-9]+$/.test(cjk)) {
        return cjk + "号线";
    }
    return cjk;
}

function getDrawDirection(routeInfo) {
    if (routeInfo != null && Number(routeInfo.travelDirection) < 0) {
        return -1;
    }
    return 1;
}

function getGameTime() {
    try {
        if (typeof Timing != "undefined") {
            return Timing.elapsed();
        }
    } catch (error) {
    }
    try {
        if (typeof TimingUtil != "undefined") {
            return TimingUtil.elapsed();
        }
    } catch (error) {
    }
    return java.lang.System.currentTimeMillis() / 1000.0;
}

/* ============================== 入口 ============================== */

function drawScreen(g, routeInfo, trainStatus, screenType, thisSideDoorWillOpen, thisSideDoorOpenNow,
                    coachNumber, includeDoorPanel, mirrorLayout, approaching) {
    if (includeDoorPanel === undefined) includeDoorPanel = true;
    ensureFonts();

    g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
    g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
    g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
    g.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE);
    g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);

    g.setColor(COLOR_WHITE);
    g.fillRect(0, 0, WIDTH, HEIGHT);

    if (routeInfo == null || trainStatus == STATUS_NO_ROUTE) {
        drawNoRouteScreen(g);
        return;
    }

    CURRENT_ROUTE_COLOR = routeInfo.routeColor;
    let page = isArrivedPage(screenType) ? SCREEN_ARRIVED : screenType;
    let ctx = {
        routeInfo: routeInfo,
        routeColor: routeInfo.routeColor,
        trainStatus: trainStatus,
        page: page,
        approaching: approaching === true,
        coachNumber: coachNumber
    };

    if (SAFE_TOP > 0) {
        g.setColor(shade(routeInfo.routeColor, 0.32));
        g.fillRect(0, 0, WIDTH, Math.round(SAFE_TOP));
    }
    if (SAFE_BOTTOM > 0) {
        g.setColor(shade(routeInfo.routeColor, 0.32));
        g.fillRect(0, Math.round(HEIGHT - SAFE_BOTTOM), WIDTH, Math.round(SAFE_BOTTOM));
    }

    withSafeArea(g, function (safeGraphics) {
        drawHeader(safeGraphics, ctx);
        drawMainPanel(safeGraphics, ctx);

        // 下半部分白底
        safeGraphics.setColor(COLOR_WHITE);
        safeGraphics.fillRect(0, Math.round(BOTTOM_TOP), WIDTH, HEIGHT - Math.round(BOTTOM_TOP));

        if (page == SCREEN_ARRIVED) {
            // 到站页由车门信息占满下半部分
        } else if (page == SCREEN_FULL_ROUTE_MAP) {
            drawFullRouteMap(safeGraphics, ctx);
        } else if (page == SCREEN_CONSIST) {
            drawConsist(safeGraphics, ctx);
        } else if (page == SCREEN_DOOR) {
            // 车门页由下面统一绘制
        } else {
            drawSegmentMap(safeGraphics, ctx);
        }

        if (includeDoorPanel && (page == SCREEN_ARRIVED || page == SCREEN_DOOR)) {
            let doorMode = getDoorMode(page == SCREEN_ARRIVED, thisSideDoorWillOpen, thisSideDoorOpenNow);
            drawDoorPanelBody(safeGraphics, ctx.routeColor, doorMode, getStaticDoorFraction(doorMode));
        }

        if (SHOW_COACH_NUMBER && coachNumber != null && coachNumber > 0) {
            drawCoachNumber(safeGraphics, coachNumber, PANEL_RIGHT - sx(81),
                PANEL_TOP + PANEL_HEIGHT / 2 + sy(8), CURRENT_ROUTE_COLOR);
        }

        drawFooter(safeGraphics);
    });
}

/* ============================== 顶部 ============================== */

function spacedTextWidth(g, font, text, tracking) {
    let width = 0;
    let s = String(text);
    g.setFont(font);
    for (let i = 0; i < s.length; i++) {
        width += g.getFontMetrics().stringWidth(s.charAt(i));
    }
    return width + tracking * Math.max(0, s.length - 1);
}

function drawHeader(g, ctx) {
    let routeColor = ctx.routeColor;

    // 面板外围：线路自定义色的深色渐变
    g.setPaint(new GradientPaint(0, 0, blend(routeColor, rgb(255, 170, 60), 0.24),
        0, RED_BOTTOM, shade(routeColor, 0.42)));
    g.fillRect(0, 0, WIDTH, Math.round(RED_BOTTOM));

    // 标题条：用线路色做亮 → 暗渐变
    g.setPaint(new GradientPaint(0, 0, blend(routeColor, rgb(255, 190, 70), 0.48),
        0, TITLE_HEIGHT, shade(routeColor, 0.18)));
    g.fillRect(0, 0, WIDTH, Math.round(TITLE_HEIGHT));
    g.setColor(blend(routeColor, rgb(255, 214, 130), 0.55));
    g.fillRect(0, Math.round(TITLE_HEIGHT - sy(3)), WIDTH, Math.max(1, Math.round(sy(2))));
    g.setColor(shade(routeColor, 0.48));
    g.fillRect(0, Math.round(TITLE_HEIGHT - sy(1)), WIDTH, Math.max(1, Math.round(sy(1))));

    // 线路名
    let title = getRouteCjkName(ctx.routeInfo);
    let titleSize = fitFontSize(g, SANS_MEDIUM, title, WIDTH * 0.90, TITLE_HEIGHT * 0.72, sy(40), sy(24));
    g.setFont(sansFont(titleSize));
    g.setColor(COLOR_WHITE);
    let titleBaseline = sy(30) + titleSize * 0.35;
    drawSpacedText(g, title, WIDTH / 2 - sx(6), titleBaseline, sx(10));

    // 运行方向条
    g.setPaint(new GradientPaint(0, DIRECTION_TOP, shade(routeColor, 0.22),
        0, HEADER_HEIGHT, shade(routeColor, 0.38)));
    g.fillRect(0, Math.round(DIRECTION_TOP), WIDTH, Math.round(DIRECTION_HEIGHT));
    g.setColor(blend(routeColor, rgb(255, 170, 60), 0.35));
    g.fillRect(0, Math.round(DIRECTION_TOP), WIDTH, Math.max(1, Math.round(sy(1))));

    let stations = ctx.routeInfo.stationInfoList;
    if (stations == null || stations.length == 0) {
        return;
    }
    let direction = getDrawDirection(ctx.routeInfo);
    let start = (direction > 0) ? stations[0] : stations[stations.length - 1];
    let end = (direction > 0) ? stations[stations.length - 1] : stations[0];
    let startName = getStationCjk(start);
    let endName = getStationCjk(end);

    let cy = DIRECTION_TOP + DIRECTION_HEIGHT / 2;
    let arrowWidth = sx(96);
    let arrowLead = sx(52);   // 箭头左侧还有速度线，排版时要一起算进去
    let gap = sx(30);
    let minStartX = sx(170);
    let available = WIDTH - minStartX - sx(30) - arrowWidth - arrowLead - gap * 2;

    // 运行方向优先保证“起点—箭头—终点”不重叠：按最长的一侧自动缩字号。
    let endpointSize = sy(38);
    let startTrack = endpointSize * 0.10;
    let endTrack = endpointSize * 0.05;
    let startW = spacedTextWidth(g, sansFont(endpointSize), startName, startTrack);
    let endW = spacedTextWidth(g, sansFont(endpointSize), endName, endTrack);
    while (endpointSize > sy(20) && (startW + endW) > available) {
        endpointSize -= 1;
        startTrack = endpointSize * 0.10;
        endTrack = endpointSize * 0.05;
        startW = spacedTextWidth(g, sansFont(endpointSize), startName, startTrack);
        endW = spacedTextWidth(g, sansFont(endpointSize), endName, endTrack);
    }

    let total = startW + endW + arrowWidth + arrowLead + gap * 2;
    let left = Math.max(minStartX, (WIDTH - total) / 2);
    let baseline = cy + endpointSize * 0.35;
    // 「运行方向」放大，并与起点/终点站名共用同一条基线。
    g.setFont(sansFont(sy(32)));
    g.setColor(COLOR_WHITE);
    drawText(g, "运行方向", sx(32), baseline);
    let arrowLeft = left + startW + gap + arrowLead;
    g.setColor(COLOR_WHITE);
    drawSpacedTextLeft(g, startName, left, baseline, startTrack);
    drawDirectionArrow(g, arrowLeft, cy, arrowWidth, sy(40));
    g.setColor(COLOR_WHITE);
    drawSpacedTextLeft(g, endName, arrowLeft + arrowWidth + gap, baseline, endTrack);
}

/** 参考图方向箭头：4 根速度线 + 主箭头 + 第二层箭尖。 */
function drawDirectionArrow(g, left, centerY, width, height) {
    let half = height / 2;
    let shaft = height * 0.36;
    let headStart = left + width * 0.60;
    let tip = left + width * 0.90;

    g.setColor(rgb(255, 198, 0));
    let offsets = [52, 34, 22, 11];
    for (let i = 0; i < offsets.length; i++) {
        let bx = left - sx(offsets[i]);
        let bh = height * ((i == 1 || i == 2) ? 0.52 : 0.44);
        g.fillRoundRect(Math.round(bx), Math.round(centerY - bh / 2),
            Math.max(2, Math.round(sx(4))), Math.round(bh), Math.round(sr(1)), Math.round(sr(1)));
    }

    let pts = [
        [tip, centerY],
        [headStart, centerY - half],
        [headStart, centerY - shaft / 2],
        [left, centerY - shaft / 2],
        [left, centerY + shaft / 2],
        [headStart, centerY + shaft / 2],
        [headStart, centerY + half]
    ];
    g.setColor(rgb(118, 0, 0));
    fillPolygon(g, pts, sx(2), sy(3));
    g.setColor(rgb(255, 198, 0));
    fillPolygon(g, pts, 0, 0);

    let c1 = left + width * 0.90;
    let c2 = left + width * 1.05;
    let chev = [[c1, centerY - height * 0.46], [c2, centerY], [c1, centerY + height * 0.46]];
    g.setStroke(new BasicStroke(Math.max(2, sx(8)), BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
    g.setColor(rgb(118, 0, 0));
    drawPolyline(g, chev, sx(2), sy(3));
    g.setColor(rgb(255, 198, 0));
    drawPolyline(g, chev, 0, 0);
    g.setStroke(new BasicStroke(1));
}

function fillPolygon(g, points, dx, dy) {
    let path = new GeneralPath();
    for (let i = 0; i < points.length; i++) {
        let x = points[i][0] + dx;
        let y = points[i][1] + dy;
        if (i == 0) path.moveTo(x, y); else path.lineTo(x, y);
    }
    path.closePath();
    g.fill(path);
}

function drawPolyline(g, points, dx, dy) {
    for (let i = 0; i < points.length - 1; i++) {
        g.drawLine(Math.round(points[i][0] + dx), Math.round(points[i][1] + dy),
            Math.round(points[i + 1][0] + dx), Math.round(points[i + 1][1] + dy));
    }
}

/* ============================== 主面板 ============================== */

function drawMainPanel(g, ctx) {
    let routeColor = ctx.routeColor;
    let arrived = (ctx.page == SCREEN_ARRIVED);
    let centerYd = 248;
    let centerY = sy(centerYd);

    g.setColor(rgba(routeColor.getRed() / 2, routeColor.getGreen(), routeColor.getBlue(), 55));
    g.fillRoundRect(Math.round(PANEL_LEFT + sx(2)), Math.round(PANEL_TOP + sy(4)),
        Math.round(PANEL_WIDTH), Math.round(PANEL_HEIGHT), PANEL_RADIUS, PANEL_RADIUS);

    g.setPaint(new GradientPaint(0, PANEL_TOP, blend(routeColor, COLOR_WHITE, 0.86),
        0, PANEL_BOTTOM, blend(routeColor, COLOR_WHITE, 0.76)));
    g.fillRoundRect(Math.round(PANEL_LEFT), Math.round(PANEL_TOP),
        Math.round(PANEL_WIDTH), Math.round(PANEL_HEIGHT), PANEL_RADIUS, PANEL_RADIUS);
    g.setColor(rgba(255, 255, 255, 210));
    g.setStroke(new BasicStroke(Math.max(1, sr(1))));
    g.drawRoundRect(Math.round(PANEL_LEFT), Math.round(PANEL_TOP),
        Math.round(PANEL_WIDTH), Math.round(PANEL_HEIGHT), PANEL_RADIUS, PANEL_RADIUS);
    g.setStroke(new BasicStroke(1));

    let labelCjk;
    let labelEn;
    if (arrived) {
        labelCjk = "已到达";
        labelEn = "Arrival";
    } else if (ctx.approaching) {
        labelCjk = "即将到达";
        labelEn = "Approaching";
    } else {
        labelCjk = "下一站";
        labelEn = "Next";
    }
    let labelSize = sy(48);
    let labelFont = roundFont(labelSize);
    let enFont = roundFont(sy(28));
    g.setFont(labelFont);
    let labelW = g.getFontMetrics().stringWidth(labelCjk);
    g.setColor(shade(routeColor, 0.10));
    drawText(g, labelCjk, sx(54), centerY - sy(23) + labelSize * 0.35);
    g.setFont(enFont);
    g.setColor(shade(routeColor, 0.02));
    let enW = g.getFontMetrics().stringWidth(labelEn);
    drawText(g, labelEn, sx(54) + (labelW - enW) / 2, centerY + sy(33) + sy(28) * 0.35);

    let station = getStationInfo(ctx.routeInfo, ctx.routeInfo.nextStationIndex);
    let stationName = getStationCjk(station);
    if (stationName.length == 0) {
        stationName = ctx.routeInfo.destination;
    }
    let pinyin = getStationEn(station);

    let nameSize = fitFontSize(g, CHIRON_800, stationName, sx(410), sy(98), sy(84), sy(40));
    let pinyinSize = fitFontSize(g, CHIRON_800, pinyin, sx(310), sy(48), sy(44), sy(18));
    g.setFont(roundFont(nameSize));
    g.setColor(COLOR_TEXT);
    drawStringCentered(g, stationName, sx(507), centerY - sy(35) + nameSize * 0.35 + sy(9));
    if (pinyin.length > 0) {
        g.setFont(roundFont(pinyinSize));
        drawStringCentered(g, pinyin, sx(507), centerY + sy(44) + pinyinSize * 0.35 + sy(7));
    }
    
    g.setColor(blend(routeColor, COLOR_WHITE, 0.55));
    g.fillRect(Math.round(sx(741)), Math.round(PANEL_TOP + sy(34)),
        Math.max(1, Math.round(sx(2))), Math.round(PANEL_HEIGHT - sy(68)));

    drawCoachNumber(g, ctx.coachNumber, PANEL_RIGHT - sx(81), centerY, ctx.routeColor);
}

/**
 * 车厢区：直接使用字体里的数字，不压缩字形。
 */
function drawCoachNumber(g, coachNumber, right, centerY, routeColor) {
    if (routeColor == null) routeColor = CURRENT_ROUTE_COLOR;
    if (!SHOW_COACH_NUMBER || coachNumber == null || coachNumber <= 0) {
        return;
    }
    let numberText = String(coachNumber);
    let unitText = "车厢";
    let numberFont = roundFont(sy(56));
    let unitFont = roundFont(sy(40));
    let numberW = g.getFontMetrics(numberFont).stringWidth(numberText);
    let unitW = g.getFontMetrics(unitFont).stringWidth(unitText);
    let gap = sx(30);
    let unitX = right - unitW;
    let numberX = unitX - gap - numberW;

    g.setFont(numberFont);
    g.setColor(shade(routeColor, 0.02));
    drawText(g, numberText, numberX, sy(237));
    g.setFont(unitFont);
    g.setColor(shade(routeColor, 0.12));
    drawText(g, unitText, unitX, sy(239));

    let enText = "No." + coachNumber + " Coach";
    let enFont = roundFont(sy(29));
    g.setFont(enFont);
    g.setColor(shade(routeColor, 0.18));
    let enW = g.getFontMetrics().stringWidth(enText);
    let tracking = sx(1.2);
    let enRight = PANEL_RIGHT - sx(52);
    drawSpacedTextLeft(g, enText, enRight - enW - tracking * Math.max(0, enText.length - 1),
        sy(278), tracking);
}

function drawCoachNumberPlate(g, screenType, coachNumber, layout) {
    if (!SHOW_COACH_NUMBER || coachNumber == null || coachNumber <= 0) {
        return;
    }
    withSafeArea(g, function (safeGraphics) {
        drawCoachNumber(safeGraphics, coachNumber, PANEL_RIGHT - sx(81),
            PANEL_TOP + PANEL_HEIGHT / 2 + sy(8), CURRENT_ROUTE_COLOR);
    });
}

/**
 * 换乘站提示：站名 + “换乘轨道交通”黑字，换乘线路名用该线路自己的颜色。
 */
function drawInterchangeNotice(g, station, stationName, centerX, baselineY, fallbackColor, fontSize) {
    if (station == null || station.interchangeInfo == null || station.interchangeInfo.length == 0) {
        return;
    }
    let segments = [];
    let prefix = stationName + "：换乘轨道交通";
    segments.push({text: prefix, color: COLOR_TEXT});
    for (let i = 0; i < station.interchangeInfo.length; i++) {
        let info = station.interchangeInfo[i];
        let rawName = String(info.name == null ? "" : info.name);
        let cjk = String(TextUtil.getCjkParts(rawName));
        let name = (cjk.length == 0) ? rawName : cjk;
        if (name.length == 0) {
            continue;
        }
        if (segments.length > 1) {
            segments.push({text: "、", color: COLOR_TEXT});
        }
        segments.push({text: name, color: info.color == null ? fallbackColor : info.color});
    }
    if (segments.length <= 1) {
        return;
    }

    let preferredSize = (fontSize == null) ? sy(26) : fontSize;
    let maxWidth = sx(700);

    // 前缀固定成一组；每条换乘线路连同它后面的“、”作为一组，换行时不会拆线路名。
    let groups = [{parts: [segments[0]]}];
    let pendingSeparator = null;
    for (let i = 1; i < segments.length; i++) {
        if (segments[i].text == "、") {
            pendingSeparator = segments[i];
            continue;
        }
        if (pendingSeparator != null) {
            groups[groups.length - 1].parts.push(pendingSeparator);
            pendingSeparator = null;
        }
        groups.push({parts: [segments[i]]});
    }

    function groupWidth(metrics, group) {
        let width = 0;
        for (let i = 0; i < group.parts.length; i++) {
            width += metrics.stringWidth(group.parts[i].text);
        }
        return width;
    }

    function buildLines(size) {
        let font = sansFont(size);
        let metrics = g.getFontMetrics(font);
        let lines = [];
        let line = [];
        let lineWidth = 0;
        for (let i = 0; i < groups.length; i++) {
            let width = groupWidth(metrics, groups[i]);
            if (lineWidth + width > maxWidth && line.length > 0) {
                lines.push(line);
                line = [];
                lineWidth = 0;
            }
            line.push(groups[i]);
            lineWidth += width;
        }
        if (line.length > 0) {
            lines.push(line);
        }
        return {font: font, lines: lines};
    }

    let size = preferredSize;
    let built = buildLines(size);
    while (built.lines.length > 2 && size > sy(18)) {
        size -= 1;
        built = buildLines(size);
    }
    let font = built.font;
    let lines = built.lines;
    if (lines.length == 0) {
        return;
    }

    g.setFont(font);
    let metrics = g.getFontMetrics(font);
    let lineHeight = size * 1.38;
    let firstBaseline = baselineY - (lines.length - 1) * lineHeight / 2;
    for (let i = 0; i < lines.length; i++) {
        let current = lines[i];
        let currentWidth = 0;
        for (let k = 0; k < current.length; k++) {
            currentWidth += groupWidth(metrics, current[k]);
        }
        let x = centerX - currentWidth / 2;
        let y = firstBaseline + i * lineHeight;
        for (let k = 0; k < current.length; k++) {
            let parts = current[k].parts;
            for (let m = 0; m < parts.length; m++) {
                g.setColor(parts[m].color);
                drawText(g, parts[m].text, x, y);
                x += metrics.stringWidth(parts[m].text);
            }
        }
    }
}

/* ============================== 全线线路图 ============================== */

function drawFullRouteMap(g, ctx) {
    let stations = ctx.routeInfo.stationInfoList;
    let count = (stations == null) ? 0 : stations.length;
    if (count <= 0) {
        return;
    }
    let direction = getDrawDirection(ctx.routeInfo);
    let marker = Math.max(0, Math.min(ctx.routeInfo.nextStationIndex, count - 1));
    let routeColor = ctx.routeColor;

    let bandLeft = sx(32);
    let bandRight = WIDTH - sx(32);
    let bandTop = sy(565);
    let bandHeight = sy(45);
    let bandCenterY = bandTop + bandHeight / 2;

    let bandColor = blend(routeColor, rgb(255, 245, 238), 0.86);
    let bandEdge = blend(routeColor, COLOR_WHITE, 0.76);
    g.setColor(bandColor);
    g.fillRoundRect(Math.round(bandLeft), Math.round(bandTop), Math.round(bandRight - bandLeft),
        Math.round(bandHeight), Math.round(bandHeight / 2), Math.round(bandHeight / 2));
    g.setColor(bandEdge);
    g.setStroke(new BasicStroke(Math.max(1, sr(1))));
    g.drawRoundRect(Math.round(bandLeft), Math.round(bandTop), Math.round(bandRight - bandLeft),
        Math.round(bandHeight), Math.round(bandHeight / 2), Math.round(bandHeight / 2));
    g.setStroke(new BasicStroke(1));

    let left = bandLeft + sx(22);
    let right = bandRight - sx(20);
    let step = (count <= 1) ? 0 : (right - left) / (count - 1);
    let radius = sr(13);
    let nameSize = sy(24);
    let lineHeight = sy(26);
    let topGap = sy(30);
    let bottomGap = sy(30);
    let minTop = PANEL_BOTTOM + sy(8);

    // 站名长短不一：按最长的一侧自动缩字号/行高，保证上排不顶进面板。
    let maxTopChars = 0;
    let maxBottomChars = 0;
    for (let i = 0; i < count; i++) {
        let n = getStationCjk(stations[i]).length;
        if (i % 2 == 0) maxBottomChars = Math.max(maxBottomChars, n);
        else maxTopChars = Math.max(maxTopChars, n);
    }
    let topAvail = bandTop - topGap - minTop;
    let bottomAvail = HEIGHT - (bandTop + bandHeight + bottomGap) - sy(4);
    let worstBlock = Math.max(
        nameSize * 0.75 + lineHeight * Math.max(0, maxTopChars - 1),
        nameSize * 0.75 + lineHeight * Math.max(0, maxBottomChars - 1)
    );
    let worstAvail = Math.min(topAvail, bottomAvail);
    if (worstBlock > worstAvail && worstBlock > 0) {
        let scale = Math.max(0.65, worstAvail / worstBlock);
        nameSize *= scale;
        lineHeight *= scale;
    }
    let nameFont = mapFont(nameSize);

    for (let i = 0; i < count; i++) {
        let cx = left + step * i;
        let passed = (direction > 0) ? (i < marker) : (i > marker);
        let current = (i == marker);

        if (current) {
            // 当前站本身保留圆点，箭头单独放在相邻站之间。
            if (marker == 0) {
                g.setColor(COLOR_WHITE);
                g.fillOval(Math.round(cx - radius - sr(3)), Math.round(bandCenterY - radius - sr(3)),
                    Math.round((radius + sr(3)) * 2), Math.round((radius + sr(3)) * 2));
                g.setColor(CURRENT_ROUTE_COLOR);
                g.fillOval(Math.round(cx - radius), Math.round(bandCenterY - radius),
                    Math.round(radius * 2), Math.round(radius * 2));
                g.setColor(COLOR_WHITE);
                g.setStroke(new BasicStroke(Math.max(1, sr(1.5))));
                g.drawOval(Math.round(cx - radius), Math.round(bandCenterY - radius),
                    Math.round(radius * 2), Math.round(radius * 2));
                g.setStroke(new BasicStroke(1));
            }

            // 当前站箭头放在相邻站之间；首站没有“上一站”，用首站到第二站的区间。
            let arrowCenter;
            if (direction > 0) {
                if (marker > 0) {
                    arrowCenter = (left + (marker - 1) * step + cx) / 2;
                } else if (marker < count - 1) {
                    arrowCenter = (cx + cx + step) / 2;
                } else {
                    arrowCenter = cx;
                }
            } else {
                if (marker < count - 1) {
                    arrowCenter = (cx + cx + step) / 2;
                } else if (marker > 0) {
                    arrowCenter = (left + (marker - 1) * step + cx) / 2;
                } else {
                    arrowCenter = cx;
                }
            }
            arrowCenter = Math.max(bandLeft + step * 0.5, Math.min(bandRight - step * 0.5, arrowCenter));
            drawStationArrow(g, arrowCenter, bandCenterY, sr(30), direction,
                (ARROW_BLINK_PHASE_LOCK == 1) ? 1 : 0, step);

            // 圆点盖在箭头之上，保证当前站圆点始终完整可见。
            if (marker == 0) {
                g.setColor(COLOR_WHITE);
                g.fillOval(Math.round(cx - radius - sr(3)), Math.round(bandCenterY - radius - sr(3)),
                    Math.round((radius + sr(3)) * 2), Math.round((radius + sr(3)) * 2));
                g.setColor(CURRENT_ROUTE_COLOR);
                g.fillOval(Math.round(cx - radius), Math.round(bandCenterY - radius),
                    Math.round(radius * 2), Math.round(radius * 2));
                g.setColor(COLOR_WHITE);
                g.setStroke(new BasicStroke(Math.max(1, sr(1.5))));
                g.drawOval(Math.round(cx - radius), Math.round(bandCenterY - radius),
                    Math.round(radius * 2), Math.round(radius * 2));
                g.setStroke(new BasicStroke(1));
            }
        } else {
            g.setColor(COLOR_WHITE);
            g.fillOval(Math.round(cx - radius - sr(3)), Math.round(bandCenterY - radius - sr(3)),
                Math.round((radius + sr(3)) * 2), Math.round((radius + sr(3)) * 2));
            g.setColor(passed ? CURRENT_ROUTE_COLOR : COLOR_WHITE);
            g.fillOval(Math.round(cx - radius), Math.round(bandCenterY - radius),
                Math.round(radius * 2), Math.round(radius * 2));
            g.setColor(bandEdge);
            g.setStroke(new BasicStroke(Math.max(1, sr(1))));
            g.drawOval(Math.round(cx - radius), Math.round(bandCenterY - radius),
                Math.round(radius * 2), Math.round(radius * 2));
            g.setStroke(new BasicStroke(1));
        }

        let name = getStationCjk(stations[i]);
        if (name.length == 0) {
            continue;
        }
        let chars = name.split("");
        let below = (i % 2 == 0);
        let base;
        if (below) {
            base = bandTop + bandHeight + bottomGap;
        } else {
            base = bandTop - topGap - lineHeight * (chars.length - 1);
            // 站名多、名字长时，上排不能顶进上面的信息面板。
            let approxTop = base - nameSize * 0.65;
            if (approxTop < minTop) {
                base += (minTop - approxTop);
            }
        }
        g.setFont(nameFont);
        g.setColor(COLOR_TEXT);
        for (let k = 0; k < chars.length; k++) {
            drawStringCentered(g, chars[k], cx, base + k * lineHeight + nameSize * 0.35);
        }
    }
}

/** 线路图当前站箭头。 */
function drawStationArrow(g, center, cy, size, direction, phase, step) {
    // center 已经是相邻站点区间的中点。
    let length = size * 1.0;
    let half = size * 0.54;
    let shaft = size * 0.34;
    let tail = center - direction * length / 2;
    let tip = center + direction * length / 2;
    let neck = tip - direction * length * 0.42;
    let pts = [
        [tip, cy],
        [neck, cy - half],
        [neck, cy - shaft / 2],
        [tail, cy - shaft / 2],
        [tail, cy + shaft / 2],
        [neck, cy + shaft / 2],
        [neck, cy + half]
    ];
    if (phase == 1) {
        g.setColor(COLOR_WHITE);
        fillPolygon(g, pts, 0, 0);
        g.setColor(CURRENT_ROUTE_COLOR);
        g.setStroke(new BasicStroke(Math.max(1.5, sr(2))));
        g.drawPolygon(toPolygon(pts));
        g.setStroke(new BasicStroke(1));
    } else {
        g.setColor(CURRENT_ROUTE_COLOR);
        fillPolygon(g, pts, 0, 0);
        g.setColor(COLOR_WHITE);
        g.setStroke(new BasicStroke(Math.max(1.5, sr(2))));
        g.drawPolygon(toPolygon(pts));
        g.setStroke(new BasicStroke(1));
    }
}

function toPolygon(points) {
    let polygon = new Polygon();
    for (let i = 0; i < points.length; i++) {
        polygon.addPoint(Math.round(points[i][0]), Math.round(points[i][1]));
    }
    return polygon;
}

/* ============================== 近站区间图 ============================== */

function drawSegmentMap(g, ctx) {
    let stations = ctx.routeInfo.stationInfoList;
    let count = (stations == null) ? 0 : stations.length;
    if (count <= 0) {
        return;
    }
    let marker = Math.max(0, Math.min(ctx.routeInfo.nextStationIndex, count - 1));
    let windowSize = Math.min(5, count);
    // 距离终点超过 5 站时，窗口第一格显示“上一站”，第二格才是“下一站”。
    // 接近终点后窗口整体贴到线路末端。
    let start;
    if (count - marker > 5) {
        start = Math.max(0, marker - 1);
    } else {
        start = Math.max(0, count - windowSize);
    }

    let bandLeft = sx(32);
    let bandRight = sx(1010);
    let bandTop = sy(512);
    let bandHeight = sy(60);
    let bandCenterY = bandTop + bandHeight / 2;
    let notch = sx(30);

    let pts = [
        [bandLeft, bandTop],
        [bandRight - notch, bandTop],
        [bandRight + notch, bandCenterY],
        [bandRight - notch, bandTop + bandHeight],
        [bandLeft, bandTop + bandHeight]
    ];
    let segBand = blend(CURRENT_ROUTE_COLOR, rgb(255, 245, 238), 0.86);
    let segEdge = blend(CURRENT_ROUTE_COLOR, COLOR_WHITE, 0.76);
    let direction = getDrawDirection(ctx.routeInfo);
    let innerLeft = bandLeft + sx(70);
    let innerRight = bandRight - sx(60);
    let step = (windowSize <= 1) ? 0 : (innerRight - innerLeft) / (windowSize - 1);
    let currentX = innerLeft + step * (marker - start);
    let radius = sr(25);

    g.setColor(segBand);
    fillPolygon(g, pts, 0, 0);

    // 已过区间填线路色：像参考图一样，红线从一端推到当前站。
    let oldClip = g.getClip();
    g.setClip(toPolygon(pts));
    g.setColor(CURRENT_ROUTE_COLOR);
    let prevX = currentX - direction * step;
    let arrowCenter = (currentX + prevX) / 2;
    let edgeX = currentX;
    if (marker > start) {
        // 红色已过区间延伸到两站之间的箭头尖端，不压到将到站圆点。
        edgeX = arrowCenter + direction * (sr(46) / 2);
    }
    if (direction > 0) {
        g.fillRect(Math.round(bandLeft), Math.round(bandTop),
            Math.round(Math.max(0, edgeX - bandLeft)), Math.round(bandHeight));
    } else {
        g.fillRect(Math.round(edgeX), Math.round(bandTop),
            Math.round(Math.max(0, bandRight + notch - edgeX)), Math.round(bandHeight));
    }
    g.setClip(oldClip);

    g.setColor(segEdge);
    g.setStroke(new BasicStroke(Math.max(1, sr(1))));
    g.drawPolygon(toPolygon(pts));
    g.setStroke(new BasicStroke(1));

    drawChevron(g, sx(1018), bandCenterY, sy(62), 96 * SX, rgba(segBand.getRed(), segBand.getGreen(), segBand.getBlue(), 225));
    drawChevron(g, sx(1066), bandCenterY, sy(62), 96 * SX, rgba(segBand.getRed(), segBand.getGreen(), segBand.getBlue(), 135));

    // 当前站与上一站之间的方向箭头；方向在整个区间内保持不变。
    if (marker != start && step > 0) {
        drawStationArrow(g, arrowCenter, bandCenterY, sr(46), direction,
            (ARROW_BLINK_PHASE_LOCK == 1) ? 1 : 0, step);
    }

    for (let i = 0; i < windowSize; i++) {
        let idx = start + i;
        let cx = innerLeft + step * i;
        let current = idx == marker;
        g.setColor(COLOR_WHITE);
        g.fillOval(Math.round(cx - radius - sr(2)), Math.round(bandCenterY - radius - sr(2)),
            Math.round((radius + sr(2)) * 2), Math.round((radius + sr(2)) * 2));
        let passed = (direction > 0) ? (idx < marker) : (idx > marker);
        g.setColor(current ? CURRENT_ROUTE_COLOR : (passed ? segBand : COLOR_WHITE));
        g.fillOval(Math.round(cx - radius), Math.round(bandCenterY - radius),
            Math.round(radius * 2), Math.round(radius * 2));
        g.setColor(current ? COLOR_WHITE : segEdge);
        g.setStroke(new BasicStroke(Math.max(1, sr(1.5))));
        g.drawOval(Math.round(cx - radius), Math.round(bandCenterY - radius),
            Math.round(radius * 2), Math.round(radius * 2));
        g.setStroke(new BasicStroke(1));

        let name = getStationCjk(stations[idx]);
        let pinyin = getStationEn(stations[idx]);
        let nameSize = fitFontSize(g, SANS_MEDIUM, name, step * 0.94, 0, sy(38), sy(18));
        g.setFont(mapFont(nameSize));
        g.setColor(COLOR_TEXT);
        drawStringCentered(g, name, cx, sy(608) + nameSize * 0.35);
        if (pinyin.length > 0) {
            let pinyinSize = fitFontSize(g, SANS_MEDIUM, pinyin, step * 0.94, 0, sy(24), sy(12));
            g.setFont(sansFont(pinyinSize));
            g.setColor(COLOR_TEXT_SOFT);
            drawStringCentered(g, pinyin, cx, sy(652) + pinyinSize * 0.35);
        }
    }
}

function drawChevron(g, x, centerY, size, length, color) {
    let pts = [
        [x, centerY - size / 2],
        [x + length, centerY],
        [x, centerY + size / 2],
        [x + length * 0.34, centerY]
    ];
    g.setColor(color);
    fillPolygon(g, pts, 0, 0);
}

/* ============================== 编组图 ============================== */

function drawConsist(g, ctx) {
    let left = sx(35);
    let right = sx(1000);
    let top = sy(500);
    let height = sy(82);
    let bottom = top + height;
    let pointY = top + height * 0.88;
    let lineY = top + height * 0.50;
    let carWidth = (right - left) / CONSIST_CARS;
    let station = getStationInfo(ctx.routeInfo, ctx.routeInfo.nextStationIndex);
    if (station != null) {
        drawInterchangeNotice(g, station, getStationCjk(station), WIDTH / 2, sy(478),
            CURRENT_ROUTE_COLOR, sy(28));
    }
    // 编组越多，车头越短，避免 1/8 号数字落进车头尖角里。
    let nose = Math.min(sx(75), carWidth * 0.42);
    let bodyLeft = left + nose;
    let bodyRight = right - nose;

    // 车体：一端为低车头尖点，顶部平直，尾部同样收尖
    let body = new GeneralPath();
    body.moveTo(left, pointY);
    body.quadTo(bodyLeft - sx(30), top, bodyLeft, top);
    body.lineTo(bodyRight, top);
    body.quadTo(bodyRight + sx(30), top, right, pointY);
    body.lineTo(right, pointY);
    body.quadTo(bodyRight + sx(30), bottom, bodyRight, bottom);
    body.lineTo(bodyLeft, bottom);
    body.quadTo(bodyLeft - sx(30), bottom, left, pointY);
    body.closePath();

    g.setColor(blend(CURRENT_ROUTE_COLOR, COLOR_WHITE, 0.92));
    g.fill(body);
    g.setColor(CURRENT_ROUTE_COLOR);
    g.setStroke(new BasicStroke(Math.max(1.5, sr(2))));
    g.draw(body);
    g.setStroke(new BasicStroke(1));

    let numberSize = fitFontSize(g, roundFont(sy(46)), String(CONSIST_CARS),
        carWidth * 0.64, height * 0.94, sy(46), sy(18));

    for (let i = 0; i < CONSIST_CARS; i++) {
        let carLeft = left + carWidth * i;
        let carRight = carLeft + carWidth;
        let cx = carLeft + carWidth / 2;

        if (i > 0) {
            g.setColor(CURRENT_ROUTE_COLOR);
            g.setStroke(new BasicStroke(Math.max(1, sr(1.6))));
            g.drawLine(Math.round(carLeft), Math.round(top + sy(4)),
                Math.round(carLeft), Math.round(bottom - sy(4)));
            g.setStroke(new BasicStroke(1));
        }

        let number = String(i + 1);
        g.setFont(roundFont(numberSize));
        let numberWidth = g.getFontMetrics().stringWidth(number);

        // 腰线在数字处断开，不额外画数字底色
        g.setColor(CURRENT_ROUTE_COLOR);
        g.setStroke(new BasicStroke(Math.max(1, sr(1.2))));
        let lineLeft = (i == 0) ? left + sx(8) : carLeft + sx(4);
        let lineRight = (i == CONSIST_CARS - 1) ? right - sx(8) : carRight - sx(4);
        if (lineLeft < cx - numberWidth / 2 - sx(6)) {
            g.drawLine(Math.round(lineLeft), Math.round(pointY),
                Math.round(cx - numberWidth / 2 - sx(6)), Math.round(pointY));
        }
        if (lineRight > cx + numberWidth / 2 + sx(6)) {
            g.drawLine(Math.round(cx + numberWidth / 2 + sx(6)), Math.round(pointY),
                Math.round(lineRight), Math.round(pointY));
        }
        g.setStroke(new BasicStroke(1));

        g.setColor(i == 0 ? CURRENT_ROUTE_COLOR : COLOR_TEXT);
        drawStringCentered(g, number, cx, lineY + numberSize * 0.35);
    }

    // 站台标记
    g.setColor(CURRENT_ROUTE_COLOR);
    g.setFont(roundFont(sy(28)));
    drawText(g, "站", sx(105), sy(650));
    drawText(g, "台", sx(105), sy(692));
    g.setStroke(new BasicStroke(Math.max(1, sr(1.5))));
    let platformTop = bottom + sy(18);
    g.drawLine(Math.round(sx(170)), Math.round(platformTop), Math.round(sx(170)), Math.round(platformTop + sy(100)));
    g.setStroke(new BasicStroke(1));
}

/* ============================== 车门 ============================== */

const DOOR_MODE_OPEN = "open";
const DOOR_MODE_OPENING = "opening";
const DOOR_MODE_BLOCKED = "blocked";
const DOOR_MODE_ARRIVED_CLOSED = "arrived_closed";

function getDoorMode(arrived, willOpen, openNow) {
    if (arrived) {
        return openNow ? DOOR_MODE_OPEN : DOOR_MODE_ARRIVED_CLOSED;
    }
    return willOpen ? DOOR_MODE_OPENING : DOOR_MODE_BLOCKED;
}

function getStaticDoorFraction(mode) {
    return (mode == DOOR_MODE_OPEN) ? 1 : 0;
}

// 开门只做一次平滑展开并保持，不再用三角波反复开合（那会看起来像门在互相冲撞）。
const DOOR_ANIM_DURATION = 2.0;
let DOOR_ANIM_STATE = {};
let DOOR_PREVIEW_FRACTION = null;

function setDoorPreviewFraction(value) {
    DOOR_PREVIEW_FRACTION = (value == null) ? null : Number(value);
}

function getDoorFraction(mode, animFraction) {
    return (mode == DOOR_MODE_OPEN) ? 1 : 0;
}

function getDoorFractionForLayout(layout, mode) {
    if (DOOR_PREVIEW_FRACTION != null) {
        return Math.max(0, Math.min(1, DOOR_PREVIEW_FRACTION));
    }
    let key = (layout == null) ? "single" : String(layout);
    if (mode != DOOR_MODE_OPEN) {
        DOOR_ANIM_STATE[key] = null;
        return 0;
    }
    let now = getGameTime();
    let state = DOOR_ANIM_STATE[key];
    if (state == null) {
        state = {start: now};
        DOOR_ANIM_STATE[key] = state;
    }
    // 开门动画 2 秒一轮；门保持开启期间不断重复，直到模式变成关门。
    let elapsed = now - state.start;
    let t = (elapsed % DOOR_ANIM_DURATION) / DOOR_ANIM_DURATION;
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
}

function getDoorAnimationFraction() {
    let phase = getGameTime() % DOOR_ANIMATION_PERIOD;
    if (phase < 0) phase += DOOR_ANIMATION_PERIOD;
    return (phase < 0.5) ? (phase * 2) : (2 - phase * 2);
}

function getDoorPanelText(mode) {
    if (mode == DOOR_MODE_OPEN) {
        return {cjk: ["此门已开启", "请下车的乘客按顺序下车"], en: "Doors on this side have been opened"};
    }
    if (mode == DOOR_MODE_OPENING) {
        return {cjk: ["将开启此门", "请等候"], en: "Doors on this side will be opened"};
    }
    if (mode == DOOR_MODE_ARRIVED_CLOSED) {
        return {cjk: ["此门不开", "请到对门下车"], en: "Doors on the opposite side have been opened"};
    }
    return {cjk: ["此门不开", "请到对门等候"], en: "Doors on the opposite side will be opened"};
}

function drawDoorPanel(g, routeColor, mode, openFraction, layout) {
    ensureFonts();
    let fraction = DOOR_ANIMATION ? getDoorFractionForLayout(layout, mode)
        : getDoorFraction(mode, openFraction);
    withSafeArea(g, function (safeGraphics) {
        drawDoorPanelBody(safeGraphics, routeColor, mode, fraction);
    });
}

function drawDoorPanelBody(g, routeColor, mode, openFraction) {
    let text = getDoorPanelText(mode);
    let doorW = sx(142);
    let doorH = sy(310);
    let centerX = sx(749);
    let doorTop = sy(430);
    let gapMin = sx(4);
    let gap = gapMin + (sx(56) - gapMin) * openFraction;
    let leftX = centerX - doorW - gap / 2;
    let rightX = centerX + gap / 2;

    drawDoorLeaf(g, leftX, doorTop, doorW, doorH);
    drawDoorLeaf(g, rightX, doorTop, doorW, doorH);

    if (mode == DOOR_MODE_BLOCKED || mode == DOOR_MODE_ARRIVED_CLOSED) {
        let banLeft = leftX;
        let banRight = rightX + doorW;
        let banTop = doorTop + doorH * 0.52;
        let banHeight = sy(40);
        g.setColor(COLOR_WHITE);
        g.fillRoundRect(Math.round(banLeft - sx(5)), Math.round(banTop - sy(5)),
            Math.round(banRight - banLeft + sx(10)), Math.round(banHeight + sy(10)),
            Math.round(banHeight), Math.round(banHeight));
        g.setColor(COLOR_BAN);
        g.fillRoundRect(Math.round(banLeft), Math.round(banTop),
            Math.round(banRight - banLeft), Math.round(banHeight),
            Math.round(banHeight), Math.round(banHeight));
    }
    if (mode == DOOR_MODE_OPEN && openFraction > 0.70) {
        drawUpArrow(g, centerX, doorTop + doorH - sy(24), sx(54), sy(32));
    }

    // 文字：字号 30 / 字距 13，英文按目标宽度自动补字距
    let cjkSize = sy(30);
    let cjkFont = sansFont(cjkSize);
    g.setFont(cjkFont);
    let lineBaseline = sy(534);
    g.setColor(shade(routeColor, 0.10));
    for (let i = 0; i < text.cjk.length; i++) {
        drawSpacedTextLeft(g, text.cjk[i], sx(50), lineBaseline + i * sy(48), sx(13));
    }

    let enSize = sy(20);
    let enFont = sansFont(enSize);
    g.setFont(enFont);
    let targetWidth = sx(470);
    let baseWidth = 0;
    for (let i = 0; i < text.en.length; i++) {
        baseWidth += g.getFontMetrics().stringWidth(text.en.charAt(i));
    }
    let enTracking = Math.max(0, Math.min(sx(4),
        (targetWidth - baseWidth) / Math.max(1, text.en.length - 1)));
    let enBaseline = sy(619);
    g.setColor(blend(routeColor, COLOR_WHITE, 0.16));
    drawSpacedTextLeft(g, text.en, sx(52), enBaseline, enTracking);
}

function drawDoorLeaf(g, x, y, width, height) {
    // 阴影 + 淡蓝光晕
    g.setColor(rgba(23, 78, 135, 34));
    g.fillRoundRect(Math.round(x + sx(3)), Math.round(y + sy(5)),
        Math.round(width), Math.round(height), Math.round(sr(28)), Math.round(sr(28)));
    g.setColor(rgba(170, 211, 244, 34));
    g.fillRoundRect(Math.round(x - sx(4)), Math.round(y - sy(4)),
        Math.round(width + sx(8)), Math.round(height + sy(8)),
        Math.round(sr(28)), Math.round(sr(28)));

    // 门板多段渐变
    let fractions = [0.0, 0.02, 0.055, 0.24, 0.55, 0.75, 1.0];
    let colors = [rgb(235, 244, 255), rgb(170, 196, 224), rgb(180, 209, 242),
        rgb(88, 152, 217), rgb(127, 177, 227), rgb(181, 210, 238), rgb(246, 249, 253)];
    let oldClip = g.getClip();
    g.setClip(new RoundRectangle2D.Float(x, y, width, height, sr(20), sr(20)));
    let fractionArray = java.lang.reflect.Array.newInstance(java.lang.Float.TYPE, fractions.length);
    for (let i = 0; i < fractions.length; i++) fractionArray[i] = fractions[i];
    let colorArray = java.lang.reflect.Array.newInstance(java.awt.Color, colors.length);
    for (let i = 0; i < colors.length; i++) colorArray[i] = colors[i];
    g.setPaint(new LinearGradientPaint(0, y, 0, y + height, fractionArray, colorArray));
    g.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
    g.setClip(oldClip);

    g.setColor(rgb(204, 228, 246));
    g.setStroke(new BasicStroke(Math.max(1, sr(0.8))));
    g.drawRoundRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height),
        Math.round(sr(20)), Math.round(sr(20)));
    g.setStroke(new BasicStroke(1));

    // 车窗
    let wx = x + sx(20);
    let wy = y + sy(24);
    let ww = width - sx(40);
    let wh = sy(171);
    g.setColor(rgb(0, 105, 197));
    g.fillRoundRect(Math.round(wx), Math.round(wy), Math.round(ww), Math.round(wh),
        Math.round(sr(16)), Math.round(sr(16)));
    g.setColor(rgb(0, 96, 183));
    g.setStroke(new BasicStroke(Math.max(1, sr(0.5))));
    g.drawRoundRect(Math.round(wx), Math.round(wy), Math.round(ww), Math.round(wh),
        Math.round(sr(16)), Math.round(sr(16)));
    g.setStroke(new BasicStroke(1));
}

function drawUpArrow(g, centerX, top, width, height) {
    let pts = [
        [centerX, top],
        [centerX + width / 2, top + height * 0.46],
        [centerX + width * 0.18, top + height * 0.46],
        [centerX + width * 0.18, top + height],
        [centerX - width * 0.18, top + height],
        [centerX - width * 0.18, top + height * 0.46],
        [centerX - width / 2, top + height * 0.46]
    ];
    g.setColor(COLOR_GREEN);
    fillPolygon(g, pts, 0, 0);
}

/* ============================== 闪动 / 兼容 ============================== */

const ARROW_BLINK = true;
const ARROW_BLINK_PERIOD = 1.0;
let ARROW_BLINK_PHASE_LOCK = null;

function getArrowBlinkPhase() {
    let phase = Math.floor(getGameTime() / ARROW_BLINK_PERIOD) % 2;
    return (phase < 0) ? 0 : phase;
}

const LAYOUT_LEFT_SCREEN = "left";
const LAYOUT_RIGHT_SCREEN = "right";

/* ============================== 无路线 ============================== */

function drawNoRouteScreen(g) {
    g.setColor(rgb(120, 0, 8));
    g.fillRect(0, 0, WIDTH, HEIGHT);
    g.setColor(COLOR_WHITE);
    g.setFont(roundFont(sy(42)));
    drawStringCentered(g, "本车厂没有设置有效路线", WIDTH / 2, HEIGHT / 2 - sy(24));
    g.setColor(rgba(255, 255, 255, 210));
    g.setFont(roundFont(sy(26)));
    drawStringCentered(g, "请在铁路仪表板中刷新路线，然后清除列车", WIDTH / 2, HEIGHT / 2 + sy(36));
    g.setFont(sansFont(sy(18)));
    g.setColor(rgba(255, 255, 255, 160));
    drawStringCentered(g, "This depot has not set a valid route.", WIDTH / 2, HEIGHT / 2 + sy(82));
}

function drawFooter(g) {
    g.setColor(rgb(0, 135, 189));
    g.fillRect(0, Math.round(HEIGHT - sy(1.5)), WIDTH, Math.max(1, Math.round(sy(1.5))));
}
