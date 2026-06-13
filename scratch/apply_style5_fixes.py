# -*- coding: utf-8 -*-
import sys

# Ensure UTF-8 console output
sys.stdout.reconfigure(encoding='utf-8')

filepath = r"e:\adhub-pro-main (4)\adhub-pro-main\src\pages\DesignStudio.tsx"

with open(filepath, "r", encoding="utf-8") as f:
    code = f.read()

# 1. Update renderWindowSlats to support coverT5BgColorOnly
old_slats = """                            <div className="absolute inset-0 flex z-0" style={{ filter: `blur(${coverT4.bgBlur}px) saturate(1.95) brightness(0.78)` }}>
                              <div className="absolute inset-0 z-0 bg-black" />
                              <div className="absolute inset-0 z-10" style={{ backgroundColor: accent, opacity: 0.65, mixBlendMode: 'color' }} />
                              <div className="absolute inset-0 z-20" style={{ background: `radial-gradient(circle at 50% 50%, ${accent} 0%, transparent 70%)`, opacity: 0.7, mixBlendMode: 'screen' }} />
                              {coverT5FillBackground ? (
                                <div className="absolute inset-0 z-10 overflow-hidden">
                                  <img
                                    src={photos[0]?.url}
                                    crossOrigin="anonymous"
                                    alt=""
                                    className="w-full h-full object-cover"
                                    style={{
                                      transform: `scale(1.2) ${isReflection ? 'scaleY(-1)' : ''}`,
                                    }}
                                  />
                                </div>
                              ) : (
                                Array.from({ length: 5 }).map((_, colIdx) => {
                                  const photo = photos[colIdx % photos.length];
                                  if (!photo) return null;
                                  return (
                                    <div key={`win-bg-photo-${colIdx}`} className="h-full flex-1 relative z-10">
                                      <img
                                        src={photo.url}
                                        crossOrigin="anonymous"
                                        alt=""
                                        className="w-full h-full object-cover"
                                        style={{
                                          transform: `scale(1.6) ${isReflection ? 'scaleY(-1)' : ''}`,
                                          objectPosition: `${20 + colIdx * 15}% 50%`,
                                        }}
                                      />
                                    </div>
                                  );
                                })
                              )}
                            </div>
                            
                            {/* Transparent glass slat panels on top */}
                            <div className="absolute inset-0 flex z-10">
                              {coverT5FillBackground ? (
                                <div 
                                  key={`win-bg-slat-single${isReflection ? '-refl' : ''}`}
                                  className="h-full flex-1 relative"
                                  style={{
                                    boxShadow: 'inset 0 0 50px rgba(0,0,0,0.35)',
                                  }}
                                >
                                  <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 40%, rgba(0,0,0,0.15) 100%)' }} />
                                </div>
                              ) : (
                                Array.from({ length: 5 }).map((_, colIdx) => (
                                  <div
                                    key={`win-bg-slat-${colIdx}${isReflection ? '-refl' : ''}`}
                                    className="h-full flex-1 relative"
                                    style={{
                                      borderRight: '1px solid rgba(255,255,255,0.08)',
                                      borderLeft: '1px solid rgba(0,0,0,0.2)',
                                      boxShadow: 'inset 0 0 30px rgba(0,0,0,0.45)',
                                    }}
                                  >
                                    <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, transparent 30%, rgba(0,0,0,0.15) 100%)' }} />
                                  </div>
                                ))
                              )}
                            </div>"""

new_slats = """                            <div className="absolute inset-0 flex z-0" style={{ filter: `blur(${coverT4.bgBlur}px) saturate(1.95) brightness(0.78)` }}>
                              <div className="absolute inset-0 z-0 bg-black" />
                              <div className="absolute inset-0 z-10" style={{ backgroundColor: accent, opacity: 0.65, mixBlendMode: 'color' }} />
                              <div className="absolute inset-0 z-20" style={{ background: `radial-gradient(circle at 50% 50%, ${accent} 0%, transparent 70%)`, opacity: 0.7, mixBlendMode: 'screen' }} />
                              
                              {coverT5BgColorOnly ? (
                                <div className="absolute inset-0 z-10" style={{ background: `radial-gradient(circle at 50% 50%, ${accent}dd 0%, #000 100%)` }} />
                              ) : (
                                coverT5FillBackground ? (
                                  <div className="absolute inset-0 z-10 overflow-hidden">
                                    <img
                                      src={photos[0]?.url}
                                      crossOrigin="anonymous"
                                      alt=""
                                      className="w-full h-full object-cover"
                                      style={{
                                        transform: `scale(1.2) ${isReflection ? 'scaleY(-1)' : ''}`,
                                      }}
                                    />
                                  </div>
                                ) : (
                                  Array.from({ length: 5 }).map((_, colIdx) => {
                                    const photo = photos[colIdx % photos.length];
                                    if (!photo) return null;
                                    return (
                                      <div key={`win-bg-photo-${colIdx}`} className="h-full flex-1 relative z-10">
                                        <img
                                          src={photo.url}
                                          crossOrigin="anonymous"
                                          alt=""
                                          className="w-full h-full object-cover"
                                          style={{
                                            transform: `scale(1.6) ${isReflection ? 'scaleY(-1)' : ''}`,
                                            objectPosition: `${20 + colIdx * 15}% 50%`,
                                          }}
                                        />
                                      </div>
                                    );
                                  })
                                )
                              )}
                            </div>
                            
                            {/* Transparent glass slat panels on top */}
                            <div className="absolute inset-0 flex z-10">
                              {coverT5BgColorOnly || coverT5FillBackground ? (
                                <div 
                                  key={`win-bg-slat-single${isReflection ? '-refl' : ''}`}
                                  className="h-full flex-1 relative"
                                  style={{
                                    boxShadow: 'inset 0 0 50px rgba(0,0,0,0.35)',
                                  }}
                                >
                                  <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 40%, rgba(0,0,0,0.15) 100%)' }} />
                                </div>
                              ) : (
                                Array.from({ length: 5 }).map((_, colIdx) => (
                                  <div
                                    key={`win-bg-slat-${colIdx}${isReflection ? '-refl' : ''}`}
                                    className="h-full flex-1 relative"
                                    style={{
                                      borderRight: '1px solid rgba(255,255,255,0.08)',
                                      borderLeft: '1px solid rgba(0,0,0,0.2)',
                                      boxShadow: 'inset 0 0 30px rgba(0,0,0,0.45)',
                                    }}
                                  >
                                    <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, transparent 30%, rgba(0,0,0,0.15) 100%)' }} />
                                  </div>
                                ))
                              )}
                            </div>"""

if old_slats in code:
    code = code.replace(old_slats, new_slats)
    print("Success: updated renderWindowSlats background logic.")
else:
    # Try with slightly different whitespace / newlines just in case
    old_slats_lf = old_slats.replace("\r\n", "\n")
    code_lf = code.replace("\r\n", "\n")
    if old_slats_lf in code_lf:
        code_lf = code_lf.replace(old_slats_lf, new_slats.replace("\r\n", "\n"))
        code = code_lf
        print("Success: updated renderWindowSlats background logic (LF normal).")
    else:
        print("Error: renderWindowSlats old block not found in file.")

# 2. Add Style 5 (Portal Background Only - No Cards) to renderCollageItems
old_style1_header = "                        // ----------------------------------------------------\n                        // Style 1: Floating Glass Cards\n                        // ----------------------------------------------------"
new_style1_header = """                        // ----------------------------------------------------
                        // Style 5: Background Only (No Cards)
                        // ----------------------------------------------------
                        if (coverT5Style === 'style5') {
                          return null;
                        }

                        // ----------------------------------------------------
                        // Style 1: Floating Glass Cards
                        // ----------------------------------------------------"""

if old_style1_header in code:
    code = code.replace(old_style1_header, new_style1_header)
    print("Success: added Style 5 null return check in renderCollageItems.")
else:
    old_style1_header_lf = old_style1_header.replace("\r\n", "\n")
    if old_style1_header_lf in code:
        code = code.replace(old_style1_header_lf, new_style1_header.replace("\r\n", "\n"))
        print("Success: added Style 5 null return check in renderCollageItems (LF normal).")
    else:
        print("Error: Style 1 header not found in renderCollageItems.")

# 3. Add Style 5 button and coverT5BgColorOnly Switch to Sidebar Controls
old_buttons = """                                        { id: 'style1', label: 'البطاقات العائمة' },
                                        { id: 'style2', label: 'ألواح مموّجة' },
                                        { id: 'style3', label: 'معرض لا نهائي' },
                                        { id: 'style4', label: 'لوحات ثلاثية الأبعاد' },
                                      ] as const).map((s) => ("""

new_buttons = """                                        { id: 'style1', label: 'البطاقات العائمة' },
                                        { id: 'style2', label: 'ألواح مموّجة' },
                                        { id: 'style3', label: 'معرض لا نهائي' },
                                        { id: 'style4', label: 'لوحات ثلاثية الأبعاد' },
                                        { id: 'style5', label: 'بوابة فقط (بدون كروت)' },
                                      ] as const).map((s) => ("""

if old_buttons in code:
    code = code.replace(old_buttons, new_buttons)
    print("Success: added Style 5 button to sidebar layout.")
else:
    old_buttons_lf = old_buttons.replace("\r\n", "\n")
    if old_buttons_lf in code:
        code = code.replace(old_buttons_lf, new_buttons.replace("\r\n", "\n"))
        print("Success: added Style 5 button to sidebar layout (LF normal).")
    else:
        print("Error: style buttons array not found in sidebar UI.")

old_switches = """                                   <div className="flex items-center justify-between pt-1">
                                     <Label className="text-[11px] font-medium text-foreground">تعبئة الصورة بالكامل (أقصى ارتفاع)</Label>
                                     <Switch checked={coverT5FillBackground} onCheckedChange={setCoverT5FillBackground} />
                                   </div>
                                 </div>
                               )}"""

new_switches = """                                   <div className="flex items-center justify-between pt-1">
                                     <Label className="text-[11px] font-medium text-foreground">تعبئة الصورة بالكامل (أقصى ارتفاع)</Label>
                                     <Switch checked={coverT5FillBackground} onCheckedChange={setCoverT5FillBackground} />
                                   </div>
                                   <div className="flex items-center justify-between pt-1">
                                     <Label className="text-[11px] font-medium text-foreground">خلفية ملونة سادة (بدون صور)</Label>
                                     <Switch checked={coverT5BgColorOnly} onCheckedChange={setCoverT5BgColorOnly} />
                                   </div>
                                 </div>
                               )}"""

if old_switches in code:
    code = code.replace(old_switches, new_switches)
    print("Success: added coverT5BgColorOnly Switch to sidebar toggles.")
else:
    old_switches_lf = old_switches.replace("\r\n", "\n")
    if old_switches_lf in code:
        code = code.replace(old_switches_lf, new_switches.replace("\r\n", "\n"))
        print("Success: added coverT5BgColorOnly Switch to sidebar toggles (LF normal).")
    else:
        print("Error: background switches block not found in sidebar UI.")

# Write back changes
with open(filepath, "w", encoding="utf-8") as f:
    f.write(code)

print("All changes successfully applied to DesignStudio.tsx.")
