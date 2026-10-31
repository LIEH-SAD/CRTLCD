# CRTLCD

CRTLCD 是一个面向 Minecraft Transit Railway（MTR）的动态列车 LCD 显示脚本，运行于 MTR Steam Locomotive 提供的脚本显示环境。它会读取列车当前路线、车站与运行状态，在车厢门上方的左右屏幕绘制线路图、下一站信息和车门提示。

![CRTLCD](lcd_logo.png)

## 功能

- **动态线路图**：显示当前线路的车站顺序、线路颜色与换乘信息。
- **下一站信息**：根据列车运行状态更新当前站、下一站及相关路线信息。
- **运行状态页面**：支持全线线路图、下一站页面和到站页面的切换。
- **车门提示与动画**：显示车门将开启、已开启等状态，并可启用开门动画。
- **车厢编号**：可为每节车厢单独显示编号，也可显示整列编组数量。
- **左右屏布局**：可单独控制右侧屏幕的镜像布局，以及线路图、站名条、信息面板等模块的镜像方式。
- **可配置显示样式**：通过 `config.json` 调整贴图尺寸、页面切换时间、线路图方向、换乘徽标样式和调试日志等设置。
- **异常恢复与绘制优化**：公共页面使用离屏画布缓存，减少重复绘制；显示屏创建或绘制失败时会尝试恢复。

## 运行环境

本项目不是独立的 Minecraft 模组。运行前需要准备：

- Minecraft；
- Minecraft Transit Railway（MTR）；
- 提供 `DisplayHelper` 和脚本接口的 MTR Steam Locomotive 环境。

请根据所安装版本的脚本系统要求部署本项目。项目未在此处声明对所有游戏、MTR 或 MTR Steam Locomotive 版本的兼容性；如遇到接口差异，请先确认相关模组版本。

## 文件结构

| 文件 | 说明 |
| --- | --- |
| `main.js` | 脚本入口：创建显示屏、处理页面切换、更新贴图及车门动画 |
| `draw.js` | 绘制线路图、站名条、换乘徽标、信息面板和车门提示 |
| `mtr_util.js` | 读取并整理 MTR 的列车、路线、站台和换乘数据 |
| `js_util.js` | 通用辅助函数 |
| `config.json` | 显示尺寸、页面时长、镜像方式及其他功能开关 |
| `fonts/` | 项目使用的字体资源 |
| `lcd_logo.png` | 项目标识图片 |
| `LICENCE` | 本项目的许可条款 |

## 配置

编辑 `config.json` 即可调整常用选项。修改后是否需要重载脚本或资源，取决于运行环境。

| 配置项 | 作用 |
| --- | --- |
| `lcdSize` | LCD 贴图宽、高；应与车上实际屏幕的长宽比一致 |
| `pageDuration` | 普通页面的轮播时长，单位为秒 |
| `serviceType` | 显示的服务类型文字 |
| `showCoachNumber` | 是否显示车厢编号 |
| `perCarCoachNumber` | 是否每节车厢分别创建显示屏并显示各自编号 |
| `flipDoorSides` | 是否翻转左右车门提示 |
| `routeMapReverse` | 是否反转线路图上的车站顺序 |
| `showStripArrow` | 是否显示站名条方向箭头 |
| `doorAnimation` | 是否启用车门动画 |
| `doorAnimationFps` | 车门动画的重绘频率 |
| `showHiddenRoutes` | 是否将隐藏线路计入换乘信息 |
| `debugLog` | 是否输出路线解析与绘制调试日志 |
| `connectingBadgeStyle` | 出站换乘徽标样式：`gray` 或 `outline` |
| `connectingBadgeGray` | 灰底换乘徽标的 RGB 颜色 |
| `hubBadgesHorizontal` | 换乘线路较多时是否横向排列徽标 |
| `mirrorRightScreen` | 是否启用右侧屏幕的镜像布局 |
| `mirrorModules` | 分别设置各模块的镜像方式：`off`、`position` 或 `full` |

### 屏幕尺寸

`lcdSize` 的格式为：

```json
"lcdSize": [2185, 280]
```

这只是当前配置中的示例值。更换列车或屏幕模型时，应按实际屏幕比例调整。脚本启动时会在日志中比较贴图与模型的长宽比；若比例不一致，画面可能出现拉伸。

### 调试

排查线路、车站或换乘信息时，可将：

```json
"debugLog": true
```

设置为 `true`，然后查看脚本运行日志。确认问题后可关闭该选项，减少日志输出。

## 使用与修改

1. 将项目文件部署到脚本系统所要求的位置，并确保 `main.js`、`draw.js`、`mtr_util.js`、`js_util.js` 与 `config.json` 的相对路径关系正确。
2. 确认运行环境可以加载 `mtrsteamloco:scripts/display_helper.js`，并能读取 `mtr:cqlcd/config.json`。
3. 根据列车模型调整 `main.js` 中的屏幕位置与偏移量，以及 `config.json` 中的贴图尺寸。
4. 进入游戏检查线路图、左右屏方向、车门提示和车厢编号；必要时开启调试日志。

脚本接口和资源命名与运行环境有关。若要将本项目移植到其他列车模型或脚本系统，需要相应调整屏幕坐标、资源路径和接口调用。

## 许可

本项目的许可条款见根目录的 [`LICENSE`](LICENSE)。使用、修改或再分发前，请先阅读该文件，尤其是有关商业分发、付费服务和再分发的限制。

项目中包含的字体或其他第三方资源可能受各自的许可约束；第三方资源的许可不因本项目的许可条款而改变。
