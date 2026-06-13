import sys

path = r"e:\adhub-pro-main (4)\adhub-pro-main\src\pages\DesignStudio.tsx"
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

brace_stack = []
paren_stack = []

for line_idx, line in enumerate(lines):
    line_num = line_idx + 1
    # Very basic scanner that ignores quotes and comments
    in_string = None
    in_comment = False
    
    col = 0
    while col < len(line):
        char = line[col]
        
        if in_comment:
            if in_comment == 'line':
                break  # line comment goes to end of line
            elif in_comment == 'block' and col < len(line) - 1 and line[col:col+2] == '*/':
                in_comment = False
                col += 2
                continue
            col += 1
            continue
            
        if in_string:
            if char == in_string:
                # check backslashes
                backslashes = 0
                temp_col = col - 1
                while temp_col >= 0 and line[temp_col] == '\\':
                    backslashes += 1
                    temp_col -= 1
                if backslashes % 2 == 0:
                    in_string = None
            col += 1
            continue
            
        if char in ('"', "'", '`'):
            in_string = char
            col += 1
            continue
            
        if col < len(line) - 1:
            if line[col:col+2] == '//':
                in_comment = 'line'
                break
            elif line[col:col+2] == '/*':
                in_comment = 'block'
                col += 2
                continue
                
        if char == '{':
            brace_stack.append((line_num, col))
        elif char == '}':
            if not brace_stack:
                print(f"Excess '}}' at line {line_num}, col {col}")
            else:
                brace_stack.pop()
                
        elif char == '(':
            paren_stack.append((line_num, col))
        elif char == ')':
            if not paren_stack:
                print(f"Excess ')' at line {line_num}, col {col}")
            else:
                paren_stack.pop()
                
        col += 1

print(f"Scan complete. Open braces remaining: {len(brace_stack)}")
if brace_stack:
    print("Last few open braces:")
    for b in brace_stack[-10:]:
        print(f"  Line {b[0]} col {b[1]}: {lines[b[0]-1].strip()[:50]}")
        
print(f"Open parentheses remaining: {len(paren_stack)}")
if paren_stack:
    print("Last few open parentheses:")
    for p in paren_stack[-10:]:
        print(f"  Line {p[0]} col {p[1]}: {lines[p[0]-1].strip()[:50]}")
