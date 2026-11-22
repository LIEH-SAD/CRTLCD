#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
车内 LCD 的 Python 版面样稿。

用途：先在 4:3 画板上把比例、字号、模块位置定下来，确认后再移植到 draw.js。
所有尺寸都以 1024x768 设计稿为准，最终输出 1024x768 PNG。

运行：
    python tools/lcd_preview.py --out docs/preview/python

依赖：Pillow
"""

from __future__ import annotations

import argparse
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Sequence

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "resource-pack" / "assets" / "mtr" / "cqlcd"
FONT_DIR = ASSETS / "fonts"
ROUND_FONT = FONT_DIR / "chiron" / "ChironGoRoundTC-800EB.ttf"
SANS_VARIANTS = {
    "regular": FONT_DIR / "source-han-sans-sc" / "SourceHanSansSC-Regular-2.otf",
    "medium": FONT_DIR / "source-han-sans-cn" / "SourceHanSansCN-Medium.ttf",
    "light": FONT_DIR / "source-han-sans-cn" / "SourceHanSansCN-Light.ttf",
}
SANS_FONT = SANS_VARIANTS["medium"]
MAP_FONT = SANS_VARIANTS["medium"]
SANS_STROKE_FACTOR = 0.0

W, H = 1024, 768          # 版面设计坐标
OUT_W, OUT_H = 1123, 843   # 参考图原始画布尺寸
S = 2.2                    # 先高倍绘制，最后缩到参考图尺寸
CANVAS = (int(W * S + 0.5), int(H * S + 0.5))

# 参考图的色板
LINE_RED = (226, 0, 24)
TITLE_ORANGE = (255, 116, 0)
TITLE_RED = (230, 18, 0)
DIRECTION_RED = (164, 10, 0)
PANEL_PINK_TOP = (255, 228, 228)
PANEL_PINK_BOTTOM = (255, 210, 210)
TEXT = (24, 22, 23)
MUTED = (94, 82, 82)
PASSED = (194, 171, 168)
MAP_BAND = (247, 221, 207)
MAP_BAND_EDGE = (238, 202, 184)
WHITE = (255, 255, 255)
DOOR_BLUE = (12, 101, 199)
DOOR_BLUE_TOP = (5, 87, 181)
DOOR_BLUE_BOTTOM = (38, 135, 222)
DOOR_FRAME_TOP = (236, 247, 255)
DOOR_FRAME_BOTTOM = (203, 230, 252)
GREEN = (42, 158, 70)
BAN_RED = (227, 8, 20)

TITLE_H = 64
DIRECTION_TOP = 64
DIRECTION_H = 64
HEADER_H = TITLE_H + DIRECTION_H       # 128
PANEL_LEFT = 14
PANEL_TOP = 128
PANEL_RIGHT = W - 14
PANEL_BOTTOM = 352
PANEL_W = PANEL_RIGHT - PANEL_LEFT
PANEL_H = PANEL_BOTTOM - PANEL_TOP
RED_BOTTOM = 384
BOTTOM_TOP = RED_BOTTOM

STATIONS: list[tuple[str, str]] = [
    ("璧山", "Bishan"),
    ("尖顶坡", "Jiandingpo"),
    ("大学城", "Daxuecheng"),
    ("陈家桥", "Chenjiaqiao"),
    ("微电园", "Weidianyuan"),
    ("赖家桥", "Laijiaqiao"),
    ("双碑", "Shuangbei"),
    ("石井坡", "Shijingpo"),
    ("磁器口", "Ciqikou"),
    ("烈士墓", "Lieshimu"),
    ("杨公桥", "Yanggongqiao"),
    ("沙坪坝", "Shapingba"),
    ("马家岩", "Majiayan"),
    ("小龙坎", "Xiaolongkan"),
    ("高庙村", "Gaomiaocun"),
    ("石桥铺", "Shiqiaopu"),
    ("歇台子", "Xietaizi"),
    ("石油路", "Shiyoulu"),
    ("大坪", "Daping"),
    ("鹅岭", "Eling"),
    ("两路口", "Lianglukou"),
    ("七星岗", "Qixinggang"),
    ("较场口", "Jiaochangkou"),
    ("小什字", "Xiaoshizi"),
    ("朝天门", "Chaotianmen"),
]

LINE_NAME = "重庆轨道交通一号线"
START_STATION = "璧山"
END_STATION = "朝天门"


def px(v: float) -> int:
    return int(round(v * S))


def font(size: float, *, family: str = "round") -> ImageFont.FreeTypeFont:
    # 大部分内容用 Chiron GoRound 800；标蓝的标题/方向/车门提示用思源黑体。
    if family == "sans":
        path = SANS_FONT
    elif family == "map":
        path = MAP_FONT
    else:
        path = ROUND_FONT
    return ImageFont.truetype(str(path), px(size))


def text_len(draw: ImageDraw.ImageDraw, txt: str, fnt: ImageFont.FreeTypeFont) -> float:
    box = draw.textbbox((0, 0), txt, font=fnt)
    return (box[2] - box[0]) / S


def text_h(draw: ImageDraw.ImageDraw, txt: str, fnt: ImageFont.FreeTypeFont) -> float:
    box = draw.textbbox((0, 0), txt, font=fnt)
    return (box[3] - box[1]) / S


def fit_font(
    draw: ImageDraw.ImageDraw,
    txt: str,
    max_width: float,
    max_height: float,
    start: float,
    minimum: float,
    *,
    family: str = "round",
) -> ImageFont.FreeTypeFont:
    size = start
    while size > minimum:
        fnt = font(size, family=family)
        box = draw.textbbox((0, 0), txt, font=fnt)
        if (box[2] - box[0]) / S <= max_width and (box[3] - box[1]) / S <= max_height:
            return fnt
        size -= 1
    return font(minimum, family=family)


def vertical_gradient(size: tuple[int, int], stops: Sequence[tuple[float, tuple[int, int, int]]]) -> Image.Image:
    """stops: [(位置0..1, RGB), ...]，返回 RGB 渐变图。"""
    w, h = size
    img = Image.new("RGB", (1, h))
    pxls = img.load()
    for y in range(h):
        t = y / max(1, h - 1)
        c = stops[0][1]
        for i in range(len(stops) - 1):
            a, ca = stops[i]
            b, cb = stops[i + 1]
            if a <= t <= b:
                k = (t - a) / max(1e-6, b - a)
                c = tuple(round(ca[j] + (cb[j] - ca[j]) * k) for j in range(3))
                break
            c = cb
        pxls[0, y] = c
    return img.resize((w, h), Image.Resampling.BILINEAR)


def rounded_mask(size: tuple[int, int], radius: float) -> Image.Image:
    mask = Image.new("L", size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=px(radius), fill=255)
    return mask


def fill_rounded(img: Image.Image, box: tuple[float, float, float, float], radius: float,
                 fill: tuple[int, int, int], outline: tuple[int, int, int] | None = None,
                 width: float = 1) -> None:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    b = tuple(px(v) for v in box)
    d.rounded_rectangle(b, radius=px(radius), fill=fill + (255,),
                        outline=(outline + (255,)) if outline else None,
                        width=max(1, px(width)))
    img.alpha_composite(layer)


def gradient_rounded(img: Image.Image, box: tuple[float, float, float, float], radius: float,
                     stops: Sequence[tuple[float, tuple[int, int, int]]],
                     outline: tuple[int, int, int] | None = None, width: float = 1) -> None:
    x0, y0, x1, y1 = (px(v) for v in box)
    w, h = max(1, x1 - x0), max(1, y1 - y0)
    grad = vertical_gradient((w, h), stops).convert("RGBA")
    mask = rounded_mask((w, h), radius)
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    layer.paste(grad, (x0, y0), mask)
    d = ImageDraw.Draw(layer)
    if outline:
        d.rounded_rectangle((x0, y0, x1 - 1, y1 - 1), radius=px(radius),
                            outline=outline + (255,), width=max(1, px(width)))
    img.alpha_composite(layer)


def draw_text(draw: ImageDraw.ImageDraw, xy: tuple[float, float], txt: str,
              fnt: ImageFont.FreeTypeFont, fill: tuple[int, int, int],
              anchor: str = "la", stroke_width: float = 0) -> None:
    draw.text((px(xy[0]), px(xy[1])), txt, font=fnt, fill=fill, anchor=anchor,
              stroke_width=max(0, int(round(px(stroke_width)))),
              stroke_fill=fill if stroke_width > 0 else None)



def draw_condensed_text(img: Image.Image, x_right: float, y_bottom: float, txt: str,
                        size: float, scale_x: float, fill: tuple[int, int, int]) -> None:
    """按参考图做横向压缩的字，用来还原窄高的车厢数字。"""
    fnt = ImageFont.truetype(str(ROUND_FONT), max(8, px(size)))
    bbox = fnt.getbbox(txt)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    layer = Image.new("RGBA", (max(1, tw), max(1, th)), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.text((-bbox[0], -bbox[1]), txt, font=fnt, fill=fill)
    layer = layer.resize((max(1, int(round(tw * scale_x))), th), Image.LANCZOS)
    img.alpha_composite(layer, (px(x_right) - layer.width, px(y_bottom) - layer.height))


def draw_spaced_text(draw: ImageDraw.ImageDraw, center_x: float, y: float, txt: str,
                     fnt: ImageFont.FreeTypeFont, fill: tuple[int, int, int],
                     tracking: float = 0, stroke_width: float = 0) -> None:
    """按字距绘制居中文字，模拟参考图标题的字间距。"""
    widths = [draw.textlength(ch, font=fnt) / S for ch in txt]
    total = sum(widths) + tracking * max(0, len(txt) - 1)
    x = center_x - total / 2
    for ch, w in zip(txt, widths):
        draw_text(draw, (x, y), ch, fnt, fill, anchor="lm", stroke_width=stroke_width)
        x += w + tracking


def draw_spaced_text_left(draw: ImageDraw.ImageDraw, x: float, y: float, txt: str,
                          fnt: ImageFont.FreeTypeFont, fill: tuple[int, int, int],
                          tracking: float = 0, stroke_width: float = 0) -> None:
    for ch in txt:
        draw_text(draw, (x, y), ch, fnt, fill, anchor="la", stroke_width=stroke_width)
        x += draw.textlength(ch, font=fnt) / S + tracking


@dataclass
class State:
    label_cjk: str
    label_en: str
    station_index: int
    page: str
    coach: int = 1
    door_mode: str = "closed"  # closed / will_open / open / locked
    total_cars: int = 6
    arrow_phase: int = 0
    line_name: str = LINE_NAME
    route: Sequence[tuple[str, str]] = field(default_factory=lambda: STATIONS)


def draw_header(img: Image.Image, st: State) -> None:
    # 面板外围的红色底：从顶部一直铺到面板底
    bg = vertical_gradient((CANVAS[0], px(RED_BOTTOM)),
                           [(0.0, (198, 0, 0)), (1.0, (146, 8, 0))])
    img.paste(bg, (0, 0))

    # 标题条：橙红高光 → 正红
    title_h = px(TITLE_H)
    grad = vertical_gradient((CANVAS[0], title_h),
                             [(0.0, (255, 140, 20)), (0.08, (245, 22, 0)),
                              (0.55, (224, 16, 0)), (1.0, (188, 6, 0))])
    img.paste(grad, (0, 0))
    d = ImageDraw.Draw(img)

    # 标题下方的金色细线 + 阴影线
    d.rectangle((0, px(TITLE_H - 3), CANVAS[0], px(TITLE_H - 1)), fill=(255, 196, 80))
    d.rectangle((0, px(TITLE_H - 1), CANVAS[0], px(TITLE_H)), fill=(120, 0, 0))

    title_font = fit_font(d, st.line_name, 440, 44, 40, 24, family="sans")
    draw_spaced_text(d, W / 2 - 6, 30, st.line_name, title_font, WHITE, 10, stroke_width=0.5)

    # 运行方向条
    dir_grad = vertical_gradient((CANVAS[0], px(DIRECTION_H)),
                                 [(0.0, (178, 12, 0)), (1.0, (154, 6, 0))])
    img.paste(dir_grad, (0, px(DIRECTION_TOP)))
    d.rectangle((0, px(DIRECTION_TOP), CANVAS[0], px(DIRECTION_TOP + 1)), fill=(235, 100, 20))

    label_font = font(23, family="sans")
    draw_text(d, (32, DIRECTION_TOP + 23), "运行方向", label_font, WHITE, anchor="lm", stroke_width=0.45 * SANS_STROKE_FACTOR)

    endpoint_font = font(38, family="sans")
    cy = DIRECTION_TOP + DIRECTION_H / 2
    # 参考图里两个终点站的位置是固定的：璧山在左三分之一、朝天门在右三分之一。
    start_cx = 340
    end_cx = 665
    draw_spaced_text(d, start_cx, cy, START_STATION, endpoint_font, WHITE, 28, stroke_width=0.8 * SANS_STROKE_FACTOR)
    draw_direction_arrow(d, 470, cy, 96, 40)
    draw_spaced_text(d, end_cx, cy, END_STATION, endpoint_font, WHITE, 15, stroke_width=0.8 * SANS_STROKE_FACTOR)


def draw_direction_arrow(d: ImageDraw.ImageDraw, x: float, cy: float, width: float, height: float) -> None:
    left = px(x)
    cy_px = px(cy)
    w = px(width)
    h = px(height)
    half = h / 2
    shaft = h * 0.36
    head_start = left + w * 0.60
    tip = left + w * 0.90

    # 4 根速度线，参考图里高度接近箭头一半
    for i, off in enumerate((52, 34, 22, 11)):
        bx = left - px(off)
        bh = h * (0.52 if i in (1, 2) else 0.44)
        d.rounded_rectangle((bx, cy_px - bh / 2, bx + px(4), cy_px + bh / 2),
                            radius=px(1), fill=(255, 198, 0))

    # 深红投影
    pts = [
        (tip, cy_px),
        (head_start, cy_px - half),
        (head_start, cy_px - shaft / 2),
        (left, cy_px - shaft / 2),
        (left, cy_px + shaft / 2),
        (head_start, cy_px + shaft / 2),
        (head_start, cy_px + half),
    ]
    d.polygon([(px_ + px(2), py_ + px(3)) for px_, py_ in pts], fill=(118, 0, 0))
    d.polygon(pts, fill=(255, 198, 0))

    # 紧贴主箭头的第二层箭尖，不能留大缝
    c1 = left + w * 0.90
    c2 = left + w * 1.05
    chev = [(c1, cy_px - h * 0.46), (c2, cy_px), (c1, cy_px + h * 0.46)]
    d.line([(px_ + px(2), py_ + px(3)) for px_, py_ in chev],
           fill=(118, 0, 0), width=px(8), joint="curve")
    d.line(chev, fill=(255, 198, 0), width=px(8), joint="curve")

def draw_main_panel(img: Image.Image, st: State) -> None:
    # 阴影
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ds = ImageDraw.Draw(shadow)
    ds.rounded_rectangle((px(PANEL_LEFT + 2), px(PANEL_TOP + 4), px(PANEL_RIGHT + 2), px(PANEL_BOTTOM + 4)),
                         radius=px(24), fill=(80, 0, 0, 55))
    img.alpha_composite(shadow)

    gradient_rounded(
        img,
        (PANEL_LEFT, PANEL_TOP, PANEL_RIGHT, PANEL_BOTTOM),
        24,
        [(0.0, PANEL_PINK_TOP), (1.0, PANEL_PINK_BOTTOM)],
        outline=(255, 255, 255),
        width=1,
    )
    d = ImageDraw.Draw(img)

    center_y = PANEL_TOP + PANEL_H / 2 + 8
    # 左侧状态标签
    label_size = 48
    label_font = font(label_size)
    draw_text(d, (54, center_y - 23), st.label_cjk, label_font, (176, 0, 10), anchor="lm")
    en_font = font(28)
    cjk_w = d.textlength(st.label_cjk, font=label_font) / S
    en_w = d.textlength(st.label_en, font=en_font) / S
    draw_text(d, (54 + (cjk_w - en_w) / 2, center_y + 33), st.label_en, en_font, (140, 0, 4), anchor="lm")

    # 中间站名
    cjk, pinyin = st.route[st.station_index]
    name_font = fit_font(d, cjk, 410, 98, 84, 40)
    pinyin_font = fit_font(d, pinyin, 310, 48, 44, 18)
    name_center_x = 507
    draw_text(d, (name_center_x, center_y - 35), cjk, name_font, TEXT, anchor="mm")
    draw_text(d, (name_center_x, center_y + 44), pinyin, pinyin_font, TEXT, anchor="mm")

    # 分隔线
    d.rounded_rectangle((px(741), px(PANEL_TOP + 34), px(741 + 2), px(PANEL_BOTTOM - 34)),
                        radius=px(1), fill=(211, 122, 122))

    # 右侧车厢号
    coach = str(st.coach)
    # 直接用字体里的“1”，不做横向压缩
    coach_font = font(56)
    unit_font = font(40)
    num_w = text_len(d, coach, coach_font)
    unit_w = text_len(d, "车厢", unit_font)
    right = PANEL_RIGHT - 81
    gap = 14
    unit_x = right - unit_w
    num_x = unit_x - gap - num_w
    draw_text(d, (num_x, 237), coach, coach_font, (208, 0, 16), anchor="ls")
    draw_text(d, (unit_x, 239), "车厢", unit_font, (160, 0, 12), anchor="ls")
    en = f"No.{st.coach} Coach"
    en_coach_font = font(29)
    en_w = text_len(d, en, en_coach_font)
    en_track = 1.2
    en_right = PANEL_RIGHT - 52
    draw_spaced_text_left(d, en_right - en_w - en_track * (len(en) - 1), center_y - 3,
                          en, en_coach_font, (140, 0, 4), en_track)


def draw_bottom_base(img: Image.Image) -> None:
    d = ImageDraw.Draw(img)
    d.rectangle((0, px(BOTTOM_TOP), CANVAS[0], CANVAS[1]), fill=WHITE)


def draw_full_map(img: Image.Image, st: State) -> None:
    d = ImageDraw.Draw(img)
    n = len(st.route)
    band_left, band_right = 32, W - 32
    band_top, band_h = 565, 45
    band_cy = band_top + band_h / 2
    fill_rounded(img, (band_left, band_top, band_right, band_top + band_h), band_h / 2, MAP_BAND,
                 MAP_BAND_EDGE, 1)
    d = ImageDraw.Draw(img)

    left, right = band_left + 22, band_right - 20
    step = (right - left) / max(1, n - 1)
    radius = 13
    name_font = font(24, family="map")
    direction = 1
    for i, (name, _) in enumerate(st.route):
        cx = left + i * step
        passed = i < st.station_index
        current = i == st.station_index
        if current:
            # 当前/下一站用红色方向箭头，不再画圆点
            draw_station_arrow(d, cx, band_cy, 38, direction, st.arrow_phase)
        else:
            d.ellipse((px(cx - radius - 3), px(band_cy - radius - 3),
                       px(cx + radius + 3), px(band_cy + radius + 3)), fill=WHITE)
            d.ellipse((px(cx - radius), px(band_cy - radius),
                       px(cx + radius), px(band_cy + radius)),
                      fill=(LINE_RED if passed else WHITE),
                      outline=(MAP_BAND_EDGE), width=px(1))

        cjk = name
        chars = list(cjk)
        line_h = 28
        below = i % 2 == 0
        if below:
            base = band_top + band_h - 2
            for k, ch in enumerate(chars):
                draw_text(d, (cx, base + k * line_h), ch, name_font,
                          TEXT, anchor="ma")
        else:
            base = band_top - 35 - line_h * (len(chars) - 1)
            for k, ch in enumerate(chars):
                draw_text(d, (cx, base + k * line_h), ch, name_font,
                          TEXT, anchor="ma")

    # 左侧方向箭头



def draw_station_arrow(d: ImageDraw.ImageDraw, cx: float, cy: float, size: float, direction: int = 1, phase: int = 0) -> None:
    """当前/下一站标记：红色块状箭头，白色描边，指向行进方向。"""
    length = size * 1.0
    half = size * 0.54
    shaft = size * 0.34
    tail = cx - direction * length * 0.55
    tip = cx + direction * length * 0.45
    neck = tip - direction * length * 0.42
    pts = [
        (px(tip), px(cy)),
        (px(neck), px(cy - half)),
        (px(neck), px(cy - shaft / 2)),
        (px(tail), px(cy - shaft / 2)),
        (px(tail), px(cy + shaft / 2)),
        (px(neck), px(cy + shaft / 2)),
        (px(neck), px(cy + half)),
    ]
    if phase == 1:
        d.polygon(pts, fill=WHITE, outline=(218, 0, 22), width=px(3))
    else:
        d.polygon(pts, fill=(218, 0, 22), outline=WHITE, width=px(3))

def draw_map_arrow(d: ImageDraw.ImageDraw, x: float, cy: float, size: float, direction: int) -> None:
    x0, y0 = px(x), px(cy)
    length, half = px(size * 1.6), px(size * 0.55)
    shaft = px(size * 0.36)
    tip = x0 + direction * length
    pts = [
        (tip, y0),
        (tip - direction * length * 0.42, y0 - half),
        (tip - direction * length * 0.42, y0 - shaft / 2),
        (x0, y0 - shaft / 2),
        (x0, y0 + shaft / 2),
        (tip - direction * length * 0.42, y0 + shaft / 2),
        (tip - direction * length * 0.42, y0 + half),
    ]
    d.polygon(pts, fill=(218, 0, 22), outline=WHITE, width=px(4))


def draw_segment(img: Image.Image, st: State) -> None:
    d = ImageDraw.Draw(img)
    n = len(st.route)
    window = min(5, n)
    start = max(0, min(st.station_index - 2, n - window))
    indices = list(range(start, start + window))

    band_left, band_right = 56, 884
    band_top, band_h = 476, 98
    band_cy = band_top + band_h / 2
    notch = 30
    pts = [(px(band_left), px(band_top)), (px(band_right - notch), px(band_top)),
           (px(band_right + notch), px(band_cy)), (px(band_right - notch), px(band_top + band_h)),
           (px(band_left), px(band_top + band_h))]
    d.polygon(pts, fill=MAP_BAND, outline=MAP_BAND_EDGE, width=px(1))

    # 大箭头
    for i, alpha in [(0, 225), (1, 135)]:
        x = 914 + i * 54
        length, size = 108, 78
        p = [(px(x), px(band_cy - size / 2)), (px(x + length), px(band_cy)),
             (px(x), px(band_cy + size / 2)), (px(x + length * 0.34), px(band_cy))]
        layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(layer).polygon(p, fill=MAP_BAND + (alpha,))
        img.alpha_composite(layer)

    d = ImageDraw.Draw(img)
    inner_l, inner_r = band_left + 80, band_right - 46
    step = (inner_r - inner_l) / max(1, window - 1)
    radius = 28
    for i, idx in enumerate(indices):
        cx = inner_l + i * step
        current = idx == st.station_index
        d.ellipse((px(cx - radius - 2), px(band_cy - radius - 2),
                   px(cx + radius + 2), px(band_cy + radius + 2)), fill=WHITE)
        d.ellipse((px(cx - radius), px(band_cy - radius),
                   px(cx + radius), px(band_cy + radius)),
                  fill=LINE_RED if current else WHITE,
                  outline=WHITE if current else MAP_BAND_EDGE, width=px(1.5))

        cjk, pinyin = st.route[idx]
        fnt = fit_font(d, cjk, step * 0.94, 38, 34, 18)
        draw_text(d, (cx, 642), cjk, fnt, TEXT, anchor="ma")
        pf = fit_font(d, pinyin, step * 0.94, 26, 21, 12)
        draw_text(d, (cx, 690), pinyin, pf, MUTED, anchor="ma")


def draw_consist(img: Image.Image, st: State) -> None:
    d = ImageDraw.Draw(img)
    total_w, left = 780, (W - 780) / 2 + 26
    top, height = 510, 132
    car_w = total_w / st.total_cars
    nose = 46
    d.text((px(66), px(top + 6)), "站", font=font(32), fill=(190, 0, 12))
    d.text((px(66), px(top + 48)), "台", font=font(32), fill=(190, 0, 12))
    d.line((px(114), px(top - 8), px(114), px(top + height + 22)), fill=(190, 0, 12), width=px(2))
    for i in range(5):
        y = top - 8 + i * 30
        d.line((px(108), px(y), px(120), px(y)), fill=(190, 0, 12), width=px(2))

    # 圆角车体
    d.rounded_rectangle((px(left), px(top), px(left + total_w), px(top + height)),
                        radius=px(height / 2), fill=(255, 255, 255),
                        outline=(208, 0, 20), width=px(3))
    for i in range(1, st.total_cars):
        x = left + car_w * i
        d.line((px(x), px(top + 8), px(x), px(top + height - 8)), fill=(208, 0, 20), width=px(2))
    for i in range(st.total_cars):
        cx = left + car_w * (i + 0.5)
        draw_text(d, (cx, top + height / 2 + 4), str(i + 1), font(44), (190, 0, 12), anchor="mm")
    # 车头灯
    d.ellipse((px(left + 12), px(top + height / 2 - 4), px(left + 20), px(top + height / 2 + 4)),
              fill=(255, 236, 190))
    d.ellipse((px(left + total_w - 20), px(top + height / 2 - 4),
               px(left + total_w - 12), px(top + height / 2 + 4)), fill=(255, 236, 190))


def draw_door_leaf(img: Image.Image, box: tuple[float, float, float, float]) -> None:
    x0, y0, x1, y1 = box
    # 柔和投影 + 外侧淡蓝光晕
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (px(x0 + 3), px(y0 + 5), px(x1 + 4), px(y1 + 6)),
        radius=px(28), fill=(23, 78, 135, 34))
    shadow = shadow.filter(ImageFilter.GaussianBlur(px(5)))
    img.alpha_composite(shadow)

    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).rounded_rectangle(
        (px(x0 - 4), px(y0 - 4), px(x1 + 4), px(y1 + 4)),
        radius=px(28), fill=(170, 211, 244, 34))
    glow = glow.filter(ImageFilter.GaussianBlur(px(5)))
    img.alpha_composite(glow)

    # 门板：上亮下浅的淡蓝渐变，边缘只留很淡的蓝线
    gradient_rounded(img, box, 20,
                     [(0.000, (235, 244, 255)), (0.020, (170, 196, 224)),
                      (0.055, (180, 209, 242)), (0.240, (88, 152, 217)),
                      (0.550, (127, 177, 227)), (0.750, (181, 210, 238)),
                      (1.000, (246, 249, 253))],
                     outline=(204, 228, 246), width=0.6)

    # 上部蓝色车窗：参考图是一整块接近纯色的蓝，下面留出浅色门板
    window_box = (x0 + 20, y0 + 24, x1 - 20, y0 + 195)
    gradient_rounded(img, window_box, 16,
                     [(0.0, (0, 105, 197)), (1.0, (0, 105, 197))],
                     outline=(0, 96, 183), width=0.4)



def draw_up_arrow(d: ImageDraw.ImageDraw, cx: float, top: float, width: float, height: float) -> None:
    pts = [
        (px(cx), px(top)),
        (px(cx + width / 2), px(top + height * 0.46)),
        (px(cx + width * 0.18), px(top + height * 0.46)),
        (px(cx + width * 0.18), px(top + height)),
        (px(cx - width * 0.18), px(top + height)),
        (px(cx - width * 0.18), px(top + height * 0.46)),
        (px(cx - width / 2), px(top + height * 0.46)),
    ]
    d.polygon(pts, fill=GREEN)


def draw_doors(img: Image.Image, st: State) -> None:
    d = ImageDraw.Draw(img)
    if st.door_mode == "will_open":
        lines = ["将开启此门", "请等候"]
        en = "Doors on this side will be opened"
    elif st.door_mode == "open":
        lines = ["此门已开启", "请下车的乘客按顺序下车"]
        en = "Doors on this side have been opened"
    elif st.door_mode == "locked":
        lines = ["此门不开", "请到对门下车"]
        en = "Doors on the opposite side have been opened"
    else:
        lines = ["此门不开", "请到对门等候"]
        en = "Doors on the opposite side will be opened"

    text_color = (176, 0, 10)
    fnt = fit_font(d, lines[1], 470, 38, 30, 24, family="sans")
    y = 499
    for line in lines:
        draw_spaced_text_left(d, 50, y, line, fnt, text_color, 13, stroke_width=0.4)
        y += 48
    en_font = fit_font(d, en, 420, 26, 20, 13, family="sans")
    en_base_width = sum(d.textlength(ch, font=en_font) / S for ch in en)
    en_tracking = max(0.0, min(4.0, (470 - en_base_width) / max(1, len(en) - 1)))
    draw_spaced_text_left(d, 52, y + 1, en, en_font, (222, 108, 102), en_tracking,
                          stroke_width=0.25 * SANS_STROKE_FACTOR)

    # 门组：参考图里没有卡片底，直接两扇门放在白底上
    door_w, door_h = 142, 310
    gap = 4 if st.door_mode != "open" else 40
    cx = 749
    top = 414
    left = cx - door_w - gap / 2
    right = cx + gap / 2
    draw_door_leaf(img, (left, top, left + door_w, top + door_h))
    draw_door_leaf(img, (right, top, right + door_w, top + door_h))

    d = ImageDraw.Draw(img)
    if st.door_mode in ("closed", "locked"):
        bx0 = left
        bx1 = right + door_w
        by = top + door_h * 0.52
        bh = 40
        d.rounded_rectangle((px(bx0 - 5), px(by - 5), px(bx1 + 5), px(by + bh + 5)),
                            radius=px(bh + 5), fill=WHITE)
        d.rounded_rectangle((px(bx0), px(by), px(bx1), px(by + bh)),
                            radius=px(bh), fill=BAN_RED, outline=WHITE, width=px(3))
    if st.door_mode == "open":
        draw_up_arrow(d, cx, top + door_h - 24, 54, 32)


def draw_footer(img: Image.Image) -> None:
    d = ImageDraw.Draw(img)
    # 参考图底部有一条很细的青色线，只是画面边缘，保留成极淡的装饰线
    d.rectangle((0, px(H - 2), CANVAS[0], px(H - 1)), fill=(0, 135, 189))


def render(st: State) -> Image.Image:
    img = Image.new("RGBA", CANVAS, WHITE + (255,))
    draw_header(img, st)
    draw_main_panel(img, st)
    draw_bottom_base(img)
    if st.page == "full":
        draw_full_map(img, st)
    elif st.page == "segment":
        draw_segment(img, st)
    elif st.page == "consist":
        draw_consist(img, st)
    elif st.page == "door":
        draw_doors(img, st)
    draw_footer(img)
    return img.convert("RGB").resize((OUT_W, OUT_H), Image.Resampling.LANCZOS)


def states() -> list[tuple[str, State]]:
    return [
        ("01-approach-door-will-open", State("即将到达", "Approaching", 14, "door", door_mode="will_open")),
        ("02-next-full-map", State("下一站", "Next", 14, "full")),
        ("03-next-segment", State("下一站", "Next", 14, "segment")),
        ("04-next-consist", State("下一站", "Next", 14, "consist")),
        ("05-next-door-blocked", State("下一站", "Next", 14, "door", door_mode="closed")),
        ("06-arrived-door-open", State("已到站", "Arrival", 14, "door", door_mode="open")),
        ("07-arrived-door-blocked", State("已到站", "Arrival", 14, "door", door_mode="locked")),
    ]


def contact_sheet(items: list[tuple[str, Image.Image]], out: Path) -> None:
    cols = 3
    tw, th = 512, 384
    gap, label_h, title_h = 14, 38, 56
    rows = math.ceil(len(items) / cols)
    sheet = Image.new("RGB", (cols * tw + (cols + 1) * gap, title_h + rows * (th + label_h) + (rows + 1) * gap),
                      (245, 245, 245))
    d = ImageDraw.Draw(sheet)
    d.text((gap, 14), "LCD 4:3 比例样稿 · Python 渲染", font=font(24), fill=(30, 30, 30))
    for i, (label, im) in enumerate(items):
        r, c = divmod(i, cols)
        x = gap + c * (tw + gap)
        y = title_h + gap + r * (th + label_h + gap)
        thumb = im.resize((tw, th), Image.Resampling.LANCZOS)
        sheet.paste(thumb, (x, y))
        d.rectangle((x, y, x + tw - 1, y + th - 1), outline=(210, 210, 210))
        label_cn = {
            "01-approach-door-will-open": "即将到达 · 车门将开",
            "02-next-full-map": "下一站 · 全线线路图",
            "03-next-segment": "下一站 · 近站区间图",
            "04-next-consist": "下一站 · 编组与站台",
            "05-next-door-blocked": "下一站 · 此门不开",
            "06-arrived-door-open": "已到站 · 车门已开",
            "07-arrived-door-blocked": "已到站 · 此门不开",
        }.get(label, label)
        d.text((x + 4, y + th + 8), label_cn, font=font(16), fill=(70, 70, 70))
    sheet.save(out)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=ROOT / "docs" / "preview" / "python")
    parser.add_argument("--sans", choices=sorted(SANS_VARIANTS), default="medium")
    args = parser.parse_args()
    global SANS_FONT, SANS_STROKE_FACTOR
    SANS_FONT = SANS_VARIANTS[args.sans]
    SANS_STROKE_FACTOR = 1.0 if args.sans == "regular" else 0.0
    args.out.mkdir(parents=True, exist_ok=True)

    rendered: list[tuple[str, Image.Image]] = []
    for name, st in states():
        im = render(st)
        im.save(args.out / f"{name}.png")
        rendered.append((name, im))
        print(f"wrote {args.out / (name + '.png')}")
    contact_sheet(rendered, args.out / "00-contact-sheet.png")
    print(f"wrote {args.out / '00-contact-sheet.png'}")


if __name__ == "__main__":
    main()
