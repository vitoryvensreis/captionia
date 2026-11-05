"""Reproducible branded icons for packaging: no binary Git blobs required."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
SIZE = 1024
im = Image.new("RGBA", (SIZE, SIZE), (18, 12, 23, 255))
d = ImageDraw.Draw(im)
for y in range(SIZE):
    a = y / SIZE
    d.line((0, y, SIZE, y), fill=(int(98*(1-a)+43*a), int(16*(1-a)+19*a),
                                 int(49*(1-a)+107*a), 255))
d.rounded_rectangle((47,47,977,977),radius=238,outline="#FF73B4",width=24)
d.rounded_rectangle((147,147,877,877),radius=190,outline="#D73793",width=9)
fonts = [
    r"C:\Windows\Fonts\arialbd.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]
font = next((ImageFont.truetype(f, 625) for f in fonts if Path(f).exists()), None)
if font is None:
    font = ImageFont.load_default(size=625)
bbox=d.textbbox((0,0),"C",font=font)
d.text(((SIZE-(bbox[2]-bbox[0]))/2-bbox[0],
        (SIZE-(bbox[3]-bbox[1]))/2-bbox[1]-17),"C",font=font,fill="#FFE8F4")
im.save(HERE/"captionia.png")
im.save(HERE/"captionia.ico",format="ICO",sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
print("Branded icons created", HERE)