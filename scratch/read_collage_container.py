with open(r"e:\adhub-pro-main (4)\adhub-pro-main\src\pages\DesignStudio.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

for idx in range(6360, min(6415, len(lines))):
    print(f"{idx+1}: {lines[idx]}", end="")
