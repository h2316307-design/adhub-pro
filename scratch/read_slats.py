with open(r"e:\adhub-pro-main (4)\adhub-pro-main\src\pages\DesignStudio.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

start_line = -1
for i, line in enumerate(lines):
    if "const renderWindowSlats = " in line:
        start_line = i
        break

print(f"renderWindowSlats starts at line {start_line+1}")

if start_line != -1:
    for idx in range(start_line, min(start_line + 95, len(lines))):
        print(f"{idx+1}: {lines[idx]}", end="")
