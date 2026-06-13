# -*- coding: utf-8 -*-
filepath = r"e:\adhub-pro-main (4)\adhub-pro-main\src\pages\DesignStudio.tsx"

with open(filepath, "r", encoding="utf-8") as f:
    code = f.read()

# Target switches container
old_part = """                                   <div className="flex items-center justify-between pt-1">
                                     <Label className="text-[11px] font-medium text-foreground">خلفية ملونة سادة (بدون صور)</Label>
                                     <Switch checked={coverT5BgColorOnly} onCheckedChange={setCoverT5BgColorOnly} />
                                   </div>
                                 </div>
                               )}"""

new_part = """                                   <div className="flex items-center justify-between pt-1">
                                     <Label className="text-[11px] font-medium text-foreground">خلفية ملونة سادة (بدون صور)</Label>
                                     <Switch checked={coverT5BgColorOnly} onCheckedChange={setCoverT5BgColorOnly} />
                                   </div>
                                   {!coverT5BgColorOnly && !coverT5FillBackground && (
                                     <div className="flex items-center justify-between pt-1">
                                       <Label className="text-[11px] font-medium text-foreground">تفتيت صورة الخلفية</Label>
                                       <Switch checked={coverT5BgShatter} onCheckedChange={setCoverT5BgShatter} />
                                     </div>
                                   )}
                                   {!coverT5BgColorOnly && (
                                     <div className="space-y-1 pt-1">
                                       <div className="flex items-center justify-between text-[11px] font-medium text-foreground">
                                         <span>عدد شرائح الزجاج بالخلفية</span>
                                         <span className="text-[10px] text-primary">{coverT5SlatCount}</span>
                                       </div>
                                       <Slider min={2} max={12} step={1} value={[coverT5SlatCount]} onValueChange={([v]) => setCoverT5SlatCount(v)} />
                                     </div>
                                   )}
                                 </div>
                               )}"""

if old_part in code:
    code = code.replace(old_part, new_part)
    print("Success: added slats count and shatter controls to sidebar.")
else:
    old_part_lf = old_part.replace("\r\n", "\n")
    code_lf = code.replace("\r\n", "\n")
    if old_part_lf in code_lf:
        code_lf = code_lf.replace(old_part_lf, new_part.replace("\r\n", "\n"))
        code = code_lf
        print("Success: added slats count and shatter controls (LF normal).")
    else:
        print("Error: sidebar switches block not found in file.")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(code)
print("Sidebar controls updated.")
