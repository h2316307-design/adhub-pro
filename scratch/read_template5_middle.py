with open(r"e:\adhub-pro-main (4)\adhub-pro-main\src\pages\DesignStudio.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

for idx in range(5800, 5886):
    print(f"{idx+1}: {lines[idx]}", end="")
