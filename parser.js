const isEast3 = typeof window !== "undefined" && window.location && window.location.hostname.includes("east-3");
console.log("CT Operations Monitor parser loaded (" + (isEast3 ? "EAST-3" : "EAST-2") + ") — v11.3.3");

const CT_ACTIVE_IMAGE_STATE_CACHE = new Map();

window.CTParser = {

    get(cls, row) {
        const cell = row.querySelector("." + cls);
        if (!cell) return "";

        const select = cell.querySelector("select");
        if (select) return String(select.value || "").trim();

        return String(cell.innerText || cell.textContent || "")
            .replace(/\s+/g, " ")
            .trim();
    },

    campaignLeafHeaders(table) {
        if (!table) return [];
        const rows = Array.from(table.querySelectorAll('thead tr, tr.mat-header-row, tr.mat-mdc-header-row, tr[role="row"]'));
        const headerRows = rows.filter(function(row) {
            return Array.from(row.querySelectorAll('th, [role="columnheader"]')).length > 0;
        });
        if (!headerRows.length) return [];
        const leafRow = headerRows.slice().sort(function(a, b) {
            return b.querySelectorAll('th, [role="columnheader"]').length - a.querySelectorAll('th, [role="columnheader"]').length;
        })[0];
        return Array.from(leafRow.querySelectorAll('th, [role="columnheader"]'));
    },

    findHeaderCell(row, labels, occurrence) {
        const table = row.closest('table, mat-table');
        if (!table) return null;
        const wanted = (labels || []).map(function(v){ return String(v).replace(/\s+/g,' ').trim().toLowerCase(); });
        const headers = this.campaignLeafHeaders(table);
        const matches = headers.filter(function(h){
            const text = String(h.innerText || h.textContent || '').replace(/\s+/g,' ').trim().toLowerCase();
            return wanted.includes(text);
        });
        const header = matches[Math.max(0, Number(occurrence || 0))];
        if (!header) return null;

        // Prefer the shared Material/CDK column class when it exists between header and row.
        const headerClasses = typeof header.className === 'string' ? header.className.split(/\s+/).filter(Boolean) : [];
        for (const cls of headerClasses) {
            if (!/^(mat|cdk)-column-/.test(cls)) continue;
            const cell = row.querySelector('.' + cls);
            if (cell) return cell;
        }

        const headerRect = header.getBoundingClientRect ? header.getBoundingClientRect() : null;
        const cells = Array.from(row.querySelectorAll('td.mat-cell, td.mat-mdc-cell, td, [role="cell"]'));
        if (headerRect && headerRect.width) {
            const center = headerRect.left + headerRect.width / 2;
            const byGeometry = cells.find(function(cell){
                const r = cell.getBoundingClientRect ? cell.getBoundingClientRect() : null;
                return r && r.width && center >= r.left - 2 && center <= r.right + 2;
            });
            if (byGeometry) return byGeometry;
        }
        const headerIndex = headers.indexOf(header);
        if (headerIndex >= 0 && cells[headerIndex]) return cells[headerIndex];
        const nonSelection = cells.filter(function(c){
            const signal = String(c.className || '').toLowerCase();
            return !/mat-column-select|cdk-column-select|checkbox/.test(signal);
        });
        return nonSelection[headerIndex] || null;
    },

    getByHeader(row, labels, fallbackClasses, occurrence) {
        for (const cls of (fallbackClasses || [])) {
            const cell = row.querySelector('.' + cls);
            if (cell) return String(cell.innerText || cell.textContent || '').replace(/\s+/g,' ').trim();
        }
        const cell = this.findHeaderCell(row, labels, occurrence);
        if (!cell) return '';
        const select = cell.querySelector && cell.querySelector('select');
        if (select) return String(select.value || '').trim();
        return String(cell.innerText || cell.textContent || '').replace(/\s+/g,' ').trim();
    },

    readActiveState(row) {
        // CallTools' Active column is the source of truth. The UI has changed
        // its rendered control several times, so do not depend on one generated
        // Angular class. Resolve the Active cell first, then inspect the actual
        // control/icon state inside that cell.
        const cellSelectors = [
            '.cdk-column-campaign__active',
            '.cdk-column-active',
            '[class*="cdk-column-campaign__active"]',
            '[class*="cdk-column-active"]',
            '[data-column="active"]',
            '[data-column-name="active"]'
        ];

        let cell = null;

        // Prefer the visible table column position over generated Angular class
        // names. In the current CallTools UI the header is explicitly "Active"
        // and this guarantees we inspect the same cell the operator sees.
        const table = row.closest('table, mat-table');
        if (table) {
            const headers = Array.from(table.querySelectorAll(
                'thead th, tr.mat-header-row th, tr.mat-mdc-header-row th, th, [role="columnheader"]'
            ));
            const activeHeader = headers.find(function (header) {
                const text = String(header.innerText || header.textContent || '')
                    .replace(/\s+/g, ' ').trim().toLowerCase();
                return text === 'active' || text === 'status';
            });

            if (activeHeader) {
                // IMPORTANT: the CallTools table has a leading row-selection
                // column. A raw header index therefore does NOT necessarily
                // equal the data-cell index. Prefer the shared Material/CDK
                // column class between the header and this row.
                const headerClasses = typeof activeHeader.className === 'string'
                    ? activeHeader.className.split(/\s+/).filter(Boolean)
                    : [];
                for (const cls of headerClasses) {
                    if (!/^((cdk|mat)-column-)/.test(cls)) continue;
                    const candidate = row.querySelector('.' + cls);
                    if (candidate) {
                        cell = candidate;
                        break;
                    }
                }

                // Some Angular renders expose the column class through a
                // nested wrapper instead of the TD itself.
                if (!cell) {
                    for (const cls of headerClasses) {
                        if (!/^((cdk|mat)-column-)/.test(cls)) continue;
                        const candidate = row.querySelector('[class*="' + cls + '"]');
                        if (candidate) {
                            cell = candidate;
                            break;
                        }
                    }
                }

            }
        }

        // Geometry fallback: align the Active header with the row cell the
        // operator actually sees. This survives Angular class/name changes and
        // the leading selection checkbox column.
        if (!cell) {
            cell = this.findHeaderCell(row, ['active', 'status']);
        }

        // First try the explicit column selectors. These are safer than a raw
        // positional index because the CallTools row contains a leading
        // selection checkbox column.
        if (!cell) {
            for (const selector of cellSelectors) {
                const candidate = row.querySelector(selector);
                if (candidate) {
                    cell = candidate;
                    break;
                }
            }
        }

        // If no column class is exposed, identify the Active cell by the
        // actual state control rendered inside it. This is the important
        // fallback for the current CallTools Angular build: the green check /
        // gray X is the only row-level state indicator that means Active.
        if (!cell) {
            const candidates = Array.from(row.querySelectorAll(
                'td.mat-cell, td.mat-mdc-cell, td, [role="cell"]'
            ));
            const stateCell = candidates.find(function (candidate) {
                const descendants = [candidate].concat(Array.from(candidate.querySelectorAll('*')));
                const signal = descendants.map(function (node) {
                    return [
                        typeof node.className === 'string' ? node.className : '',
                        node.getAttribute && node.getAttribute('aria-label'),
                        node.getAttribute && node.getAttribute('title'),
                        node.getAttribute && node.getAttribute('data-icon'),
                        node.getAttribute && node.getAttribute('data-icon-name'),
                        node.getAttribute && node.getAttribute('data-material-icon'),
                        node.getAttribute && node.getAttribute('fonticon'),
                        node.textContent || ''
                    ].filter(Boolean).join(' ');
                }).join(' ').toLowerCase();
                return /check_circle|check_circle_outline|highlight_off|radio_button_checked|radio_button_unchecked|toggle_on|toggle_off|mat-checkbox-checked|mat-checkbox-unchecked|mdc-checkbox--selected|mdc-checkbox--unselected/.test(signal);
            });
            if (stateCell) cell = stateCell;
        }

        // Last positional fallback only. This must happen AFTER semantic/icon
        // detection; otherwise the leading selection column can shift the
        // Active header index and make us inspect the Name/Count cell instead.
        if (!cell && table) {
            const headers = Array.from(table.querySelectorAll(
                'thead th, tr.mat-header-row th, tr.mat-mdc-header-row th, th, [role="columnheader"]'
            ));
            const activeHeader = headers.find(function (header) {
                const text = String(header.innerText || header.textContent || '')
                    .replace(/\s+/g, ' ').trim().toLowerCase();
                return text === 'active' || text === 'status';
            });
            if (activeHeader) {
                const cells = Array.from(row.querySelectorAll(
                    'td.mat-cell, td.mat-mdc-cell, td, [role="cell"]'
                ));
                const headerIndex = headers.indexOf(activeHeader);
                const selectionHeaderCount = headers.slice(0, Math.max(0, headerIndex))
                    .filter(function (header) {
                        const signal = [
                            header.getAttribute && header.getAttribute('class'),
                            header.getAttribute && header.getAttribute('data-column'),
                            header.getAttribute && header.getAttribute('aria-label')
                        ].filter(Boolean).join(' ').toLowerCase();
                        const text = String(header.innerText || header.textContent || '')
                            .replace(/\s+/g, ' ').trim().toLowerCase();
                        return /select|checkbox|row-select|mat-column-select|cdk-column-select/.test(signal) || text === '';
                    }).length;
                const dataIndex = Math.max(0, headerIndex - selectionHeaderCount);
                cell = cells[dataIndex] || null;
            }
        }

        // If the generated column/header structure is unavailable, identify a
        // dedicated status cell by its own class/data attributes.
        if (!cell) {
            const candidates = Array.from(row.querySelectorAll(
                'td, [role="cell"], .mat-cell, .mat-mdc-cell'
            ));
            cell = candidates.find(function (candidate) {
                const signal = [
                    candidate.className,
                    candidate.getAttribute && candidate.getAttribute('data-column'),
                    candidate.getAttribute && candidate.getAttribute('data-column-name'),
                    candidate.getAttribute && candidate.getAttribute('aria-label'),
                    candidate.getAttribute && candidate.getAttribute('title')
                ].filter(Boolean).join(' ').toLowerCase();
                return /(^|[\s_-])(active|status)([\s_-]|$)/.test(signal);
            }) || null;
        }

        if (!cell) return null;

        const nodes = [cell].concat(Array.from(cell.querySelectorAll('*')));
        const readBool = function (value) {
            const text = String(value == null ? '' : value).trim().toLowerCase();
            if (['true','1','yes','on','checked','active','enabled','selected'].includes(text)) return true;
            if (['false','0','no','off','unchecked','inactive','disabled','unselected'].includes(text)) return false;
            return null;
        };

        // Native checkbox/switch state.
        const input = cell.querySelector('input[type="checkbox"], input[role="switch"]');
        if (input) return Boolean(input.checked);

        // Accessibility/data state.
        for (const node of nodes) {
            const attrs = [
                node.getAttribute && node.getAttribute('aria-checked'),
                node.getAttribute && node.getAttribute('aria-pressed'),
                node.getAttribute && node.getAttribute('data-checked'),
                node.getAttribute && node.getAttribute('data-active'),
                node.getAttribute && node.getAttribute('data-state'),
                node.getAttribute && node.getAttribute('data-status')
            ];
            for (const value of attrs) {
                const parsed = readBool(value);
                if (parsed !== null) return parsed;
            }
        }

        // Material/Angular control classes and icon names.
        const classSignals = nodes.map(function (node) {
            return typeof node.className === 'string' ? node.className.toLowerCase() : '';
        }).join(' ');
        if (/mat-checkbox-checked|mdc-checkbox--selected|mat-slide-toggle-checked|toggle_on|radio_button_checked|check_circle|check_circle_outline/.test(classSignals)) return true;
        if (/mat-checkbox-unchecked|mdc-checkbox--unselected|mat-slide-toggle-unchecked|toggle_off|radio_button_unchecked|highlight_off/.test(classSignals)) return false;

        const signalText = nodes.map(function (node) {
            return [
                node.getAttribute && node.getAttribute('aria-label'),
                node.getAttribute && node.getAttribute('title'),
                node.getAttribute && node.getAttribute('data-testid'),
                node.getAttribute && node.getAttribute('data-icon'),
                node.getAttribute && node.getAttribute('fonticon'),
                node.getAttribute && node.getAttribute('mattooltip'),
                node.getAttribute && node.getAttribute('data-icon-name'),
                node.getAttribute && node.getAttribute('data-material-icon'),
                node.textContent,
                typeof node.className === 'string' ? node.className : ''
            ].filter(Boolean).join(' ').toLowerCase();
        }).join(' | ');

        if (/highlight_off|radio_button_unchecked|toggle_off|\b(inactive|disabled|false|off|unchecked|unselected|close|cancel)\b/.test(signalText)) return false;
        if (/check_circle|check_circle_outline|\bcheck\b|done_all|done_outline|radio_button_checked|toggle_on|\bchecked\b|\bdone\b|\benabled\b|\bselected\b/.test(signalText)) return true;

        // The current CallTools build renders the Active indicator as an <img>
        // inside the Active TD. The screenshot/DOM diagnostic shows the TD has
        // the correct cdk-column-campaign__active class but the cell text is
        // empty, so class/text-only icon detection cannot resolve the state.
        // Read image attributes first, then (when same-origin and already
        // decoded) sample the rendered pixels. This keeps Active sourced from
        // the actual visible Active indicator instead of another campaign metric.
        const imageNodes = cell.querySelectorAll ? Array.from(cell.querySelectorAll('img')) : [];
        for (const image of imageNodes) {
            const imageSignal = [
                image.getAttribute && image.getAttribute('src'),
                image.getAttribute && image.getAttribute('alt'),
                image.getAttribute && image.getAttribute('title'),
                image.getAttribute && image.getAttribute('aria-label'),
                image.getAttribute && image.getAttribute('data-icon'),
                image.getAttribute && image.getAttribute('data-icon-name'),
                image.getAttribute && image.getAttribute('data-material-icon'),
                typeof image.className === 'string' ? image.className : ''
            ].filter(Boolean).join(' ').toLowerCase();

            if (/\b(active|enabled|checked|selected|on|success|green|check|tick)\b/.test(imageSignal)) return true;
            if (/\b(inactive|disabled|unchecked|unselected|off|close|cancel|gray|grey|disabled|error)\b/.test(imageSignal)) return false;

            const imageSrc = String(image.currentSrc || image.src || '').trim();
            if (imageSrc && image.complete && image.naturalWidth > 0) {
                const cached = CT_ACTIVE_IMAGE_STATE_CACHE.get(imageSrc);
                if (cached === true || cached === false) return cached;
                try {
                    const canvas = document.createElement('canvas');
                    const size = 32;
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    if (ctx) {
                        ctx.clearRect(0, 0, size, size);
                        ctx.drawImage(image, 0, 0, size, size);
                        const pixels = ctx.getImageData(0, 0, size, size).data;
                        let samples = 0;
                        let green = 0;
                        let neutral = 0;
                        let colored = 0;
                        for (let i = 0; i < pixels.length; i += 16) {
                            const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
                            if (a < 60) continue;
                            samples++;
                            const max = Math.max(r, g, b);
                            const min = Math.min(r, g, b);
                            const saturation = max ? (max - min) / max : 0;
                            if (g >= 90 && g > r * 1.12 && g > b * 1.03) green++;
                            if (saturation < 0.16 && max > 35 && max < 245) neutral++;
                            if (saturation >= 0.16) colored++;
                        }
                        if (samples >= 3) {
                            if (green / samples >= 0.08) {
                                CT_ACTIVE_IMAGE_STATE_CACHE.set(imageSrc, true);
                                return true;
                            }
                            if (neutral / samples >= 0.45 && colored / samples < 0.45) {
                                CT_ACTIVE_IMAGE_STATE_CACHE.set(imageSrc, false);
                                return false;
                            }
                        }
                    }
                } catch (error) {}
            }
        }

        // SVG/icon state. The visible CallTools control is a colored icon; its
        // state can live in fill/stroke rather than color/backgroundColor.
        try {
            for (const node of nodes) {
                const style = window.getComputedStyle(node);
                const values = [
                    style.color, style.backgroundColor, style.borderColor,
                    style.fill, style.stroke
                ].filter(Boolean).join(' ');
                const attrs = [
                    node.getAttribute && node.getAttribute('fill'),
                    node.getAttribute && node.getAttribute('stroke'),
                    node.getAttribute && node.getAttribute('style')
                ].filter(Boolean).join(' ');
                const colors = (values + ' ' + attrs).toLowerCase();

                // Common green active-state rendering, including rgb/rgba and
                // hex forms. This is only evaluated inside the resolved Active cell.
                const rgbMatches = colors.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g) || [];
                for (const rgb of rgbMatches) {
                    const m = rgb.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
                    if (!m) continue;
                    const r = Number(m[1]), g = Number(m[2]), b = Number(m[3]);
                    if (g >= 105 && g > r * 1.15 && g > b * 1.03) return true;
                    if (r >= 130 && r > g * 1.15 && r > b * 1.15) return false;
                }

                const hexMatches = colors.match(/#[0-9a-f]{6}/g) || [];
                for (const hex of hexMatches) {
                    const r = parseInt(hex.slice(1,3), 16), g = parseInt(hex.slice(3,5), 16), b = parseInt(hex.slice(5,7), 16);
                    if (g >= 105 && g > r * 1.15 && g > b * 1.03) return true;
                    if (r >= 130 && r > g * 1.15 && r > b * 1.15) return false;
                }
            }
        } catch (error) {}

        // Final explicit text fallback.
        const text = String(cell.innerText || cell.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (['✓','✔','check','check_circle','done','on','active','enabled','selected'].includes(text)) return true;
        if (['×','✕','✖','close','cancel','off','inactive','disabled','unchecked'].includes(text)) return false;

        return null;
    },

    findQueueTable() {
        const rawTables = Array.from(document.querySelectorAll("table, mat-table, [role='table']"));
        const tables = rawTables.filter(t => !t.closest || !t.closest("#ct-operations-dashboard, [id^='ct-operations-dashboard'], .ct-dashboard, #ct-operations-root"));
        if (!tables.length) return null;
        // Primary signature: CallTools Queues multi-tier table
        const primary = tables.find(function(table) {
            const text = String(table.innerText || table.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
            const hasCalls = /calls \(today\)|calls today/.test(text);
            const hasAgents = /agents \(now\)|agents now/.test(text);
            const hasWaitOrCallsNow = /wait time|calls \(now\)|calls now|on queue calls/.test(text);
            return (hasCalls && hasAgents) || (hasAgents && hasWaitOrCallsNow);
        });
        if (primary) return primary;

        // Fallback: table with characteristic queue columns
        return tables.find(function(table) {
            const text = String(table.innerText || table.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
            return /logged in/.test(text) && /on queue calls/.test(text) && /waiting/.test(text);
        }) || null;
    },

    queueLeafHeaders(table) {
        if (!table) return [];
        const rows = Array.from(table.querySelectorAll('thead tr, tr.mat-header-row, tr.mat-mdc-header-row, tr[role="row"]'));
        const headerRows = rows.filter(function(row) {
            return Array.from(row.querySelectorAll('th, [role="columnheader"]')).length > 0;
        });
        if (!headerRows.length) return [];
        const leafRow = headerRows.slice().sort(function(a,b) {
            return b.querySelectorAll('th, [role="columnheader"]').length - a.querySelectorAll('th, [role="columnheader"]').length;
        })[0];
        return Array.from(leafRow.querySelectorAll('th, [role="columnheader"]'));
    },

    queueHeaderCell(row, label, occurrence) {
        const table = row && row.closest ? row.closest('table, mat-table') : null;
        if (!table) return null;
        const headers = this.queueLeafHeaders(table);
        const wanted = String(label || '').replace(/\s+/g,' ').trim().toLowerCase();
        const matches = headers.filter(function(h) {
            return String(h.innerText || h.textContent || '').replace(/\s+/g,' ').trim().toLowerCase() === wanted;
        });
        const header = matches[Math.max(0, Number(occurrence || 0))];
        if (!header) return null;

        // Prefer the shared Material/CDK column class when it exists.
        const headerClasses = typeof header.className === 'string' ? header.className.split(/\s+/).filter(Boolean) : [];
        for (const cls of headerClasses) {
            if (!/^(mat|cdk)-column-/.test(cls)) continue;
            const cell = row.querySelector('.' + cls);
            if (cell) return cell;
        }

        // Geometry is the authoritative fallback because duplicate leaf labels
        // such as Total and Answered exist in multiple grouped sections.
        const rect = header.getBoundingClientRect ? header.getBoundingClientRect() : null;
        const cells = Array.from(row.querySelectorAll('td.mat-cell, td.mat-mdc-cell, td, [role="cell"]'));
        if (rect && rect.width) {
            const center = rect.left + rect.width / 2;
            const byGeometry = cells.find(function(cell) {
                const r = cell.getBoundingClientRect ? cell.getBoundingClientRect() : null;
                return r && r.width && center >= r.left - 2 && center <= r.right + 2;
            });
            if (byGeometry) return byGeometry;
        }

        // Positional index must align with LEAF headers (not all multi-tier headers),
        // because row cells map 1-to-1 to leaf columns.
        const leafIndex = headers.indexOf(header);
        return leafIndex >= 0 && cells[leafIndex] ? cells[leafIndex] : null;
    },

    queueValue(row, label, occurrence) {
        const cell = this.queueHeaderCell(row, label, occurrence);
        if (!cell) return null;
        const select = cell.querySelector && cell.querySelector('select');
        if (select) return String(select.value || '').trim();
        return String(cell.innerText || cell.textContent || '').replace(/\s+/g,' ').trim();
    },

    parseMetricRecord(raw) {
        if (raw === null || raw === undefined || String(raw).trim() === '') {
            return { raw: raw, value: null, state: "MISSING", isValid: false };
        }
        const clean = String(raw).replace(/,/g, '').trim();
        const n = parseFloat(clean);
        if (isNaN(n)) {
            return { raw: raw, value: null, state: "MALFORMED", isValid: false };
        }
        if (n === 0) {
            return { raw: raw, value: 0, state: "VALID_ZERO", isValid: true };
        }
        return { raw: raw, value: n, state: "VALID_NONZERO", isValid: true };
    },

    readQueues() {
        const table = this.findQueueTable();
        if (!table) return [];
        const rows = Array.from(table.querySelectorAll('tr.mat-row, tr.mat-mdc-row, tbody tr')).filter(function(row) {
            return String(row.innerText || row.textContent || '').trim();
        });
        const parse = this.parseMetricRecord.bind(this);
        return rows.map((row, index) => {
            const rawCallsTodayTotal = this.queueValue(row, 'Total', 0);
            const rawCallsTodayAnswered = this.queueValue(row, 'Answered', 0);
            const rawCallsTodayNotAnswered = this.queueValue(row, 'Not Answered', 0);
            const rawInboundMachine = this.queueValue(row, 'Inbound Machine', 0);
            const rawInboundNoAnswer = this.queueValue(row, 'Inbound No Answer', 0) ?? this.queueValue(row, 'No Answer', 0);
            const rawLoggedIn = this.queueValue(row, 'Logged In', 0);
            const rawOnQueueCalls = this.queueValue(row, 'On Queue Calls', 0);
            const rawCallsNowTotal = this.queueValue(row, 'Total', 1);
            const rawWaiting = this.queueValue(row, 'Waiting', 0);
            const rawCallsNowAnswered = this.queueValue(row, 'Answered', 1);
            const rawWaitAverage = this.queueValue(row, 'Average', 0);
            const rawWaitMax = this.queueValue(row, 'Max', 0);
            const rawCalendarEvents = this.queueValue(row, 'Calender Events', 0) || this.queueValue(row, 'Calendar Events', 0);
            const rawOpportunities = this.queueValue(row, 'Opportunities', 0);
            const rawGoals = this.queueValue(row, 'Goals', 0);
            const rawSales = this.queueValue(row, 'Sales', 0);

            return {
                id: row.getAttribute('data-queue-id') || row.getAttribute('data-id') || '',
                rowIndex: index,
                name: this.queueValue(row, 'Name', 0) || '',
                callsTodayTotal: rawCallsTodayTotal ?? '',
                callsTodayAnswered: rawCallsTodayAnswered ?? '',
                callsTodayNotAnswered: rawCallsTodayNotAnswered ?? '',
                inboundMachine: rawInboundMachine ?? '',
                inboundNoAnswer: rawInboundNoAnswer ?? '',
                loggedIn: rawLoggedIn ?? '',
                onQueueCalls: rawOnQueueCalls ?? '',
                callsNowTotal: rawCallsNowTotal ?? '',
                waiting: rawWaiting ?? '',
                callsNowAnswered: rawCallsNowAnswered ?? '',
                waitAverage: rawWaitAverage ?? '',
                waitMax: rawWaitMax ?? '',
                calendarEvents: rawCalendarEvents ?? '',
                opportunities: rawOpportunities ?? '',
                goals: rawGoals ?? '',
                sales: rawSales ?? '',
                // Typed metric validity records:
                _metrics: {
                    callsTodayTotal: parse(rawCallsTodayTotal),
                    callsTodayAnswered: parse(rawCallsTodayAnswered),
                    callsTodayNotAnswered: parse(rawCallsTodayNotAnswered),
                    inboundMachine: parse(rawInboundMachine),
                    inboundNoAnswer: parse(rawInboundNoAnswer),
                    loggedIn: parse(rawLoggedIn),
                    onQueueCalls: parse(rawOnQueueCalls),
                    callsNowTotal: parse(rawCallsNowTotal),
                    waiting: parse(rawWaiting),
                    callsNowAnswered: parse(rawCallsNowAnswered),
                    waitAverage: parse(rawWaitAverage),
                    waitMax: parse(rawWaitMax),
                    calendarEvents: parse(rawCalendarEvents),
                    opportunities: parse(rawOpportunities),
                    goals: parse(rawGoals),
                    sales: parse(rawSales)
                }
            };
        });
    },

    findCampaignTable() {
        const rawTables = Array.from(document.querySelectorAll("table, mat-table, [role='table']"));
        if (!rawTables.length) return null;
        for (const table of rawTables) {
            // Strictly exclude CT Operations Monitor dashboard elements, modals, and hidden frames
            if (table.closest && (
                table.closest("#ct-operations-dashboard, [id^='ct-operations-dashboard'], .ct-dashboard, #ct-operations-root, iframe, [id^='ct-operations-hidden-']") ||
                (table.className && String(table.className).includes("ct-active-summary-table"))
            )) {
                continue;
            }
            // Check for native CallTools table markers: headers, rows, or characteristic classes
            const hasNativeHeaders = Boolean(table.querySelector("th.cdk-column-name, th.cdk-column-outbound, th.mat-header-cell, tr.mat-header-row, tr.mat-mdc-header-row, mat-header-row"));
            const hasNativeRows = Boolean(table.querySelector("tr.mat-row, tr.mat-mdc-row, mat-row, tr[mat-row], [role='row'].mat-row, [role='row'].mat-mdc-row"));
            const text = String(table.innerText || table.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();

            if (hasNativeHeaders || hasNativeRows || /campaign|contacts|channels|outbound|human/.test(text)) {
                return table;
            }
        }
        const nonDash = rawTables.filter(t => !t.closest || !t.closest("#ct-operations-dashboard, [id^='ct-operations-dashboard'], iframe, [id^='ct-operations-hidden-']"));
        return nonDash.length ? nonDash[0] : null;
    },

    readCampaigns() {
        const table = this.findCampaignTable ? this.findCampaignTable() : null;
        const selector = "tr.mat-row, tr.mat-mdc-row, mat-row, tr[mat-row], tbody tr, [role='row'].mat-row, [role='row'].mat-mdc-row";
        let allRows = [];
        if (table) {
            allRows = Array.from(table.querySelectorAll(selector));
        } else {
            allRows = Array.from(document.querySelectorAll(selector)).filter(function (r) {
                return !r.closest || !r.closest("#ct-operations-dashboard, [id^='ct-operations-dashboard'], iframe, [id^='ct-operations-hidden-']");
            });
        }
        const rows = allRows.filter(function (row) {
            return !row.closest("thead") && !row.querySelector("th") && !row.matches("tr.mat-header-row, tr.mat-mdc-header-row");
        });
        if (!rows.length) return [];
        const parse = this.parseMetricRecord.bind(this);

        return rows.map((row, index) => {
            const idNode = row.querySelector(
                '[data-campaign-id], [data-id], [data-campaignid], [data-campaign-id]'
            );
            let id = idNode
                ? (idNode.getAttribute("data-campaign-id") || idNode.getAttribute("data-id") || idNode.getAttribute("data-campaignid"))
                : (row.getAttribute("data-campaign-id") || row.getAttribute("data-id") || "");
            if (!id) {
                const editLink = row.querySelector("a[href*='/manager/campaigns/edit/'], a[href*='/campaigns/edit/'], button[data-id]");
                if (editLink) {
                    const href = editLink.getAttribute("href") || "";
                    const m = href.match(/\/campaigns\/edit\/([a-zA-Z0-9_\-]+)/);
                    if (m) id = m[1];
                    else if (editLink.getAttribute("data-id")) id = editLink.getAttribute("data-id");
                }
            }

            const rawName = this.getByHeader(row, ["name"], ["cdk-column-name", "cdk-column-campaign__name"]);
            const active = this.readActiveState(row);
            const rawContacts = this.getByHeader(row, ["count", "contact count", "total contacts", "total"], ["cdk-column-contact_count", "cdk-column-total_saved_contact_count", "cdk-column-contacts"], 0);
            const rawChannels = this.getByHeader(row, ["per agent", "channels per agent", "channels"], ["cdk-column-channels", "cdk-column-campaign__channels_per_agent"]);
            const rawWaitNow = this.getByHeader(row, ["agent wait", "wait now", "now"], ["cdk-column-wait_now", "cdk-column-cached_now_avg_wait_time"]);
            const rawWaitToday = this.getByHeader(row, ["today"], ["cdk-column-wait_today", "cdk-column-recent_avg_wait_time", "cdk-column-cached_today_avg_wait_time"]);
            const rawOutbound = this.getByHeader(row, ["outbound", "outbound calls", "total"], ["cdk-column-outbound", "cdk-column-calls_outbound", "cdk-column-calls_today"], 1);
            const rawHuman = this.getByHeader(row, ["human"], ["cdk-column-human", "cdk-column-calls_outbound_human"]);
            const rawMachine = this.getByHeader(row, ["machine"], ["cdk-column-machine", "cdk-column-calls_outbound_machine"]);
            const rawAgentConnect = this.getByHeader(row, ["to agents", "agent connect", "agent connects"], ["cdk-column-agent_connect", "cdk-column-calls_outbound_agent_connect"]);
            const rawAbandoned = this.getByHeader(row, ["abandoned"], ["cdk-column-abandoned", "cdk-column-calls_outbound_abandoned"]);
            const rawNoAnswer = this.getByHeader(row, ["no ans", "no answer"], ["cdk-column-no_answer", "cdk-column-calls_outbound_noanswer"]);
            const rawBusy = this.getByHeader(row, ["busy"], ["cdk-column-busy", "cdk-column-calls_outbound_busy"]);
            const rawFailed = this.getByHeader(row, ["failed"], ["cdk-column-failed", "cdk-column-calls_outbound_failed"]);

            // Agent state columns are not exposed on the native CallTools Campaigns table.
            // If present in another view or custom layout, extract them; otherwise preserve null (unavailable)
            // so dashboard.js never fabricates 0 or triggers false agent capacity alerts.
            const rawLoggedIn = this.getByHeader(row, ["logged in", "logged-in"], ["cdk-column-logged_in", "cdk-column-cached_logged_in_agents"]);
            const rawWaiting = this.getByHeader(row, ["waiting"], ["cdk-column-waiting_agents", "cdk-column-cached_waiting_agents"]);
            const rawOnCall = this.getByHeader(row, ["on call", "on-call"], ["cdk-column-phone_call_agents", "cdk-column-cached_phone_call_agents"]);
            const rawPostCall = this.getByHeader(row, ["post call", "wrap up"], ["cdk-column-post_call_wrap_up_agents", "cdk-column-cached_post_call_wrap_up_agents"]);
            const rawSales = this.getByHeader(row, ["sales", "sale", "sales (today)", "sales today"], ["mat-column-sales", "cdk-column-sales", "cdk-column-sales_today", "cdk-column-campaign__sales"]);
            const rawGoals = this.getByHeader(
                row,
                ["goals", "goal", "goals (today)", "goals today", "conversions"],
                [
                    "mat-column-goals",
                    "cdk-column-goals",
                    "cdk-column-goals_today",
                    "cdk-column-campaign__goals",
                    "cdk-column-conversions"
                ]
            );

            // Live Filter discovery (Stage 3 & Phase 13)
            let rawLiveFilter = this.getByHeader(
                row,
                ["live filter", "filter", "active filter", "assigned filter"],
                ["cdk-column-live_filter", "cdk-column-filter", "cdk-column-campaign__live_filter", "cdk-column-campaign__filter"]
            );
            let filterSource = rawLiveFilter ? "TABLE_COLUMN" : "DOM_UNAVAILABLE";
            if (!rawLiveFilter) {
                const filterCell = row.querySelector("[data-column='live_filter'], [data-column='filter'], .cdk-column-live_filter, .cdk-column-filter, [class*='column-filter'], [class*='column-live_filter']");
                if (filterCell) {
                    const sel = filterCell.querySelector("select");
                    rawLiveFilter = sel ? String(sel.value || "").trim() : String(filterCell.innerText || filterCell.textContent || "").trim();
                    if (rawLiveFilter) filterSource = "TABLE_CELL";
                }
            }
            if (!rawLiveFilter && (row.getAttribute("data-live-filter") || row.getAttribute("data-filter"))) {
                rawLiveFilter = String(row.getAttribute("data-live-filter") || row.getAttribute("data-filter")).trim();
                if (rawLiveFilter) filterSource = "ROW_ATTRIBUTE";
            }
            if (!rawLiveFilter && typeof document !== "undefined") {
                const editForm = document.querySelector("select[name='live_filter'], mat-select[formcontrolname*='filter'], mat-select[formcontrolname*='live_filter']");
                if (editForm && id && editForm.closest && editForm.closest(`[data-campaign-id='${id}']`)) {
                    rawLiveFilter = String(editForm.value || editForm.innerText || editForm.textContent || "").trim();
                    if (rawLiveFilter) filterSource = "EDIT_FORM";
                }
            }
            // Check active CDK overlays or modals on page for campaign edit drawer
            if (!rawLiveFilter && typeof document !== "undefined" && id) {
                const overlay = document.querySelector(".cdk-overlay-container, mat-dialog-container, mat-drawer, mat-sidenav, [role='dialog']");
                if (overlay) {
                    const overlayEditForm = (overlay.querySelector && overlay.querySelector(`[data-campaign-id='${id}']`)) || overlay;
                    const ms = overlayEditForm.querySelector("mat-select[formcontrolname*='filter' i], select[name*='filter' i], .mat-select-value-text");
                    if (ms) {
                        const txt = String(ms.innerText || ms.textContent || ms.value || "").trim();
                        if (txt && txt !== "None" && txt !== "Unassigned" && !txt.toLowerCase().includes("select")) {
                            rawLiveFilter = txt;
                            filterSource = "ACTIVE_OVERLAY";
                        }
                    }
                }
            }
            // Check verified registry if not found directly in current table row
            let verifiedTimestamp = null;
            const storageObj = (typeof localStorage !== "undefined" ? localStorage : null) || (typeof window !== "undefined" && window.localStorage ? window.localStorage : null);
            if (!rawLiveFilter && storageObj) {
                try {
                    const regKey = isEast3 ? "ct_east3_verified_campaign_filters_v1" : "ct_east2_verified_campaign_filters_v1";
                    const regData = JSON.parse(storageObj.getItem(regKey) || "{}");
                    let entry = null;
                    if (id && regData[String(id)]) {
                        entry = regData[String(id)];
                    } else if (rawName) {
                        const cleanName = String(rawName).trim();
                        if (regData[cleanName]) {
                            entry = regData[cleanName];
                        } else {
                            for (const k of Object.keys(regData)) {
                                if (regData[k] && regData[k].campaignName && String(regData[k].campaignName).trim().toLowerCase() === cleanName.toLowerCase()) {
                                    entry = regData[k];
                                    break;
                                }
                            }
                        }
                    }
                    if (entry) {
                        const fVal = entry.liveFilter || entry.filter;
                        if (fVal) {
                            rawLiveFilter = fVal;
                            filterSource = entry.source || "VERIFIED_REGISTRY";
                            verifiedTimestamp = entry.timestamp || null;
                        }
                    }
                } catch (e) {}
            }

            const hasLiveFilter = Boolean(rawLiveFilter && String(rawLiveFilter).trim() !== "" && rawLiveFilter !== "None" && rawLiveFilter !== "Unassigned" && rawLiveFilter !== "—");
            const liveFilter = hasLiveFilter ? String(rawLiveFilter).trim() : null;
            const liveFilterStatus = hasLiveFilter ? "ASSIGNED" : (rawLiveFilter === "None" || rawLiveFilter === "Unassigned" ? "NONE" : "FILTER SOURCE UNAVAILABLE");
            const liveFilterSource = hasLiveFilter ? filterSource : "DOM_UNAVAILABLE";
            const liveFilterConfidence = hasLiveFilter ? "VERIFIED" : "UNAVAILABLE";
            const liveFilterTimestamp = verifiedTimestamp || (hasLiveFilter ? Date.now() : null);

            return {
                id: id || "",
                rowIndex: index,
                name: rawName,
                active: active,
                contacts: rawContacts,
                channels: rawChannels,
                waitNow: rawWaitNow,
                waitToday: rawWaitToday,
                outbound: rawOutbound,
                human: rawHuman,
                machine: rawMachine,
                agentConnect: rawAgentConnect,
                abandoned: rawAbandoned,
                noAnswer: rawNoAnswer,
                busy: rawBusy,
                failed: rawFailed,
                loggedIn: rawLoggedIn !== "" ? rawLoggedIn : null,
                waiting: rawWaiting !== "" ? rawWaiting : null,
                onCall: rawOnCall !== "" ? rawOnCall : null,
                postCall: rawPostCall !== "" ? rawPostCall : null,
                goals: rawGoals !== "" ? rawGoals : null,
                sales: rawSales !== "" ? rawSales : null,
                liveFilter: liveFilter,
                liveFilterStatus: liveFilterStatus,
                liveFilterSource: liveFilterSource,
                liveFilterConfidence: liveFilterConfidence,
                liveFilterTimestamp: liveFilterTimestamp,
                _metrics: {
                    contacts: parse(rawContacts),
                    channels: parse(rawChannels),
                    waitNow: parse(rawWaitNow),
                    waitToday: parse(rawWaitToday),
                    outbound: parse(rawOutbound),
                    human: parse(rawHuman),
                    machine: parse(rawMachine),
                    agentConnect: parse(rawAgentConnect),
                    abandoned: parse(rawAbandoned),
                    noAnswer: parse(rawNoAnswer),
                    busy: parse(rawBusy),
                    failed: parse(rawFailed),
                    loggedIn: parse(rawLoggedIn),
                    waiting: parse(rawWaiting),
                    onCall: parse(rawOnCall),
                    postCall: parse(rawPostCall),
                    goals: parse(rawGoals)
                }
            };
        });
    },

    /**
     * Reads campaign edit form / Targeting section DOM.
     * Extracts campaignId, campaignName, and selected Live Filter.
     */
    readCampaignEditForm(doc) {
        const targetDoc = doc || (typeof document !== "undefined" ? document : null);
        if (!targetDoc) return null;

        // 1. Identify Campaign ID
        let campaignId = "";
        if (typeof window !== "undefined" && window.location && window.location.pathname) {
            const match = window.location.pathname.match(/\/campaigns\/edit\/([a-zA-Z0-9_\-]+)/);
            if (match) campaignId = match[1];
        }
        if (!campaignId) {
            const formWithId = targetDoc.querySelector("[data-campaign-id], [data-id]");
            if (formWithId) {
                campaignId = formWithId.getAttribute("data-campaign-id") || formWithId.getAttribute("data-id") || "";
            }
        }
        if (!campaignId) {
            const idInput = targetDoc.querySelector("input[name='id'], input[formcontrolname='id']");
            if (idInput && (idInput.value || idInput.getAttribute("value"))) {
                campaignId = idInput.value || idInput.getAttribute("value") || "";
            }
        }

        // 2. Identify Campaign Name
        let campaignName = "";
        const nameInput = targetDoc.querySelector("input[name='name'], input[formcontrolname='name']");
        if (nameInput && (nameInput.value || nameInput.getAttribute("value"))) {
            campaignName = String(nameInput.value || nameInput.getAttribute("value") || "").trim();
        } else {
            const headerEl = targetDoc.querySelector("h1, h2, .page-title, .breadcrumb-item.active");
            if (headerEl) {
                const txt = (headerEl.innerText || headerEl.textContent || "").trim();
                const clean = txt.replace(/^Edit\s+/i, "").trim();
                if (clean) campaignName = clean;
            }
        }

        // 3. Identify Live Filter
        let liveFilter = null;
        let filterSource = "NONE";

        // A. Angular Material mat-select
        const matSelects = Array.from(targetDoc.querySelectorAll("mat-select[formcontrolname*='filter' i], mat-select[name*='filter' i], mat-select[aria-label*='filter' i], mat-select[placeholder*='filter' i]"));
        for (const ms of matSelects) {
            const valEl = ms.querySelector(".mat-select-value, .mat-select-value-text, .mat-mdc-select-value-text, .mat-select-min-line");
            const valText = valEl ? String(valEl.innerText || valEl.textContent || "").trim() : "";
            if (valText && valText !== "None" && valText !== "Unassigned" && valText !== "—" && !valText.toLowerCase().includes("select")) {
                liveFilter = valText;
                filterSource = "MAT_SELECT";
                break;
            }
        }

        // B. Standard HTML select
        if (!liveFilter) {
            const nativeSelects = Array.from(targetDoc.querySelectorAll("select[name*='filter' i], select[id*='filter' i], select[formcontrolname*='filter' i]"));
            for (const sel of nativeSelects) {
                if (sel.options && sel.options.length > 0) {
                    const idx = sel.selectedIndex >= 0 ? sel.selectedIndex : 0;
                    const opt = sel.options[idx];
                    const text = opt ? String(opt.text || opt.innerText || opt.textContent || opt.value || "").trim() : "";
                    if (text && text !== "None" && text !== "Unassigned" && !text.toLowerCase().includes("select")) {
                        liveFilter = text;
                        filterSource = "NATIVE_SELECT";
                        break;
                    }
                } else if (sel.value) {
                    const text = String(sel.value).trim();
                    if (text && text !== "None" && text !== "Unassigned") {
                        liveFilter = text;
                        filterSource = "NATIVE_SELECT";
                        break;
                    }
                }
            }
        }

        // C. Targeting section / Label associated field
        if (!liveFilter) {
            const labels = Array.from(targetDoc.querySelectorAll("label, mat-label, .form-label"));
            for (const lbl of labels) {
                const lblText = (lbl.innerText || lbl.textContent || "").toLowerCase();
                if (lblText.includes("live filter") || (lblText.includes("filter") && lblText.includes("targeting"))) {
                    const container = (lbl.closest && lbl.closest(".form-group, mat-form-field, .targeting-field")) || lbl.parentElement;
                    if (container) {
                        const valEl = container.querySelector(".mat-select-value-text, .mat-select-value, select, input, [data-value]");
                        if (valEl) {
                            const txt = String(valEl.value || valEl.innerText || valEl.textContent || "").trim();
                            if (txt && txt !== "None" && txt !== "Unassigned" && !txt.toLowerCase().includes("select")) {
                                liveFilter = txt;
                                filterSource = "TARGETING_SECTION";
                                break;
                            }
                        }
                    }
                }
            }
        }

        if (!campaignId && !liveFilter && !campaignName) return null;

        const isAssigned = Boolean(liveFilter && liveFilter !== "None" && liveFilter !== "Unassigned");
        return {
            campaignId: campaignId || "unknown",
            campaignName: campaignName || (campaignId ? `Campaign ${campaignId}` : ""),
            liveFilter: isAssigned ? liveFilter : null,
            status: isAssigned ? "ASSIGNED" : "NONE",
            source: filterSource,
            timestamp: Date.now()
        };
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = window.CTParser;
}
