with open(r"e:\adhub-pro-main (4)\adhub-pro-main\src\pages\DesignStudio.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "#080402" in line or "radial-gradient(circle" in line:
        if i > 5750 and i < 6350:
            print(f"Line {i+1}: {line.strip()}")
