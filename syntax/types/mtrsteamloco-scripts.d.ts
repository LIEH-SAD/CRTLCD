/*
 * (A)NTE / MTR Steam Loco 资源包脚本 —— 全局类型声明（列车 / 装饰物件 / 动态贴图 / 显示屏）
 *
 * 来源文档仓库：https://github.com/aphrodite281/mtr-ante/tree/alpha/docs
 * 覆盖文档：js-train.md、js-example-train.md、js-eyecandy.md、js-example-eyecandy.md、
 *           js-dynamic-texture.md、js-display-helper.md
 *
 * 引擎：Rhino 1.7.14（已开启 VERSION_ES6 标记），JavaScript 运行于严格模式。
 * 范围：仅覆盖上述文档已记录的 API；文档中未出现的成员一律未声明。
 *
 * 使用说明：
 *  - 本文件是“全局声明文件”，不含顶层 import / export，脚本中可直接写
 *    TrainScriptContext / Train / EyeCandyScriptContext / BlockEntityEyeCandy / new DisplayHelper(...) 等。
 *  - 与核心声明文件（mtrsteamloco-core.d.ts）配合使用：本文件不重复声明其负责的类型
 *    （ResourceLocation、Matrices、Vector3f、Matrix4f、GraphicsTexture、ConfigResponder 等），需要时只使用类型名。
 *  - 引擎为 Java 环境：MTR/NTE 返回的是 Java 字符串，取长度请用 str.length()；
 *    Java 的 List 可用 list[0] 取值或 for (a of list) 遍历；下文以 Record<...> 表示的 Java Map
 *    同样支持 map[key] 取值与 for..of 遍历。
 */

/* =====================================================================
 * 列车脚本上下文（js-train.md）
 * ===================================================================== */

/**
 * 列车脚本渲染控制上下文（js-train.md）。
 *
 * 由 NTE 在调用 create / render / dispose 时作为第一个参数（ctx）传入，
 * 用于向 NTE 输出“如何渲染这列车”的操作以及播放声音。
 */
interface TrainScriptContext {
  /*
   * 以下 draw* 方法仅在 render 中保证线程安全，请勿在其他线程使用。
   * 每次 render 时都需要为想绘制的模型重新调用相应函数，否则该帧不会绘制。
   */

  /**
   * 要求 NTE 在一节车厢处绘制模型（ModelCluster 版本）。
   * @param model 要绘制的模型
   * @param carIndex 相对哪节车厢的中心（0 为出库方向第一节，train.trainCars() - 1 为最后一节）
   * @param poseStack 模型放置位置的变换；传入 null 表示放在车厢中心不做变换
   */
  drawCarModel(model: ModelCluster, carIndex: number, poseStack: Matrices | null): void;

  /**
   * 要求 NTE 在一节车厢处绘制模型（DynamicModelHolder 版本，用于需要在函数内上传的模型）。
   * @param model 动态模型容器
   * @param carIndex 相对哪节车厢的中心（0 为出库方向第一节，train.trainCars() - 1 为最后一节）
   * @param poseStack 模型放置位置的变换；传入 null 表示放在车厢中心不做变换
   */
  drawCarModel(model: DynamicModelHolder, carIndex: number, poseStack: Matrices | null): void;

  /**
   * 要求 NTE 在车厢连接处绘制模型。
   * @param model 要绘制的模型
   * @param carIndex 相对第几个连接处（0 为出库方向第 1、2 节之间，train.trainCars() - 2 为最后一个）
   * @param poseStack 模型放置位置的变换；传入 null 表示放在连接处中心不做变换
   */
  drawConnModel(model: ModelCluster, carIndex: number, poseStack: Matrices | null): void;

  /**
   * 要求 NTE 在车厢连接处绘制与 MTR 原版相同的可拉伸折蓬。
   * 为节省性能，输入图片需是 MTR 原版四张图片合并成一张：左上为外侧、
   * 右上为内部侧面、左下为内部顶面、右下为内部底面。
   * @param location 合并后的折蓬贴图
   * @param carIndex 相对第几个连接处
   */
  drawConnStretchTexture(location: ResourceLocation, carIndex: number): void;

  /*
   * 以下为声音播放方法，仅在 render 中保证线程安全。
   * 只在需要“开始播放”时调用一次，重复调用会使多个声音叠加。
   */

  /**
   * 播放车厢声音，可设定声源位置，能被所有附近玩家听到。
   * @param sound 声音资源位置
   * @param carIndex 相对哪节车厢
   * @param x 声源相对车厢中心的 X 偏移
   * @param y 声源相对车厢中心的 Y 偏移
   * @param z 声源相对车厢中心的 Z 偏移
   * @param volume 音量
   * @param pitch 音调
   */
  playCarSound(sound: ResourceLocation, carIndex: number, x: number, y: number, z: number, volume: number, pitch: number): void;

  /**
   * 播放广播声音，只能被当前在车上的玩家听到。
   * @param sound 声音资源位置
   * @param volume 音量
   * @param pitch 音调
   */
  playAnnSound(sound: ResourceLocation, volume: number, pitch: number): void;

  /**
   * 按“车厢”划分的绘制调用表（可在所有线程读写，向其中添加、替换或删除键值对即可控制渲染，
   * 常用于异步线程中更新绘制内容）。
   *
   * 文档中标注为 Java 的 Map<Object, DrawCall>[]；此处以 Record 表示，
   * 支持 drawCalls[carIndex][key] 取值与 for..of 遍历。
   */
  drawCalls: Record<string | number, DrawCall>[];

  /*
   * 辅助开发调试（在原版“显示JS调试信息”开启时才显示）。
   */

  /**
   * 在屏幕左上角输出调试信息。
   * @param key 值的名称
   * @param value 内容；GraphicsTexture 类型会直接显示，其他类型会转为字符串显示
   */
  setDebugInfo(key: string, value: unknown): void;

  /** 获取本列车对应的客户端列车对象。 */
  train: TrainClient;
}

/* =====================================================================
 * 列车状态（js-train.md）
 * ===================================================================== */

/**
 * 用于获取列车的状态（js-train.md）。
 *
 * 作为 create / render / dispose 的第三个参数（train）传入。所有长度单位见各成员说明。
 */
interface Train {
  /**
   * 现在是否应该显示这列车。
   * 开启“隐藏正在乘坐的列车”时脚本仍会照常运行以保证广播等功能，此时返回 false。
   * 不需要用它来判断是否停止 drawCarModel，NTE 会自动让调用无效。
   */
  shouldRender(): boolean;

  /**
   * 列车是否在细节显示范围（32 格）以内。
   * @deprecated 此功能已废弃，一律返回 true。如需按距离优化性能，
   * 请改用 MinecraftClient.getCameraDistance(train.lastCarPosition[carIndex])。
   */
  shouldRenderDetail(): boolean;

  /** 车型 ID。 */
  trainTypeId(): string;

  /** 基于的车型 ID。 */
  baseTrainType(): string;

  /**
   * 这辆车在 MTR 内部的唯一编号（随机的 64 位整数）。
   * 注意在 JavaScript 里可能因有效数字位数不够，末尾几位变成 0。
   */
  id(): number;

  /** 交通方式种类。 */
  transportMode(): TransportMode;

  /** 每节车的长度 + 1。 */
  spacing(): number;

  /** 宽度。由于玩家也有宽度，3 格宽的车的此属性为 2。 */
  width(): number;

  /** 车厢数。 */
  trainCars(): number;

  /** 加速度，单位 m/tick/tick，即 *1/400 m/s²。 */
  accelerationConstant(): number;

  /** 是否可以人工控制。 */
  manualAllowed(): boolean;

  /** 人工控制时的最大速度（与轨道类型从低到高的顺序对应）。 */
  maxManualSpeed(): number;

  /** 无人驾驶后转回自动控制的时间。 */
  manualToAutomaticTime(): number;

  /** 行驶路径，即要经过的每段轨道的列表。 */
  path(): PathData[];

  /** 从车库开出的距离。 */
  railProgress(): number;

  /** 速度，单位 m/tick，即 *1/20 m/s。 */
  speed(): number;

  /** 车门开度。关门为 0，全开为 1，开门时增加、关门时减少。 @returns 车门开度 */
  doorValue(): number;

  /** 是否正在开门。 */
  isDoorOpening(): boolean;

  /** 各车厢左侧车门是否可以打开（按车厢索引访问）。 */
  doorLeftOpen: boolean[];

  /** 各车厢右侧车门是否可以打开（按车厢索引访问）。 */
  doorRightOpen: boolean[];

  /** 各车厢在上一帧的世界坐标（按车厢索引访问）。 */
  lastWorldPose: Matrix4f[];

  /** 各车厢在上一帧的位置（按车厢索引访问）。 */
  lastCarPosition: Vector3f[];

  /** 各车厢在上一帧的旋转角度，XYZ 欧拉（按车厢索引访问）。 */
  lastCarRotation: Vector3f[];

  /** 是否正在被人工控制。 */
  isCurrentlyManual(): boolean;

  /** 是否已折返，即现在 1 号车是车尾。 */
  isReversed(): boolean;

  /** 是否已出库。 */
  isOnRoute(): boolean;

  /**
   * 相对于当前行驶方向的车头，从 0 开始计第 car 车前方、从车库开出的距离。
   * 如 getRailProgress(1) 是 1/2 车连接处的位置。
   * @param car 车厢索引
   */
  getRailProgress(car: number): number;

  /**
   * 计算某个 railProgress 位于 path() 中的第几项轨道上。
   * @param railProgress 从车库开出的距离
   * @param roundDown 位置正处两条轨道交界时：为 true 返回更靠车尾方向的一条，否则返回更靠车头方向的一条
   */
  getRailIndex(railProgress: number, roundDown: boolean): number;

  /**
   * path() 中第 railIndex 项这条轨道可通行的最高速度（能正确处理站台不进站还加速的情况）。
   * @param railIndex 轨道在 path() 中的索引
   * @returns 最高速度，单位 m/tick，即 *1/20 m/s
   */
  getRailSpeed(railIndex: number): number;

  /** 列车指令里所有线路行经的所有站台的列表（在站台上折返时只算作一项）。 */
  getAllPlatforms(): PlatformInfo[];

  /**
   * 下一站要停靠的站台在 getAllPlatforms() 列表中的第几项。
   * 0 代表刚出库正前往第一个站台，等于 getAllPlatforms().size() 代表正在回库；
   * 因此它不一定在列表索引范围内，使用前需判断。
   */
  getAllPlatformsNextIndex(): number;

  /** 列车现在行驶的线路行经的所有站台的列表。 */
  getThisRoutePlatforms(): PlatformInfo[];

  /**
   * 下一站要停靠的站台在 getThisRoutePlatforms() 列表中的第几项。
   * 0 正前往第一个站台，等于 getThisRoutePlatforms().size() 代表正前往下一条线路起点或回库；
   * 因此它不一定在列表索引范围内，使用前需判断。
   */
  getThisRoutePlatformsNextIndex(): number;
}

/**
 * 客户端列车。TrainScriptContext.train 返回此类型；
 * 文档未给出额外成员，故继承 Train 的全部信息。
 */
interface TrainClient extends Train {}

/* =====================================================================
 * 路径与站台信息（js-train.md）
 * ===================================================================== */

/** 行驶路径中的一段轨道（js-train.md）。 */
interface PathData {
  /** 这段轨道。 */
  rail: Rail;

  /** 若这段轨道是站台则为停车时间（单位 *0.5s），不是站台时为 0。 */
  dwellTime: number;
}

/** 一段轨道（js-train.md）。 */
interface Rail {
  /** 这段轨道的轨道类型（木、铁……）。 */
  railType: RailType;

  /** 这段轨道所使用的 NTE 轨道模型。未设置为空字符串，隐藏为 "null"。 */
  getModelKey(): string;
}

/** 轨道类型（木、铁……）；具体成员见 MTR 源码 RailType.java。 */
interface RailType {}

/** 一条线路（js-train.md）；具体成员见 MTR 源码 Route.java。 */
interface Route {
  /** 这条线路的名称。 */
  name: string;
}

/** 站台信息（js-train.md）。 */
interface PlatformInfo {
  /** 这个站台所属的路线（在站台上折返时为折返后的路线）。 */
  route: Route;

  /** 这个站台所属的车站。 */
  station: Station;

  /** 这个站台。 */
  platform: Platform;

  /** 这个站台所属线路的终点站。 */
  destinationStation: Station;

  /** 这个站台的终点名称（考虑自定义终点名称）。 */
  destinationName: string;

  /** 这个站台末端所在位置从车库开出的距离（可与 railProgress 比较）。 */
  distance: number;

  /** 列车是否会在这个站台上折返。 */
  reverseAtPlatform: boolean;
}

/** 交通方式种类（js-train.md）。 */
interface TransportMode {}

/* =====================================================================
 * 列车脚本入口函数（js-train.md / js-example-train.md）
 * 由作者实现，NTE 按需调用。
 * ===================================================================== */

/**
 * 列车脚本入口：列车最开始被加载时调用，可用于初始化（如创建动态贴图）。
 * @param ctx 渲染控制上下文
 * @param state 与该列车关联的可写对象，初始为 {}，可存放每列车独立的数据
 * @param train 列车状态
 */
declare function create(ctx: TrainScriptContext, state: Record<string, unknown>, train: Train): void;

/**
 * 列车脚本入口：大致每帧调用一次，用于主要显示逻辑。
 * 代码在单独线程运行以避免拖低 FPS；请勿阻塞或无限循环，耗时过长则可能好几帧才运行一次。
 * @param ctx 渲染控制上下文
 * @param state 列车的每车独立状态对象
 * @param train 列车状态
 */
declare function render(ctx: TrainScriptContext, state: Record<string, unknown>, train: Train): void;

/**
 * 列车脚本入口：列车驶出可视范围时调用，可用于释放动态贴图等资源。
 * @param ctx 渲染控制上下文
 * @param state 列车的每车独立状态对象
 * @param train 列车状态
 */
declare function dispose(ctx: TrainScriptContext, state: Record<string, unknown>, train: Train): void;

/* =====================================================================
 * 装饰物件脚本上下文（js-eyecandy.md）
 * ===================================================================== */

/**
 * 装饰物件脚本渲染控制上下文（js-eyecandy.md）。
 *
 * 由 NTE 在调用 create / render / dispose / use 时作为第一个参数（ctx）传入。
 */
interface EyeCandyScriptContext {
  /*
   * 以下 drawModel / playSound 仅在 render 中保证线程安全，请勿在其他线程使用。
   * 每次 render 时都需要为想绘制的模型重新调用 drawModel。
   */

  /**
   * 要求 NTE 绘制模型（ModelCluster 版本）。
   * @param model 要绘制的模型
   * @param poseStack 模型放置位置的变换；传入 null 表示放在中心不做变换
   */
  drawModel(model: ModelCluster, poseStack: Matrices | null): void;

  /**
   * 要求 NTE 绘制模型（DynamicModelHolder 版本，用于需要在函数内上传的模型）。
   * @param model 动态模型容器
   * @param poseStack 模型放置位置的变换；传入 null 表示放在中心不做变换
   */
  drawModel(model: DynamicModelHolder, poseStack: Matrices | null): void;

  /**
   * 播放声音。只在需要“第一次播放”时调用一次，重复播放会导致声音叠加。
   * @param sound 声音资源位置
   * @param volume 音量
   * @param pitch 音调
   */
  playSound(sound: ResourceLocation, volume: number, pitch: number): void;

  /**
   * 绘制调用表（可在所有线程读写，向其中添加、替换或删除键值对即可控制渲染。
   * 常用于异步线程中更新绘制内容，此时不要在异步线程中调用 drawModel / playSound）。
   *
   * 文档中标注为 Java 的 Map<Object, DrawCall>；此处以 Record 表示，
   * 支持 drawCalls[key] 取值与 for..of 遍历。
   */
  drawCalls: Record<string | number, DrawCall>;

  /*
   * 辅助开发调试（在原版“显示JS调试信息”开启时才显示）。
   */

  /**
   * 在屏幕左上角输出调试信息。
   * @param key 值的名称
   * @param value 内容；GraphicsTexture 类型会直接显示，其他类型会转为字符串；传入多个值时会转换为数组
   */
  setDebugInfo(key: string, ...value: unknown[]): void;

  /**
   * 在屏幕左上角输出调试信息，并按 PlacementOrder 的顺序添加。
   * @param key 值的名称
   * @param order 放置顺序
   * @param value 内容；传入多个值时会转换为数组
   */
  setDebugInfo(key: string, order: PlacementOrder, ...value: unknown[]): void;
}

/* =====================================================================
 * 装饰物件方块（js-eyecandy.md）
 * ===================================================================== */

/**
 * 装饰物件方块状态（js-eyecandy.md）。
 *
 * 作为 create / render / dispose / use 的第三个参数（entity）传入。
 */
interface BlockEntityEyeCandy {
  /** 方块在 X 方向上的偏移量。 */
  translateX: number;

  /** 方块在 Y 方向上的偏移量。 */
  translateY: number;

  /** 方块在 Z 方向上的偏移量。 */
  translateZ: number;

  /** 方块在 X 轴上的旋转。 */
  rotateX: number;

  /** 方块在 Y 轴上的旋转。 */
  rotateY: number;

  /** 方块在 Z 轴上的旋转。 */
  rotateZ: number;

  /** 方块的预制体 ID。 */
  prefabId: string;

  /** 方块是否为全光照。 */
  fullLight: boolean;

  /** 方块是否被当作站台。 */
  asPlatform: boolean;

  /** 方块是否为闸机。 */
  isTicketBarrier: boolean;

  /** 方块是否为入口。 */
  isEntrance: boolean;

  /** 附近列车车门的值。 */
  doorValue: number;

  /** 附近列车车门的目标状态（false 为关闭，true 为打开）。 */
  doorTarget: boolean;

  /** 方块是否固定。 */
  fixedMatrix: boolean;

  /**
   * 设置方块的形状。
   * @param shape 形状字符串
   */
  setShape(shape: string): void;

  /** 获取方块的形状。 */
  getShape(): string;

  /**
   * 设置方块的碰撞形状。
   * @param shape 形状字符串
   */
  setCollisionShape(shape: string): void;

  /** 获取方块的碰撞形状。 */
  getCollisionShape(): string;

  /** 获取方块坐标，返回原版的 BlockPos 类型。 */
  getWorldPos(): BlockPos;

  /** 获取方块坐标，返回 Vector3f。 */
  getWorldPosVector3f(): Vector3f;

  /** 获取方块坐标，返回 Vector3f，且已应用了方块的变换。 */
  getTransformPosVector3f(): Vector3f;

  /** 发送方块状态更新。 */
  sendUpdateC2S(): void;

  /** 获取方块在 Y 轴上的旋转（摆放方向，0-270）。 */
  getBlockYRot(): number;

  /**
   * 设置发光等级。
   * @param level 发光等级，取值 0-15
   */
  setLightLevel(level: number): void;

  /** 获取发光等级（0-15）。 */
  getLightLevel(): number;

  /**
   * 注册配置响应器。如果原来没有值则添加默认值，如果原来有值则不变动。
   * @param responders 配置响应器
   */
  registerCustomConfig(responders: ConfigResponder): void;

  /**
   * 移除一项配置。
   * @param key 配置项标识
   */
  removeCustomConfig(key: string): void;

  /**
   * 添加或修改一项配置（如果没有注册响应器，则在装饰物件的屏幕中无法修改）。
   * @param key 配置项标识
   * @param value 配置值
   */
  putCustomConfig(key: string, value: string): void;

  /**
   * 获取一项配置。
   * @param key 配置项标识
   */
  getCustomConfig(key: string): string;
}

/* =====================================================================
 * 装饰物件脚本入口函数（js-eyecandy.md）
 * 由作者实现，NTE 按需调用。
 * ===================================================================== */

/**
 * 装饰物件脚本入口：装饰物件最开始被加载时调用，可用于初始化（如创建动态贴图）。
 * @param ctx 渲染控制上下文
 * @param state 与该装饰物件方块关联的可写对象，初始为 {}，可存放每个方块独立的数据
 * @param entity 方块状态
 */
declare function create(ctx: EyeCandyScriptContext, state: Record<string, unknown>, entity: BlockEntityEyeCandy): void;

/**
 * 装饰物件脚本入口：大致每帧调用一次，用于主要显示逻辑。
 * 代码在单独线程运行以避免拖低 FPS；请勿阻塞或无限循环。
 * @param ctx 渲染控制上下文
 * @param state 每个方块独立的状态对象
 * @param entity 方块状态
 */
declare function render(ctx: EyeCandyScriptContext, state: Record<string, unknown>, entity: BlockEntityEyeCandy): void;

/**
 * 装饰物件脚本入口：超出可视范围时调用，可用于释放动态贴图等资源。
 * @param ctx 渲染控制上下文
 * @param state 每个方块独立的状态对象
 * @param entity 方块状态
 */
declare function dispose(ctx: EyeCandyScriptContext, state: Record<string, unknown>, entity: BlockEntityEyeCandy): void;

/**
 * 装饰物件脚本入口：玩家使用装饰物件时调用（手持刷子使用除外）。
 * @param ctx 渲染控制上下文
 * @param state 每个方块独立的状态对象
 * @param entity 方块状态
 * @param player 使用该装饰物件的玩家
 */
declare function use(ctx: EyeCandyScriptContext, state: Record<string, unknown>, entity: BlockEntityEyeCandy, player: WrappedEntity): void;

/* =====================================================================
 * 动态贴图（js-dynamic-texture.md）
 * ===================================================================== */

/**
 * 动态贴图（js-dynamic-texture.md）。
 *
 * 用于在模型上使用由 JS 控制内容的贴图，如 LCD 显示屏、闪灯图、LED 滚动文字等。
 * 不同列车的内容可能不同，因此通常在 create 函数里创建并放进 state，并在 dispose 里 close。
 */
declare class GraphicsTexture {
  /**
   * 创建一张动态贴图，创建时必须指定宽和高。
   * @param width 宽（像素）
   * @param height 高（像素）
   */
  constructor(width: number, height: number);

  /**
   * 释放这张动态贴图所使用的内存。之后不能再使用它。
   * 在 create 里创建的贴图必须在 dispose 里关闭，否则会持续占用内存造成内存泄漏。
   */
  close(): void;

  /** 用于暂存绘图效果的 Java AWT BufferedImage。 */
  bufferedImage: BufferedImage;

  /** 这张动态贴图的 Java AWT Graphics，可以在上面调用各种绘制函数向 bufferedImage 画图。 */
  graphics: Graphics2D;

  /**
   * 把 bufferedImage 里的内容正式上传到显存，立刻应用到模型上显示。
   * 该操作较拉低 FPS，建议用 RateLimit 减少更新频率（例如显示屏每秒刷新十次），
   * 或把刷新逻辑放到单独的线程里，避免影响游戏主线程。
   */
  upload(): void;

  /**
   * 上传 img 到贴图，用它替换贴图内容。
   * 这样就不用清空 bufferedImage 再重新绘制，也不会出现线程安全问题。
   * @param img 要上传的图片
   */
  upload(img: BufferedImage): void;

  /** 这张动态贴图的虚拟资源位置，用它来替换模型的贴图。 */
  identifier: ResourceLocation;
}

/* =====================================================================
 * 显示屏工具类（js-display-helper.md）
 * ===================================================================== */

/** Java AWT 的绘图上下文（Graphics2D）；在其上可调用 AWT 提供的各种绘图方法。 */
interface Graphics2D {}

/** DisplayHelper 的显示屏位置配置（对应 display_helper.js 所需的 JSON 结构）。 */
interface DisplayHelperConfig {
  /** 配置格式版本，目前为 1。 */
  version: number;

  /** 生成的动态贴图尺寸：[宽, 高]。 */
  texSize: number[];

  /** 各个显示屏位置。 */
  slots: DisplayHelperSlot[];
}

/** DisplayHelper 配置中的一个显示屏位置。 */
interface DisplayHelperSlot {
  /** 该位置的名称，供 graphicsFor(slotName) 定位。 */
  name: string;

  /** 在最终动态贴图里用作该屏幕显示内容的区域：[X, Y, 宽, 高]。 */
  texArea: number[];

  /**
   * 各屏幕的位置（三层数组）：每项为一个屏幕，按该屏幕正面的
   * 左上、左下、右下、右上顺序给出四个 [x, y, z] 坐标点。
   * 坐标原点为列车中心、地板高度；X 正方向向左、Y 正方向向上、Z 正方向向后。
   */
  pos: number[][][];

  /** 复制 pos 中各屏幕的偏移量（每项为 [x, y, z]）；不写则不复制。 */
  offsets?: number[][];
}

/**
 * 显示屏工具类（js-display-helper.md）。
 *
 * 用于给现有列车添加显示屏：统一配置各显示屏模型与动态贴图。
 * 需先 include(Resources.id("mtrsteamloco:scripts/display_helper.js")) 导入。
 */
declare class DisplayHelper {
  /**
   * 按照一个显示屏位置配置创建 DisplayHelper，并生成相应的模型。
   * 返回一个只配置了模型的“基本”DisplayHelper。必须在函数之外（顶层）调用。
   * @param cfg 显示屏位置配置
   */
  constructor(cfg: DisplayHelperConfig);

  /**
   * 进行创建动态贴图等特定的配置，返回一个完全配置好的 DisplayHelper。
   * 结果可保存到 state 里。new 出来的 DisplayHelper 只能用于调用 create，
   * create 出来的 DisplayHelper 才能用来进行其他操作。
   */
  create(): DisplayHelper;

  /** 释放资源。create 出来的 DisplayHelper 必须在 dispose 时关闭。 */
  close(): void;

  /** 获取用来在显示屏上画图的 AWT Graphics；坐标原点是包含所有显示屏位置的整张大图的左上角。 */
  graphics(): Graphics2D;

  /**
   * 获取用来在某个显示屏上画图的 AWT Graphics；坐标原点是该显示屏区域的左上角。
   * 与 graphics() 返回同一个对象，只是自动设置了变换。
   * @param slotName 显示屏位置的名称
   */
  graphicsFor(slotName: string): Graphics2D;

  /** 将画好的内容正式上传应用。 */
  upload(): void;

  /** 包含了所有显示屏的模型。 */
  model: ModelCluster;

  /** 内部使用的动态贴图。 */
  texture: GraphicsTexture;
}
