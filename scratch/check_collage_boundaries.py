with open(r"e:\adhub-pro-main (4)\adhub-pro-main\src\pages\DesignStudio.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

start_line = -1
for i, line in enumerate(lines):
    if "const renderCollageItems = " in line:
        start_line = i
        break

print(f"Start block at line {start_line+1}:")
for idx in range(start_line - 2, start_line + 15):
    print(f"{idx+1}: {lines[idx]}", end="")

print("\n-------------------------------\nEnd block:")
# Find the end of renderCollageItems (where it returns null or the next section starts)
for idx in range(start_line + 380, min(start_line + 410, len(lines))):
    print(f"{idx+1}: {lines[idx]}", end="")
