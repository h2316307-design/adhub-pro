with open(r"e:\adhub-pro-main (4)\adhub-pro-main\src\pages\DesignStudio.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

occurrences = []
for i, line in enumerate(lines):
    if "renderCollageItems" in line and not "const renderCollageItems" in line:
        occurrences.append(i)

print("Occurrences of renderCollageItems:", occurrences)
for o in occurrences:
    print(f"\n--- Around line {o+1} ---")
    for idx in range(max(0, o - 15), min(len(lines), o + 15)):
        print(f"{idx+1}: {lines[idx]}", end="")
