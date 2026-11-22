/*
 * (A)NTE / MTR Steam Loco 资源包脚本 —— 全局类型声明（核心）
 *
 * 来源文档仓库：https://github.com/aphrodite281/mtr-ante/tree/alpha/docs
 * 覆盖文档：js-general.md、js-graal.md、js-resources-env.md、js-util.md、js-math.md、js-custom-config.md
 *
 * 引擎：Rhino 1.7.14（已开启 VERSION_ES6 标记）；自 ANTE 1.1.1 起框架改用 GraalJS，两者均兼容本声明。
 * 范围：仅覆盖上述文档已记录的 API；文档中未出现的 API 一律未声明。
 *
 * 使用说明：
 *  - 本文件是“全局声明文件”，不含顶层 import / export，脚本中可直接写
 *    Resources.id("a:b") / ComponentUtil.translatable(...) / new ConfigResponder.TextField(...) 等。
 *  - 脚本运行于 JavaScript 严格模式，变量必须用 let / var 声明，禁止直接赋值未声明变量。
 *  - MTR/NTE 返回的是 Java 字符串：取长度用 str.length()（Java）而非 str.length（JS）；
 *    用 "" + str 可转成 JS 字符串。Java 列表可用 list[0] 取值或 for (a of list) 遍历。
 */

/* =====================================================================
 * 共享全局函数
 * ===================================================================== */

/**
 * 向 Minecraft 日志输出测试信息（游戏内无显示）。
 * @param params 任意数量、任意类型的参数
 */
declare function print(...params: unknown[]): void;

/**
 * 把一个 List 转换成 Java 数组（内部即 List.toArray()）。
 * JS 中无法直接调用 [].toArray()，故提供此方法。
 * @param array 待转换的数组 / Java 列表
 * @returns 转换后的 Java 数组
 */
declare function asJavaArray<T>(array: T[]): T[];

/**
 * 载入并运行位置相对于当前 JS 文件的另一个 JS 文件。
 * @param relPath 相对于本 JS 文件的路径
 */
declare function include(relPath: string): void;

/**
 * 载入并运行资源包中某个位置的 JS 文件，如 include(Resources.id("mtr:path/absolute.js"))。
 * @param path 资源包内资源位置
 */
declare function include(path: ResourceLocation): void;

/**
 * 加载一个 Java 包（等价于 Java 的 import xxx.*）。
 * 例：importPackage(java.awt)。
 * @param src 包名
 */
declare function importPackage(src: string): void;

/**
 * 导入一个 Java 类（等价于 Java 的 import xxx;）。
 * 例：importClass("java.util.ArrayList")。
 * @param src 全限定类名
 */
declare function importClass(src: string): void;

/* =====================================================================
 * 全局对象与变量
 * ===================================================================== */

/**
 * Rhino 的 Java 包访问入口：Packages.包名.类名。
 * 例：new Packages.mtr.data.Station()。
 * （桥接对象，此处不做强类型约束。）
 */
declare const Packages: any;

/**
 * Java 标准库的简写入口（等价于 Packages.java）。
 * 例：java.awt.image.BufferedImage、java.util.Optional（文档说明可直接使用）。
 * （桥接对象，此处不做强类型约束。）
 */
declare const java: any;

/**
 * GraalJS / JSR 223 标准的 Java 类引用入口（ANTE 1.1.1+）。
 * 推荐用它替代 importClass / importPackage。
 * （桥接对象，此处不做强类型约束。）
 */
declare const Java: {
  /**
   * 按全限定名引用一个 Java 类，如 Java.type('java.util.ArrayList')。
   * @param className 全限定类名
   */
  type(className: string): any;
};

/**
 * 使用本脚本的 JSON 块的配置信息。
 * 例如配置块键名为 qssnn，则 CONFIG_INFO.key === "qssnn"，
 * 其余字段（configs、objects 等）与 JSON 中的定义一致。
 */
declare const CONFIG_INFO: ConfigInfo;

/** 脚本对应 JSON 配置块的内容。 */
interface ConfigInfo {
  /** 该配置块在 JSON 文件中的键名（如 "qssnn"）。 */
  readonly key: string;
  /** 该配置块的 name 字段。 */
  readonly name?: string;
  /** 该配置块中的其余任意字段，来源于资源包 JSON 的定义。 */
  readonly [field: string]: unknown;
}

/* =====================================================================
 * 通用工具类型 与 外部（Java / Minecraft）类型占位
 * ===================================================================== */

/**
 * Java 8 的 Optional，用于表示“值可能为空”。
 * ANTE 已把它加入脚本环境，通常用 java.util.Optional.empty() / of(...) 创建。
 */
interface Optional<T> {}

/** 无参数、无返回值的任务（对应 Java 的 Runnable）。 */
type Runnable = () => void;

/** 我的世界的文本组件。通常用 ComponentUtil 创建。 */
interface Component {}

/** Minecraft 资源位置，用于标识资源包内的文件。请用 Resources.id / idr 获取。 */
interface ResourceLocation {}

/** Minecraft 的方块坐标。 */
interface BlockPos {}

/** Minecraft 的 Vec3 坐标。 */
interface Vec3 {}

/** Java NIO 的 FloatBuffer。 */
interface FloatBuffer {}

/** Java AWT 字体。 */
interface Font {}

/** Java AWT 的 FontRenderContext。 */
interface FontRenderContext {}

/** Java AWT 的 BufferedImage。 */
interface BufferedImage {}

/** Minecraft 原版 NBT 的 CompoundTag。请用 Resources.parseNbtString 获取。 */
interface CompoundTag {}

/** 当前世界（Minecraft 的 Level）。 */
interface Level {}

/** MTR 的站点。 */
interface Station {}

/** MTR 的站台。 */
interface Platform {}

/** Minecraft 的实体。 */
interface Entity {}

/** 声音的播放介质（BLOCK、MASTER 等）。请用 SoundHelper.getSoundSource 获取。 */
interface SoundSource {}

/** 一段声音事件（SoundEvent）。 */
interface SoundEvent {}

/** 一个声音实例（SoundInstance），如 TickableSound。 */
interface SoundInstance {}

/** SoundInstance 的嵌套类型定义。 */
declare namespace SoundInstance {
  /** 声音衰减方式。 */
  interface Attenuation {}
}

/** 播放中的声音（Sound）。 */
interface Sound {}

/** 粒子的参数（ParticleOptions）。 */
interface ParticleOptions {}

/** 简单粒子类型（SimpleParticleType）。 */
interface SimpleParticleType {}

/** 粒子类型（ParticleType）。 */
interface ParticleType {}

/** Minecraft 的屏幕（Screen）。 */
interface Screen {}

/** Minecraft 的按钮（Button）。请用 IScreen.newButton 创建。 */
interface Button {}

/** Button 的嵌套类型定义。 */
declare namespace Button {
  /** 按钮按下时的回调。 */
  interface OnPress {}
  /** 按钮的提示（Tooltip）回调。 */
  interface OnTooltip {}
}

/** ClothConfig2 的配置构建器（ConfigBuilder）。 */
interface ConfigBuilder {}

/** ClothConfig2 的配置条目构建器（ConfigEntryBuilder）。 */
interface ConfigEntryBuilder {}

/** ClothConfig2 的配置列表条目（AbstractConfigListEntry）。 */
interface AbstractConfigListEntry {}

/** ANTE 扩展的按钮列表条目（ButtonListEntry）。 */
interface ButtonListEntry {}

/** ButtonListEntry 的嵌套类型定义。 */
declare namespace ButtonListEntry {
  /** 条目值的处理器。 */
  interface Processor {}
}

/** Java NIO 的 Path。 */
interface Path {}

/** 1.19.0 之前 Minecraft 原版使用的矩阵类型。 */
declare namespace com {
  namespace mojang {
    namespace math {
      /** com.mojang.math.Matrix4f。 */
      interface Matrix4f {}
    }
  }
}

/** 1.19.0 及之后 Minecraft 原版使用的矩阵类型。 */
declare namespace org {
  namespace joml {
    /** org.joml.Matrix4f。 */
    interface Matrix4f {}
  }
}

/* =====================================================================
 * Resources —— 资源管理（js-resources-env.md / js-util.md）
 * ===================================================================== */

declare class Resources {
  /**
   * 将字符串转为对应的 ResourceLocation。
   * 例：Resources.id("mtr:path/absolute.js")。
   * @param idStr 资源位置字符串（形如 "命名空间:路径"）
   */
  static id(idStr: string): ResourceLocation;

  /**
   * 相对当前 JS 文件的另一个文件的 ResourceLocation。
   * 例：Resources.idr("ccc.png")。目前不能在 create / render / dispose 函数内使用。
   * @param relPath 相对路径
   */
  static idr(relPath: string): ResourceLocation;

  /** 同 idr（相对当前 JS 文件的资源位置）。 */
  static idRelative(relPath: string): ResourceLocation;

  /**
   * 获取一个系统或 MTR 内置字体（如 Noto Serif、Noto Sans、Serif、SansSerif、Monospaced）。
   * @param name 字体名称
   */
  static getSystemFont(name: string): Font;

  /**
   * 加载一张图片为 BufferedImage。
   * @param path 图片资源位置
   */
  static readBufferedImage(path: ResourceLocation): BufferedImage;

  /**
   * 加载一个 TTF 或 OTF 字体为 Font。
   * @param path 字体资源位置
   */
  static readFont(path: ResourceLocation): Font;

  /** 获取一个 AWT FontRenderContext。 */
  static getFontRenderContext(): FontRenderContext;

  /**
   * 获取资源管理器，供 ModelManager.loadRawModel / loadPartedRawModel 等使用。
   * 文档未说明该对象自身的成员，故返回类型留作占位。
   */
  static manager(): unknown;

  /**
   * 将一个资源文件的内容作为字符串读出；读取失败时返回 null。
   * @param location 资源位置
   */
  static readString(location: ResourceLocation): string | null;

  /**
   * 解析 NBT 字符串（命令方块写法）为原版 CompoundTag。
   * @param nbtStr NBT 字符串
   */
  static parseNbtString(nbtStr: string): CompoundTag;

  /** MTR 的版本字符串，形如 "1.19.2-3.1.0-hotfix-1"。 */
  static getMTRVersion(): string;

  /** NTE 的版本字符串，形如 "0.4.0+1.19.2"。 */
  static getNTEVersion(): string;

  /** NTE 版本的数字形式，便于比较（如 0.4.0 为 4000，1.9.1 为 19100）。 */
  static getNTEVersionInt(): number;

  /** NTE 的存档格式版本数字。 */
  static getNTEProtoVersion(): number;
}

/* =====================================================================
 * 工具类（js-util.md）
 * ===================================================================== */

/** 分割 MTR 车站命名（"中文|English||EXTRA"）的工具类。 */
declare class TextUtil {
  /** 获取中文部分。 */
  static getCjkParts(src: string): string;
  /** 获取英文部分。 */
  static getNonCjkParts(src: string): string;
  /** 获取隐藏（EXTRA）部分。 */
  static getExtraParts(src: string): string;
  /** 获取中文和英文部分。 */
  static getNonExtraParts(src: string): string;
  /** 获取英文和隐藏部分。 */
  static getNonCjkAndExtraParts(src: string): string;
  /** 检查一个字符串是否包含中文字（文档标注返回类型为 String）。 */
  static isCjk(src: string): string;
}

/** 时间工具类。 */
declare class Timing {
  /** 游戏运行时间，单位秒，递增；游戏暂停时停止增长。 */
  static elapsed(): number;
  /** 本次 render 调用与上次之间的时间差（秒）。 */
  static delta(): number;
}

/**
 * 状态跟踪器，用于检测状态的转换。
 * 每列车逻辑独立，建议存入列车的 state 中。
 */
declare class StateTracker {
  /** 创建一个 StateTracker。 */
  constructor();
  /** 设置当前状态；不调用时保持原状态。 */
  setState(value: string): void;
  /** 获取当前状态。 */
  stateNow(): string;
  /** 获取上一个状态；没有则返回 null。 */
  stateLast(): string | null;
  /** 当前状态已持续的时间。 */
  stateNowDuration(): number;
  /** 是否是刚刚通过 setState 换入当前状态。 */
  stateNowFirst(): boolean;
}

/** 按时间自动循环切换的 StateTracker。建议存入列车的 state 中。 */
declare class CycleTracker {
  /**
   * 创建一个 CycleTracker。
   * params 依次为各个状态名与其持续时间（秒），如 new CycleTracker(["route", 5, "nextStation", 5])。
   * @param params 状态名与持续时间交替组成的数组
   */
  constructor(params: unknown[]);
  /** 根据当前时间更新状态。 */
  tick(): void;
  /** 获取当前状态。 */
  stateNow(): string;
  /** 获取上一个状态；没有则返回 null。 */
  stateLast(): string | null;
  /** 当前状态已持续的时间。 */
  stateNowDuration(): number;
  /** 是否是刚刚通过 tick 换入当前状态。 */
  stateNowFirst(): boolean;
}

/** 频率限制工具类，用于限制某段代码的执行频率。建议存入列车的 state 中。 */
declare class RateLimit {
  /**
   * 创建一个 RateLimit。
   * @param interval 两次执行之间的最小间隔（秒），如 0.1 表示一秒十次
   */
  constructor(interval: number);
  /** 距上次运行是否已过去足够长的时间。 */
  shouldUpdate(): boolean;
  /** 重置计时，使其马上可以再次运行。 */
  resetCoolDown(): void;
}

/** MTR 的客户端数据（读取换乘线路等）。具体成员参见 MTR 的 ClientData。 */
declare class MTRClientData {}

/** 因混淆表原因，提供客户端相关辅助方法。 */
declare class MinecraftClient {
  /** 世界是否在下雨。 */
  static worldIsRaining(): boolean;
  /** 世界某方块处是否正在下雨且被淋到。 */
  static worldIsRainingAt(pos: Vector3f): boolean;
  /** 世界的一天内时间（单位：Tick）。 */
  static worldDayTime(): number;
  /** 调用系统“讲述人”读出一段文本。 */
  static narrate(text: string): void;
  /**
   * 在聊天框或操作栏显示文本。
   * @param message 文本
   * @param actionBar 为 true 显示在操作栏，否则显示在聊天框
   */
  static displayMessage(message: string, actionBar: boolean): void;
  /** 在主线程中执行一个任务。 */
  static execute(task: Runnable): void;
  /** 触发一个世界事件。 */
  static levelEvent(p_109534_: number, p_109535_: Vector3f, p_109536_: number): void;
  /** 获取某个位置的通过等级。 */
  static getOccupiedAspect(vPos: Vector3f, facing: number, aspects: number): number;
  /** 获取某位置处的车站。 */
  static getStationAt(pos: Vector3f): Station;
  /** 获取某范围内的站台。 */
  static getPlatformAt(pos: Vector3f, radius: number, lower: number, upper: number): Platform;
  /** 获取某位置周围的节点坐标。 */
  static getNodeAt(vPos: Vector3f, fFacing: number): Vector3f;
  /** 获取某位置的亮度颜色。 */
  static getLightColor(pos: Vector3f): number;
  /** 获取相机位置。 */
  static getCameraPos(): Vector3f;
  /** 获取相机到某位置的距离。 */
  static getCameraDistance(from: Vector3f): number;
  /** 获取相机的实体。 */
  static getCameraEntity(): WrappedEntity;
  /** 获取玩家的实体。 */
  static getPlayer(): WrappedEntity;
  /** 获取当前世界。 */
  static getLevel(): Level;
  /**
   * 检查从 p1 到 p2 两侧是否可以开门。
   * @returns {doorLeftOpen, doorRightOpen}；客户端无相关数据时返回 false
   */
  static canOpenDoorsAt(p1: Vector3f, p2: Vector3f): boolean[];
  /** 包装一个光照贴图。 */
  static packLightTexture(a: number, b: number): number;
  /**
   * 设置屏幕。
   * @param screen 屏幕；传入 null 关闭屏幕
   */
  static setScreen(screen: Screen | null): void;
  /** 重新加载资源包。 */
  static reloadResourcePacks(): void;
  /** 标记渲染器所有数据都已改变。 */
  static markRendererAllChanged(): void;
}

/** 可实时更新参数的声音。 */
declare class TickableSound {
  /**
   * 以 BLOCK 声源创建一个 TickableSound。
   * @param sound 声音资源位置
   */
  constructor(sound: ResourceLocation);
  /**
   * 以指定声源创建一个 TickableSound。
   * @param sound 声音资源位置
   * @param source 声源
   */
  constructor(sound: ResourceLocation, source: SoundSource);
  /** 设置音量、音调、位置。 */
  setData(volume: number, pitch: number, pos: Vector3f): void;
  /** 设置是否循环播放。 */
  setLooping(looping: boolean): void;
  /** 设置延迟播放的时间。 */
  setDelay(delay: number): void;
  /** 设置声音衰减。 */
  setAttenuation(attenuation: boolean): void;
  /** 设置声音是否相对于玩家。 */
  setRelative(relative: boolean): void;
  /** 播放声音（等价于 SoundHelper.play(this)）。 */
  play(): void;
  /** 停止播放声音（等价于 SoundHelper.stop(this)）。 */
  quit(): void;
  /** 暂停播放声音。 */
  pause(): void;
  /** 获取声音。 */
  getSound(): Sound;
  /** 获取声音的标签位置。 */
  getLocation(): ResourceLocation;
  /** 获取声音的声源。 */
  getSource(): SoundSource;
  /** 是否循环播放。 */
  isLooping(): boolean;
  /** 获取音量。 */
  getVolume(): number;
  /** 获取音调。 */
  getPitch(): number;
  /** 获取延迟播放的时间。 */
  getDelay(): number;
  /** 获取声音衰减。 */
  getAttenuation(): SoundInstance.Attenuation;
  /** 是否声音相对于玩家。 */
  isRelative(): boolean;
  /** 转为字符串（调试时自动调用）。 */
  toString(): string;
}

/** 声音相关功能。 */
declare class SoundHelper {
  /** 播放一个声音实例（如 TickableSound、TrainLoopingSoundInstance）。 */
  static play(sound: SoundInstance): void;
  /**
   * 延迟一段时间后播放声音。
   * @param sound 声音实例
   * @param delay 延迟时间
   */
  static play(sound: SoundInstance, delay: number): void;
  /** 在指定位置播放一个 SoundEvent。 */
  static play(sound: SoundEvent, pos: Vector3f, volume: number, pitch: number): void;
  /** 以指定声源在指定位置播放一个 SoundEvent。 */
  static play(sound: SoundEvent, pos: Vector3f, source: SoundSource, volume: number, pitch: number): void;
  /** 停止所有声音。 */
  static stop(): void;
  /** 停止某个声音实例。 */
  static stop(sound: SoundInstance): void;
  /** 停止以某声源播放的某一个 SoundEvent 的所有声音。 */
  static stop(sound: SoundEvent, source: SoundSource): void;
  /** 停止以 BLOCK 声源播放的某一个 SoundEvent 的所有声音。 */
  static stop(sound: SoundEvent): void;
  /** 根据字符串获取一个 SoundSource。 */
  static getSoundSource(str: string): SoundSource;
}

/** 粒子相关功能。 */
declare class ParticleHelper {
  /** 在某个位置添加一个粒子。 */
  static addParticle(particle: ParticleOptions, pos: Vector3f, config: Vector3f): void;
  /** 在某个位置添加一个粒子，并忽略粒子限制器。 */
  static addParticle(particle: ParticleOptions, isOverrideLimiter: boolean, pos: Vector3f, config: Vector3f): void;
  /** 在某个位置添加一个粒子，并忽略粒子限制器与是否在地上。 */
  static addParticle(particle: ParticleOptions, isOverrideLimiter: boolean, isOnGround: boolean, pos: Vector3f, config: Vector3f): void;
  /**
   * 根据名字获取一个 SimpleParticleType / ParticleType（名称见 Minecraft Wiki 的“JAVA版ID名”）。
   * @param particleName 粒子名称
   */
  static getParticleType(particleName: string): SimpleParticleType;
}

/** 文本组件工具类。 */
declare class ComponentUtil {
  /**
   * 获取一个可翻译的组件。
   * @param text 翻译键
   * @param objects 可变参数，用于替换翻译文本中的占位符
   */
  static translatable(text: string, ...objects: unknown[]): Component;
  /** 将字符串转化为组件。 */
  static literal(text: string): Component;
  /** 将组件转化为字符串。 */
  static getString(component: Component): string;
}

/** ANTE 实现的 Map，用法与 Map 基本相同（此处仅声明类型，成员参见源码 OrderedMap.java）。 */
interface OrderedMap<K, V> {}

/** OrderedMap 中方块的放置顺序。 */
declare enum PlacementOrder {
  /** 上面。 */
  UPPER,
  /** 中间。 */
  CENTRAL,
  /** 下面。 */
  LOWER,
}

/** 包装 Minecraft 实体，规避混淆表带来的问题。 */
declare class WrappedEntity {
  /**
   * 创建一个 WrappedEntity。
   * @param entity 被包装的实体
   */
  constructor(entity: Entity);
  /** 获取实体的 X 坐标。 */
  getX(): number;
  /** 获取实体的 Y 坐标。 */
  getY(): number;
  /** 获取实体的 Z 坐标。 */
  getZ(): number;
  /** 获取实体的视线方向。 */
  getLookAngle(): Vector3f;
  /** 获取实体的位置。 */
  getPosition(): Vector3f;
}

/** ANTE 的屏幕接口。 */
declare class IScreen {
  /** 创建一个按钮（可选提供提示回调）。 */
  static newButton(x: number, y: number, width: number, height: number, text: Component, onPress: Button.OnPress): Button;
  /** 创建一个按钮（带提示回调）。 */
  static newButton(x: number, y: number, width: number, height: number, text: Component, onPress: Button.OnPress, onTooltip: Button.OnTooltip): Button;
}

/** IScreen 的嵌套类型定义。 */
declare namespace IScreen {
  /** ClothConfig2 相关辅助方法。 */
  class ClothConfig2 {
    /** 创建一个 ConfigBuilder。 */
    static createConfigBuilder(): ConfigBuilder;
    /**
     * 创建一个 ANTE 添加的按钮列表条目。
     * @param tooltipSupplier 提示信息提供者，可为 null 表示没有提示
     * @param requiresRestart 是否需要重启游戏
     */
    static newButtonListEntry(name: Component, button: Button, processor: ButtonListEntry.Processor, tooltipSupplier: (() => Optional<Component[]>) | null, requiresRestart: boolean): ButtonListEntry;
  }

  /** 高度自定义的屏幕，提供一个 GraphicsTexture 用于自绘。 */
  class WithTexture {
    /**
     * 创建一个 WithTexture。
     * @param title 标题组件
     */
    constructor(title: Component);
    /** 用于绘制屏幕的 GraphicsTexture（宽高为实际屏幕宽高）。 */
    texture: GraphicsTexture;
    /** 用于存储任意状态的对象。 */
    state: Record<string, unknown>;
    /** 当前是否为暂停界面。 */
    isPauseScreen: boolean;
    /** 初始化函数，在创建时或调整窗口大小时调用。 */
    initFunction: (screen: WithTexture, width: number, height: number) => void;
    /** 键盘按下响应器。 */
    keyPressResponder: (screen: WithTexture, i1: number, i2: number, i3: number) => boolean;
    /** 插入文本函数。 */
    insertTextFunction: (screen: WithTexture, text: string, i1: number) => void;
    /** 渲染函数，在屏幕渲染时调用。 */
    renderFunction: (screen: WithTexture, mouseX: number, mouseY: number, delta: number) => void;
    /** tick 函数，每帧调用。 */
    tickFunction: (screen: WithTexture) => void;
    /** 文件拖放函数。 */
    onFilesDropFunction: (screen: WithTexture, files: Path[]) => void;
    /** 关闭函数。 */
    onCloseFunction: (screen: WithTexture) => void;
    /** 鼠标点击函数。 */
    mouseClickedFunction: (screen: WithTexture, x: number, y: number, i: number) => boolean;
    /** 鼠标移动函数。 */
    mouseMovedFunction: (screen: WithTexture, x: number, y: number) => void;
    /** 鼠标是否在某个组件上的判定函数。 */
    isMouseOverFunction: (screen: WithTexture, x: number, y: number) => boolean;
    /** 字符输入函数。 */
    charTypedFunction: (screen: WithTexture, p_94732_: string, p_94733_: number) => boolean;
    /** 键盘释放函数。 */
    keyReleasedFunction: (screen: WithTexture, p_94750_: number, p_94751_: number, p_94752_: number) => void;
    /** 鼠标滚动函数。 */
    mouseScrolledFunction: (screen: WithTexture, x: number, y: number, value: number) => boolean;
    /** 鼠标拖拽函数。 */
    mouseDraggedFunction: (screen: WithTexture, sx: number, sy: number, ex: number, ey: number, i: number) => void;
    /** 鼠标释放函数。 */
    mouseReleasedFunction: (screen: WithTexture, x: number, y: number, i: number) => void;
  }
}

/** 全局注册器，用于打通不同脚本之间的通信（单实例化）。 */
declare class GlobalRegister {
  /** 向注册表中添加一个对象。 */
  static put(key: string, value: unknown): void;
  /** 从注册表中获取一个对象。 */
  static get(key: string): unknown;
}

/** ANTE 序列化装饰物件形状的工具类（一般用不到）。 */
declare class ShapeSerializer {}

/** MTR 的绘制接口。 */
interface IDrawing {}

/** MTR 的客户端工具类。 */
declare class UtilitiesClient {}

/* =====================================================================
 * 数学类（js-math.md）
 * ===================================================================== */

/** 三维矢量，即 (x, y, z) 坐标。 */
declare class Vector3f {
  /**
   * 由三个分量创建一个 Vector3f。
   * @param x X 分量
   * @param y Y 分量
   * @param z Z 分量
   */
  constructor(x: number, y: number, z: number);
  /**
   * 复制另一个 Vector3f。
   * @param other 被复制的矢量
   */
  constructor(other: Vector3f);
  /**
   * 由一个 BlockPos 创建。
   * @param blockPos 方块坐标
   */
  constructor(blockPos: BlockPos);
  /**
   * 由一个 Vec3 创建。
   * @param vec3 源坐标
   */
  constructor(vec3: Vec3);

  /** 一个零矢量。不要对它做操作。 */
  static readonly ZERO: Vector3f;
  /** (1, 0, 0)。 */
  static readonly XP: Vector3f;
  /** (0, 1, 0)。 */
  static readonly YP: Vector3f;
  /** (0, 0, 1)。 */
  static readonly ZP: Vector3f;

  /** 获取 X 坐标。 */
  x(): number;
  /** 获取 Y 坐标。 */
  y(): number;
  /** 获取 Z 坐标。 */
  z(): number;
  /** 复制一个 Vector3f，以便独立修改。 */
  copy(): Vector3f;
  /** 标准化为单位矢量（保持方向，长度变为 1）。 */
  normalize(): void;
  /** 加上一个矢量 (x, y, z)。 */
  add(x: number, y: number, z: number): void;
  /** 加上另一个矢量。 */
  add(other: Vector3f): void;
  /** 减去另一个矢量。 */
  sub(other: Vector3f): void;
  /** 三个分量分别加上三个数相乘。 */
  mul(x: number, y: number, z: number): void;
  /** 数乘：三个分量分别乘以同一个数。 */
  mul(n: number): void;
  /** 在原点绕一个方向旋转（弧度制，正值逆时针；axis 需为单位矢量）。 */
  rot(axis: Vector3f, rad: number): void;
  /** 同 rot，但采用角度制。 */
  rotDeg(axis: Vector3f, deg: number): void;
  /** 按 X 轴旋转（弧度制）。 */
  rotX(rad: number): void;
  /** 按 Y 轴旋转（弧度制）。 */
  rotY(rad: number): void;
  /** 按 Z 轴旋转（弧度制）。 */
  rotZ(rad: number): void;
  /** 与另一个矢量计算叉积，并让自身成为结果。 */
  cross(other: Vector3f): void;
  /** 到另一个矢量代表坐标的距离。 */
  distance(other: Vector3f): number;
  /** 到另一个矢量代表坐标的距离的平方（更快）。 */
  distanceSq(other: Vector3f): number;
  /** 取整转换为原版 BlockPos。 */
  toBlockPos(): BlockPos;
  /** 转换为 Vec3。 */
  toVec3(): Vec3;
  /** 转换成字符串。 */
  toString(): string;
}

/** 4x4 矩阵（包装当前版本原版的 Matrix4f）。注意：更靠后调用的变换离原始模型更近。 */
declare class Matrix4f {
  /** 创建一个单位矩阵（不做任何变换）。 */
  constructor();
  /**
   * 复制另一个矩阵。
   * @param other 被复制的矩阵
   */
  constructor(other: Matrix4f);

  /** 增加一个平移 (x, y, z) 的变换。 */
  translate(x: number, y: number, z: number): void;
  /** 增加一个平移 (x, y, z) 的变换。 */
  translate(other: Vector3f): void;
  /** 增加一个在原点绕某方向旋转的变换（弧度制，正值逆时针；axis 需为单位矢量）。 */
  rotate(axis: Vector3f, rad: number): void;
  /** 按 X 轴旋转（弧度制）。 */
  rotateX(rad: number): void;
  /** 按 Y 轴旋转（弧度制）。 */
  rotateY(rad: number): void;
  /** 按 Z 轴旋转（弧度制）。 */
  rotateZ(rad: number): void;
  /** 按 X/Y/Z 轴旋转（弧度制）。 */
  rotateXYZ(rx: number, ry: number, rz: number): void;
  /** 按 X/Y/Z 轴旋转（弧度制）。 */
  rotateXYZ(vs: Vector3f): void;
  /** 按 Y/X/Z 轴旋转（弧度制）。 */
  rotateYXZ(rx: number, ry: number, rz: number): void;
  /** 按 Y/X/Z 轴旋转（弧度制）。 */
  rotateYXZ(vs: Vector3f): void;
  /** 按 Z/Y/X 轴旋转（弧度制）。 */
  rotateZYX(rx: number, ry: number, rz: number): void;
  /** 按 Z/Y/X 轴旋转（弧度制）。 */
  rotateZYX(vs: Vector3f): void;
  /** 获取当前矩阵的欧拉角（XYZ）。 */
  getEulerAnglesXYZ(): Vector3f;
  /** 获取当前矩阵的欧拉角（YXZ）。 */
  getEulerAnglesYXZ(): Vector3f;
  /** 获取当前矩阵的欧拉角（ZYX）。 */
  getEulerAnglesZYX(): Vector3f;
  /** 复制一个 Matrix4f，以便独立修改。 */
  copy(): Matrix4f;
  /** 右乘另一个变换矩阵（把那个矩阵的变换接在后面）。 */
  multiply(other: Matrix4f): void;
  /** 计算坐标经此变换后的结果（返回新 Vector3f，不修改输入）。 */
  transform(vec: Vector3f): Vector3f;
  /** 同 transform，但只计入旋转不计入平移。 */
  transform3(vec: Vector3f): Vector3f;
  /** (0,0,0) 经此变换后的坐标。 */
  getTranslationPart(): Vector3f;
  /** 转换成原版矩阵类型（1.19.0 前为 com.mojang.math.Matrix4f，1.19.0 起为 org.joml.Matrix4f）。 */
  asMoj(): com.mojang.math.Matrix4f | org.joml.Matrix4f;
  /** 增加一个缩放 (x, y, z) 的变换。 */
  scale(x: number, y: number, z: number): void;
  /** 存储到一个 FloatBuffer 中。 */
  store(buffer: FloatBuffer): void;
  /** 从一个 FloatBuffer 中加载。 */
  load(buffer: FloatBuffer): void;

  /** 获取一个平移变换矩阵。 */
  static translation(x: number, y: number, z: number): Matrix4f;
}

/** 变换矩阵堆栈。push 与 pop 需成对进行。 */
declare class Matrices {
  /** 创建一个 Matrices（初始只有一项单位矩阵）。 */
  constructor();
  /** 为当前状态增加一个平移 (x, y, z) 的变换。 */
  translate(x: number, y: number, z: number): void;
  /** 为当前状态增加一个在原点绕某方向旋转的变换（弧度制，正值逆时针；axis 需为单位矢量）。 */
  rotate(axis: Vector3f, rad: number): void;
  /** 按 X 轴旋转（弧度制）。 */
  rotateX(rad: number): void;
  /** 按 Y 轴旋转（弧度制）。 */
  rotateY(rad: number): void;
  /** 按 Z 轴旋转（弧度制）。 */
  rotateZ(rad: number): void;
  /** 获取当前状态。 */
  last(): Matrix4f;
  /** 将当前状态复制一份压入堆栈。 */
  pushPose(): void;
  /** 弹出堆栈最后一项，恢复为上一个保存的状态。 */
  popPose(): void;
  /** 先恢复再保存。 */
  popPushPose(): void;
  /** 现在是否只有一项。 */
  clear(): boolean;
  /** 将当前状态重设为单位矩阵。 */
  setIdentity(): void;
}

/* =====================================================================
 * 自定义配置（js-custom-config.md）
 * ===================================================================== */

/**
 * 配置响应器，用于存储与响应配置项。
 * 也可用 new ConfigResponder({ key, init, getListEntries }) 传入对象字面量实现。
 */
declare class ConfigResponder {
  /**
   * 以对象字面量实现一个配置响应器。
   * @param responder 实现（key / init / getListEntries）
   */
  constructor(responder: ConfigResponder.ResponderImpl);
  /** 获取配置项的标识。 */
  key(): string;
  /** 初始化配置项（每次注册时调用）。 */
  init(configMap: Record<string, string>): void;
  /**
   * 获取列表条目。
   * @param configMap 配置项映射（Java Map，支持 [key] 取值与 for..of 遍历）
   * @param builder 列表条目构建器
   * @param screenSupplier 调用 screenSupplier() 可获取本界面（Supplier<Screen>）
   */
  getListEntries(configMap: Record<string, string>, builder: ConfigEntryBuilder, screenSupplier: () => Screen): AbstractConfigListEntry[];
}

/** ConfigResponder 及其内置实现。 */
declare namespace ConfigResponder {
  /** 对象字面量形式的配置响应器实现。 */
  interface ResponderImpl {
    /** 获取配置项的标识。 */
    key(): string;
    /** 初始化配置项。 */
    init(configMap: Record<string, string>): void;
    /** 获取列表条目。 */
    getListEntries(configMap: Record<string, string>, builder: ConfigEntryBuilder, screenSupplier: () => Screen): AbstractConfigListEntry[];
  }

  /** 文本输入框配置响应器。支持链式调用。 */
  class TextField {
    /**
     * 创建一个文本输入框配置响应器。
     * @param key 配置项标识
     * @param name 配置项名称
     * @param defaultValue 默认值
     */
    constructor(key: string, name: Component, defaultValue: string);
    /**
     * 创建一个文本输入框配置响应器（完整参数）。
     * @param key 配置项标识
     * @param name 配置项名称
     * @param defaultValue 默认值
     * @param transformer 转换器
     * @param errorSupplier 错误提示（返回为空表示无错误）
     * @param saveConsumer 保存函数
     * @param tooltipSupplier 提示信息（返回为空表示无提示）
     * @param requireRestart 是否需要重启游戏
     */
    constructor(key: string, name: Component, defaultValue: string, transformer: (value: string) => string, errorSupplier: (value: string) => Optional<Component>, saveConsumer: (value: string) => void, tooltipSupplier: (value: string) => Optional<Component[]>, requireRestart: boolean);

    /** 配置项的标识。 */
    key: string;
    /** 配置项的名称。 */
    name: Component;
    /** 配置项的默认值。 */
    defaultValue: string;
    /** 配置项的转换器。 */
    transformer: (value: string) => string;
    /** 配置项的错误提示。 */
    errorSupplier: (value: string) => Optional<Component>;
    /** 配置项的保存函数。 */
    saveConsumer: (value: string) => void;
    /** 配置项的提示信息（请用 asJavaArray([...]) 构造 Optional<Component[]>）。 */
    tooltipSupplier: (value: string) => Optional<Component[]>;
    /** 配置项是否需要重启游戏。 */
    requireRestart: boolean;

    /** 设置名称。 */
    setName(name: Component): TextField;
    /** 设置默认值。 */
    setDefaultValue(defaultValue: string): TextField;
    /** 设置转换器。 */
    setTransformer(transformer: (value: string) => string): TextField;
    /** 设置错误提示。 */
    setErrorSupplier(errorSupplier: (value: string) => Optional<Component>): TextField;
    /** 设置保存函数。 */
    setSaveConsumer(saveConsumer: (value: string) => void): TextField;
    /** 设置提示信息。 */
    setTooltipSupplier(tooltipSupplier: (value: string) => Optional<Component[]>): TextField;
    /** 设置是否需要重启游戏。 */
    setRequireRestart(requireRestart: boolean): TextField;
  }

  /** 循环选择器配置响应器。支持链式调用。 */
  class CycleToggle {
    /**
     * 创建一个循环选择器配置响应器。
     * @param key 配置项标识
     * @param name 配置项名称
     * @param defaultValue 默认值（所选值在 values 中的下标）
     * @param values 可选值列表
     */
    constructor(key: string, name: Component, defaultValue: number, values: string[]);
    /**
     * 创建一个循环选择器配置响应器（完整参数）。
     * @param key 配置项标识
     * @param name 配置项名称
     * @param defaultValue 默认值
     * @param values 可选值列表
     * @param tooltipSupplier 提示信息（返回为空表示无提示）
     * @param saveConsumer 保存函数
     * @param requireRestart 是否需要重启游戏
     */
    constructor(key: string, name: Component, defaultValue: number, values: string[], tooltipSupplier: (value: number) => Optional<Component[]>, saveConsumer: (value: number) => void, requireRestart: boolean);

    /** 配置项的标识。 */
    key: string;
    /** 配置项的名称。 */
    name: Component;
    /** 配置项的默认值。 */
    defaultValue: number;
    /** 配置项的可选值。 */
    values: string[];
    /** 配置项的提示信息。 */
    tooltipSupplier: (value: number) => Optional<Component[]>;
    /** 配置项的保存函数。 */
    saveConsumer: (value: number) => void;
    /** 配置项是否需要重启游戏。 */
    requireRestart: boolean;

    /** 设置名称。 */
    setName(name: Component): CycleToggle;
    /** 设置默认值。 */
    setDefaultValue(defaultValue: number): CycleToggle;
    /** 设置可选值。 */
    setValues(values: string[]): CycleToggle;
    /** 设置提示信息。 */
    setTooltipSupplier(tooltipSupplier: (value: number) => Optional<Component[]>): CycleToggle;
    /** 设置保存函数。 */
    setSaveConsumer(saveConsumer: (value: number) => void): CycleToggle;
    /** 设置是否需要重启游戏。 */
    setRequireRestart(requireRestart: boolean): CycleToggle;
  }

  /** 布尔选择器配置响应器。支持链式调用。 */
  class BooleanToggle {
    /**
     * 创建一个布尔选择器配置响应器。
     * @param key 配置项标识
     * @param name 配置项名称
     * @param defaultValue 默认值
     */
    constructor(key: string, name: Component, defaultValue: boolean);
    /**
     * 创建一个布尔选择器配置响应器（完整参数）。
     * @param key 配置项标识
     * @param name 配置项名称
     * @param defaultValue 默认值
     * @param tooltipSupplier 提示信息（返回为空表示无提示）
     * @param saveConsumer 保存函数
     * @param requireRestart 是否需要重启游戏
     */
    constructor(key: string, name: Component, defaultValue: boolean, tooltipSupplier: (value: boolean) => Optional<Component[]>, saveConsumer: (value: boolean) => void, requireRestart: boolean);

    /** 配置项的标识。 */
    key: string;
    /** 配置项的名称。 */
    name: Component;
    /** 配置项的默认值。 */
    defaultValue: boolean;
    /** 配置项的提示信息。 */
    tooltipSupplier: (value: boolean) => Optional<Component[]>;
    /** 配置项的保存函数。 */
    saveConsumer: (value: boolean) => void;
    /** 配置项是否需要重启游戏。 */
    requireRestart: boolean;

    /** 设置名称。 */
    setName(name: Component): BooleanToggle;
    /** 设置默认值。 */
    setDefaultValue(defaultValue: boolean): BooleanToggle;
    /** 设置提示信息。 */
    setTooltipSupplier(tooltipSupplier: (value: boolean) => Optional<Component[]>): BooleanToggle;
    /** 设置保存函数。 */
    setSaveConsumer(saveConsumer: (value: boolean) => void): BooleanToggle;
    /** 设置是否需要重启游戏。 */
    setRequireRestart(requireRestart: boolean): BooleanToggle;
  }

  /** 双精度浮点数滑块配置响应器。支持链式调用。 */
  class DoubleSlider {
    /**
     * 创建一个双精度浮点数滑块配置响应器。
     * @param key 配置项标识
     * @param name 配置项名称
     * @param defaultValue 默认值
     * @param min 最小值
     * @param max 最大值
     * @param step 步进层级
     */
    constructor(key: string, name: Component, defaultValue: number, min: number, max: number, step: number);
    /**
     * 创建一个双精度浮点数滑块配置响应器（完整参数）。
     * @param key 配置项标识
     * @param name 配置项名称
     * @param defaultValue 默认值
     * @param min 最小值
     * @param max 最大值
     * @param step 步进层级
     * @param tooltipSupplier 提示信息（返回为空表示无提示）
     * @param saveConsumer 保存函数
     * @param requireRestart 是否需要重启游戏
     */
    constructor(key: string, name: Component, defaultValue: number, min: number, max: number, step: number, tooltipSupplier: (value: number) => Optional<Component[]>, saveConsumer: (value: number) => void, requireRestart: boolean);

    /** 配置项的标识。 */
    key: string;
    /** 配置项的名称。 */
    name: Component;
    /** 配置项的默认值。 */
    defaultValue: number;
    /** 配置项的最小值。 */
    min: number;
    /** 配置项的最大值。 */
    max: number;
    /** 配置项的步进层级。 */
    step: number;
    /** 配置项的提示信息。 */
    tooltipSupplier: (value: number) => Optional<Component[]>;
    /** 配置项的保存函数。 */
    saveConsumer: (value: number) => void;
    /** 配置项是否需要重启游戏。 */
    requireRestart: boolean;

    /** 设置名称。 */
    setName(name: Component): DoubleSlider;
    /** 设置默认值。 */
    setDefaultValue(defaultValue: number): DoubleSlider;
    /** 设置最小值。 */
    setMin(min: number): DoubleSlider;
    /** 设置最大值。 */
    setMax(max: number): DoubleSlider;
    /** 设置步进层级。 */
    setStep(step: number): DoubleSlider;
    /** 设置提示信息。 */
    setTooltipSupplier(tooltipSupplier: (value: number) => Optional<Component[]>): DoubleSlider;
    /** 设置保存函数。 */
    setSaveConsumer(saveConsumer: (value: number) => void): DoubleSlider;
    /** 设置是否需要重启游戏。 */
    setRequireRestart(requireRestart: boolean): DoubleSlider;
  }
}

/** 客户端配置：注册与读取配置，配置保存在客户端。 */
declare class ClientConfig {
  /**
   * 添加一个配置响应器。注册后的配置会出现在 /mtrnte config 设置界面最下方。
   * @param response 配置响应器
   */
  static register(response: ConfigResponder.TextField): void;
  /**
   * 获取一个配置项的值。
   * @param key 配置项标识
   */
  static get(key: string): string;
  /** 保存所有配置项到本地文件。 */
  static save(): void;
}
