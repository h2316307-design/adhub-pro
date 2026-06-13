# -*- coding: utf-8 -*-
filepath = r"e:\adhub-pro-main (4)\adhub-pro-main\src\pages\DesignStudio.tsx"

with open(filepath, "r", encoding="utf-8") as f:
    code = f.read()

# Target the exact switch block with exact indentation
old_part = """                                  <div className="flex items-center justify-between pt-1">
                                    <Label className="text-[11px] font-medium text-foreground">تعبئة الصورة بالكامل (أقصى ارتفاع)</Label>
                                    <Switch checked={coverT5FillBackground} onCheckedChange={setCoverT5FillBackground} />
                                  </div>
                                </div>
                              )}"""

new_part = """                                  <div className="flex items-center justify-between pt-1">
                                    <Label className="text-[11px] font-medium text-foreground">تعبئة الصورة بالكامل (أقصى ارتفاع)</Label>
                                    <Switch checked={coverT5FillBackground} onCheckedChange={setCoverT5FillBackground} />
                                  </div>
                                  <div className="flex items-center justify-between pt-1">
                                    <Label className="text-[11px] font-medium text-foreground">خلفية ملونة سادة (بدون صور)</Label>
                                    <Switch checked={coverT5BgColorOnly} onCheckedChange={setCoverT5BgColorOnly} />
                                  </div>
                                </div>
                              )}"""

if old_part in code:
    code = code.replace(old_part, new_part)
    print("Success: added coverT5BgColorOnly Switch to sidebar toggles.")
else:
    # Try LF version
    old_part_lf = old_part.replace("\r\n", "\n")
    code_lf = code.replace("\r\n", "\n")
    if old_part_lf in code_lf:
        code_lf = code_lf.replace(old_part_lf, new_part.replace("\r\n", "\n"))
        code = code_lf
        print("Success: added coverT5BgColorOnly Switch (LF normal).")
    else:
        print("Error: switches block still not found.")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(code)
