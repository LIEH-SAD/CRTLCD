/*
 * 数据层：从 MTR 的数据缓存里取出这一趟车要显示的路线与车站信息。
 *
 * main.js 每帧只调用 getTrainStatus() 与 getRouteInfo()，
 * 换来换去的数据都在这里整理成 draw.js 好用的形状（RouteInfo）。
 * MTR 的地图缓存键是 64 位随机数，取值统一走 getMapValueByKey()。
 */

importPackage(java.awt);

include("js_util.js");

/* ============================== 配置 ============================== */

// 数据层用到的 config.json 开关
let UTIL_CONFIG = readUtilConfig();
let ROUTE_MAP_REVERSE = (UTIL_CONFIG.routeMapReverse == true);   // 线路图站序是否整体反转
let DEBUG_LOG = (UTIL_CONFIG.debugLog == true);                  // 是否打印排查日志
let SHOW_HIDDEN_ROUTES = (UTIL_CONFIG.showHiddenRoutes == true); // 隐藏线路是否也算换乘（默认不算）

/** 读取 config.json，读不到时返回空对象。 */
function readUtilConfig() {
    try {
        return JSON.parse(Resources.readString(Resources.id("mtr:cqlcd/config.json")));
    } catch (error) {
        return {};
    }
}

/** 打印一行排查日志（在 config.json 里把 debugLog 打开才有输出）。 */
function printDebug(message) {
    if (DEBUG_LOG) {
        print("LCD：" + message);
    }
}

/* ============================== 状态 ============================== */

// 下面这些就是 getTrainStatus() 可能返回的状态
const STATUS_NO_ROUTE = "no_route";                          // 没有有效路线
const STATUS_WAITING_FOR_DEPARTURE = "waiting_for_departure"; // 在车厂里等发车
const STATUS_LEAVING_DEPOT = "leaving_depot";                // 正在出库
const STATUS_ON_ROUTE = "on_route";                          // 区间行驶中
const STATUS_ARRIVED = "arrived";                            // 停靠站台
const STATUS_CHANGING_ROUTE = "changing_route";              // 从终点站开往下一线路起点
const STATUS_RETURNING_TO_DEPOT = "returning_to_depot";      // 正在回库

/**
 * 获取列车状态。
 * @param {Train} train 要判断的列车。
 * @return {String} 上面某个 STATUS_* 常量。
 */
function getTrainStatus(train) {
    let trainStatus = null;
    let allCount = train.getAllPlatforms().size();
    let routeCount = train.getThisRoutePlatforms().size();
    if (allCount == 0 && routeCount == 0) {
        trainStatus = STATUS_NO_ROUTE;
    } else if (allCount == 0) {
        // 整条路径的数据没有读到（联机时见过这种），但本线路的车站是有的：
        // 按正常行驶处理，这样 LCD 还能靠本线路的数据画线路图，不会一直停在「没有路线」页。
        trainStatus = train.isOnRoute() ? STATUS_ON_ROUTE : STATUS_WAITING_FOR_DEPARTURE;
    } else if (!train.isOnRoute()) {
        trainStatus = STATUS_WAITING_FOR_DEPARTURE;
    } else if (train.getAllPlatformsNextIndex() == allCount) {
        trainStatus = STATUS_RETURNING_TO_DEPOT;
    } else if (train.railProgress() == train.getAllPlatforms().get(train.getAllPlatformsNextIndex()).distance) {
        trainStatus = STATUS_ARRIVED;
    } else if (train.getAllPlatformsNextIndex() == 0) {
        trainStatus = STATUS_LEAVING_DEPOT;
    } else if (train.getThisRoutePlatformsNextIndex() == routeCount) {
        trainStatus = STATUS_CHANGING_ROUTE;
    } else {
        trainStatus = STATUS_ON_ROUTE;
    }
    return trainStatus;
}

/* ============================== 路线信息 ============================== */

/**
 * 获取列车的下一个路线。
 * @param {Train} train 要获取的列车。
 * @return {Route} 下一个路线；不存在或是隐藏路线时返回 null。
 */
function getNextRoute(train) {
    try {
        if (train.getAllPlatforms().get(train.getAllPlatforms().size() - 1) != train.getThisRoutePlatforms().get(train.getThisRoutePlatforms().size() - 1)) { // 列车路径的终点不是本线路终点，说明后面还要跑别的线
            let nextRoute = train.getAllPlatforms().get(train.getAllPlatforms().indexOf(train.getThisRoutePlatforms().size() - 1) + 1).route;
            return nextRoute.isHidden ? null : nextRoute;
        }
    } catch (error) {
        return null;
    }
    return null;
}

/**
 * 获取列车侧线所在的车厂。
 * @param {Train} train 要获取车厂的列车。
 * @return {Depot} 列车侧线所在的车厂。找不到时返回 null。
 */
function getDepot(train) {
    try {
        let siding = train.siding();
        return siding == null ? null : getMapValueByKeyStr(MTRClientData.DATA_CACHE.sidingIdToDepot, siding.id);
    } catch (error) {
        return null;
    }
}

/**
 * 获取列车将在下一站停靠的站台信息。
 * @param {Train} train 要获取信息的列车。
 * @param {String} trainStatus 列车状态，见 {@link getTrainStatus}。
 * @return {PlatformInfo} 站台信息。列车无有效路线时返回 null。
 */
function getNextPlatformInfo(train, trainStatus) {
    let allPlatforms = train.getAllPlatforms();
    let allCount = (allPlatforms == null) ? 0 : allPlatforms.size();
    switch (trainStatus) {
        case STATUS_NO_ROUTE:
            return null;
        case STATUS_RETURNING_TO_DEPOT:
            return (allCount > 0) ? allPlatforms.get(allCount - 1) : getThisRoutePlatform(train);
        case STATUS_WAITING_FOR_DEPARTURE:
            return (allCount > 0) ? allPlatforms.get(0) : getThisRoutePlatform(train);
        case STATUS_CHANGING_ROUTE:
            return (allCount > train.getAllPlatformsNextIndex())
                ? allPlatforms.get(train.getAllPlatformsNextIndex()) : getThisRoutePlatform(train);
        default:
            return getThisRoutePlatform(train);
    }
}

/**
 * 取本线路上下一个要停靠的站台信息。
 * 整条路径的数据没读到时也靠它兜底，所以单独抽出来。
 * @param {Train} train 要获取信息的列车。
 * @return {PlatformInfo} 站台信息，本线路也没有数据时返回 null。
 */
function getThisRoutePlatform(train) {
    let platforms = train.getThisRoutePlatforms();
    if (platforms == null || platforms.size() == 0) {
        return null;
    }
    let index = Math.max(0, Math.min(train.getThisRoutePlatformsNextIndex(), platforms.size() - 1));
    return platforms.get(index);
}

/**
 * 获取列车当前路线信息。
 * @param {Train} train 要获取路线信息的列车。
 * @param {String} trainStatus 列车状态，见 {@link getTrainStatus}。
 * @param {PlatformInfo} platformInfo 本次将要停靠的站台，见 {@link getNextPlatformInfo}。
 * @return {RouteInfo} 当前路线信息。注意如果列车状态为 {@link STATUS_RETURNING_TO_DEPOT}，则 stationInfoList 只含终点站与车厂。
 */
function getRouteInfo(train, trainStatus, platformInfo) {
    if (platformInfo == null) {
        return null;
    }

    let route = platformInfo.route;
    let nextRoute = getNextRoute(train);
    let depot = getDepot(train);
    let routeInfo = {
        routeName: String(route.name),
        routeColor: new Color(route.color & 0xFFFFFF),
        destination: String(platformInfo.destinationStation.name),
        depotName: (depot == null) ? "车厂|Depot" : String(depot.name),
        route: route,
        nextRoute: nextRoute,
        stationInfoList: [],
        nextStationIndex: 0,
        travelDirection: 0
    };

    if (trainStatus == STATUS_RETURNING_TO_DEPOT) { // 回库车的 stationInfoList 只含终点站与车厂
        beginRouteInfoBuild();
        routeInfo.stationInfoList.push({
            platformId: platformInfo.platform.id,
            stationName: String(platformInfo.station.name),
            interchangeInfo: getAllInterchangeRoutes(platformInfo.station, route, null)
        });
        routeInfo.stationInfoList.push({stationName: routeInfo.depotName, interchangeInfo: []});
        routeInfo.nextStationIndex = 1;
        printRouteDebug(route, routeInfo.stationInfoList);
        return routeInfo;
    }

    // 整条路线的全部车站（含本次列车路径之外的车站）
    beginRouteInfoBuild();
    let stationInfoList = getFullRouteStationInfoList(route, nextRoute);
    if (stationInfoList.length == 0) { // 兜底：直接使用列车路径上的车站
        ROUTE_DEBUG.usedFallback = true;
        stationInfoList = getTrainRouteStationInfoList(train, route, nextRoute);
    }
    routeInfo.stationInfoList = stationInfoList;

    let index = indexOfPlatformId(stationInfoList, platformInfo.platform.id);
    if (index < 0) {
        index = Math.max(0, Math.min(train.getThisRoutePlatformsNextIndex(), stationInfoList.length - 1));
    }
    routeInfo.nextStationIndex = index;
    routeInfo.travelDirection = resolveTravelDirection(train, route, stationInfoList, index);
    printRouteDebug(route, stationInfoList, routeInfo);
    return routeInfo;
}

/**
 * 按 config.json 的 debugLog 打印一行路线与换乘统计，排查「换乘不显示」「方向不对」时很有用：
 * 能看出平台有没有对到车站、缓存里有哪些线路、画出几个徽标，以及这次按哪个方向画。
 */
function printRouteDebug(route, stationInfoList, routeInfo) {
    if (!DEBUG_LOG) {
        return;
    }
    printDebug("路线 " + normalizeRouteName(route == null ? "" : route.name)
        + " 隐藏=" + (route != null && route.isHidden == true)
        + " 环形=" + (getCircularState(route) == null ? "无字段" : getCircularState(route))
        + " 平台命中 " + ROUTE_DEBUG.resolvedPlatforms + "/" + ROUTE_DEBUG.totalPlatforms
        + (ROUTE_DEBUG.usedFallback ? "（站表用了列车路径兜底）" : "")
        + "；方向=" + ((routeInfo == null) ? "?" : (routeInfo.travelDirection > 0 ? "递增" : "递减"))
        + "；" + getInterchangeDebugText(stationInfoList));
}

/**
 * 每列车记住上一次的「下一站序号」和这次判断出的方向，见 {@link resolveTravelDirection}。
 * 键是列车编号，值是 {routeName, count, firstId, lastId, nextIndex, direction}。
 */
let DIRECTION_MEMORY = {};

/**
 * 决定这次线路图按哪个方向画（1 = 站序递增，-1 = 站序递减）。
 *
 * 折返（不一定在终点站）时最容易出错：折返站的路线到此为止，列车剩下的路径可能只有 1 站，
 * 或者路线对象整个换成反方向那条，这时按「上一站 → 下一站」的序号根本算不出方向，
 * 一旦算成 0，站名条和线路图就会把「已过站 / 未到站」翻到对面，看上去就是方向全乱。
 *
 * 所以按下面的顺序判断：
 *   1. 下一站序号比上次大 1（或环形绕回起点）→ 递增；比上次小 1（折返后就是这样）→ 递减；
 *   2. 序号没动或跳太多，就用路线算式的结果；
 *   3. 算式也给不出（0）就沿用上一次的方向，别让画面突然翻面；
 *   4. 连记录都没有才默认递增（和线路图默认站序一致）。
 *
 * @param {Train} train 列车。
 * @param {Route} route 当前路线。
 * @param {Array} stationInfoList 线路图上的车站信息数组。
 * @param {Number} index 下一站在 stationInfoList 里的序号。
 * @return {Number} 1 或 -1，不会是 0。
 */
function resolveTravelDirection(train, route, stationInfoList, index) {
    let key = "";
    try {
        key = String(train.id());
    } catch (error) {
        key = "";
    }
    let routeName = normalizeRouteName(route == null ? "" : route.name);
    let count = stationInfoList.length;
    let firstId = String(stationInfoList[0].platformId);
    let lastId = String(stationInfoList[count - 1].platformId);
    let memory = (key.length == 0) ? null : DIRECTION_MEMORY[key];
    if (memory != null && (memory.routeName != routeName || memory.count != count
            || memory.firstId != firstId || memory.lastId != lastId)) {
        memory = null; // 换线、站表变了或者站序整个翻过来了，旧记录作废
    }

    let direction = 0;
    if (memory != null) {
        let last = count - 1;
        let step = index - memory.nextIndex;
        if (step == 1 || (memory.nextIndex == last && index == 0)) {
            direction = 1;   // 下一站往前挪了一站
        } else if (step == -1 || (memory.nextIndex == 0 && index == last)) {
            direction = -1;  // 下一站往回挪了一站：折返之后就是这种
        }
    }
    if (direction == 0) {
        direction = getTravelDirection(train, stationInfoList);
    }
    if (direction == 0 && memory != null) {
        direction = memory.direction;
    }
    if (direction == 0) {
        direction = 1;
    }

    if (key.length > 0) {
        DIRECTION_MEMORY[key] = {
            routeName: routeName, count: count, firstId: firstId, lastId: lastId,
            nextIndex: index, direction: direction
        };
    }
    return direction;
}

/**
 * 判断列车在线路图的车站顺序中是朝序号增大（右侧）还是减小（左侧）的方向行驶。
 * 注意：折返、路线只剩 1 站等情况这里会返回 0，真正画图用的是 {@link resolveTravelDirection}。
 * @param {Train} train 要判断的列车。
 * @param {Array} stationInfoList 线路图上的车站信息数组（见 {@link getRouteInfo}）。
 * @return {Number} 1 表示朝序号增大方向，-1 表示朝序号减小方向，0 表示无法判断。
 */
function getTravelDirection(train, stationInfoList) {
    try {
        let platforms = train.getThisRoutePlatforms();
        let count = platforms.size();
        if (count < 2 || stationInfoList == null || stationInfoList.length < 2) {
            return 0;
        }
        let index = Math.max(0, Math.min(train.getThisRoutePlatformsNextIndex(), count - 1));
        let fromIndex = index;
        let toIndex = index + 1;
        if (index > 0) { // 用「刚驶离的车站」到「即将到达的车站」确定方向
            fromIndex = index - 1;
            toIndex = index;
        }
        let from = indexOfPlatformId(stationInfoList, platforms.get(fromIndex).platform.id);
        let to = indexOfPlatformId(stationInfoList, platforms.get(toIndex).platform.id);
        if (from < 0 || to < 0 || from == to) {
            return 0;
        }
        if (from == stationInfoList.length - 1 && to == 0) { // 环形线路绕回起点，仍算作朝序号增大方向
            return 1;
        }
        return (to > from) ? 1 : -1;
    } catch (error) {
        return 0;
    }
}

/**
 * 查找相反方向的同名路线，用于让线路图在两个方向上保持同一绘制顺序。
 * 反向路线必须与本路线站数相同且站序完全相反；若其编号更小则用它作为绘制顺序。
 * @param {Route} route 本路线。
 * @return {Route} 用于绘制线路图的路线。找不到反向路线时返回本路线。
 */
function getCanonicalRoute(route) {
    if (route == null) {
        return route;
    }
    let baseIds = getRoutePlatformIdStrings(route);
    let best = route;
    let bestId = Number(route.id);
    try {
        for (let candidate of MTRClientData.DATA_CACHE.routeIdMap.values()) {
            if (candidate == null || sameId(candidate.id, route.id)) {
                continue;
            }
            if (String(candidate.name) != String(route.name) && normalizeRouteName(candidate.name) != normalizeRouteName(route.name)) {
                continue; // 名字不同就不是同一条线（同一线路的上下行名字相同，只是「||」后面不同）
            }
            if (!isReverseOrder(getRoutePlatformIdStrings(candidate), baseIds)) {
                continue;
            }
            let candidateId = Number(candidate.id);
            if (candidateId < bestId) {
                best = candidate;
                bestId = candidateId;
            }
        }
    } catch (error) {
        return route;
    }
    return best;
}

/* ============================== 车站信息 ============================== */

/** 取路线的站台编号列表（全部转成字符串，便于比较）。 */
function getRoutePlatformIdStrings(route) {
    let ids = [];
    if (route == null || route.platformIds == null) {
        return ids;
    }
    for (let i = 0; i < route.platformIds.size(); i++) {
        ids.push(String(route.platformIds.get(i).platformId));
    }
    return ids;
}

/** 判断两份站台编号列表是否站数相同且顺序完全相反。 */
function isReverseOrder(ids, otherIds) {
    if (ids.length != otherIds.length || ids.length < 2) {
        return false;
    }
    for (let i = 0; i < ids.length; i++) {
        if (ids[i] != otherIds[otherIds.length - 1 - i]) {
            return false;
        }
    }
    return true;
}

/**
 * 获取某路线的全部车站信息。
 * @param {Route} route 要获取车站信息的路线。
 * @param {Route} nextRoute 下一个路线。可以为 null。
 * @return {Array} 车站信息数组，每项含 platformId、platformName、platformDwellTime、stationName、interchangeInfo。
 */
function getFullRouteStationInfoList(route, nextRoute) {
    let stationInfoList = [];
    if (route == null || route.platformIds == null) {
        return stationInfoList;
    }

    // 相反方向的同名路线使用同一绘制顺序，保证两个方向的线路图一致
    let drawRoute = getCanonicalRoute(route);

    ROUTE_DEBUG.totalPlatforms = drawRoute.platformIds.size();
    ROUTE_DEBUG.resolvedPlatforms = 0;
    for (let i = 0; i < drawRoute.platformIds.size(); i++) {
        let platformId = drawRoute.platformIds.get(i).platformId;
        let platform = getMapValueByKeyStr(MTRClientData.DATA_CACHE.platformIdMap, platformId);
        let station = getMapValueByKeyStr(MTRClientData.DATA_CACHE.platformIdToStation, platformId);
        if (platform == null || station == null) {
            continue;
        }
        ROUTE_DEBUG.resolvedPlatforms++;
        stationInfoList.push({
            platformId: platformId,
            platformName: String(platform.name),
            platformDwellTime: platform.getDwellTime(),
            stationName: String(station.name),
            interchangeInfo: getAllInterchangeRoutes(station, route, nextRoute)
        });
    }

    if (ROUTE_MAP_REVERSE) {
        stationInfoList.reverse();
    }
    return stationInfoList;
}

/**
 * 获取列车本次路线上的车站信息（{@link getFullRouteStationInfoList} 的兜底）。
 */
function getTrainRouteStationInfoList(train, route, nextRoute) {
    let stationInfoList = [];
    for (let platformInfo of train.getThisRoutePlatforms()) {
        stationInfoList.push({
            platformId: platformInfo.platform.id,
            platformName: String(platformInfo.platform.name),
            platformDwellTime: platformInfo.platform.getDwellTime(),
            stationName: String(platformInfo.station.name),
            interchangeInfo: getAllInterchangeRoutes(platformInfo.station, route, nextRoute)
        });
    }
    return stationInfoList;
}

/**
 * 查找某站台在车站信息数组中的下标。
 * @return {Number} 下标，找不到时返回 -1。
 */
function indexOfPlatformId(stationInfoList, platformId) {
    if (stationInfoList == null) {
        return -1;
    }
    for (let i = 0; i < stationInfoList.length; i++) {
        if (sameId(stationInfoList[i].platformId, platformId)) {
            return i;
        }
    }
    return -1;
}

/* ============================== 车门侧 ============================== */

/*
 * 车门开在哪一侧，取决于站台在轨道的哪一边，而同一个站台换个行驶方向就是另一侧。
 * 折返（列车往回开，MTR 里会换成反向的线路）时行驶方向变了，但车头朝向 isReversed()
 * 不一定跟着变，所以不能拿车头当依据，这里按「站台编号 + 行驶方向」记 MTR 实际开过的门：
 *   1. 到站时 MTR 会如实报左右门状态 → 记下来；
 *   2. 行车途中查这张表，提前提示「将开启本侧车门 / 请到对门」；
 *   3. 表里没有时用同站台反方向的结果推（同一站台换个方向就是另一侧）；
 *   4. 都查不到才按车头朝向猜（只作兜底）。
 * 表是全局的，每条线跑过一遍各站就都有了。
 */
let LEARNED_DOOR_SIDES = {};

/** 学习表的键：站台编号 + 行驶方向。 */
function doorSideKey(platformId, direction) {
    return String(platformId) + "|" + direction;
}

/** 取路线信息里下一站的站台编号。 */
function nextPlatformIdOf(routeInfo) {
    if (routeInfo == null || routeInfo.stationInfoList == null || routeInfo.stationInfoList.length == 0) {
        return null;
    }
    let index = Math.max(0, Math.min(routeInfo.nextStationIndex, routeInfo.stationInfoList.length - 1));
    let station = routeInfo.stationInfoList[index];
    return (station == null) ? null : station.platformId;
}

/**
 * 推断即将到达的站台会开哪一侧门。
 * @param {RouteInfo} routeInfo 当前路线信息。
 * @param {Boolean} reversed 车头朝向（MTR 的 isReversed），本函数只在兜底时用到。
 * @return {String} "left" / "right"，推断不出来时返回 null（由调用方按车头猜）。
 */
function doorSideFor(routeInfo, reversed) {
    let platformId = nextPlatformIdOf(routeInfo);
    let direction = (routeInfo == null) ? 0 : routeInfo.travelDirection;
    if (platformId == null || direction == 0) {
        return null; // 方向不明就没法按方向查
    }
    let side = LEARNED_DOOR_SIDES[doorSideKey(platformId, direction)];
    if (side == null) {
        // 同一个站台换个行驶方向，开的就是另一侧——折返后靠这一条就能立刻正确
        let opposite = LEARNED_DOOR_SIDES[doorSideKey(platformId, -direction)];
        if (opposite != null) {
            side = (opposite == "left") ? "right" : "left";
        }
    }
    if (side == null) {
        return null;
    }
    return FLIP_DOOR_SIDES ? ((side == "left") ? "right" : "left") : side;
}

/** 记录某站台在当前行驶方向下开的是哪一侧门（side 用 MTR 报的原始左右）。 */
function rememberDoorSide(routeInfo, side) {
    if (routeInfo == null) {
        return;
    }
    let platformId = nextPlatformIdOf(routeInfo);
    let direction = routeInfo.travelDirection;
    if (platformId == null || direction == 0) {
        return;
    }
    let key = doorSideKey(platformId, direction);
    if (LEARNED_DOOR_SIDES[key] != side) {
        LEARNED_DOOR_SIDES[key] = side;
        printDebug("记住车门侧 " + key + " = " + side);
    }
}

/* ============================== 换乘信息 ============================== */

// 排查用（见 config.json 的 debugLog）：
// 这一次构建路线信息时换乘缓存里出现过的线路名（含被排除的），以及站台对到车站的数量。
let INTERCHANGE_CACHE_NAMES = {};
let ROUTE_DEBUG = {totalPlatforms: 0, resolvedPlatforms: 0, usedFallback: false};

// 自己整理的「车站编号 -> 经过的线路」索引，作为 MTR 换乘缓存的补充，见 buildStationRoutesIndex()。
let STATION_ROUTES_INDEX = {};

/**
 * 开始一次新的路线信息构建：清空统计，并重建车站-线路索引。
 * 索引一次建好，后面每个车站直接查，比逐站扫全部线路快得多。
 */
function beginRouteInfoBuild() {
    INTERCHANGE_CACHE_NAMES = {};
    ROUTE_DEBUG = {totalPlatforms: 0, resolvedPlatforms: 0, usedFallback: false};
    buildStationRoutesIndex();
}

/**
 * 从线路表整理出「哪些线路经过哪些车站」。
 * MTR 自带的 stationIdToRoutes 是给换乘显示用的，但它不收隐藏线路，
 * 联机或者刚改完线路时也可能还没同步过来，所以这里自己再算一份当补充。
 */
function buildStationRoutesIndex() {
    STATION_ROUTES_INDEX = {};
    let routes = MTRClientData.DATA_CACHE.routeIdMap;
    let platformIdToStation = MTRClientData.DATA_CACHE.platformIdToStation;
    if (routes == null || platformIdToStation == null) {
        return;
    }
    for (let route of routes.values()) {
        if (route == null || route.platformIds == null) {
            continue;
        }
        if (route.isHidden == true && !SHOW_HIDDEN_ROUTES) {
            continue; // 回库/调度这类隐藏线路默认不当换乘显示
        }
        let name = normalizeRouteName(route.name);
        if (name.length == 0) {
            continue;
        }
        let color = new Color(route.color & 0xFFFFFF);
        for (let i = 0; i < route.platformIds.size(); i++) {
            let station = getMapValueByKey(platformIdToStation, route.platformIds.get(i).platformId);
            if (station == null) {
                continue;
            }
            let key = String(station.id);
            if (STATION_ROUTES_INDEX[key] == null) {
                STATION_ROUTES_INDEX[key] = [];
            }
            pushUniqueRoute(STATION_ROUTES_INDEX[key], name, color);
        }
    }
}

/** 往列表里加一条线路，同名的只留一条。 */
function pushUniqueRoute(list, name, color) {
    for (let i = 0; i < list.length; i++) {
        if (list[i].name == name) {
            return;
        }
    }
    list.push({name: name, color: color});
}

/** 取这一次的换乘统计文字，见 config.json 的 debugInterchange。 */
function getInterchangeDebugText(stationInfoList) {
    let names = [];
    for (let key in INTERCHANGE_CACHE_NAMES) {
        names.push(key);
    }
    let shown = 0;
    for (let i = 0; i < stationInfoList.length; i++) {
        shown += stationInfoList[i].interchangeInfo.length;
    }
    return "换乘统计：" + stationInfoList.length + " 站，缓存里出现过的线路 = ["
        + names.join("、") + "]，实际显示徽标 " + shown + " 个";
}

/**
 * 获取某车站的所有换乘信息（包括连接车站）。
 * @param {Station} station 要获取换乘信息的车站。
 * @param {Route} thisRoute 本路线。
 * @param {Route} nextRoute 下一个路线。可以为 null。
 * @return {Array} 换乘信息数组。
 */
function getAllInterchangeRoutes(station, thisRoute, nextRoute) {
    let interchangeRoutes = [];
    try {
        getInterchangeRoutes(station, thisRoute, nextRoute, false, interchangeRoutes); // 获取本站的换乘信息
        let connectingStations = getMapValueByKey(MTRClientData.DATA_CACHE.stationIdToConnectingStations, station);
        if (connectingStations != null) {
            connectingStations.forEach(connectingStation => { // 获取连接车站的换乘信息
                getInterchangeRoutes(connectingStation, thisRoute, nextRoute, true, interchangeRoutes);
            });
        }
    } catch (error) {
        // 换乘信息读取失败不应影响整页绘制
        print("LCD：读取换乘信息失败，" + error);
    }
    return interchangeRoutes;
}

/**
 * 获取某车站（不含连接车站）的换乘信息。
 * @param {Station} station 要获取换乘信息的车站。
 * @param {Route} thisRoute 本路线。
 * @param {Route} nextRoute 下一个路线。可以为 null。
 * @param {Boolean} isConnectingStation 在获取连接车站的换乘信息时，此参数应传入 true，否则为 false。
 * @param {Array} interchangeRoutes 换乘信息数组，获取到的换乘信息会追加到该数组末尾。
 */
function getInterchangeRoutes(station, thisRoute, nextRoute, isConnectingStation, interchangeRoutes) {
    let routesInStation = getMapValueByKey(MTRClientData.DATA_CACHE.stationIdToRoutes, station.id);
    if (routesInStation != null) {
        for (let entry of routesInStation.entrySet()) {
            let tuple = entry.getValue();
            if (tuple == null) {
                continue;
            }
            let cachedName = normalizeRouteName(tuple.name);
            INTERCHANGE_CACHE_NAMES[cachedName] = true;
            // 排除本路线与下一路线：不把列车自己正在跑的线路当成换乘线路显示
            if (isSameRouteEntry(cachedName, thisRoute) || isSameRouteEntry(cachedName, nextRoute)) {
                continue;
            }
            if (cachedName.length == 0) {
                continue;
            }
            interchangeRoutes.push({
                name: cachedName,
                color: new Color(tuple.color & 0xFFFFFF),
                isConnectingStation: isConnectingStation
            });
        }
    }

    // 再用自己整理的索引补一遍：MTR 的换乘缓存可能没有这个车站，或者少了某些线路
    let indexed = STATION_ROUTES_INDEX[String(station.id)];
    if (indexed == null) {
        return;
    }
    for (let i = 0; i < indexed.length; i++) {
        let name = indexed[i].name;
        if (isSameRouteEntry(name, thisRoute) || isSameRouteEntry(name, nextRoute)) {
            continue;
        }
        let exists = false;
        for (let k = 0; k < interchangeRoutes.length; k++) {
            if (interchangeRoutes[k].name == name) {
                exists = true;
                break;
            }
        }
        if (!exists) {
            interchangeRoutes.push({
                name: name,
                color: indexed[i].color,
                isConnectingStation: isConnectingStation
            });
        }
    }
}

/**
 * 把线路名归一化：去掉「||」后面的附加部分（MTR 用它放线路编号或方向），再去掉多余空白。
 * 这里自己切字符串而不用 TextUtil.getNonExtraParts()：那个函数对没有「||」的名字
 * 会返回空字符串，会把「1号线|Line 1」这种正常名字整条丢掉。
 */
function normalizeRouteName(name) {
    let text = (name == null) ? "" : String(name);
    let extraIndex = text.indexOf("||");
    if (extraIndex >= 0) {
        text = text.substring(0, extraIndex);
    }
    return text.replace(/\s+/g, " ").trim();
}

/**
 * 判断换乘数据里的一条线路是不是就是 route。
 * MTR 的 stationIdToRoutes 是按线路颜色建索引的，名字则已经去过「||」附加部分，
 * 所以只比归一化后的名字：同一条线的上下行名字相同，也会一并排除。
 * @param {*} entryRouteName 换乘数据里的线路名。
 * @param {Route} route 要比较的线路，可以为 null。
 * @return {Boolean} 是否是同一条线路。
 */
function isSameRouteEntry(entryRouteName, route) {
    if (route == null) {
        return false;
    }
    let entryName = normalizeRouteName(entryRouteName);
    return (entryName.length > 0) && (entryName == normalizeRouteName(route.name));
}

/* ============================== 工具 ============================== */

/**
 * 比较两个 MTR 编号是否相同。
 * Rhino 把 Java 的 long 读成 double 之后，同一个编号的字符串形式会变（科学计数法），
 * 所以除了字符串还要比一次数值；编号之间相差极大，这点容差不会认错。
 * @param {*} a 编号一。
 * @param {*} b 编号二。
 * @return {Boolean} 是否相同。
 */
function sameId(a, b) {
    if (a == null || b == null) {
        return false;
    }
    if (a == b || String(a) == String(b)) {
        return true;
    }
    let numberA = Number(a);
    let numberB = Number(b);
    return !isNaN(numberA) && !isNaN(numberB) && Math.abs(numberA - numberB) < 4096;
}

/**
 * 从 Java Map 中按键取值。
 *
 * 键比较要格外小心：MTR 的车站/站台编号都是 64 位整数，而 Rhino 从 Java 的 long 字段读出来
 * 可能已经是 double（精度丢掉了），这时 containsKey() 会失败，String() 出来的形式也和原来的
 * 整数不一样（会变成科学计数法）。所以这里按「Java equals → 字符串 → 数值」三种方式依次比较。
 *
 * @param {Map} map Java Map。
 * @param {*} key 键。
 * @return {*} 值，找不到时返回 null。
 */
function getMapValueByKey(map, key) {
    if (map == null || key == null) {
        return null;
    }
    try {
        if (map.containsKey(key)) {
            return map.get(key);
        }
    } catch (error) {
        // 取不到时用下面的比较
    }
    let keyString = String(key);
    let keyNumber = Number(key);
    for (let entry of map.entrySet()) {
        let entryKey = entry.getKey();
        if (entryKey == key || String(entryKey) == keyString) {
            return entry.getValue();
        }
        // long 被读成 double 时字符串形式不同，但换成数字就是同一个值。
        // MTR 的编号是 64 位随机数，彼此相差极大，这一点点容差不会认错。
        let entryNumber = Number(entryKey);
        if (!isNaN(keyNumber) && !isNaN(entryNumber) && Math.abs(entryNumber - keyNumber) < 4096) {
            return entry.getValue();
        }
    }
    return null;
}

/** 与 getMapValueByKey() 相同，早期调用点用的是这个名字。 */
function getMapValueByKeyStr(map, key) {
    return getMapValueByKey(map, key);
}
