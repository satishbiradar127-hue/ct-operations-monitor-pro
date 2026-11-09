import os

for dialer in ["East2", "East3"]:
    p = os.path.join("CT_OPERATIONS_DUAL_DIALER_RELEASE", f"CT_Operations_Monitor_{dialer}", "src", "intelligence.js")
    with open(p, "r", encoding="utf-8") as f:
        c = f.read()
    c = c.replace("\r\n", "\n")

    if "recordRefreshResult(" in c:
        print(f"{dialer} already has recordRefreshResult.")
        continue

    target = """            };
        }
    }

    return {
        CTDataIntelligenceEngine,"""

    replacement = """            };
        }

        getRefreshHistory() {
            try {
                const raw = this.storage ? this.storage.getItem(this.prefix + "refresh_history_v1") : null;
                return raw ? JSON.parse(raw) : [];
            } catch (e) {
                return [];
            }
        }

        recordRefreshResult(record) {
            try {
                const history = this.getRefreshHistory();
                history.unshift(Object.assign({
                    timestamp: Date.now(),
                    dialer: this.dialer
                }, record));
                const trimmed = history.slice(0, 30);
                if (this.storage) {
                    this.storage.setItem(this.prefix + "refresh_history_v1", JSON.stringify(trimmed));
                }
                return trimmed;
            } catch (e) {
                return [];
            }
        }
    }

    return {
        CTDataIntelligenceEngine,"""

    if target in c:
        c = c.replace(target, replacement)
        with open(p, "w", encoding="utf-8", newline="\n") as f:
            f.write(c)
        print(f"Added getRefreshHistory and recordRefreshResult to {dialer}/intelligence.js")
    else:
        print(f"Target not found in {dialer}/intelligence.js")

