with open(r"e:\adhub-pro-main (4)\adhub-pro-main\src\pages\DesignStudio.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "البطاقات العائمة" in line:
        print(f"Line {i+1}: {line.strip()}")
        # print 5 lines before and 25 lines after
        for idx in range(max(0, i - 6), min(len(lines), i + 26)):
            print(f"  {idx+1}: {lines[idx]}", end="")
