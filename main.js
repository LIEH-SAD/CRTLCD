/*
 * LCD 的入口脚本：给列车挂上动态贴图，每帧决定画什么。
 *
 * main.js（本文件）负责显示屏的位置、每节车厢的贴图、页面切换与开门动画；
 * 版面怎么画在 draw.js，数据从哪来在 mtr_util.js。
 * 车厢编号与车门面板是逐节车厢各画一次的，其余页面两块屏共用一张离屏画布。
 */

importPackage(java.awt);
importPackage(java.awt.geom);

include(Resources.id("mtrsteamloco:scripts/display_helper.js"));
include("draw.js");
include("mtr_util.js");

/* ============================== 显示屏位置 ============================== */

// 贴图尺寸跟随 config.json 的 lcdSize，换屏幕比例时只改那里。
// 每节车厢各一张贴图才能显示各自的车厢编号；一张贴图只保留左右两块屏的面积。
// pos 的四个角按「左上、左下、右下、右上」给出，offsets 把这块屏复制到 4 个车门上方。
let slotCfg = {
    "version": 1,
    "texSize": [WIDTH, HEIGHT * 2],
    "slots": [
      {
        "name": "lcd_door_left",
        "texArea": [0, 0, WIDTH, HEIGHT],
        "pos": [
          [ [1.13, 2.27, -0.58], [1.18, 2.13, -0.58], [1.18, 2.13, 0.58], [1.13, 2.27, 0.58]]
        ],
        "offsets": [[0, 0, -2.5], [0, 0, -7.5], [0, 0, 2.5], [0, 0, 7.5]]
      },
      {
        "name": "lcd_door_right",
        "texArea": [0, HEIGHT, WIDTH, HEIGHT],
        "pos": [
          [ [-1.13, 2.27, 0.58], [-1.18, 2.13, 0.58], [-1.18, 2.13, -0.58], [-1.13, 2.27, -0.58]]
        ],
        "offsets": [[0, 0, -2.5], [0, 0, -7.5], [0, 0, 2.5], [0, 0, 7.5]]
      }
    ]
  };

var dhBase = new DisplayHelper(slotCfg);

/* ============================== 长宽比自检 ============================== */

/**
 * 显示屏的实际长宽比。pos 的四个角依次是左上、左下、右下、右上，
 * 所以「左上→右上」是屏幕宽，「左上→左下」是屏幕高。
 */
function getDisplayAspect(cfg) {
    let quad = cfg.slots[0].pos[0];
    let width = cornerDistance(quad[0], quad[3]);
    let height = cornerDistance(quad[0], quad[1]);
    return (height <= 0) ? 0 : (width / height);
}

/** 两个三维点之间的距离。 */
function cornerDistance(a, b) {
    let dx = a[0] - b[0];
    let dy = a[1] - b[1];
    let dz = a[2] - b[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// 贴图长宽比和显示屏对不上时画面会被拉伸（文字变宽、圆点变椭圆），
// 这里在日志里直接给出该填的 lcdSize，换车时照着改 config.json 就行。
try {
    let displayAspect = getDisplayAspect(slotCfg);
    let textureAspect = WIDTH / HEIGHT;
    if (displayAspect > 0 && Math.abs(textureAspect / displayAspect - 1) > 0.02) {
        print("LCD：贴图长宽比 " + textureAspect.toFixed(3) + " 与显示屏 " + displayAspect.toFixed(3)
            + " 不一致，画面会被拉伸；建议把 config.json 的 lcdSize 改成 ["
            + Math.round(HEIGHT * displayAspect) + ", " + HEIGHT + "]");
    } else {
        print("LCD：贴图长宽比 " + textureAspect.toFixed(3) + " 与显示屏 " + displayAspect.toFixed(3) + " 一致，画面不会被拉伸");
    }
} catch (error) {
    print("LCD：无法计算显示屏长宽比，" + error);
}

/* ============================== 两块屏的布局 ============================== */

// 右侧屏按模块镜像，各模块的策略见 draw.js 的 MODULE_MIRROR_DEFAULT 与 config.json
var LAYOUT_LEFT_SCREEN = createLayout(false);
var LAYOUT_RIGHT_SCREEN = createLayout(MIRROR_RIGHT_SCREEN);

/* ============================== ANTE 入口 ============================== */

/**
 * 建立一块动态贴图屏。
 * ANTE 的 create() 如果被打断（例如资源重载时脚本线程被重启），出来的实例会缺 slotTransforms，
 * 之后每次 graphicsFor() 都抛异常，画面就再也不更新。所以这里先试一次画笔，拿不到就当失败。
 * @return {DisplayHelper} 可用的屏，失败时返回 null。
 */
function createScreen() {
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            let screen = dhBase.create();
            if (screen != null && screen.graphicsFor("lcd_door_left") != null) {
                return screen;
            }
        } catch (error) {
            printDebug("创建显示屏失败（第 " + (attempt + 1) + " 次）：" + error);
        }
    }
    return null;
}

/**
 * 建好 state.screens（每节车厢一块，或全列共用一块）。
 * @return {Number} 实际建好的屏数量，0 表示这次没建成。
 */
function createScreens(state, train) {
    state.screens = [];
    let screenCount = usePerCarScreen() ? train.trainCars() : 1;
    for (let i = 0; i < screenCount; i++) {
        let screen = createScreen();
        if (screen == null) {
            break; // 建不出来就先用已有的，下一帧再试
        }
        state.screens.push(screen);
    }
    state.canvasDirty = true;   // 屏换了，整页要重画
    return state.screens.length;
}

/** 关掉并清空 state.screens，出错时也不影响别的车厢。 */
function disposeScreens(state) {
    if (state.screens == null) {
        return;
    }
    for (let i = 0; i < state.screens.length; i++) {
        try {
            state.screens[i].close();
        } catch (error) {
            // 已经坏了，忽略
        }
    }
    state.screens = [];
}

function create(ctx, state, train) {
    createScreens(state, train);

    // 公共页面先画到离屏画布，再逐节车厢贴过去，避免每节车厢都重画一遍线路图
    state.canvasLeft = new java.awt.image.BufferedImage(WIDTH, HEIGHT, java.awt.image.BufferedImage.TYPE_INT_ARGB);
    state.canvasRight = new java.awt.image.BufferedImage(WIDTH, HEIGHT, java.awt.image.BufferedImage.TYPE_INT_ARGB);
    state.graphicsLeft = state.canvasLeft.createGraphics();
    state.graphicsRight = state.canvasRight.createGraphics();
    state.canvasDirty = true;
    // 开门动画的重画频率（1 秒一次开合，这里限制每秒重画次数）
    state.animRate = new RateLimit(1.0 / DOOR_ANIMATION_FPS);
    state.repaintCount = 0;
    printDebug("create 车=" + train.id() + " 屏=" + state.screens.length);
}

function dispose(ctx, state, train) {
    disposeScreens(state);
    if (state.graphicsLeft != null) {
        state.graphicsLeft.dispose();
        state.graphicsLeft = null;
    }
    if (state.graphicsRight != null) {
        state.graphicsRight.dispose();
        state.graphicsRight = null;
    }
    state.canvasLeft = null;
    state.canvasRight = null;
    printDebug("dispose 车=" + train.id());
}

/** 是否每节车厢各用一张贴图（这样能显示各自的车厢编号）。 */
function usePerCarScreen() {
    return PER_CAR_COACH_NUMBER && SHOW_COACH_NUMBER;
}

/**
 * 取某节车厢要用的屏。屏还没建好或建坏了时返回 null，由调用方决定怎么办。
 */
function screenAt(state, index) {
    if (state.screens == null || index < 0 || index >= state.screens.length) {
        return null;
    }
    return state.screens[index];
}

/* ============================== 渲染 ============================== */

function render(ctx, state, train) {
    let cars = train.trainCars();
    let perCar = usePerCarScreen();
    for (let i = 0; i < cars; i++) {
        let screen = screenAt(state, perCar ? i : 0);
        if (screen != null) {
            ctx.drawCarModel(screen.model, i, null);
        }
    }

    if (!train.shouldRender() || !train.shouldRenderDetail()) {
        return;
    }

    let trainStatus = getTrainStatus(train);
    let arrived = (trainStatus == STATUS_ARRIVED);
    let reversed = train.isReversed();
    // 到站时 MTR 会如实报左右门有没有开（原始值，不含 flipDoorSides 的翻转）
    let rawLeftDoorOpen = isAnyDoorOpen(train.doorLeftOpen);
    let rawRightDoorOpen = isAnyDoorOpen(train.doorRightOpen);
    let leftDoorOpen = FLIP_DOOR_SIDES ? rawRightDoorOpen : rawLeftDoorOpen;
    let rightDoorOpen = FLIP_DOOR_SIDES ? rawLeftDoorOpen : rawRightDoorOpen;
    let nextDoorSide = arrived ? null : doorSideFor(state.routeInfo, reversed);
    let leftDoorWillOpen = (nextDoorSide == null) ? (FLIP_DOOR_SIDES ? !reversed : reversed) : (nextDoorSide == "left");
    let rightDoorWillOpen = (nextDoorSide == null) ? (FLIP_DOOR_SIDES ? reversed : !reversed) : (nextDoorSide == "right");
    let needRepaint = false;
    let repaintReason = "";

    // 到站开门时把「这个站台、这个行驶方向开哪一侧」记下来：
    // 折返时行驶方向会变而车头不变，只有按方向记才能给出正确的车门提示。
    if (arrived && state.routeInfo != null && (rawLeftDoorOpen || rawRightDoorOpen)) {
        rememberDoorSide(state.routeInfo, rawLeftDoorOpen ? "left" : "right");
    }

    if (arrived) {
        // 到站页不计入 10s 循环；出站后会重建计时器，从「全线线路图」重新开始
        if (state.pageTracker != null) {
            state.pageTracker = null;
            needRepaint = true;
            state.canvasDirty = true;
            repaintReason = "到站";
        }
    } else if (state.pageTracker == null) {
        state.pageTracker = new CycleTracker([SCREEN_FULL_ROUTE_MAP, PAGE_DURATION, SCREEN_NEXT_STATION, PAGE_DURATION]);
        state.pageTracker.tick();
        needRepaint = true;
        state.canvasDirty = true;
        repaintReason = "出站重新计时";
    } else {
        state.pageTracker.tick();
        if (state.pageTracker.stateNowFirst()) { // 刚好切到新的一页
            needRepaint = true;
            state.canvasDirty = true;
            repaintReason = "换页";
        }
    }

    if (!checkProperty(state, "trainStatus", trainStatus)) {
        print("列车 " + train.id() + " 的状态更新为：" + trainStatus + describeTrainRoute(train));
        state.trainStatus = trainStatus;
        needRepaint = true;
        state.canvasDirty = true;
        repaintReason = "状态变化";
    }
    if (state.leftDoorOpen != leftDoorOpen || state.rightDoorOpen != rightDoorOpen) {
        state.leftDoorOpen = leftDoorOpen;
        state.rightDoorOpen = rightDoorOpen;
        if (arrived) { // 「已到达」页需要跟随车门开闭更新
            needRepaint = true;
            repaintReason = "车门";
        }
    }
    if (routeInfoChanged(state, train, trainStatus)) {
        needRepaint = true;
        state.canvasDirty = true;
        repaintReason = "路线信息";
    }

    let pageType = arrived ? SCREEN_ARRIVED : ((state.pageTracker == null) ? SCREEN_ARRIVED : String(state.pageTracker.stateNow()));
    let leftDoorMode = getDoorMode(arrived, leftDoorWillOpen, leftDoorOpen);
    let rightDoorMode = getDoorMode(arrived, rightDoorWillOpen, rightDoorOpen);

    // 只有本侧车门已经打开时才播放开门动画（1 秒一次开合）；「将开启／不开启」都是静止的
    let animating = DOOR_ANIMATION && (leftDoorMode == DOOR_MODE_OPEN || rightDoorMode == DOOR_MODE_OPEN);
    if (animating && state.animRate.shouldUpdate()) {
        needRepaint = true;
        if (repaintReason.length == 0) {
            repaintReason = "开门动画";
        }
    }

    if (!needRepaint) {
        return;
    }

    // 屏要是丢了或建坏了，这里补建，补建完这一帧先不画，下一帧再画
    if (state.screens == null || state.screens.length == 0) {
        if (createScreens(state, train) == 0) {
            return;
        }
    }

    // 公共页面（不含车门面板与车厢编号）只在换页、换路线、换状态时重画
    // 右侧屏按模块镜像：版面翻到另一侧，文字仍然正向
    if (state.canvasDirty) {
        drawScreen(state.graphicsLeft, state.routeInfo, trainStatus, pageType, leftDoorWillOpen, leftDoorOpen, 0, false, false);
        drawScreen(state.graphicsRight, state.routeInfo, trainStatus, pageType, rightDoorWillOpen, rightDoorOpen, 0, false, MIRROR_RIGHT_SCREEN);
        state.canvasDirty = false;
    }

    // 逐节车厢：贴公共页面 + 画本侧车门面板（可动画） + 补画本车厢的车厢编号
    let noRoute = (state.routeInfo == null);
    let showDoorPanel = !noRoute && (pageType != SCREEN_FULL_ROUTE_MAP); // 线路图页没有车门面板
    let routeColor = noRoute ? Color.WHITE : state.routeInfo.routeColor;
    let animFraction = getDoorAnimationFraction();
    try {
        for (let i = 0; i < state.screens.length; i++) {
            let coachNumber = perCar ? (i + 1) : cars; // 不分车厢时显示编组总数

            let g = state.screens[i].graphicsFor("lcd_door_left");
            g.drawImage(state.canvasLeft, 0, 0, null);
            if (showDoorPanel) {
                drawDoorPanel(g, routeColor, leftDoorMode, getDoorFraction(leftDoorMode, animFraction), LAYOUT_LEFT_SCREEN);
            }
            if (!noRoute) {
                drawCoachNumberPlate(g, pageType, coachNumber, LAYOUT_LEFT_SCREEN);
            }

            g = state.screens[i].graphicsFor("lcd_door_right");
            g.drawImage(state.canvasRight, 0, 0, null);
            if (showDoorPanel) {
                drawDoorPanel(g, routeColor, rightDoorMode, getDoorFraction(rightDoorMode, animFraction), LAYOUT_RIGHT_SCREEN);
            }
            if (!noRoute) {
                drawCoachNumberPlate(g, pageType, coachNumber, LAYOUT_RIGHT_SCREEN);
            }

            state.screens[i].upload();
        }
    } catch (error) {
        // 贴图在这一帧坏了（例如 ANTE 的 create() 被打断过），重建后下一帧继续画。
        // 这样不用等列车回车厂也能自己恢复。
        printDebug("绘制显示屏出错，重建：" + error);
        disposeScreens(state);
        return;
    }

    state.repaintCount = (state.repaintCount == null) ? 1 : (state.repaintCount + 1);
    printDebug("重画[" + repaintReason + "] 车=" + train.id() + " 页=" + pageType
        + " 下一站序号=" + ((state.routeInfo == null) ? "-" : state.routeInfo.nextStationIndex)
        + " 累计=" + state.repaintCount);
}

/* ============================== 数据 ============================== */

// 路线信息最多隔多久重建一次（秒）。
// 光靠「下一站变了」判断不够：MTR 的线路、换乘数据随时可能变（改线路、联机同步），
// 那样就只能等列车回车厂才刷新。定时重建再比对内容，才能及时跟上。
const ROUTE_REFRESH_INTERVAL = 3;

/** 取路线信息的内容特征，用来判断重建出来的东西是不是真的变了。 */
function routeSignature(routeInfo) {
    if (routeInfo == null) {
        return "";
    }
    let parts = [String(routeInfo.routeName), String(routeInfo.destination), String(routeInfo.nextStationIndex),
        String(routeInfo.travelDirection)];
    let stations = routeInfo.stationInfoList;
    for (let i = 0; i < stations.length; i++) {
        parts.push(String(stations[i].stationName) + "/" + stations[i].interchangeInfo.length);
    }
    return parts.join(",");
}

/**
 * 按需更新 state.routeInfo，并返回路线信息有没有变化。
 * 换站、换线路都会立刻重建；此外每隔 ROUTE_REFRESH_INTERVAL 秒无条件重建一次，
 * 比对内容特征后才决定要不要重画，这样线路改动、联机同步过来的数据也能自己更新。
 * @return {Boolean} 路线信息是否发生变化。
 */
function routeInfoChanged(state, train, trainStatus) {
    let now = getGameTime();
    let dueCheck = (state.routeCheckedAt == null) || (now - state.routeCheckedAt >= ROUTE_REFRESH_INTERVAL);
    let platformInfo = getNextPlatformInfo(train, trainStatus);

    if (platformInfo == null) {
        state.routeCheckedAt = now;
        let changed = (state.routeInfo != null);
        state.routeInfo = null;
        state.routeId = null;
        state.platformId = null;
        state.routeSignature = "";
        return changed;
    }

    let routeId = String(platformInfo.route.id);
    let platformId = String(platformInfo.platform.id);
    let keyChanged = !(state.routeInfo != null && state.routeId == routeId && state.platformId == platformId);
    if (!keyChanged && !dueCheck) {
        return false;
    }

    state.routeCheckedAt = now;
    let routeInfo = getRouteInfo(train, trainStatus, platformInfo);
    let signature = routeSignature(routeInfo);
    let changed = keyChanged || (signature != state.routeSignature);

    state.routeInfo = routeInfo;
    state.routeId = routeId;
    state.platformId = platformId;
    state.routeSignature = signature;

    if (routeInfo != null && (changed || keyChanged)) {
        print("列车 " + train.id() + " 的路线信息：" + routeInfo.routeName
            + "，下一站序号 " + routeInfo.nextStationIndex + "／共 " + routeInfo.stationInfoList.length + " 站");
    }
    return changed;
}

/** 判断某侧车门是否有任意一节车厢已开启。 */
function isAnyDoorOpen(doorArray) {
    if (doorArray == null) {
        return false;
    }
    for (let i = 0; i < doorArray.length; i++) {
        if (doorArray[i]) {
            return true;
        }
    }
    return false;
}

/**
 * 排查用：说明列车现在的路径情况。
 * no_route 有两种可能——列车根本没有路径（没派车/车厂没连到线路），或者线路数据没读到，
 * 这一行能把两者区分开。
 */
function describeTrainRoute(train) {
    try {
        return "（路径 " + train.getAllPlatforms().size() + " 站，本线路 "
            + train.getThisRoutePlatforms().size() + " 站，下一站指针 "
            + train.getThisRoutePlatformsNextIndex() + "，isOnRoute=" + train.isOnRoute() + "）";
    } catch (error) {
        return "";
    }
}
