from PIL import Image
import os
import math

# Define source and target color mappings (with fuzziness)
# fuzzy_color_map = [
#     {"src": (164, 0, 1), "dst": (0, 87, 174)},    # dark red → dark blue
#     {"src": (227, 30, 29), "dst": (0, 166, 184)}  # light red → light blue
# ]

fuzzy_color_map = [
    {"src": (164, 0, 0), "dst": (255, 255, 255)},    # dark red → dark blue
    # {"src": (178,17,17), "dst": (255,255, 255)},  # light red → light blue
    {"src": (227, 30, 29), "dst": (0, 87, 174)}, # light red → light blue
    # {"src": (255,255,255), "dst": (0, 0, 0)}
    ]

def color_distance(c1, c2):
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(c1, c2)))

def find_closest_color(pixel, color_map, threshold=20000000):
    for mapping in color_map:
        if color_distance(pixel[:3], mapping["src"]) <= threshold:
            return mapping["dst"] + (pixel[3],)
    return pixel

def replace_colors_fuzzy(image_path, output_path, color_map, threshold=65):
    img = Image.open(image_path).convert("RGBA")
    pixels = list(img.getdata())
    new_pixels = [find_closest_color(p, color_map, threshold) for p in pixels]
    img.putdata(new_pixels)
    img.save(output_path)

reference_mav = "/Users/leventebotos/vonatok/public/kocsik/mav/Amz.png"
reference_rj = "/Users/leventebotos/vonatok/public/kocsik/oebb/Ampz-2-rjng.png"
input_folder = "/Users/leventebotos/vonatok/public/kocsik/oebb"
output_folder = "/Users/leventebotos/vonatok/public/kocsik/mav/railjet"
os.makedirs(output_folder, exist_ok=True)


# Process all PNGs in folder
for filename in os.listdir(input_folder):
    if filename.lower().endswith(".png"):
        input_path = os.path.join(input_folder, filename)
        output_path = os.path.join(output_folder, filename)
        replace_colors_fuzzy(input_path, output_path, fuzzy_color_map)

print("🎨 Recoloring finished successfully!")