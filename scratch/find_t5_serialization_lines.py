with open(r"e:\adhub-pro-main (4)\adhub-pro-main\src\pages\DesignStudio.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "coverT5FillBackground" in line and ("glass_panel_style" in lines[i-1] or "glass_panel_style" in lines[i-2] or "coverTemplate" in line):
        print(f"Line {i+1}: {line.strip()}")
    if "setCoverT5FillBackground(gpsAny.coverT5FillBackground)" in line:
        print(f"Line {i+1}: {line.strip()}")
