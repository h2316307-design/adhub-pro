with open(r"e:\adhub-pro-main (4)\adhub-pro-main\src\pages\DesignStudio.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "coverT5BgColorOnly" in line and "Switch" in line:
        print(f"Line {i+1}: {repr(line)}")
        for idx in range(max(0, i - 4), min(len(lines), i + 8)):
            print(f"  {idx+1}: {repr(lines[idx])}")
