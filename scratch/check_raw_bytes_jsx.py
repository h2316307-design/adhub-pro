with open(r"e:\adhub-pro-main (4)\adhub-pro-main\src\pages\DesignStudio.tsx", "rb") as f:
    content = f.read()

# Search for the string "id: 'style1'"
style1_idx = content.find(b"id: 'style1'")
if style1_idx != -1:
    start_idx = max(0, style1_idx - 100)
    end_idx = min(len(content), style1_idx + 350)
    chunk = content[start_idx:end_idx]
    print("Raw bytes of JSX style block:", chunk)
    
    for enc in ["utf-8", "windows-1256", "cp1256", "iso-8859-1"]:
        try:
            print(f"\nDecoding as {enc}:")
            print(chunk.decode(enc))
        except Exception as e:
            print(f"Failed to decode as {enc}: {e}")
else:
    print("id: 'style1' raw bytes not found")
