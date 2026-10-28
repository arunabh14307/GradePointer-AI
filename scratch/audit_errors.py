import os
import re
import glob

def check_html_ids():
    with open('index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # Find all IDs defined in HTML
    html_ids = set(re.findall(r'id=["\']([^"\']+)["\']', html))
    print(f"Total HTML IDs defined: {len(html_ids)}")

    # Check for duplicate IDs in HTML
    all_ids = re.findall(r'id=["\']([^"\']+)["\']', html)
    seen = {}
    duplicates = []
    for i in all_ids:
        if i in seen:
            duplicates.append(i)
        seen[i] = True
    if duplicates:
        print(f"DUPLICATE IDs found: {set(duplicates)}")
    else:
        print("No duplicate IDs in index.html.")

    # Check getElementById in JS files
    missing_elements = []
    for js_path in glob.glob('js/*.js'):
        with open(js_path, 'r', encoding='utf-8') as f:
            js_code = f.read()
        
        # Match getElementById('...')
        get_ids = re.findall(r'getElementById\(["\']([^"\']+)["\']\)', js_code)
        for gid in get_ids:
            if gid not in html_ids:
                # Some IDs might be dynamically generated in templates
                missing_elements.append((js_path, gid))

    print(f"Total getElementById calls checked. Potential missing from HTML: {len(missing_elements)}")
    for js, gid in missing_elements:
        print(f"  [MISSING ID] {js} -> '{gid}'")

if __name__ == '__main__':
    check_html_ids()
