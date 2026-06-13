with open(r"e:\adhub-pro-main (4)\adhub-pro-main\src\pages\DesignStudio.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "coverT5" in line or "coverT5Style" in line or "coverT5ColorMode" in line:
        print(f"Line {i+1}: {line.strip()}")
