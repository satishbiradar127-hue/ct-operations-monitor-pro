console.log("CT Operations Monitor parser loaded (" + ("EAST-3") + ") — v11.3.8");

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
            // 1. Precise Campaign ID Extraction (Stable Numeric ID)
            let id = null;
            const idNode = row.querySelector('[data-campaign-id], [data-id], [data-campaignid]');
            if (idNode) {
                const rawAttr = (idNode.getAttribute("data-campaign-id") || idNode.getAttribute("data-id") || idNode.getAttribute("data-campaignid") || "").trim();
                if (/^[0-9]+$/.test(rawAttr)) id = rawAttr;
            }
            if (!id) {
                const rowAttr = (row.getAttribute("data-campaign-id") || row.getAttribute("data-id") || "").trim();
                if (/^[0-9]+$/.test(rowAttr)) id = rowAttr;
            }
            if (!id) {
                const cb = row.querySelector("input[type='checkbox'], mat-checkbox");
                if (cb) {
                    const cbVal = (cb.value || cb.getAttribute("value") || cb.getAttribute("data-id") || cb.getAttribute("data-campaign-id") || "").trim();
                    if (/^[0-9]+$/.test(cbVal) && cbVal !== "on" && cbVal !== "true") id = cbVal;
                }
            }
            if (!id) {
                const ngEls = Array.from(row.querySelectorAll("[ng-reflect-router-link], [ng-reflect-href], [ng-reflect-id]"));
                for (const ng of ngEls) {
                    const rLink = ng.getAttribute("ng-reflect-router-link") || ng.getAttribute("ng-reflect-href") || ng.getAttribute("ng-reflect-id") || "";
                    const m = rLink.match(/(?:^|[,/\s])([0-9]{2,10})(?:$|[,/\s])/);
                    if (m && m[1]) { id = m[1]; break; }
                }
            }
            if (!id) {
                const candidates = Array.from(row.querySelectorAll("a[href], button[data-id], [data-campaign-id], [data-id]"));
                for (const el of candidates) {
                    const did = (el.getAttribute("data-campaign-id") || el.getAttribute("data-id") || el.getAttribute("data-campaignid") || "").trim();
                    if (/^[0-9]+$/.test(did)) {
                        id = did;
                        break;
                    }
                    const href = el.getAttribute("href") || "";
                    const m = href.match(/\/(?:campaigns\/(?:edit|members|agent-dashboard-settings|change-logs|preview|overview)|campaign)\/([0-9]+)/i) ||
                              href.match(/[?&](?:campaign|campaign_id|campaignId|logged_in_agents_for_campaign)=([0-9]+)/i);
                    if (m && m[1]) {
                        id = m[1];
                        break;
                    }
                }
            }

            // Detect lead list/file if visibly exposed in native DOM
            let leadList = null;
            const leadListCell = row.querySelector(".cdk-column-lead_file, .cdk-column-contact_list, .cdk-column-lead_pool, [data-column='lead_file'], [data-column='contact_list']");
            if (leadListCell) {
                const txt = String(leadListCell.innerText || leadListCell.textContent || "").trim();
                if (txt) leadList = txt;
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
            // Check active CDK overlays or modals on page for campaign edit drawer (strictly scoped to this campaign)
            if (!rawLiveFilter && typeof document !== "undefined" && id) {
                const overlay = document.querySelector(".cdk-overlay-container, mat-dialog-container, mat-drawer, mat-sidenav, [role='dialog']");
                if (overlay && overlay.querySelector) {
                    const overlayEditForm = overlay.querySelector(`[data-campaign-id='${id}']`) ||
                        (rawName ? overlay.querySelector(`[data-campaign-name='${rawName}']`) : null);
                    if (overlayEditForm) {
                        const ms = overlayEditForm.querySelector("ng-select[formcontrolname*='filter' i], mat-select[formcontrolname*='filter' i], select[name*='filter' i], .ng-value-label, .mat-select-value-text");
                        if (ms) {
                            const txt = String(ms.getAttribute("title") || ms.innerText || ms.textContent || ms.value || "").trim();
                            if (txt && txt !== "None" && txt !== "Unassigned" && !txt.toLowerCase().includes("select")) {
                                rawLiveFilter = txt;
                                filterSource = "ACTIVE_OVERLAY";
                            }
                        }
                    }
                }
            }
            // Check verified registry if not found directly in current table row
            let verifiedTimestamp = null;
            const storageObj = (typeof localStorage !== "undefined" ? localStorage : null) || (typeof window !== "undefined" && window.localStorage ? window.localStorage : null);
            if (!rawLiveFilter && storageObj) {
                try {
                    const regKey = "ct_east3_verified_campaign_filters_v1";
                    const regData = JSON.parse(storageObj.getItem(regKey) || "{}");
                    let entry = null;
                    if (id && regData[String(id)]) {
                        entry = regData[String(id)];
                    } else if (!id && rawName) {
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
                        if (!id && entry.campaignId && /^[0-9]+$/.test(String(entry.campaignId).trim())) {
                            id = String(entry.campaignId).trim();
                        }
                        const entryAge = entry.timestamp ? (Date.now() - entry.timestamp) : 0;
                        const isStale = entryAge > 120000;
                        const fVal = entry.liveFilter || entry.filter;
                        if (fVal) {
                            rawLiveFilter = fVal;
                            filterSource = isStale ? "STALE_REGISTRY" : (entry.source || "VERIFIED_REGISTRY");
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
            const liveFilterTimestamp = verifiedTimestamp || null;

            return {
                id: id || "",
                rawId: id || null,
                leadList: leadList || null,
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
     * Supports Angular ng-select, mat-select, native select, and combobox.
     */
    readCampaignEditForm(doc) {
        const targetDoc = (doc && doc.document) ? doc.document : (doc || (typeof document !== "undefined" ? document : null));
        if (!targetDoc || !targetDoc.querySelector) return null;

        // If on non-edit route without explicit edit form container, do not parse
        if (typeof window !== "undefined" && window.location && window.location.pathname) {
            const p = window.location.pathname;
            if (p === "/manager/campaigns" || (p.startsWith("/manager/campaigns") && !p.includes("/campaigns/edit/"))) {
                const hasEditContainer = Boolean(targetDoc.querySelector && targetDoc.querySelector("form, .campaign-edit-form, input[name='name']"));
                if (!hasEditContainer) return null;
            }
        }

        // 1. Identify Campaign ID
        let campaignId = "";
        if (typeof window !== "undefined" && window.location && window.location.pathname) {
            const match = window.location.pathname.match(/\/campaigns\/edit\/([0-9a-zA-Z_\-]+)/);
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
        const nameInput = targetDoc.querySelector("input[name='name'], input[formcontrolname='name'], input[id='name']");
        if (nameInput && (nameInput.value || nameInput.getAttribute("value"))) {
            campaignName = String(nameInput.value || nameInput.getAttribute("value") || "").trim();
        } else {
            const headerEl = targetDoc.querySelector("h1, h2, .page-title, .breadcrumb-item.active");
            if (headerEl) {
                const txt = (headerEl.innerText || headerEl.textContent || "").trim();
                const m = txt.match(/^Edit\s+Campaign\s*\((.*?)\)$/i) || txt.match(/^Edit\s+(?:Campaign\s+)?\(?(.*?)\)?$/i);
                if (m && (m[1] || m[2])) {
                    campaignName = String(m[1] || m[2] || "").trim();
                } else {
                    const clean = txt.replace(/^Edit\s+(?:Campaign\s+)?/i, "").replace(/[()]/g, "").trim();
                    if (clean) campaignName = clean;
                }
            }
        }

        // 3. Identify Live Filter
        let liveFilter = null;
        let filterSource = "NONE";

        function isValidFilterValue(val) {
            if (!val) return false;
            const s = String(val).trim();
            if (!s || s === "—" || s === "-" || s === "None" || s === "Unassigned") return false;
            const lower = s.toLowerCase();
            if (lower.startsWith("select") || lower === "choose..." || lower === "please select a live filter or bucket") return false;
            return true;
        }

        // A. Angular ng-select (Standard CallTools 2.0 dropdown)
        const ngSelects = Array.from(targetDoc.querySelectorAll("ng-select[formcontrolname*='filter' i], ng-select[name*='filter' i], ng-select[id*='filter' i], ng-select[aria-label*='filter' i], ng-select"));
        for (const ng of ngSelects) {
            const containerText = ((ng.closest && ng.closest(".form-group, .targeting-field, section, div")) ? ng.closest(".form-group, .targeting-field, section, div").textContent : "") || "";
            const isFilterSelect = (ng.getAttribute("formcontrolname") && ng.getAttribute("formcontrolname").toLowerCase().includes("filter")) ||
                                   (ng.getAttribute("name") && ng.getAttribute("name").toLowerCase().includes("filter")) ||
                                   /live\s*filter/i.test(containerText) ||
                                   /targeting/i.test(containerText);
            if (!isFilterSelect && ngSelects.length > 1) continue;

            const valEl = ng.querySelector(".ng-value-label, span[title], span.ng-value, [class*='ng-value-label']") || ng.querySelector(".ng-value");
            if (valEl) {
                const targetEl = (valEl.querySelector && valEl.querySelector(".ng-value-label, span[title]")) || valEl;
                const valText = String(targetEl.getAttribute("title") || targetEl.getAttribute("aria-label") || targetEl.innerText || targetEl.textContent || "").trim();
                if (isValidFilterValue(valText)) {
                    liveFilter = valText;
                    filterSource = "NG_SELECT";
                    break;
                }
            }
            if (!liveFilter) {
                const inputEl = ng.querySelector("input:not([type='hidden'])");
                if (inputEl) {
                    const inpVal = String(inputEl.getAttribute("title") || inputEl.value || inputEl.getAttribute("value") || "").trim();
                    if (isValidFilterValue(inpVal)) {
                        liveFilter = inpVal;
                        filterSource = "NG_SELECT";
                        break;
                    }
                }
            }
        }

        // B. Angular Material mat-select
        if (!liveFilter) {
            const matSelects = Array.from(targetDoc.querySelectorAll("mat-select[formcontrolname*='filter' i], mat-select[name*='filter' i], mat-select[aria-label*='filter' i], mat-select[placeholder*='filter' i]"));
            for (const ms of matSelects) {
                const valEl = ms.querySelector(".mat-select-value, .mat-select-value-text, .mat-mdc-select-value-text, .mat-select-min-line");
                const valText = valEl ? String(valEl.innerText || valEl.textContent || "").trim() : "";
                if (isValidFilterValue(valText)) {
                    liveFilter = valText;
                    filterSource = "MAT_SELECT";
                    break;
                }
            }
        }

        // C. Standard HTML select
        if (!liveFilter) {
            const nativeSelects = Array.from(targetDoc.querySelectorAll("select[name*='filter' i], select[id*='filter' i], select[formcontrolname*='filter' i]"));
            for (const sel of nativeSelects) {
                if (sel.options && sel.options.length > 0) {
                    const idx = sel.selectedIndex >= 0 ? sel.selectedIndex : 0;
                    const opt = sel.options[idx];
                    const text = opt ? String(opt.text || opt.innerText || opt.textContent || opt.value || "").trim() : "";
                    if (isValidFilterValue(text)) {
                        liveFilter = text;
                        filterSource = "NATIVE_SELECT";
                        break;
                    }
                } else if (sel.value) {
                    const text = String(sel.value).trim();
                    if (isValidFilterValue(text)) {
                        liveFilter = text;
                        filterSource = "NATIVE_SELECT";
                        break;
                    }
                }
            }
        }

        // D. Targeting section traversal from label
        if (!liveFilter) {
            const labels = Array.from(targetDoc.querySelectorAll("label, mat-label, .form-label, strong, b, div, span"));
            for (const lbl of labels) {
                const lblText = (lbl.innerText || lbl.textContent || "").trim().toLowerCase();
                if (lblText === "live filter" || lblText === "live filter:" || lblText.includes("select a live filter")) {
                    const container = (lbl.closest && lbl.closest(".form-group, mat-form-field, .targeting-field, .field, .form-row, .row, fieldset, section")) || lbl.parentElement;
                    if (container) {
                        const valEl = container.querySelector(".ng-value-label, span[title], .mat-select-value-text, .mat-select-value, .selected-item, [role='combobox'] span, [data-value]");
                        if (valEl) {
                            const txt = String(valEl.getAttribute("title") || valEl.innerText || valEl.textContent || "").trim();
                            if (isValidFilterValue(txt)) {
                                liveFilter = txt;
                                filterSource = "TARGETING_SECTION";
                                break;
                            }
                        }
                        const sel = container.querySelector("select");
                        if (sel && sel.options && sel.options.length > 0) {
                            const opt = sel.options[sel.selectedIndex >= 0 ? sel.selectedIndex : 0];
                            const txt = opt ? String(opt.text || opt.innerText || opt.textContent || "").trim() : "";
                            if (isValidFilterValue(txt)) {
                                liveFilter = txt;
                                filterSource = "TARGETING_SECTION";
                                break;
                            }
                        }
                        const inp = container.querySelector("input:not([type='hidden']):not([type='checkbox']):not([type='radio'])");
                        if (inp) {
                            const inpVal = String(inp.getAttribute("title") || inp.value || inp.getAttribute("value") || inp.placeholder || "").trim();
                            if (isValidFilterValue(inpVal)) {
                                liveFilter = inpVal;
                                filterSource = "TARGETING_SECTION";
                                break;
                            }
                        }
                        const combo = container.querySelector("[role='combobox']");
                        if (combo) {
                            const comboVal = String(combo.getAttribute("title") || combo.getAttribute("aria-label") || combo.innerText || combo.textContent || combo.value || "").trim();
                            if (isValidFilterValue(comboVal)) {
                                liveFilter = comboVal;
                                filterSource = "TARGETING_SECTION";
                                break;
                            }
                        }
                    }
                }
            }
        }

        // Extract Filter ID from pencil edit link if present
        let extractedFilterId = null;
        try {
            const editLinks = Array.from(targetDoc.querySelectorAll("a[href*='live-filter'], a[href*='live_filter'], [data-filter-id]"));
            for (const el of editLinks) {
                const href = el.getAttribute("href") || "";
                const m = href.match(/\/live-filters?\/(?:edit\/)?([0-9]+)/i);
                if (m && m[1]) {
                    extractedFilterId = m[1];
                    break;
                }
                const dfid = el.getAttribute("data-filter-id");
                if (dfid && /^[0-9]+$/.test(dfid)) {
                    extractedFilterId = dfid;
                    break;
                }
            }
        } catch (e) {}

        if (!campaignId && !liveFilter && !campaignName) return null;

        let filterCount = null;
        let cleanFilterName = liveFilter;
        if (liveFilter) {
            const mCount = liveFilter.match(/[\(\[]\s*(?:Count|Contacts)?\s*:?\s*([0-9,]+)\s*[\)\]]/i);
            if (mCount && mCount[1]) {
                filterCount = Number(mCount[1].replace(/,/g, ""));
                cleanFilterName = liveFilter.replace(/[\(\[]\s*(?:Count|Contacts)?\s*:?\s*[0-9,]+\s*[\)\]]/i, "").trim();
            }

            // Cross-reference with title attribute or inventory if filter name ends with ellipsis
            if (cleanFilterName && (cleanFilterName.endsWith("...") || cleanFilterName.endsWith("…") || cleanFilterName.includes("..."))) {
                const prefix = cleanFilterName.replace(/\.{3}$|…$/, "").replace(/\.\.\..*$/, "").trim().toLowerCase();
                const titleMatch = targetDoc.querySelector && targetDoc.querySelector(`[title^="${prefix}" i], [aria-label^="${prefix}" i]`);
                if (titleMatch) {
                    const full = String(titleMatch.getAttribute("title") || titleMatch.getAttribute("aria-label") || "").trim();
                    if (full && !full.endsWith("...") && !full.endsWith("…") && isValidFilterValue(full)) {
                        cleanFilterName = full.replace(/[\(\[]\s*(?:Count|Contacts)?\s*:?\s*[0-9,]+\s*[\)\]]/i, "").trim();
                    }
                }
                if (cleanFilterName.endsWith("...") || cleanFilterName.endsWith("…") || cleanFilterName.includes("...")) {
                    try {
                        const isEast3Env = (typeof window !== "undefined" && window.location && window.location.hostname.includes("east-3")) || (typeof isEast3 !== "undefined" && isEast3);
                        const invKey = "ct_east3_live_filters_inventory_v1";
                        const invStorage = typeof localStorage !== "undefined" ? localStorage : (typeof window !== "undefined" ? window.localStorage : null);
                        if (invStorage) {
                            const invData = JSON.parse(invStorage.getItem(invKey) || "{}");
                            const items = invData.items ? Object.values(invData.items) : (Array.isArray(invData) ? invData : []);

                            // 1. If filterId was extracted from edit pencil link, match exact ID
                            let match = null;
                            if (extractedFilterId) {
                                match = items.find(f => f && String(f.id) === String(extractedFilterId));
                            }
                            // 2. Score candidates by longest prefix match
                            if (!match) {
                                const candidates = items.filter(f => f && f.name && f.name.toLowerCase().startsWith(prefix));
                                if (candidates.length === 1) {
                                    match = candidates[0];
                                } else if (candidates.length > 1) {
                                    candidates.sort((a, b) => (b.name || "").length - (a.name || "").length);
                                    match = candidates[0];
                                }
                            }
                            if (match) {
                                cleanFilterName = match.name.replace(/[\(\[]\s*(?:Count|Contacts)?\s*:?\s*[0-9,]+\s*[\)\]]/i, "").trim();
                                if (filterCount === null && match.count !== undefined) {
                                    filterCount = Number(match.count);
                                }
                                if (!extractedFilterId && match.id) {
                                    extractedFilterId = String(match.id);
                                }
                            }
                        }
                    } catch (e) {}
                }
            }
        }

        const isAssigned = Boolean(cleanFilterName && isValidFilterValue(cleanFilterName));
        return {
            campaignId: campaignId || "unknown",
            campaignName: campaignName || (campaignId ? `Campaign ${campaignId}` : ""),
            liveFilter: isAssigned ? cleanFilterName : null,
            rawLiveFilter: liveFilter,
            filterId: extractedFilterId || null,
            filterCount: filterCount,
            status: isAssigned ? "ASSIGNED" : "NONE",
            source: filterSource,
            timestamp: Date.now()
        };
    },

    readLiveFilters(doc) {
        const targetDoc = doc || (typeof document !== "undefined" ? document : null);
        if (!targetDoc) return [];

        let table = null;
        const allTables = Array.from(targetDoc.querySelectorAll("table, [role='table'], mat-table"));
        for (const t of allTables) {
            if (t.closest && t.closest("#ct-operations-dashboard, [id^='ct-operations-dashboard'], iframe")) continue;
            const headerText = (t.innerText || t.textContent || "").toLowerCase();
            if (headerText.includes("count") || headerText.includes("active") || headerText.includes("change log") || t.querySelector(".cdk-column-name, [class*='column-count']")) {
                table = t;
                break;
            }
        }

        const selector = "tr.mat-row, tr.mat-mdc-row, mat-row, tr[mat-row], tbody tr, [role='row'].mat-row, [role='row'].mat-mdc-row";
        let rows = [];
        if (table) {
            rows = Array.from(table.querySelectorAll(selector));
        } else {
            rows = Array.from(targetDoc.querySelectorAll(selector)).filter(function (r) {
                return !r.closest || !r.closest("#ct-operations-dashboard, [id^='ct-operations-dashboard'], iframe");
            });
        }

        const validRows = rows.filter(function (r) {
            return !r.closest("thead") && !r.querySelector("th") && !r.matches("tr.mat-header-row, tr.mat-mdc-header-row");
        });

        if (!validRows.length) return [];

        return validRows.map((row, index) => {
            let filterId = null;
            const rawIdAttr = (row.getAttribute("data-id") || row.getAttribute("data-live-filter-id") || "").trim();
            if (/^[0-9]+$/.test(rawIdAttr)) filterId = rawIdAttr;

            if (!filterId) {
                const actionLinks = Array.from(row.querySelectorAll("a[href], button[data-id]"));
                for (const el of actionLinks) {
                    const did = (el.getAttribute("data-id") || el.getAttribute("data-live-filter-id") || "").trim();
                    if (/^[0-9]+$/.test(did)) {
                        filterId = did;
                        break;
                    }
                    const href = el.getAttribute("href") || "";
                    const m = href.match(/\/live-filters\/(?:edit|preview|change-logs)\/([0-9]+)/i) ||
                              href.match(/[?&](?:filter|filter_id|live_filter)=([0-9]+)/i);
                    if (m && m[1]) {
                        filterId = m[1];
                        break;
                    }
                }
            }

            let name = this.getByHeader ? this.getByHeader(row, ["name", "live filter", "filter name"], ["cdk-column-name", "mat-column-name", "cdk-column-filter_name"]) : null;
            if (!name) {
                const nameEl = row.querySelector(".cdk-column-name, [data-column='name'], a");
                if (nameEl) name = String(nameEl.innerText || nameEl.textContent || "").trim();
            }

            let active = true;
            const activeCell = row.querySelector(".cdk-column-active, [data-column='active'], .mat-column-active");
            if (activeCell) {
                const toggle = activeCell.querySelector("input[type='checkbox'], mat-slide-toggle, [role='switch']");
                if (toggle) {
                    active = toggle.checked || toggle.getAttribute("aria-checked") === "true" || (toggle.classList && toggle.classList.contains("mat-checked"));
                } else {
                    const txt = (activeCell.innerText || activeCell.textContent || "").toLowerCase().trim();
                    if (txt === "inactive" || txt === "disabled" || txt === "no" || txt === "false") {
                        active = false;
                    }
                }
            }

            let count = 0;
            const countRaw = this.getByHeader ? this.getByHeader(row, ["count", "contacts", "contact count"], ["cdk-column-count", "mat-column-count", "cdk-column-contacts"]) : null;
            if (countRaw != null) {
                const parsed = parseInt(String(countRaw).replace(/[^0-9]/g, ""), 10);
                if (!isNaN(parsed)) count = parsed;
            } else {
                const countCell = row.querySelector(".cdk-column-count, [data-column='count']");
                if (countCell) {
                    const parsed = parseInt(String(countCell.innerText || countCell.textContent || "").replace(/[^0-9]/g, ""), 10);
                    if (!isNaN(parsed)) count = parsed;
                }
            }

            let totalCount = count;
            const totalCountRaw = this.getByHeader ? this.getByHeader(row, ["total", "total-count", "ignore time zone", "total count"], ["cdk-column-total-count", "cdk-column-ignore_time_zone_count", "cdk-column-total_count"]) : null;
            if (totalCountRaw != null) {
                const parsed = parseInt(String(totalCountRaw).replace(/[^0-9]/g, ""), 10);
                if (!isNaN(parsed)) totalCount = parsed;
            } else {
                const tcCell = row.querySelector(".cdk-column-total-count, .cdk-column-ignore_time_zone_count, [data-column='total-count']");
                if (tcCell) {
                    const parsed = parseInt(String(tcCell.innerText || tcCell.textContent || "").replace(/[^0-9]/g, ""), 10);
                    if (!isNaN(parsed)) totalCount = parsed;
                }
            }

            const stableId = filterId || (name ? name.toLowerCase().replace(/[^a-z0-9_-]/g, "_") : `filter-${index}`);
            return {
                id: stableId,
                rawId: filterId || null,
                name: name || (filterId ? `Filter ${filterId}` : `Filter ${index + 1}`),
                active: Boolean(active),
                count: count,
                totalCount: totalCount,
                observedAt: Date.now(),
                source: "LIVE_FILTERS_PAGE"
            };
        });
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = window.CTParser;
}
