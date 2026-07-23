from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageColor, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
MARK_PATH = ASSETS / "brand-mark.png"
FONT_PATH = (
    ROOT
    / "node_modules"
    / "@expo-google-fonts"
    / "barlow-condensed"
    / "900Black"
    / "BarlowCondensed_900Black.ttf"
)

DARK = "#0A0907"
DARK_RAISED = "#17110D"
COURT_LINE = "#3A241B"
ORANGE = "#FF5A1F"
OFF_WHITE = "#FFF7F2"


def gradient_background(size: tuple[int, int]) -> Image.Image:
    width, height = size
    top = Image.new("RGB", size, DARK_RAISED)
    bottom = Image.new("RGB", size, DARK)
    gradient = Image.linear_gradient("L").resize((width, height))
    return Image.composite(bottom, top, gradient)


def draw_court(canvas: Image.Image, *, splash: bool = False) -> None:
    width, height = canvas.size
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    if splash:
        line_width = max(4, width // 145)
        inset = width // 8
        center_y = int(height * 0.51)
        radius = int(width * 0.25)
        line = (*ImageColor.getrgb(COURT_LINE), 125)
        draw.rounded_rectangle(
            (inset, -height // 10, width - inset, height + height // 10),
            radius=width // 18,
            outline=line,
            width=line_width,
        )
        draw.line((inset, center_y, width - inset, center_y), fill=line, width=line_width)
        draw.ellipse(
            (width // 2 - radius, center_y - radius, width // 2 + radius, center_y + radius),
            outline=line,
            width=line_width,
        )
        draw.arc(
            (-radius, center_y - radius, radius, center_y + radius),
            -90,
            90,
            fill=line,
            width=line_width,
        )
        draw.arc(
            (width - radius, center_y - radius, width + radius, center_y + radius),
            90,
            270,
            fill=line,
            width=line_width,
        )
    else:
        scale = width / 1024
        line_width = max(5, round(10 * scale))
        inset = round(96 * scale)
        radius = round(205 * scale)
        line = (*ImageColor.getrgb(COURT_LINE), 150)
        draw.rounded_rectangle(
            (inset, inset, width - inset, height - inset),
            radius=round(60 * scale),
            outline=line,
            width=line_width,
        )
        draw.line((width // 2, inset, width // 2, height - inset), fill=line, width=line_width)
        draw.ellipse(
            (width // 2 - radius, height // 2 - radius, width // 2 + radius, height // 2 + radius),
            outline=line,
            width=line_width,
        )

    canvas.paste(overlay, mask=overlay.getchannel("A"))


def normalized_mark(source: Image.Image, box: tuple[int, int]) -> Image.Image:
    alpha = source.getchannel("A")
    bounds = alpha.getbbox()
    if bounds is None:
        raise ValueError("The SPORTZ source mark has no visible pixels.")

    cropped_alpha = alpha.crop(bounds)
    cropped_alpha.thumbnail(box, Image.Resampling.LANCZOS)
    mark = Image.new("RGBA", cropped_alpha.size, ImageColor.getrgb(ORANGE) + (0,))
    mark.putalpha(cropped_alpha)
    return mark


def paste_centered(canvas: Image.Image, mark: Image.Image, center: tuple[int, int]) -> None:
    x = center[0] - mark.width // 2
    y = center[1] - mark.height // 2
    canvas.paste(mark, (x, y), mark)


def create_icon(source: Image.Image) -> Image.Image:
    canvas = gradient_background((1024, 1024))
    draw_court(canvas)
    mark = normalized_mark(source, (620, 620))
    paste_centered(canvas, mark, (512, 512))
    return canvas.convert("RGB")


def create_adaptive_icon(source: Image.Image) -> Image.Image:
    # Android's guaranteed safe circle is roughly 66/108 of the foreground.
    # The 560 px mark stays wholly within that centered 626 px safe region.
    canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    mark = normalized_mark(source, (560, 560))
    paste_centered(canvas, mark, (512, 512))
    return canvas


def create_splash(source: Image.Image) -> Image.Image:
    # Keep every outer-edge pixel equal to the native splash background color.
    # This prevents visible seams on screens with a different portrait ratio.
    canvas = Image.new("RGB", (1290, 2796), DARK)
    draw_court(canvas, splash=True)

    mark = normalized_mark(source, (420, 420))
    mark_center = (canvas.width // 2, 1120)
    paste_centered(canvas, mark, mark_center)

    font = ImageFont.truetype(str(FONT_PATH), 215)
    draw = ImageDraw.Draw(canvas)
    word = "SPORTZ"
    word_bounds = draw.textbbox((0, 0), word, font=font, stroke_width=0)
    word_width = word_bounds[2] - word_bounds[0]
    word_x = (canvas.width - word_width) // 2
    word_y = 1375
    draw.text((word_x, word_y), word, font=font, fill=OFF_WHITE)

    dot_font = ImageFont.truetype(str(FONT_PATH), 215)
    draw.text((word_x + word_width + 7, word_y), ".", font=dot_font, fill=ORANGE)
    return canvas.convert("RGB")


def create_notification_icon(source: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    alpha = source.getchannel("A")
    bounds = alpha.getbbox()
    if bounds is None:
        raise ValueError("The SPORTZ source mark has no visible pixels.")
    glyph_alpha = alpha.crop(bounds)
    glyph_alpha.thumbnail((60, 60), Image.Resampling.LANCZOS)
    glyph = Image.new("RGBA", glyph_alpha.size, (255, 255, 255, 0))
    glyph.putalpha(glyph_alpha)
    # Paste the RGBA pixels directly so antialiased edges remain white with
    # varying alpha instead of being blended into gray RGB values.
    canvas.paste(glyph, (48 - glyph.width // 2, 48 - glyph.height // 2))
    return canvas


def validate_assets(
    icon: Image.Image,
    adaptive_icon: Image.Image,
    splash: Image.Image,
    notification_icon: Image.Image,
    favicon: Image.Image,
) -> None:
    expected = (
        ("icon.png", icon, (1024, 1024), "RGB"),
        ("adaptive-icon.png", adaptive_icon, (1024, 1024), "RGBA"),
        ("splash.png", splash, (1290, 2796), "RGB"),
        ("notification-icon.png", notification_icon, (96, 96), "RGBA"),
        ("favicon.png", favicon, (64, 64), "RGB"),
    )
    for name, image, size, mode in expected:
        if image.size != size or image.mode != mode:
            raise ValueError(f"{name} must be {size[0]}x{size[1]} {mode}.")

    safe_min = (1024 - 626) // 2
    safe_max = safe_min + 626
    adaptive_bounds = adaptive_icon.getchannel("A").getbbox()
    if adaptive_bounds is None or not (
        adaptive_bounds[0] >= safe_min
        and adaptive_bounds[1] >= safe_min
        and adaptive_bounds[2] <= safe_max
        and adaptive_bounds[3] <= safe_max
    ):
        raise ValueError(f"Adaptive mark exceeds the centered safe region: {adaptive_bounds}")

    notification_pixels = notification_icon.get_flattened_data()
    if any(alpha > 0 and (red, green, blue) != (255, 255, 255) for red, green, blue, alpha in notification_pixels):
        raise ValueError("Notification icon contains non-white visible pixels.")
    if any(notification_icon.getpixel(point)[3] != 0 for point in ((0, 0), (95, 0), (0, 95), (95, 95))):
        raise ValueError("Notification icon corners must be transparent.")

    edge_points = ((0, 0), (splash.width - 1, 0), (0, splash.height - 1), (splash.width - 1, splash.height - 1))
    expected_edge = ImageColor.getrgb(DARK)
    if any(splash.getpixel(point) != expected_edge for point in edge_points):
        raise ValueError("Splash edges must match the configured native background color.")


def main() -> None:
    if not MARK_PATH.exists():
        raise FileNotFoundError(f"Missing source mark: {MARK_PATH}")
    if not FONT_PATH.exists():
        raise FileNotFoundError(f"Missing SPORTZ display font: {FONT_PATH}")

    source = Image.open(MARK_PATH).convert("RGBA")
    icon = create_icon(source)
    adaptive_icon = create_adaptive_icon(source)
    splash = create_splash(source)
    notification_icon = create_notification_icon(source)
    favicon = icon.resize((64, 64), Image.Resampling.LANCZOS)

    validate_assets(icon, adaptive_icon, splash, notification_icon, favicon)

    icon.save(ASSETS / "icon.png", optimize=True)
    adaptive_icon.save(ASSETS / "adaptive-icon.png", optimize=True)
    splash.save(ASSETS / "splash.png", optimize=True)
    notification_icon.save(ASSETS / "notification-icon.png", optimize=True)
    favicon.save(ASSETS / "favicon.png", optimize=True)

    for name, image in (
        ("icon.png", icon),
        ("adaptive-icon.png", adaptive_icon),
        ("splash.png", splash),
        ("notification-icon.png", notification_icon),
        ("favicon.png", favicon),
    ):
        print(f"Wrote assets/{name}: {image.width}x{image.height} {image.mode}")


if __name__ == "__main__":
    main()
