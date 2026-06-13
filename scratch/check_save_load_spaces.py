with open(r"e:\adhub-pro-main (4)\adhub-pro-main\src\pages\DesignStudio.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

print("--- Chunk 0 ---")
for idx in range(2132, 2138):
    print(f"{idx+1}: {repr(lines[idx])}")

print("--- Chunk 1 ---")
for idx in range(2176, 2182):
    print(f"{idx+1}: {repr(lines[idx])}")

print("--- Chunk 2 ---")
for idx in range(2245, 2251):
    print(f"{idx+1}: {repr(lines[idx])}")
