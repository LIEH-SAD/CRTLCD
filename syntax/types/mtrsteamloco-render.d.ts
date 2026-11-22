/*
 * (A)NTE / MTR Steam Loco 资源包脚本 —— 全局类型声明（模型处理与绘制调用）
 *
 * 来源文档仓库：https://github.com/aphrodite281/mtr-ante/tree/alpha/docs
 * 覆盖文档：js-model-processing.md（模型处理）、js-draw-call.md（绘制调用）、js-advanced.md（高阶技巧）
 *
 * 引擎：Rhino 1.7.14（已开启 VERSION_ES6 标记）。
 * 范围：仅覆盖上述文档已记录的 API；文档中未出现的 API 一律未声明。
 *
 * 使用说明：
 *  - 本文件是“全局声明文件”，不含顶层 import / export，脚本中可直接使用
 *    ModelManager / RawModel / RawMeshBuilder / ModelCluster / DynamicModelHolder /
 *    new DrawCall(...) / ClusterDrawCall / WorldDrawCall 等。
 *  - 与其它声明文件共用的类型（Resources、ResourceLocation、Vector3f、Matrix4f、
 *    Matrices、Runnable、Component 等）不在此重复声明，仅引用其类型名。
 *  - Java 的 List<X> / Collection<X> 在本文件中一律写作 X[]（Rhino 支持 [i] 取值与 for..of 遍历）。
 */

/* =====================================================================
 * 模型处理（js-model-processing.md）
 * ===================================================================== */

/** 面：存储了构成该面的顶点索引。 */
interface Face {}

/** 顶点：存储了位置、法线、颜色、UV 坐标与亮度。 */
interface Vertex {}

/** 顶点属性类型：描述一个顶点属性的种类。 */
interface VertAttrType {}

/** 顶点属性内容（源），存储了具体的顶点属性数据。 */
interface VertAttrSrc {}

/** 顶点属性映射：关联若干 VertAttrType 与 VertAttrSrc，并携带缓冲区信息。 */
interface VertAttrMapping {}

/**
 * 顶点属性状态。
 * 在此设定的材质颜色会与贴图上的颜色相乘。
 */
interface VertAttrState {
  /** 颜色，格式为 RRGGBBAA（32 位整数，每项 0~255）。 */
  color: number;
  /**
   * 设置颜色（一次性传入 RRGGBBAA）。
   * @param rgba 32 位颜色值，格式 RRGGBBAA
   */
  setColor(rgba: number): void;
  /**
   * 设置颜色（按分量传入）。
   * @param red 红，0~255
   * @param green 绿，0~255
   * @param blue 蓝，0~255
   * @param alpha 透明度，0~255
   */
  setColor(red: number, green: number, blue: number, alpha: number): void;
}

/** 材质属性：记录贴图路径、着色器种类、材质颜色（颜色存于 attrState）等。 */
interface MaterialProp {
  /** 材质（着色器）名称。 */
  shaderName: string;
  /** 材质使用的贴图路径。 */
  texture: ResourceLocation;
  /** 材质是否透明。 */
  translucent: boolean;
  /** 材质是否写入深度缓冲区。 */
  writeDepthBuf: boolean;
  /** 材质是否始终面向摄像机（billboard）。 */
  billboard: boolean;
  /** 顶点属性状态（材质颜色在此设定，会与贴图颜色相乘）。 */
  attrState: VertAttrState;
}

/** 上传后的单个网格：绑定了对应 VBO / EBO 的 VAO 对象引用。 */
interface VertArray {
  /** 该网格的材质属性。 */
  materialProp: MaterialProp;
  /** 该网格的顶点属性映射。 */
  mapping: VertAttrMapping;
}

/** 上传后的模型：包含多个 VertArray（每个不同材质对应一个）。 */
interface VertArrays {
  /** 各个不同材质所对应的 VertArray。 */
  meshList: VertArray[];
  /**
   * 把所有文件名为 oldTexture 的贴图替换为 newTexture。
   * @param oldTexture 原贴图文件名
   * @param newTexture 新贴图资源位置
   */
  replaceTexture(oldTexture: string, newTexture: ResourceLocation): void;
  /**
   * 把所有贴图替换为 newTexture。
   * @param newTexture 新贴图资源位置
   */
  replaceAllTexture(newTexture: ResourceLocation): void;
}

/** 原始网格：包含一个材质属性、一个面数组与一个顶点数组。 */
interface RawMesh {
  /** 该网格使用的材质属性。 */
  materialProp: MaterialProp;
  /** 面数组（每个面存储顶点索引）。 */
  faces: Face[];
  /** 顶点数组。 */
  vertices: Vertex[];
}

/**
 * 原始网格构造器：用于在程序中构建 RawMesh。
 * 支持链式调用（每个方法都返回自身，可把多个操作串在一起）。
 */
declare class RawMeshBuilder {
  /**
   * 创建一个 RawMeshBuilder。
   * @param faceSize 每个面的顶点数量（四边形为 4，三角形为 3）
   * @param renderType 渲染类型，如 "interior" / "exterior"
   * @param texture 默认贴图资源位置
   */
  constructor(faceSize: number, renderType: string, texture: ResourceLocation);
  /** 重置此构造器，并返回自身。 */
  reset(): RawMeshBuilder;
  /**
   * 添加一个顶点（矢量形式），并返回自身。
   * @param position 顶点位置
   */
  vertex(position: Vector3f): RawMeshBuilder;
  /**
   * 添加一个顶点（分量形式），并返回自身。
   * @param x X 坐标
   * @param y Y 坐标
   * @param z Z 坐标
   */
  vertex(x: number, y: number, z: number): RawMeshBuilder;
  /**
   * 设定当前顶点的法向量，并返回自身。
   * @param x 法线 X 分量
   * @param y 法线 Y 分量
   * @param z 法线 Z 分量
   */
  normal(x: number, y: number, z: number): RawMeshBuilder;
  /**
   * 设定当前顶点的 UV 坐标，并返回自身。
   * @param x U 坐标
   * @param y V 坐标
   */
  uv(x: number, y: number): RawMeshBuilder;
  /** 结束当前顶点的定义（顺序一般为 vertex -> normal/uv -> endVertex），并返回自身。 */
  endVertex(): RawMeshBuilder;
  /**
   * 设置材质颜色，并返回自身。
   * @param red 红，0~255
   * @param green 绿，0~255
   * @param blue 蓝，0~255
   * @param alpha 透明度，0~255
   */
  color(red: number, green: number, blue: number, alpha: number): RawMeshBuilder;
  /**
   * 设置 lightMapUV（光照贴图 UV），并返回自身。
   * @param x U 坐标
   * @param y V 坐标
   */
  lightMapUV(x: number, y: number): RawMeshBuilder;
  /**
   * 设置一个新的默认顶点，并返回自身。
   * 注意：Build #619 之前此方法不返回 RawMeshBuilder。
   * @param texture 贴图资源位置
   */
  setNewDefaultVertex(texture: ResourceLocation): RawMeshBuilder;
  /** 取得构建好的 RawMesh（用于 RawModel.append）。 */
  getMesh(): RawMesh;
}

/**
 * 原始模型：初加载的模型。可由 ModelManager 从 OBJ / CSV / NMB 等文件加载，
 * 也可由若干 RawMesh 组合而成。上传为 ModelCluster 之前可自由修改。
 * 顶点的面数越多，上传到显存与渲染的开销越大，可用 distinct / triangulate 精简。
 */
declare class RawModel {
  /** 创建一个空的 RawModel。 */
  constructor();
  /**
   * 模型来源。两个来源相同的 RawModel 实际是同一个；
   * 设为 null 可断开与其它模型的关联，避免相互影响。
   */
  sourceLocation: ResourceLocation | null;
  /**
   * 材质到网格的映射（Java 的 HashMap<MaterialProp, RawMesh>）。
   * 键为 MaterialProp，值为 RawMesh；支持 [key] 取值与 for..of 遍历。
   */
  meshList: Record<string, RawMesh>;
  /**
   * 将另一个 RawModel 合并到此模型。
   * @param other 被合并的模型
   */
  append(other: RawModel): void;
  /**
   * 将一个 RawMesh 合并到此模型。
   * @param other 被合并的网格
   */
  append(other: RawMesh): void;
  /**
   * 将一些 RawMesh 合并到此模型。
   * @param other 被合并的网格列表
   */
  append(other: RawMesh[]): void;
  /**
   * 用一个矩阵变换模型中的所有顶点。
   * @param transform 变换矩阵
   */
  applyMatrix(transform: Matrix4f): void;
  /**
   * 平移模型中的所有顶点。
   * @param x X 方向平移量
   * @param y Y 方向平移量
   * @param z Z 方向平移量
   */
  applyTranslation(x: number, y: number, z: number): void;
  /**
   * 以原点为中心、绕一个轴旋转模型中的所有顶点。
   * @param direction 旋转轴（需为单位矢量）
   * @param angle 旋转角度（角度制）
   */
  applyRotation(direction: Vector3f, angle: number): void;
  /**
   * 缩放模型。
   * @param x X 方向缩放
   * @param y Y 方向缩放
   * @param z Z 方向缩放
   */
  applyScale(x: number, y: number, z: number): void;
  /**
   * 镜面翻转模型。
   * @param vx 是否翻转顶点 X
   * @param vy 是否翻转顶点 Y
   * @param vz 是否翻转顶点 Z
   * @param nx 是否翻转法线 X
   * @param ny 是否翻转法线 Y
   * @param nz 是否翻转法线 Z
   */
  applyMirror(vx: boolean, vy: boolean, vz: boolean, nx: boolean, ny: boolean, nz: boolean): void;
  /**
   * 反转 UV 方向。导入 Blockbench / Blender 模型时通常需写 applyUVMirror(false, true)。
   * @param u 是否反转 U
   * @param v 是否反转 V
   */
  applyUVMirror(u: boolean, v: boolean): void;
  /**
   * 把所有文件名为 oldFileName 的贴图替换为 path。
   * @param oldFileName 原贴图文件名
   * @param path 新贴图资源位置
   */
  replaceTexture(oldFileName: string, path: ResourceLocation): void;
  /**
   * 把所有贴图替换为 path。
   * @param path 新贴图资源位置
   */
  replaceAllTexture(path: ResourceLocation): void;
  /**
   * 应用切变变换。
   * @param direction 切变方向轴
   * @param shear 切变矢量
   * @param ratio 切变比例
   */
  applyShear(direction: Vector3f, shear: Vector3f, ratio: number): void;
  /** 复制模型的材质与顶点数据，得到一个新模型。 */
  copy(): RawModel;
  /** 复制模型的材质为新模型，但与原模型共用同一组顶点数据。 */
  copyForMaterialChanges(): RawModel;
  /**
   * 设置所有材质的渲染类型（如 "exterior"）。
   * @param renderType 渲染类型
   */
  setAllRenderType(renderType: string): void;
  /** 生成法线。 */
  generateNormals(): void;
  /** 精简模型，去除完全重复的面。 */
  distinct(): void;
  /** 三角化所有面，可解决面顶点不共面导致的渲染问题。 */
  triangulate(): void;
  /**
   * 删除指定的顶点属性。
   * @param attrType 要删除的顶点属性类型
   */
  clearAttrState(attrType: VertAttrType): void;
}

/**
 * 上传到显存后的模型集群，也是渲染相关函数所接受的类型。
 * 上传后不能再修改顶点数据与渲染阶段，但仍可替换贴图。
 */
interface ModelCluster {
  /** 已上传的不透明部分的 VertArrays。 */
  readonly uploadedOpaqueParts: VertArrays;
  /** 不透明部分的 RawModel。 */
  readonly opaqueParts: RawModel;
  /** 已上传的透明部分的 VertArrays。 */
  readonly uploadedTranslucentParts: VertArrays;
  /** 透明部分的 RawModel。 */
  readonly translucentParts: RawModel;
  /**
   * 把所有文件名为 oldFileName 的贴图替换为 path。
   * @param oldFileName 原贴图文件名
   * @param path 新贴图资源位置
   */
  replaceTexture(oldFileName: string, path: ResourceLocation): void;
  /**
   * 把所有贴图替换为 path。
   * @param path 新贴图资源位置
   */
  replaceAllTexture(path: ResourceLocation): void;
  /** 复制模型的材质为新模型，但与原模型共用同一组顶点数据。 */
  copyForMaterialChanges(): ModelCluster;
  /** 关闭此 ModelCluster 实例，释放资源。 */
  close(): void;
}

/**
 * 动态模型容器：解决无法在 create / render / dispose 等函数内直接上传 RawModel 的问题。
 * 需要动态更新模型时使用它，上传动作会延迟到主线程进行。
 */
declare class DynamicModelHolder {
  /** 创建一个 DynamicModelHolder。 */
  constructor();
  /**
   * 把 RawModel 加入上传队列，稍后（接下来某一帧的主线程上）上传为 ModelCluster。
   * @param rawModel 待上传的模型
   */
  uploadLater(rawModel: RawModel): void;
  /**
   * 立即把 RawModel 上传为 ModelCluster，成为新的 uploadedModel。
   * 必须在初始化或渲染线程中调用。
   * @param rawModel 待上传的模型
   */
  uploadNow(rawModel: RawModel): void;
  /** 获取已上传的 ModelCluster；尚未上传或 uploadLater 还未实际执行时返回 null。 */
  getUploadedModel(): ModelCluster | null;
  /** 关闭此实例并释放资源，之后 uploadedModel 不再可用。 */
  close(): void;
}

/** 模型管理器：加载模型文件、上传 RawModel 等。 */
declare class ModelManager {
  /**
   * 把一个模型整体加载为一个 RawModel。
   * 注意：由于线程问题，不能在 create / render / dispose 中调用它。
   * @param manager 请传 Resources.manager()（资源管理器；文档未给出其类型）
   * @param path 模型资源位置（OBJ / CSV / NMB 等）
   * @param arg 固定传 null
   */
  static loadRawModel(manager: unknown, path: ResourceLocation, arg: null): RawModel;
  /**
   * 把一个模型的每个分组分别加载为各个 RawModel，返回“组名 -> RawModel”的映射。
   * 返回 Java Map，支持 [key] 取值与 for..of 遍历。
   * 注意：由于线程问题，不能在 create / render / dispose 中调用它。
   * @param manager 请传 Resources.manager()（资源管理器；文档未给出其类型）
   * @param path 模型资源位置
   * @param arg 固定传 null
   */
  static loadPartedRawModel(manager: unknown, path: ResourceLocation, arg: null): Record<string, RawModel>;
  /**
   * 把 RawModel 上传到显存，返回上传好的 ModelCluster。
   * 注意：由于线程问题，不能在 create / render / dispose 中调用它；动态更新请改用 DynamicModelHolder。
   * @param rawModel 待上传的模型
   */
  static uploadVertArrays(rawModel: RawModel): ModelCluster;
}

/* =====================================================================
 * 绘制调用（js-draw-call.md）
 * ===================================================================== */

/**
 * 渲染调度员：负责管理渲染任务。
 * ANTE 会定期调用 DrawCall.commit，您应在 commit 中通过它提交渲染任务。
 */
interface DrawScheduler {
  /**
   * 向渲染队列添加一个 ModelCluster。
   * @param model 要绘制的模型
   * @param pose 模型的世界坐标变换
   * @param light 光照贴图索引
   */
  enqueue(model: ModelCluster, pose: Matrix4f, light: number): void;
}

/**
 * 绘制调用（仅含 commit 一个方法）。
 * ANTE 会（大致）每帧调用 commit 更新渲染内容，您被期望在其中提交渲染任务；
 * 注意不要在其中执行耗时/阻塞操作。
 * 除传入实现了 commit 的对象外，也可直接传入一个同签名的函数。
 */
type DrawCall =
  | { commit(drawScheduler: DrawScheduler, basePose: Matrix4f, worldPose: Matrix4f, light: number): void }
  | ((drawScheduler: DrawScheduler, basePose: Matrix4f, worldPose: Matrix4f, light: number) => void);

/**
 * 由实现了 commit 的对象字面量创建绘制调用，如
 * new DrawCall({ commit: (drawScheduler, basePose, worldPose, light) => { ... } })。
 */
declare const DrawCall: {
  new (impl: { commit(drawScheduler: DrawScheduler, basePose: Matrix4f, worldPose: Matrix4f, light: number): void }): {
    commit(drawScheduler: DrawScheduler, basePose: Matrix4f, worldPose: Matrix4f, light: number): void;
  };
};

/** DrawCall 的一种实现：使用 basePose。 */
declare class ClusterDrawCall {
  /**
   * @param model 模型集群
   * @param pose 变换矩阵
   */
  constructor(model: ModelCluster, pose: Matrix4f);
  /**
   * @param model 动态模型容器
   * @param pose 变换矩阵
   */
  constructor(model: DynamicModelHolder, pose: Matrix4f);
  /** 提交绘制调用（由 ANTE 每帧调用，勿在其中阻塞）。 */
  commit(drawScheduler: DrawScheduler, basePose: Matrix4f, worldPose: Matrix4f, light: number): void;
}

/** DrawCall 的一种实现：使用 worldPose。 */
declare class WorldDrawCall {
  /**
   * @param model MTR 的模型
   * @param pose 变换矩阵
   */
  constructor(model: Model, pose: Matrix4f);
  /**
   * @param model MTR 的动态模型
   * @param pose 变换矩阵
   */
  constructor(model: DynamicModel, pose: Matrix4f);
  /** 提交绘制调用（由 ANTE 每帧调用，勿在其中阻塞）。 */
  commit(drawScheduler: DrawScheduler, basePose: Matrix4f, worldPose: Matrix4f, light: number): void;
}

/** MTR 的模型（列车等使用的模型）。文档中仅出现其类型名，故此处仅为占位类型。 */
interface Model {}

/** MTR 的动态模型。文档中仅出现其类型名，故此处仅为占位类型。 */
interface DynamicModel {}

/* =====================================================================
 * js-advanced.md（高阶技巧）—— 无新增类型或函数
 * =====================================================================
 * 该文档介绍用 Java 的异步机制（如 java.util.concurrent.Executors、
 * TimeUnit、Runnable，经 importPackage 引入）为每个 entity 创建独立线程，
 * 以分担 render 的负载；示例中还用到 PlacementOrder、ClusterDrawCall 与
 * Matrix4f（分别见其它声明文件、本文件与 js-math）。
 * 它本身未引入新的 NTE 类型或函数，故这里不为它新增声明。
 * 提醒：异步线程中不要调用 drawModel / playSound 等仅在 render 中才安全的方法，
 * 且务必注意线程安全；修改绘制内容请通过 ctx.drawCalls。
 */
