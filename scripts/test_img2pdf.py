import os
from PIL import Image

img_path = "test_rendered/slide-1.png"
if os.path.exists(img_path):
    img = Image.open(img_path).convert("RGB")
    img.save("test_presentation.pdf", "PDF", resolution=100.0)
    print("pdf generated:", os.path.exists("test_presentation.pdf"), os.path.getsize("test_presentation.pdf"))
