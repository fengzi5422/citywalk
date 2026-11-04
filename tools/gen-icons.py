"""生成 PWA 图标（纯标准库，无第三方依赖）。

设计：墨绿圆角底 + 白色定位圆环 + 陶土橙路径虚线。
运行：python3 tools/gen-icons.py
输出：app/public/icon-192.png / icon-512.png / icon.svg
"""
import math
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'app', 'public')
GREEN = (23, 86, 78)
WHITE = (255, 255, 255)
CLAY = (199, 99, 59)


def write_png(path, size):
    w = h = size
    px = bytearray(w * h * 4)

    def dot(x, y, color, alpha=255):
        if 0 <= x < w and 0 <= y < h:
            i = (y * w + x) * 4
            px[i], px[i + 1], px[i + 2], px[i + 3] = (*color, alpha)

    radius = size * 0.22
    # 圆角背景
    for y in range(h):
        for x in range(w):
            cx = min(x, w - 1 - x)
            cy = min(y, h - 1 - y)
            inside = True
            if cx < radius and cy < radius:
                inside = (cx - radius) ** 2 + (cy - radius) ** 2 <= radius ** 2
            if inside:
                dot(x, y, GREEN)

    def disc(cx, cy, r, color):
        for y in range(int(cy - r), int(cy + r) + 1):
            for x in range(int(cx - r), int(cx + r) + 1):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2:
                    dot(x, y, color)

    # 陶土橙的路径虚线：从左下到右上，绕过定位点
    route = [(0.20, 0.72), (0.28, 0.60), (0.34, 0.48), (0.38, 0.34), (0.46, 0.24), (0.58, 0.20), (0.70, 0.24), (0.80, 0.34)]
    for fx, fy in route:
        if 0.38 < fx < 0.64 and 0.36 < fy < 0.66:
            continue
        disc(fx * size, fy * size, size * 0.022, CLAY)

    # 白色定位圆环 + 中心实心点
    cx = cy = size * 0.5
    r_outer = size * 0.235
    r_inner = size * 0.175
    for y in range(int(cy - r_outer), int(cy + r_outer) + 1):
        for x in range(int(cx - r_outer), int(cx + r_outer) + 1):
            d2 = (x - cx) ** 2 + (y - cy) ** 2
            if r_inner ** 2 <= d2 <= r_outer ** 2:
                dot(x, y, WHITE)
    disc(cx, cy, size * 0.085, WHITE)

    # 编码 PNG
    raw = b''.join(b'\x00' + bytes(px[y * w * 4:(y + 1) * w * 4]) for y in range(h))

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(raw, 9))
           + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)
    print('wrote', path, size, 'x', size)


SVG = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="112" fill="#17564E"/>
  <g fill="#C7633B">
    <circle cx="102" cy="369" r="11"/><circle cx="143" cy="307" r="11"/>
    <circle cx="174" cy="246" r="11"/><circle cx="195" cy="174" r="11"/>
    <circle cx="236" cy="123" r="11"/><circle cx="297" cy="102" r="11"/>
    <circle cx="358" cy="123" r="11"/><circle cx="410" cy="174" r="11"/>
  </g>
  <circle cx="256" cy="256" r="120" fill="none" stroke="#FFFFFF" stroke-width="31"/>
  <circle cx="256" cy="256" r="44" fill="#FFFFFF"/>
</svg>
'''

def write_foreground_png(path, size):
    """Android 自适应图标前景层：透明底 + 白色定位圆环 + 陶土橙路径点。

    自适应图标只显示画布中心的 66%，所以图案整体缩进到中心 60% 安全区；
    墨绿底由 adaptive-icon 的 <background> 提供，这里保持透明。
    """
    w = h = size
    px = bytearray(w * h * 4)

    def dot(x, y, color, alpha=255):
        if 0 <= x < w and 0 <= y < h:
            i = (y * w + x) * 4
            px[i], px[i + 1], px[i + 2], px[i + 3] = (*color, alpha)

    def disc(cx, cy, r, color):
        for y in range(int(cy - r), int(cy + r) + 1):
            for x in range(int(cx - r), int(cx + r) + 1):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2:
                    dot(x, y, color)

    pad, span = size * 0.20, size * 0.60
    route = [(0.20, 0.72), (0.28, 0.60), (0.34, 0.48), (0.38, 0.34),
             (0.46, 0.24), (0.58, 0.20), (0.70, 0.24), (0.80, 0.34)]
    for fx, fy in route:
        if 0.38 < fx < 0.64 and 0.36 < fy < 0.66:
            continue
        disc(pad + fx * span, pad + fy * span, span * 0.022, CLAY)

    cx = cy = size * 0.5
    r_outer, r_inner = span * 0.235, span * 0.175
    for y in range(int(cy - r_outer), int(cy + r_outer) + 1):
        for x in range(int(cx - r_outer), int(cx + r_outer) + 1):
            d2 = (x - cx) ** 2 + (y - cy) ** 2
            if r_inner ** 2 <= d2 <= r_outer ** 2:
                dot(x, y, WHITE)
    disc(cx, cy, span * 0.085, WHITE)

    raw = b''.join(b'\x00' + bytes(px[y * w * 4:(y + 1) * w * 4]) for y in range(h))

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(raw, 9))
           + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)
    print('wrote', path, size, 'x', size, '(foreground)')


def gen_android_icons():
    """给 Capacitor Android 工程生成各密度启动图标（工程不存在时跳过）。"""
    res = os.path.join(os.path.dirname(OUT), 'android', 'app', 'src', 'main', 'res')
    if not os.path.isdir(os.path.dirname(res)):
        return
    for dpi, size in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
        d = os.path.join(res, 'mipmap-' + dpi)
        os.makedirs(d, exist_ok=True)
        write_png(os.path.join(d, 'ic_launcher.png'), size)
        write_png(os.path.join(d, 'ic_launcher_round.png'), size)
        # 自适应图标前景画布为 108dp（=@2.25 倍 mdpi 尺寸）
        write_foreground_png(os.path.join(d, 'ic_launcher_foreground.png'), round(size * 2.25))


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    write_png(os.path.join(OUT, 'icon-192.png'), 192)
    write_png(os.path.join(OUT, 'icon-512.png'), 512)
    with open(os.path.join(OUT, 'icon.svg'), 'w', encoding='utf-8') as f:
        f.write(SVG)
    print('wrote', os.path.join(OUT, 'icon.svg'))
    gen_android_icons()
