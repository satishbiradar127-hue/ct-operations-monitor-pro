import os

for d in ['East2', 'East3']:
    p = os.path.join('CT_OPERATIONS_DUAL_DIALER_RELEASE', f'CT_Operations_Monitor_{d}', 'src', 'dashboard.js')
    with open(p, 'r', encoding='utf-8') as f:
        c = f.read()
    c = c.replace('\r\n', '\n')
    
    old = """        refs.operatingTrigger.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            const willOpen = refs.operatingMenu.hidden;
            if (willOpen) {
                const rect = refs.operatingTrigger.getBoundingClientRect();
                refs.operatingMenu.style.position = "fixed";
                refs.operatingMenu.style.top = Math.round(rect.bottom + 4) + "px";
                refs.operatingMenu.style.left = Math.max(10, Math.min(window.innerWidth - 360, Math.round(rect.left))) + "px";
                refs.operatingMenu.style.width = "340px";
                refs.operatingMenu.style.maxHeight = "min(420px, 80vh)";
                refs.operatingMenu.style.zIndex = "1000000";
                refs.operatingMenu.hidden = false;
                refs.operatingTrigger.setAttribute("aria-expanded", "true");
                updateOperatingSelect(state.campaigns);
            } else {
                refs.operatingMenu.hidden = true;
                refs.operatingTrigger.setAttribute("aria-expanded", "false");
            }
        });"""

    new = """        refs.operatingTrigger.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            const willOpen = refs.operatingMenu.hidden;
            refs.operatingMenu.hidden = !willOpen;
            refs.operatingTrigger.setAttribute("aria-expanded", String(willOpen));
            if (willOpen) {
                updateOperatingSelect(state.campaigns);
            }
        });"""

    if old in c:
        c = c.replace(old, new)
        with open(p, 'w', encoding='utf-8', newline='\n') as f:
            f.write(c)
        print(d, 'operating toggle replaced successfully!')
    else:
        print(d, 'old block not found')
