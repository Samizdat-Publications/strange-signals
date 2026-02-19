/* ============================================
   GARDENSYNC // FOOD NOT BOMBS CANTON
   Main application logic
   ============================================ */

// ---- PLANT LIBRARY (Zone 6a compatible) ----
const PLANT_LIBRARY = [
    {
        id: 'tomato', name: 'Tomato', emoji: '\u{1F345}', type: 'vegetable',
        spacing: 24, daysToHarvest: 75, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: -6, transplantAfterFrost: 2,
        directSow: null, harvestWeeks: 10,
        companions: ['basil', 'marigold', 'carrot', 'parsley'],
        enemies: ['cabbage', 'fennel', 'dill'],
        notes: 'Stake or cage. Indeterminate types produce all season.',
        seedStartInstructions: 'Start seeds indoors 6-8 weeks before last frost (Mar 1-7). Use seed starting mix, 1/4" deep. Keep at 70-80\u00B0F. Transplant out after May 1 when soil is 60\u00B0F+.',
        careNotes: 'Water deeply 1-2x/week. Mulch heavily. Remove suckers for determinate types. Side-dress with compost mid-season.',
        lowMaintenance: true
    },
    {
        id: 'cucumber', name: 'Cucumber', emoji: '\u{1F952}', type: 'vegetable',
        spacing: 18, daysToHarvest: 60, waterNeed: 'high',
        sunNeed: 'full', sowIndoors: -3, transplantAfterFrost: 2,
        directSow: 2, harvestWeeks: 8,
        companions: ['beans', 'peas', 'lettuce', 'sunflower'],
        enemies: ['potato', 'sage', 'melon'],
        notes: 'Can trellis vertically to save space. Pick frequently.',
        seedStartInstructions: 'Start indoors 3-4 weeks before last frost (Mar 21-28) OR direct sow after May 1. Plant 1" deep. Needs 70\u00B0F soil.',
        careNotes: 'Needs consistent moisture. Trellis to save space & improve air flow. Pick daily once producing.',
        lowMaintenance: false
    },
    {
        id: 'lettuce', name: 'Lettuce', emoji: '\u{1F96C}', type: 'vegetable',
        spacing: 8, daysToHarvest: 45, waterNeed: 'medium',
        sunNeed: 'partial', sowIndoors: -4, transplantAfterFrost: -2,
        directSow: -2, harvestWeeks: 6,
        companions: ['carrot', 'radish', 'strawberry', 'chive'],
        enemies: [],
        notes: 'Cool season crop. Succession plant every 2 weeks. Bolts in heat.',
        seedStartInstructions: 'Start indoors mid-March or direct sow as early as April 1. Surface sow (needs light). Succession plant every 2 weeks through May, resume in Aug.',
        careNotes: 'Keep soil consistently moist. Shade cloth in summer. Harvest outer leaves for continuous production.',
        lowMaintenance: true
    },
    {
        id: 'spinach', name: 'Spinach', emoji: '\u{1F343}', type: 'vegetable',
        spacing: 6, daysToHarvest: 40, waterNeed: 'medium',
        sunNeed: 'partial', sowIndoors: null, transplantAfterFrost: null,
        directSow: -4, harvestWeeks: 4,
        companions: ['strawberry', 'peas', 'beans'],
        enemies: [],
        notes: 'Very cold-hardy. One of the first crops to plant. Bolts fast in heat.',
        seedStartInstructions: 'Direct sow 4-6 weeks before last frost (Mar 7-21). Plant 1/2" deep, 1" apart, thin to 6". Can also fall sow in September.',
        careNotes: 'Keep cool & moist. Mulch to retain moisture. Harvest outer leaves. Plant again in fall.',
        lowMaintenance: true
    },
    {
        id: 'green-beans', name: 'Green Beans', emoji: '\u{1FAD8}', type: 'vegetable',
        spacing: 6, daysToHarvest: 55, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: 1, harvestWeeks: 6,
        companions: ['corn', 'squash', 'cucumber', 'strawberry', 'marigold'],
        enemies: ['onion', 'garlic', 'fennel'],
        notes: 'Nitrogen fixer. Bush types need no support. Very productive.',
        seedStartInstructions: 'Direct sow 1 week after last frost (Apr 25-May 1). Plant 1" deep, 6" apart. Soil must be 60\u00B0F+. Do NOT start indoors \u2014 beans hate transplanting.',
        careNotes: 'Minimal care once established. Water during drought only. Pick regularly to encourage production. Bush types are lowest maintenance.',
        lowMaintenance: true
    },
    {
        id: 'sweet-peas', name: 'Sweet Peas', emoji: '\u{1F33C}', type: 'flower',
        spacing: 6, daysToHarvest: 65, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: -6, transplantAfterFrost: -2,
        directSow: -4, harvestWeeks: 8,
        companions: ['beans', 'carrot', 'radish'],
        enemies: ['onion', 'garlic'],
        notes: 'Beautiful cut flowers. Cool season \u2014 plant early. Needs trellis.',
        seedStartInstructions: 'Soak seeds 24hrs. Start indoors 6 weeks before last frost (Mar 7) or direct sow 4 weeks before (Mar 21). Nick seed coat with file before soaking.',
        careNotes: 'Provide trellis or netting. Keep soil cool with mulch. Deadhead regularly for continuous bloom.',
        lowMaintenance: true
    },
    {
        id: 'strawberry', name: 'Strawberry', emoji: '\u{1F353}', type: 'fruit',
        spacing: 12, daysToHarvest: 90, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: 0,
        directSow: null, harvestWeeks: 4,
        companions: ['lettuce', 'spinach', 'beans', 'thyme'],
        enemies: ['cabbage', 'broccoli'],
        notes: 'Perennial! Plant once, harvest for years. Use bare root transplants.',
        seedStartInstructions: 'Purchase bare root crowns. Plant as soon as soil is workable (mid-April). Set crown at soil level. Pinch first-year flowers on June-bearers for bigger second-year crop.',
        careNotes: 'Mulch with straw to keep fruit clean. Remove runners unless you want spreading. Very low maintenance once established.',
        lowMaintenance: true
    },
    {
        id: 'cantaloupe', name: 'Cantaloupe', emoji: '\u{1F348}', type: 'fruit',
        spacing: 36, daysToHarvest: 85, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: -3, transplantAfterFrost: 2,
        directSow: 2, harvestWeeks: 4,
        companions: ['corn', 'sunflower', 'marigold'],
        enemies: ['potato', 'cucumber'],
        notes: 'Space hog \u2014 needs room to sprawl. Warm soil essential.',
        seedStartInstructions: 'Start indoors 3-4 weeks before last frost (Mar 28). Use peat pots to avoid root disturbance. Transplant after May 1 when soil is 65\u00B0F+.',
        careNotes: 'Black plastic mulch warms soil. Reduce water as fruit ripens. Slip test: ripe when stem separates easily.',
        lowMaintenance: false
    },
    {
        id: 'marigold', name: 'Marigold', emoji: '\u{1F33B}', type: 'flower',
        spacing: 8, daysToHarvest: 50, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: -6, transplantAfterFrost: 0,
        directSow: 0, harvestWeeks: 16,
        companions: ['tomato', 'pepper', 'beans', 'squash'],
        enemies: [],
        notes: 'Pest deterrent powerhouse. Plant everywhere as companion. Deer resistant.',
        seedStartInstructions: 'Start indoors 6-8 weeks before last frost (Mar 1) or direct sow after last frost (Apr 18). Easy germinators. Cover lightly with soil.',
        careNotes: 'Nearly indestructible. Deadhead for continuous bloom. Drought tolerant once established. French marigolds best for pest control.',
        lowMaintenance: true
    },
    {
        id: 'basil', name: 'Basil', emoji: '\u{1F33F}', type: 'herb',
        spacing: 10, daysToHarvest: 60, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: -6, transplantAfterFrost: 2,
        directSow: 2, harvestWeeks: 14,
        companions: ['tomato', 'pepper', 'marigold'],
        enemies: ['sage', 'rue'],
        notes: 'Classic tomato companion. Pinch flowers for bushy growth.',
        seedStartInstructions: 'Start indoors 6-8 weeks before last frost (Mar 1-7). Surface sow, press into soil. Needs light & warmth (70\u00B0F+). Transplant after all frost danger.',
        careNotes: 'Pinch growing tips regularly for bushy plants. Harvest before flowering. Very frost-sensitive \u2014 cover or harvest at season end.',
        lowMaintenance: true
    },
    {
        id: 'pepper', name: 'Bell Pepper', emoji: '\u{1F336}', type: 'vegetable',
        spacing: 18, daysToHarvest: 70, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: -8, transplantAfterFrost: 2,
        directSow: null, harvestWeeks: 10,
        companions: ['tomato', 'basil', 'carrot', 'marigold'],
        enemies: ['fennel', 'kohlrabi'],
        notes: 'Slow to start. Needs warm soil. Very productive once going.',
        seedStartInstructions: 'Start indoors 8-10 weeks before last frost (Feb 15-Mar 1). Needs warmth (75-85\u00B0F) for germination. Slow grower. Harden off carefully. Transplant after May 1.',
        careNotes: 'Mulch well. Stake if heavy with fruit. Water consistently. Pick green or let ripen to red for more sweetness.',
        lowMaintenance: true
    },
    {
        id: 'zucchini', name: 'Zucchini', emoji: '\u{1F33D}', type: 'vegetable',
        spacing: 24, daysToHarvest: 50, waterNeed: 'medium',
        sunNeed: 'full', sowIndoors: -3, transplantAfterFrost: 1,
        directSow: 1, harvestWeeks: 10,
        companions: ['corn', 'beans', 'marigold', 'nasturtium'],
        enemies: ['potato'],
        notes: 'Incredibly productive. One plant feeds many. Pick small.',
        seedStartInstructions: 'Start indoors 3-4 weeks before last frost (Mar 28) or direct sow 1 week after (Apr 25). Plant 1" deep. Germinates fast in warm soil.',
        careNotes: 'Water at base to prevent powdery mildew. Harvest at 6-8" for best flavor. Check daily \u2014 they grow FAST.',
        lowMaintenance: true
    },
    {
        id: 'radish', name: 'Radish', emoji: '\u{1F4AE}', type: 'vegetable',
        spacing: 3, daysToHarvest: 25, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: -4, harvestWeeks: 2,
        companions: ['lettuce', 'peas', 'beans', 'carrot'],
        enemies: [],
        notes: 'Fastest veggie! Great row marker. Succession plant biweekly.',
        seedStartInstructions: 'Direct sow 4-6 weeks before last frost (Mar 7-21). Plant 1/2" deep, 1" apart. Succession sow every 2 weeks. Also great fall crop (Sept).',
        careNotes: 'Virtually zero maintenance. Thin to 2-3" apart. Harvest promptly or they get pithy. Great teaching crop for new gardeners.',
        lowMaintenance: true
    },
    {
        id: 'carrot', name: 'Carrot', emoji: '\u{1F955}', type: 'vegetable',
        spacing: 3, daysToHarvest: 70, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: -2, harvestWeeks: 8,
        companions: ['tomato', 'lettuce', 'onion', 'rosemary'],
        enemies: ['dill'],
        notes: 'Direct sow only \u2014 doesn\'t transplant. Loose soil essential.',
        seedStartInstructions: 'Direct sow 2-3 weeks before last frost (Apr 1). Tiny seeds \u2014 mix with sand for even sowing. Press into soil surface, barely cover. Keep moist until germination (14-21 days).',
        careNotes: 'Thin to 2-3" apart when 2" tall. Keep soil loose and stone-free. Mulch shoulders to prevent greening. Sweet after frost!',
        lowMaintenance: true
    },
    {
        id: 'kale', name: 'Kale', emoji: '\u{1F96C}', type: 'vegetable',
        spacing: 18, daysToHarvest: 55, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: -6, transplantAfterFrost: -2,
        directSow: -4, harvestWeeks: 20,
        companions: ['beans', 'beet', 'celery', 'lettuce'],
        enemies: ['strawberry'],
        notes: 'Cold-hardy champion. Sweetens after frost. Harvest all season.',
        seedStartInstructions: 'Start indoors 6 weeks before last frost (Mar 7) or direct sow 4 weeks before (Mar 21). Plant 1/4" deep. Cold tolerant \u2014 can go out early.',
        careNotes: 'Extremely low maintenance. Harvest lower leaves, plant keeps producing. Gets SWEETER after frost. Can overwinter in Zone 6a with mulch.',
        lowMaintenance: true
    },
    {
        id: 'onion', name: 'Onion', emoji: '\u{1F9C5}', type: 'vegetable',
        spacing: 4, daysToHarvest: 100, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: -10, transplantAfterFrost: -2,
        directSow: null, harvestWeeks: 2,
        companions: ['carrot', 'lettuce', 'tomato', 'strawberry'],
        enemies: ['beans', 'peas'],
        notes: 'Start from sets for easiest results. Long day varieties for Ohio.',
        seedStartInstructions: 'Start from seeds 10-12 weeks before last frost (Jan 15-Feb 1) or plant onion sets as soon as soil is workable (mid-March). Use long-day varieties for Ohio.',
        careNotes: 'Weed carefully \u2014 shallow roots. Stop watering when tops fall over. Cure in sun for 2 weeks before storage.',
        lowMaintenance: true
    },
    {
        id: 'garlic', name: 'Garlic', emoji: '\u{1F9C4}', type: 'vegetable',
        spacing: 6, daysToHarvest: 240, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: null, harvestWeeks: 2,
        companions: ['tomato', 'pepper', 'lettuce', 'strawberry'],
        enemies: ['beans', 'peas'],
        notes: 'Plant in FALL (October). Harvest following July. Easiest crop ever.',
        seedStartInstructions: 'Plant individual cloves in mid-October, 2" deep, pointy end up, 6" apart. Mulch heavily with straw. They grow roots in fall, go dormant in winter, and shoot up in spring.',
        careNotes: 'Almost zero effort. Remove scapes in June for bigger bulbs. Harvest when lower 1/3 of leaves are brown (July). Cure 2 weeks. ULTIMATE low-maintenance crop.',
        lowMaintenance: true
    },
    {
        id: 'chive', name: 'Chives', emoji: '\u{1F33E}', type: 'herb',
        spacing: 8, daysToHarvest: 60, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: -8, transplantAfterFrost: 0,
        directSow: 0, harvestWeeks: 20,
        companions: ['carrot', 'tomato', 'strawberry'],
        enemies: ['beans', 'peas'],
        notes: 'Perennial! Returns every year. Pest deterrent. Edible flowers.',
        seedStartInstructions: 'Start indoors 8-10 weeks before last frost (Feb 15) or buy transplants. Very slow from seed. Easier to divide existing clumps.',
        careNotes: 'Perennial \u2014 plant once, harvest for years. Cut back to 2" periodically for fresh growth. Divide clumps every 3 years.',
        lowMaintenance: true
    },
    {
        id: 'nasturtium', name: 'Nasturtium', emoji: '\u{1F33A}', type: 'flower',
        spacing: 10, daysToHarvest: 55, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: 0, harvestWeeks: 14,
        companions: ['tomato', 'cucumber', 'squash', 'beans'],
        enemies: [],
        notes: 'Edible! Trap crop for aphids. Thrives in poor soil. Zero maintenance.',
        seedStartInstructions: 'Direct sow after last frost (Apr 18). Plant 1/2" deep. Large seeds, easy to handle. Nick seed coat for faster germination.',
        careNotes: 'Thrives on neglect. Poor soil = more flowers. Do NOT fertilize. Edible flowers and leaves (peppery). Trap crop attracts aphids away from veggies.',
        lowMaintenance: true
    },
    {
        id: 'sunflower', name: 'Sunflower', emoji: '\u{1F33B}', type: 'flower',
        spacing: 18, daysToHarvest: 80, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: 1, harvestWeeks: 4,
        companions: ['cucumber', 'corn', 'squash'],
        enemies: ['potato'],
        notes: 'Pollinators love them. Community engagement magnet. Seeds for birds.',
        seedStartInstructions: 'Direct sow 1 week after last frost (Apr 25). Plant 1" deep. Fast growers. Succession plant every 2 weeks for continuous bloom.',
        careNotes: 'Water regularly until established, then drought tolerant. Stake tall varieties. Leave seed heads for birds in fall \u2014 great community engagement.',
        lowMaintenance: true
    },
    {
        id: 'thyme', name: 'Thyme', emoji: '\u{1F33F}', type: 'herb',
        spacing: 8, daysToHarvest: 70, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: -8, transplantAfterFrost: 0,
        directSow: null, harvestWeeks: 20,
        companions: ['strawberry', 'tomato', 'cabbage'],
        enemies: [],
        notes: 'Perennial ground cover. Drought champion. Practically unkillable.',
        seedStartInstructions: 'Start indoors 8-10 weeks before last frost (Feb 15) or buy transplants (much easier). Slow from seed. Perennial in Zone 6a.',
        careNotes: 'Nearly indestructible. Drought tolerant. Cut back by 1/3 in spring. Never overwater. Spreading varieties make great ground cover between beds.',
        lowMaintenance: true
    },
    {
        id: 'dill', name: 'Dill', emoji: '\u{1F33F}', type: 'herb',
        spacing: 8, daysToHarvest: 55, waterNeed: 'low',
        sunNeed: 'full', sowIndoors: null, transplantAfterFrost: null,
        directSow: 0, harvestWeeks: 8,
        companions: ['cucumber', 'lettuce', 'onion'],
        enemies: ['carrot', 'tomato'],
        notes: 'Self-seeds aggressively. Attracts beneficial insects. Easy pickles!',
        seedStartInstructions: 'Direct sow after last frost (Apr 18). Scatter seeds, press into soil. Barely cover. Self-seeds like crazy \u2014 you\'ll have it forever after one planting.',
        careNotes: 'Let some plants go to seed for next year\'s crop. Attracts swallowtail butterflies. Harvest leaves anytime, seeds when brown.',
        lowMaintenance: true
    },
    {
        id: 'mint', name: 'Mint', emoji: '\u{1F33F}', type: 'herb',
        spacing: 12, daysToHarvest: 60, waterNeed: 'medium',
        sunNeed: 'partial', sowIndoors: null, transplantAfterFrost: 0,
        directSow: null, harvestWeeks: 20,
        companions: ['tomato', 'cabbage'],
        enemies: [],
        notes: 'WARNING: Invasive spreader! ALWAYS plant in containers, never directly in beds.',
        seedStartInstructions: 'Buy transplants \u2014 do NOT direct sow in beds. MUST be contained in a pot sunk into the bed or it will take over everything. Plant after last frost.',
        careNotes: 'Will aggressively spread if not contained. Grow in sunken pots within beds. Cut back hard periodically. Perennial and virtually unkillable.',
        lowMaintenance: true
    }
];

// ---- CANTON CLIMATE DATA ----
const CANTON_CLIMATE = {
    zone: '6a',
    lastFrost: { month: 3, day: 18 },  // April 18 (0-indexed months)
    firstFrost: { month: 9, day: 28 },   // October 28
    growingSeason: 193,
    monthlyRainfall: {
        0: 2.5, 1: 2.3, 2: 3.1, 3: 3.4, 4: 4.1, 5: 5.4,
        6: 4.1, 7: 3.4, 8: 2.7, 9: 2.3, 10: 2.8, 11: 2.6
    },
    monthlyAvgHigh: {
        0: 34, 1: 37, 2: 48, 3: 60, 4: 70, 5: 79,
        6: 83, 7: 81, 8: 74, 9: 62, 10: 50, 11: 38
    },
    monthlyAvgLow: {
        0: 19, 1: 21, 2: 29, 3: 39, 4: 49, 5: 58,
        6: 62, 7: 60, 8: 53, 9: 42, 10: 33, 11: 24
    },
    annualRainfall: 42
};

const MONTH_NAMES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ---- APP STATE ----
const state = {
    beds: [[], [], [], []],          // Array of placed plants per bed
    selectedBed: 0,
    volunteers: [],
    bedAssignments: [null, null, null, null],
    geminiKey: localStorage.getItem('gardensync_gemini_key') || '',
    dragData: null,
    // QoL: undo/redo
    undoStack: [],
    redoStack: [],
    // QoL: click-to-place mode
    clickPlaceMode: null,  // null or { plantId: string }
    // QoL: selected plant in bed
    selectedPlacement: null, // null or { bedIndex, placementId }
    // QoL: info panel dismiss handler ref
    _infoPanelDismiss: null,
};

// ---- UNDO / REDO ENGINE ----
function pushUndo() {
    state.undoStack.push(JSON.parse(JSON.stringify(state.beds)));
    if (state.undoStack.length > 50) state.undoStack.shift();
    state.redoStack = [];
    updateUndoRedoButtons();
}

function undo() {
    if (state.undoStack.length === 0) return;
    state.redoStack.push(JSON.parse(JSON.stringify(state.beds)));
    state.beds = state.undoStack.pop();
    for (let i = 0; i < 4; i++) renderPlacedPlants(i);
    updateBedDetails();
    saveState();
    updateUndoRedoButtons();
    showToast('Undo');
}

function redo() {
    if (state.redoStack.length === 0) return;
    state.undoStack.push(JSON.parse(JSON.stringify(state.beds)));
    state.beds = state.redoStack.pop();
    for (let i = 0; i < 4; i++) renderPlacedPlants(i);
    updateBedDetails();
    saveState();
    updateUndoRedoButtons();
    showToast('Redo');
}

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');
    if (undoBtn) undoBtn.classList.toggle('disabled', state.undoStack.length === 0);
    if (redoBtn) redoBtn.classList.toggle('disabled', state.redoStack.length === 0);
}

// ---- CLICK-TO-PLACE ENGINE ----
function enterClickPlaceMode(plantId) {
    state.clickPlaceMode = { plantId };
    document.body.classList.add('click-place-mode');
    document.querySelectorAll('.garden-bed').forEach(bed => bed.classList.add('click-place-target'));
    const plant = PLANT_LIBRARY.find(p => p.id === plantId);
    showToast(`Click on a bed to place ${plant.emoji} ${plant.name} (ESC to cancel)`);
}

function exitClickPlaceMode() {
    state.clickPlaceMode = null;
    document.body.classList.remove('click-place-mode');
    document.querySelectorAll('.garden-bed').forEach(bed => bed.classList.remove('click-place-target'));
    document.querySelectorAll('.plant-item').forEach(item => item.classList.remove('click-place-active'));
}

// ---- SELECTION ENGINE ----
function selectPlacement(bedIndex, placementId) {
    clearSelection();
    state.selectedPlacement = { bedIndex, placementId };
    const el = document.querySelector(`.placed-plant[data-placement-id="${placementId}"]`);
    if (el) el.classList.add('selected');
}

function clearSelection() {
    state.selectedPlacement = null;
    document.querySelectorAll('.placed-plant.selected').forEach(el => el.classList.remove('selected'));
    hideContextMenu();
}

// ---- INITIALIZATION ----
document.addEventListener('DOMContentLoaded', () => {
    const inits = [
        ['Navigation', initNavigation],
        ['PlantPalette', initPlantPalette],
        ['GardenBeds', initGardenBeds],
        ['BedSelector', initBedSelector],
        ['ToolbarButtons', initToolbarButtons],
        ['Volunteers', initVolunteers],
        ['ClimateCharts', initClimateCharts],
        ['RainBarrelCalc', initRainBarrelCalc],
        ['Visualizer', initVisualizer],
        ['BedJournal', initBedJournal],
        ['PlantingLog', initPlantingLog],
        ['CalendarExport', initCalendarExport],
        ['HarvestLog', initHarvestLog],
        ['DataExportImport', initDataExportImport],
        ['Weather', initWeather],
        ['KeyboardShortcuts', initKeyboardShortcuts],
        ['ZoomControls', initZoomControls],
        ['LoadSavedState', loadSavedState],
    ];
    for (const [name, fn] of inits) {
        try { fn(); }
        catch (e) { console.error(`[GardenSync] init ${name} FAILED:`, e); }
    }
    console.log('[GardenSync] All init complete');
});

// ---- NAVIGATION ----
function switchTab(tabName) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll(`.nav-btn[data-tab="${tabName}"]`).forEach(b => b.classList.add('active'));
    document.querySelectorAll(`.mobile-nav-btn[data-tab="${tabName}"]`).forEach(b => b.classList.add('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    if (tabName === 'schedule') updateSchedule();
    if (tabName === 'plantlog') renderPlantingLog('all');
    if (tabName === 'harvest') renderHarvestLog();
    if (tabName === 'volunteers') renderVolunteers();
    if (tabName === 'climate') { drawRainfallChart(); drawTempChart(); }
}

function initNavigation() {
    // Desktop nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Mobile hamburger
    const menuBtn = document.getElementById('mobile-menu-btn');
    const mobileNav = document.getElementById('mobile-nav');

    menuBtn.addEventListener('click', () => {
        menuBtn.classList.toggle('open');
        mobileNav.classList.toggle('hidden');
    });

    // Mobile nav buttons
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
            mobileNav.classList.add('hidden');
            menuBtn.classList.remove('open');
        });
    });
}

// ---- PLANT PALETTE ----
function getFilteredSortedPlants() {
    const searchQ = (document.getElementById('plant-search')?.value || '').toLowerCase();
    const activeFilter = document.querySelector('.filter-btn[data-filter].active')?.dataset.filter || 'all';
    const sortBy = document.getElementById('plant-sort')?.value || 'name';

    let plants = [...PLANT_LIBRARY];

    // Filter by type
    if (activeFilter !== 'all') plants = plants.filter(p => p.type === activeFilter);

    // Filter by search
    if (searchQ) plants = plants.filter(p => p.name.toLowerCase().includes(searchQ) || p.type.includes(searchQ));

    // Sort
    const sorters = {
        'name': (a, b) => a.name.localeCompare(b.name),
        'name-desc': (a, b) => b.name.localeCompare(a.name),
        'spacing': (a, b) => a.spacing - b.spacing,
        'days': (a, b) => a.daysToHarvest - b.daysToHarvest,
        'water': (a, b) => { const w = {low:1,medium:2,high:3}; return w[a.waterNeed] - w[b.waterNeed]; },
        'type': (a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name),
    };
    if (sorters[sortBy]) plants.sort(sorters[sortBy]);

    return { plants, searchQ };
}

function getPlantSeasonBadge(plant) {
    const now = new Date();
    const month = now.getMonth();
    const day = now.getDate();
    const lastFrost = new Date(now.getFullYear(), CANTON_CLIMATE.lastFrost.month, CANTON_CLIMATE.lastFrost.day);
    const firstFrost = new Date(now.getFullYear(), CANTON_CLIMATE.firstFrost.month, CANTON_CLIMATE.firstFrost.day);

    // Determine activity window
    let startWeek = null, endWeek = null;
    if (plant.sowIndoors) {
        startWeek = new Date(lastFrost);
        startWeek.setDate(startWeek.getDate() + plant.sowIndoors * 7);
    } else if (plant.directSow !== null) {
        startWeek = new Date(lastFrost);
        startWeek.setDate(startWeek.getDate() + plant.directSow * 7);
    } else if (plant.transplantAfterFrost !== null) {
        startWeek = new Date(lastFrost);
        startWeek.setDate(startWeek.getDate() + plant.transplantAfterFrost * 7);
    }
    if (startWeek) {
        endWeek = new Date(startWeek);
        endWeek.setDate(endWeek.getDate() + (plant.harvestWeeks || 10) * 7 + plant.daysToHarvest);
    }

    if (!startWeek || !endWeek) return { cls: 'off-season', text: 'N/A' };

    const twoWeeksFromNow = new Date(now);
    twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 21);

    if (now >= startWeek && now <= endWeek) return { cls: 'in-season', text: 'IN SEASON' };
    if (now < startWeek && twoWeeksFromNow >= startWeek) return { cls: 'upcoming', text: 'SOON' };
    return { cls: 'off-season', text: 'OFF SEASON' };
}

function initPlantPalette() {
    refreshPlantList();

    document.getElementById('plant-search').addEventListener('input', refreshPlantList);

    document.getElementById('plant-sort').addEventListener('change', refreshPlantList);

    document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            refreshPlantList();
        });
    });

    // Create hover card element
    const hoverCard = document.createElement('div');
    hoverCard.className = 'plant-hover-card';
    hoverCard.id = 'plant-hover-card';
    document.body.appendChild(hoverCard);
}

function refreshPlantList() {
    const { plants, searchQ } = getFilteredSortedPlants();
    renderPlantList(plants, searchQ);
}

function renderPlantList(plants, searchQ) {
    const container = document.getElementById('plant-list');
    searchQ = searchQ || '';

    container.innerHTML = plants.map(p => {
        // Search highlight
        let displayName = p.name;
        if (searchQ) {
            const idx = p.name.toLowerCase().indexOf(searchQ);
            if (idx !== -1) {
                displayName = p.name.substring(0, idx) + '<span class="search-match">' + p.name.substring(idx, idx + searchQ.length) + '</span>' + p.name.substring(idx + searchQ.length);
            }
        }
        // Season badge
        const badge = getPlantSeasonBadge(p);
        return `
        <div class="plant-item" draggable="true" data-plant-id="${p.id}" data-type="${p.type}">
            <span class="plant-emoji">${p.emoji}</span>
            <span class="plant-name">${displayName}</span>
            <span class="season-badge ${badge.cls}">${badge.text}</span>
            <span class="plant-type-badge">${p.type.toUpperCase()}</span>
        </div>
    `}).join('');

    const hoverCard = document.getElementById('plant-hover-card');
    let hoverTimeout;

    container.querySelectorAll('.plant-item').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            state.dragData = { plantId: item.dataset.plantId, source: 'palette' };
            e.dataTransfer.setData('text/plain', item.dataset.plantId);
            e.dataTransfer.effectAllowed = 'copy';
            item.style.opacity = '0.5';
            // Custom drag ghost with plant emoji
            const plant = PLANT_LIBRARY.find(p => p.id === item.dataset.plantId);
            if (plant) {
                const ghost = document.createElement('div');
                ghost.className = 'drag-ghost';
                ghost.textContent = plant.emoji;
                ghost.style.position = 'absolute';
                ghost.style.top = '-100px';
                ghost.style.left = '-100px';
                document.body.appendChild(ghost);
                e.dataTransfer.setDragImage(ghost, 18, 18);
                setTimeout(() => ghost.remove(), 0);
            }
            // Hide hover card on drag
            if (hoverCard) { hoverCard.classList.remove('visible'); clearTimeout(hoverTimeout); }
        });
        item.addEventListener('dragend', () => {
            item.style.opacity = '1';
        });
        item.addEventListener('click', () => {
            showPlantInfo(item.dataset.plantId);
        });
        // Double-click to enter click-to-place mode
        item.addEventListener('dblclick', (e) => {
            e.preventDefault();
            if (state.clickPlaceMode && state.clickPlaceMode.plantId === item.dataset.plantId) {
                exitClickPlaceMode();
            } else {
                exitClickPlaceMode();
                item.classList.add('click-place-active');
                enterClickPlaceMode(item.dataset.plantId);
            }
        });

        // Hover card on mouseenter
        item.addEventListener('mouseenter', (e) => {
            if (!hoverCard) return;
            clearTimeout(hoverTimeout);
            hoverTimeout = setTimeout(() => {
                const plant = PLANT_LIBRARY.find(p => p.id === item.dataset.plantId);
                if (!plant) return;
                const waterColors = { low: '#10b981', medium: '#f59e0b', high: '#dc2626' };
                const companions = plant.companions.map(c => { const cp = PLANT_LIBRARY.find(pl=>pl.id===c); return cp ? cp.emoji : c; }).join(' ');
                hoverCard.innerHTML = `
                    <div class="hover-title">${plant.emoji} ${plant.name}</div>
                    <div class="hover-stats">
                        <div class="hover-stat">SPACE: <span>${plant.spacing}"</span></div>
                        <div class="hover-stat">DAYS: <span>${plant.daysToHarvest}d</span></div>
                        <div class="hover-stat">WATER: <span style="color:${waterColors[plant.waterNeed]}">${plant.waterNeed.toUpperCase()}</span></div>
                        <div class="hover-stat">SUN: <span>${plant.sunNeed.toUpperCase()}</span></div>
                    </div>
                    ${companions ? `<div class="hover-companions">COMPANIONS: ${companions}</div>` : ''}
                `;
                const rect = item.getBoundingClientRect();
                hoverCard.style.left = (rect.right + 8) + 'px';
                hoverCard.style.top = rect.top + 'px';
                // Keep in viewport
                const cardRect = hoverCard.getBoundingClientRect();
                if (rect.right + 8 + 220 > window.innerWidth) {
                    hoverCard.style.left = (rect.left - 228) + 'px';
                }
                hoverCard.classList.add('visible');
            }, 350);
        });
        item.addEventListener('mouseleave', () => {
            clearTimeout(hoverTimeout);
            if (hoverCard) hoverCard.classList.remove('visible');
        });
    });
}

// ---- BED NAMES ----
const bedNames = JSON.parse(localStorage.getItem('gardensync_bed_names') || 'null') || ['BED 1','BED 2','BED 3','BED 4'];

function saveBedNames() {
    localStorage.setItem('gardensync_bed_names', JSON.stringify(bedNames));
}

// ---- GARDEN BEDS ----
function initGardenBeds() {
    const grid = document.getElementById('garden-grid');
    grid.innerHTML = '';
    for (let i = 0; i < 4; i++) {
        const bed = document.createElement('div');
        bed.className = 'garden-bed';
        bed.dataset.bedIndex = i;
        bed.innerHTML = `
            <span class="bed-label" data-bed="${i}" title="Click to rename">${bedNames[i]}</span>
            <span class="bed-count-badge" style="display:none;"></span>
            <span class="bed-dimensions">5' \u00D7 10'</span>
            <div class="bed-empty-hint">
                <span class="hint-icon">\u{1F331}</span>
                <span class="hint-text">drag or double-click to plant</span>
            </div>
        `;

        // Bed name editing on click
        const label = bed.querySelector('.bed-label');
        label.addEventListener('click', (e) => {
            e.stopPropagation();
            if (bed.querySelector('.bed-label-input')) return;
            const input = document.createElement('input');
            input.className = 'bed-label-input';
            input.value = bedNames[i];
            input.maxLength = 20;
            label.style.display = 'none';
            bed.appendChild(input);
            input.focus();
            input.select();

            function finishEdit() {
                const newName = input.value.trim() || `BED ${i + 1}`;
                bedNames[i] = newName;
                saveBedNames();
                label.textContent = newName;
                label.style.display = '';
                input.remove();
                // Also update bed tab in sidebar
                const bedTab = document.querySelector(`.bed-tab[data-bed="${i}"]`);
                if (bedTab) bedTab.textContent = newName;
            }
            input.addEventListener('blur', finishEdit);
            input.addEventListener('keydown', (ke) => {
                if (ke.key === 'Enter') input.blur();
                if (ke.key === 'Escape') { input.value = bedNames[i]; input.blur(); }
            });
        });
        // Drag & drop
        bed.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            bed.classList.add('drag-over');
        });
        bed.addEventListener('dragleave', () => bed.classList.remove('drag-over'));
        bed.addEventListener('drop', (e) => {
            e.preventDefault();
            bed.classList.remove('drag-over');
            if (!state.dragData) return;
            const plantId = state.dragData.plantId;
            const rect = bed.getBoundingClientRect();
            const x = e.clientX - rect.left - 18;
            const y = e.clientY - rect.top - 18;
            placePlant(i, plantId, Math.max(0, Math.min(x, rect.width - 36)), Math.max(0, Math.min(y, rect.height - 36)));
            state.dragData = null;
        });

        // Click-to-place handler
        bed.addEventListener('click', (e) => {
            if (!state.clickPlaceMode) return;
            // Ignore clicks on placed plants (they handle their own clicks)
            if (e.target.closest('.placed-plant')) return;
            const rect = bed.getBoundingClientRect();
            const x = e.clientX - rect.left - 18;
            const y = e.clientY - rect.top - 18;
            placePlant(i, state.clickPlaceMode.plantId, Math.max(0, Math.min(x, rect.width - 36)), Math.max(0, Math.min(y, rect.height - 36)));
            // Stay in click-place mode for rapid multi-placement
        });

        grid.appendChild(bed);
    }

    // Click on empty area to deselect
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.placed-plant') && !e.target.closest('.context-menu') && !e.target.closest('.bed-plant-entry')) {
            clearSelection();
        }
    });
}

// ---- KEYBOARD SHORTCUTS ----
function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // ESC to cancel click-place mode or deselect
        if (e.key === 'Escape') {
            if (state.clickPlaceMode) {
                exitClickPlaceMode();
                showToast('Placement cancelled');
            } else {
                clearSelection();
            }
            return;
        }

        // Delete/Backspace to remove selected plant
        if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedPlacement) {
            // Don't intercept if typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            e.preventDefault();
            pushUndo();
            const { bedIndex, placementId } = state.selectedPlacement;
            const plant = state.beds[bedIndex].find(p => p.id === placementId);
            state.beds[bedIndex] = state.beds[bedIndex].filter(p => p.id !== placementId);
            clearSelection();
            renderPlacedPlants(bedIndex);
            updateBedDetails();
            saveState();
            if (plant) {
                const lib = PLANT_LIBRARY.find(p => p.id === plant.plantId);
                showToast(`Removed ${lib ? lib.name : 'plant'}`);
            }
            return;
        }

        // Ctrl+Z / Cmd+Z = Undo
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            e.preventDefault();
            undo();
            return;
        }

        // Ctrl+Y / Cmd+Shift+Z = Redo
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z') || (e.shiftKey && e.key === 'Z'))) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            e.preventDefault();
            redo();
            return;
        }
    });
}

// ---- ZOOM CONTROLS ----
let currentZoom = 1;
function initZoomControls() {
    const grid = document.getElementById('garden-grid');
    const zoomIn = document.getElementById('zoom-in');
    const zoomOut = document.getElementById('zoom-out');
    const zoomReset = document.getElementById('zoom-reset');
    const zoomLevel = document.getElementById('zoom-level');

    function setZoom(level) {
        currentZoom = Math.max(0.5, Math.min(2, level));
        grid.style.transform = `scale(${currentZoom})`;
        grid.style.transformOrigin = 'center center';
        zoomLevel.textContent = Math.round(currentZoom * 100) + '%';
    }

    zoomIn.addEventListener('click', () => setZoom(currentZoom + 0.1));
    zoomOut.addEventListener('click', () => setZoom(currentZoom - 0.1));
    zoomReset.addEventListener('click', () => setZoom(1));

    // Mouse wheel zoom on viewport
    document.getElementById('garden-viewport').addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            setZoom(currentZoom + (e.deltaY > 0 ? -0.1 : 0.1));
        }
    }, { passive: false });
}

// Snap-to-grid helper (20px grid cells)
function snapToGrid(val, gridSize) {
    gridSize = gridSize || 20;
    return Math.round(val / gridSize) * gridSize;
}

function placePlant(bedIndex, plantId, x, y) {
    const plant = PLANT_LIBRARY.find(p => p.id === plantId);
    if (!plant) return;

    // Snap to 20px grid for cleaner layouts
    x = snapToGrid(x);
    y = snapToGrid(y);

    pushUndo();
    const placement = {
        id: `${plantId}-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
        plantId,
        x, y
    };
    state.beds[bedIndex].push(placement);

    renderPlacedPlants(bedIndex);
    updateBedDetails();
    updateSpacingWarnings(bedIndex);
    saveState();
}

function renderPlacedPlants(bedIndex) {
    const bedEl = document.querySelectorAll('.garden-bed')[bedIndex];
    bedEl.querySelectorAll('.placed-plant').forEach(el => el.remove());
    bedEl.querySelectorAll('.spacing-warning').forEach(el => el.remove());
    bedEl.querySelectorAll('.spacing-radius').forEach(el => el.remove());
    bedEl.querySelectorAll('.companion-svg').forEach(el => el.remove());

    // Show/hide empty bed hint
    const hint = bedEl.querySelector('.bed-empty-hint');
    if (hint) hint.style.display = state.beds[bedIndex].length === 0 ? '' : 'none';

    // Update bed count badge
    const countBadge = bedEl.querySelector('.bed-count-badge');
    if (countBadge) {
        const cnt = state.beds[bedIndex].length;
        countBadge.textContent = cnt > 0 ? `${cnt} plant${cnt !== 1 ? 's' : ''}` : '';
        countBadge.style.display = cnt > 0 ? '' : 'none';
    }

    // Draw companion lines (SVG overlay)
    drawCompanionLines(bedIndex, bedEl);

    state.beds[bedIndex].forEach((placement) => {
        const plant = PLANT_LIBRARY.find(p => p.id === placement.plantId);
        if (!plant) return;

        const el = document.createElement('div');
        el.className = 'placed-plant';
        el.dataset.water = plant.waterNeed; // water need color-coding
        if (state.selectedPlacement && state.selectedPlacement.placementId === placement.id) {
            el.classList.add('selected');
        }
        el.style.left = placement.x + 'px';
        el.style.top = placement.y + 'px';
        el.dataset.placementId = placement.id;
        el.innerHTML = `${plant.emoji}<span class="plant-tooltip">${plant.name}</span>`;

        // Drag to reposition
        el.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            const bedRect = bedEl.getBoundingClientRect();
            const startX = e.clientX;
            const startY = e.clientY;
            const origX = placement.x;
            const origY = placement.y;
            let hasMoved = false;

            pushUndo();

            function onMove(me) {
                hasMoved = true;
                const dx = me.clientX - startX;
                const dy = me.clientY - startY;
                let newX = Math.max(0, Math.min(origX + dx, bedRect.width - 36));
                let newY = Math.max(0, Math.min(origY + dy, bedRect.height - 36));
                // Snap to grid on release (smooth while dragging)
                placement.x = newX;
                placement.y = newY;
                el.style.left = placement.x + 'px';
                el.style.top = placement.y + 'px';
            }
            function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                if (!hasMoved) {
                    // If no drag, select plant and show info
                    selectPlacement(bedIndex, placement.id);
                    showPlantInfo(placement.plantId);
                    // Pop the undo since nothing changed
                    state.undoStack.pop();
                } else {
                    // Snap to grid on release
                    placement.x = snapToGrid(placement.x);
                    placement.y = snapToGrid(placement.y);
                    el.style.left = placement.x + 'px';
                    el.style.top = placement.y + 'px';
                    updateSpacingWarnings(bedIndex);
                }
                saveState();
            }
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        // Right-click context menu
        el.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            selectPlacement(bedIndex, placement.id);
            showContextMenu(e.clientX, e.clientY, bedIndex, placement);
        });

        // Spacing radius on hover
        el.addEventListener('mouseenter', () => showSpacingRadius(bedEl, placement, plant));
        el.addEventListener('mouseleave', () => removeSpacingRadii(bedEl));

        bedEl.appendChild(el);
    });

    updateSpacingWarnings(bedIndex);
}

// ---- COMPANION LINES ----
function drawCompanionLines(bedIndex, bedEl) {
    const plants = state.beds[bedIndex];
    if (plants.length < 2) return;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('companion-svg');
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;';
    svg.setAttribute('viewBox', `0 0 ${bedEl.offsetWidth} ${bedEl.offsetHeight}`);

    for (let i = 0; i < plants.length; i++) {
        for (let j = i + 1; j < plants.length; j++) {
            const p1 = PLANT_LIBRARY.find(p => p.id === plants[i].plantId);
            const p2 = PLANT_LIBRARY.find(p => p.id === plants[j].plantId);
            if (!p1 || !p2) continue;

            const isCompanion = p1.companions.includes(p2.id) || p2.companions.includes(p1.id);
            const isEnemy = p1.enemies.includes(p2.id) || p2.enemies.includes(p1.id);

            if (isCompanion || isEnemy) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', plants[i].x + 18);
                line.setAttribute('y1', plants[i].y + 18);
                line.setAttribute('x2', plants[j].x + 18);
                line.setAttribute('y2', plants[j].y + 18);
                line.setAttribute('class', isCompanion ? 'companion-line-good' : 'companion-line-bad');
                line.setAttribute('stroke-width', '1.5');
                svg.appendChild(line);
            }
        }
    }

    bedEl.appendChild(svg);
}

// ---- SPACING RADIUS on hover ----
function showSpacingRadius(bedEl, placement, plant) {
    removeSpacingRadii(bedEl);
    const pxPerInchX = bedEl.offsetWidth / 120;
    const pxPerInchY = bedEl.offsetHeight / 60;
    const radiusPx = (plant.spacing / 2) * Math.min(pxPerInchX, pxPerInchY);

    const circle = document.createElement('div');
    circle.className = 'spacing-radius';
    circle.style.width = (radiusPx * 2) + 'px';
    circle.style.height = (radiusPx * 2) + 'px';
    circle.style.left = (placement.x + 18 - radiusPx) + 'px';
    circle.style.top = (placement.y + 18 - radiusPx) + 'px';
    bedEl.appendChild(circle);
}

function removeSpacingRadii(bedEl) {
    bedEl.querySelectorAll('.spacing-radius').forEach(el => el.remove());
}

// ---- SPACING VALIDATION & OVERLAP WARNINGS ----
function updateSpacingWarnings(bedIndex) {
    const bedEl = document.querySelectorAll('.garden-bed')[bedIndex];
    if (!bedEl) return;
    bedEl.querySelectorAll('.spacing-warning').forEach(el => el.remove());

    const plants = state.beds[bedIndex];
    const bedRect = bedEl.getBoundingClientRect();
    // px per inch roughly: bed is 5'x10' = 60"x120", mapped to bedEl dimensions
    const pxPerInchX = bedEl.offsetWidth / 120;
    const pxPerInchY = bedEl.offsetHeight / 60;

    for (let i = 0; i < plants.length; i++) {
        const p1 = plants[i];
        const plant1 = PLANT_LIBRARY.find(p => p.id === p1.plantId);
        if (!plant1) continue;

        for (let j = i + 1; j < plants.length; j++) {
            const p2 = plants[j];
            const plant2 = PLANT_LIBRARY.find(p => p.id === p2.plantId);
            if (!plant2) continue;

            const minDist = ((plant1.spacing + plant2.spacing) / 2);
            const minPx = minDist * Math.min(pxPerInchX, pxPerInchY);
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < minPx * 0.6) {
                // Show warning line between the two
                const midX = (p1.x + p2.x) / 2 + 18;
                const midY = (p1.y + p2.y) / 2 + 18;
                const warn = document.createElement('div');
                warn.className = 'spacing-warning';
                warn.style.left = midX + 'px';
                warn.style.top = midY + 'px';
                warn.title = `Too close! ${plant1.name} needs ${plant1.spacing}" / ${plant2.name} needs ${plant2.spacing}"`;
                warn.textContent = '⚠';
                bedEl.appendChild(warn);
            }
        }
    }
}

// ---- CONTEXT MENU ----
function showContextMenu(x, y, bedIndex, placement) {
    hideContextMenu();
    const plant = PLANT_LIBRARY.find(p => p.id === placement.plantId);
    if (!plant) return;

    const menu = document.createElement('div');
    menu.id = 'plant-context-menu';
    menu.className = 'context-menu';

    const otherBeds = [0,1,2,3].filter(i => i !== bedIndex);
    menu.innerHTML = `
        <div class="context-menu-header">${plant.emoji} ${plant.name}</div>
        <button class="context-menu-item" data-action="info">ℹ️ Plant Info</button>
        <button class="context-menu-item" data-action="duplicate">📋 Duplicate</button>
        <button class="context-menu-item" data-action="remove">🗑️ Remove</button>
        <div class="context-menu-divider"></div>
        <div class="context-menu-sublabel">MOVE TO:</div>
        ${otherBeds.map(i => `<button class="context-menu-item" data-action="move" data-target-bed="${i}">➡️ Bed ${i + 1}</button>`).join('')}
    `;

    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    document.body.appendChild(menu);

    // Clamp to viewport
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + 'px';

    menu.querySelectorAll('.context-menu-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            if (action === 'info') {
                showPlantInfo(placement.plantId);
            } else if (action === 'duplicate') {
                pushUndo();
                const newPlacement = {
                    id: `${placement.plantId}-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
                    plantId: placement.plantId,
                    x: Math.min(placement.x + 40, document.querySelectorAll('.garden-bed')[bedIndex].offsetWidth - 36),
                    y: placement.y
                };
                state.beds[bedIndex].push(newPlacement);
                renderPlacedPlants(bedIndex);
                updateBedDetails();
                saveState();
                showToast(`Duplicated ${plant.name}`);
            } else if (action === 'remove') {
                pushUndo();
                state.beds[bedIndex] = state.beds[bedIndex].filter(p => p.id !== placement.id);
                renderPlacedPlants(bedIndex);
                updateBedDetails();
                saveState();
                showToast(`Removed ${plant.name}`);
            } else if (action === 'move') {
                const targetBed = parseInt(btn.dataset.targetBed);
                pushUndo();
                state.beds[bedIndex] = state.beds[bedIndex].filter(p => p.id !== placement.id);
                const targetBedEl = document.querySelectorAll('.garden-bed')[targetBed];
                placement.x = Math.min(placement.x, targetBedEl.offsetWidth - 36);
                placement.y = Math.min(placement.y, targetBedEl.offsetHeight - 36);
                state.beds[targetBed].push(placement);
                renderPlacedPlants(bedIndex);
                renderPlacedPlants(targetBed);
                updateBedDetails();
                saveState();
                showToast(`Moved ${plant.name} to Bed ${targetBed + 1}`);
            }
            hideContextMenu();
            clearSelection();
        });
    });

    // Close on outside click
    setTimeout(() => {
        document.addEventListener('click', _closeContextMenuHandler);
        document.addEventListener('contextmenu', _closeContextMenuHandler);
    }, 10);
}

function _closeContextMenuHandler(e) {
    const menu = document.getElementById('plant-context-menu');
    if (menu && !menu.contains(e.target)) {
        hideContextMenu();
        clearSelection();
    }
}

function hideContextMenu() {
    const menu = document.getElementById('plant-context-menu');
    if (menu) menu.remove();
    document.removeEventListener('click', _closeContextMenuHandler);
    document.removeEventListener('contextmenu', _closeContextMenuHandler);
}

// ---- PLANT INFO PANEL ----
function showPlantInfo(plantId) {
    const plant = PLANT_LIBRARY.find(p => p.id === plantId);
    if (!plant) return;
    const panel = document.getElementById('plant-info-panel');
    const content = document.getElementById('plant-info-content');

    const waterColors = { low: '#10b981', medium: '#f59e0b', high: '#dc2626' };
    content.innerHTML = `
        <h3 class="info-title">${plant.emoji} ${plant.name}</h3>
        <p style="color:var(--text-secondary);margin:0.5rem 0;font-size:0.9rem;">${plant.notes}</p>
        <div class="plant-info-grid">
            <div class="info-item"><span class="info-label">TYPE</span><span class="info-value">${plant.type.toUpperCase()}</span></div>
            <div class="info-item"><span class="info-label">DAYS TO HARVEST</span><span class="info-value">${plant.daysToHarvest} days</span></div>
            <div class="info-item"><span class="info-label">SPACING</span><span class="info-value">${plant.spacing}" apart</span></div>
            <div class="info-item"><span class="info-label">WATER NEED</span><span class="info-value" style="color:${waterColors[plant.waterNeed]}">${plant.waterNeed.toUpperCase()}</span></div>
            <div class="info-item"><span class="info-label">SUN</span><span class="info-value">${plant.sunNeed.toUpperCase()}</span></div>
            <div class="info-item"><span class="info-label">LOW MAINTENANCE</span><span class="info-value">${plant.lowMaintenance ? '\u2705 YES' : '\u26A0\uFE0F NEEDS ATTENTION'}</span></div>
            <div class="info-item"><span class="info-label">COMPANIONS</span><span class="info-value">${plant.companions.map(c => { const cp = PLANT_LIBRARY.find(pl=>pl.id===c); return cp ? cp.emoji + ' ' + cp.name : c; }).join(', ') || 'None specific'}</span></div>
            <div class="info-item"><span class="info-label">ENEMIES</span><span class="info-value" style="color:var(--red-accent)">${plant.enemies.map(c => { const cp = PLANT_LIBRARY.find(pl=>pl.id===c); return cp ? cp.emoji + ' ' + cp.name : c; }).join(', ') || 'None'}</span></div>
        </div>
    `;

    panel.classList.remove('hidden');
    document.getElementById('close-info').onclick = () => panel.classList.add('hidden');

    // Click outside to dismiss
    function dismissOnOutsideClick(e) {
        if (!panel.contains(e.target) && !e.target.closest('.placed-plant') && !e.target.closest('.context-menu')) {
            panel.classList.add('hidden');
            document.removeEventListener('mousedown', dismissOnOutsideClick);
        }
    }
    // Remove old listener if any, add new
    document.removeEventListener('mousedown', state._infoPanelDismiss);
    state._infoPanelDismiss = dismissOnOutsideClick;
    setTimeout(() => document.addEventListener('mousedown', dismissOnOutsideClick), 100);
}

// ---- BED SELECTOR & DETAILS ----
function initBedSelector() {
    // Set initial bed tab names from saved names
    document.querySelectorAll('.bed-tab').forEach(tab => {
        const bedIdx = parseInt(tab.dataset.bed);
        tab.textContent = bedNames[bedIdx];
    });

    document.querySelectorAll('.bed-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.bed-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            state.selectedBed = parseInt(tab.dataset.bed);
            updateBedDetails();
            highlightActiveBed(state.selectedBed);
        });
    });
}

function highlightActiveBed(bedIndex) {
    document.querySelectorAll('.garden-bed').forEach(bed => {
        bed.classList.remove('active-highlight');
    });
    const beds = document.querySelectorAll('.garden-bed');
    if (beds[bedIndex]) {
        beds[bedIndex].classList.add('active-highlight');
        // Scroll the bed into view if needed
        beds[bedIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        // Remove highlight after animation
        setTimeout(() => beds[bedIndex].classList.remove('active-highlight'), 800);
    }
}

function updateBedDetails() {
    const bedIndex = state.selectedBed;
    const plants = state.beds[bedIndex];
    const uniquePlants = [...new Set(plants.map(p => p.plantId))];

    document.getElementById('bed-plant-count').textContent = plants.length;

    // Update total plant count in toolbar
    const totalPlants = state.beds.reduce((sum, bed) => sum + bed.length, 0);
    const totalCountEl = document.getElementById('total-plant-count');
    if (totalCountEl) {
        totalCountEl.innerHTML = `<span class="count-num">${totalPlants}</span> PLANT${totalPlants !== 1 ? 'S' : ''}`;
    }

    // Coverage estimate (rough)
    const bedArea = 5 * 10 * 144; // sq inches
    let usedArea = 0;
    plants.forEach(p => {
        const plant = PLANT_LIBRARY.find(pl => pl.id === p.plantId);
        if (plant) usedArea += Math.PI * Math.pow(plant.spacing / 2, 2);
    });
    const coverage = Math.min(100, Math.round((usedArea / bedArea) * 100));
    document.getElementById('bed-coverage').textContent = coverage + '%';

    // Water need
    const waterLevels = { low: 1, medium: 2, high: 3 };
    if (plants.length === 0) {
        document.getElementById('bed-water').textContent = '--';
    } else {
        const avgWater = plants.reduce((sum, p) => {
            const plant = PLANT_LIBRARY.find(pl => pl.id === p.plantId);
            return sum + (plant ? waterLevels[plant.waterNeed] : 0);
        }, 0) / plants.length;
        const waterLabel = avgWater < 1.5 ? 'LOW' : avgWater < 2.5 ? 'MEDIUM' : 'HIGH';
        document.getElementById('bed-water').textContent = waterLabel;
    }

    // Plant list with +/- quantity controls
    const listEl = document.getElementById('bed-plant-list');
    if (plants.length === 0) {
        listEl.innerHTML = '<p class="muted-text">No plants yet \u2014 drag from the library!</p>';
    } else {
        const counts = {};
        plants.forEach(p => { counts[p.plantId] = (counts[p.plantId] || 0) + 1; });
        listEl.innerHTML = Object.entries(counts).map(([pid, count]) => {
            const plant = PLANT_LIBRARY.find(pl => pl.id === pid);
            return `<div class="bed-plant-entry">
                <span class="bed-plant-emoji">${plant.emoji}</span>
                <span class="bed-plant-name">${plant.name}</span>
                <div class="qty-controls">
                    <button class="qty-btn qty-minus" data-plant-id="${pid}" title="Remove one ${plant.name}">\u2212</button>
                    <span class="qty-value">${count}</span>
                    <button class="qty-btn qty-plus" data-plant-id="${pid}" title="Add one ${plant.name}">+</button>
                </div>
                <button class="remove-plant" data-plant-id="${pid}" title="Remove all ${plant.name}">\u00D7</button>
            </div>`;
        }).join('');

        listEl.querySelectorAll('.qty-minus').forEach(btn => {
            btn.addEventListener('click', () => {
                pushUndo();
                const pid = btn.dataset.plantId;
                const idx = state.beds[bedIndex].findLastIndex(p => p.plantId === pid);
                if (idx !== -1) {
                    state.beds[bedIndex].splice(idx, 1);
                    renderPlacedPlants(bedIndex);
                    updateBedDetails();
                    saveState();
                }
            });
        });

        listEl.querySelectorAll('.qty-plus').forEach(btn => {
            btn.addEventListener('click', () => {
                const pid = btn.dataset.plantId;
                const bedEl = document.querySelectorAll('.garden-bed')[bedIndex];
                const bedW = bedEl.offsetWidth;
                const bedH = bedEl.offsetHeight;
                const existing = state.beds[bedIndex].filter(p => p.plantId === pid);
                let x, y;
                if (existing.length > 0) {
                    const last = existing[existing.length - 1];
                    x = last.x + 40;
                    y = last.y;
                    if (x >= bedW - 36) { x = 10; y = Math.min(last.y + 40, bedH - 36); }
                    x = Math.min(x, bedW - 36);
                } else {
                    x = Math.random() * (bedW - 40) + 2;
                    y = Math.random() * (bedH - 40) + 2;
                }
                placePlant(bedIndex, pid, x, y);
            });
        });

        listEl.querySelectorAll('.remove-plant').forEach(btn => {
            btn.addEventListener('click', () => {
                pushUndo();
                state.beds[bedIndex] = state.beds[bedIndex].filter(p => p.plantId !== btn.dataset.plantId);
                renderPlacedPlants(bedIndex);
                updateBedDetails();
                saveState();
            });
        });
    }

    // Companion alerts
    const alertsEl = document.getElementById('companion-alerts');
    const alerts = [];
    for (let i = 0; i < uniquePlants.length; i++) {
        for (let j = i + 1; j < uniquePlants.length; j++) {
            const p1 = PLANT_LIBRARY.find(pl => pl.id === uniquePlants[i]);
            const p2 = PLANT_LIBRARY.find(pl => pl.id === uniquePlants[j]);
            if (p1.companions.includes(p2.id)) {
                alerts.push({ type: 'good', text: `${p1.emoji} ${p1.name} + ${p2.emoji} ${p2.name} = great companions!` });
            }
            if (p1.enemies.includes(p2.id) || p2.enemies.includes(p1.id)) {
                alerts.push({ type: 'bad', text: `${p1.emoji} ${p1.name} + ${p2.emoji} ${p2.name} = avoid together!` });
            }
        }
    }
    if (alerts.length === 0) {
        alertsEl.innerHTML = '<p class="muted-text">Place plants to see companion tips</p>';
    } else {
        alertsEl.innerHTML = alerts.map(a =>
            `<div class="companion-${a.type}">${a.type === 'good' ? '\u2714' : '\u26A0'} ${a.text}</div>`
        ).join('');
    }

    // Update journal entries for this bed
    renderJournalEntries();
}

// ---- BED JOURNAL ----
function initBedJournal() {
    document.getElementById('btn-add-journal').addEventListener('click', addJournalEntry);
    document.getElementById('journal-entry-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addJournalEntry();
    });
}

function getJournalData() {
    return JSON.parse(localStorage.getItem('gardensync_journal') || '{}');
}

function saveJournalData(data) {
    localStorage.setItem('gardensync_journal', JSON.stringify(data));
}

function addJournalEntry() {
    const input = document.getElementById('journal-entry-input');
    const text = input.value.trim();
    if (!text) return;

    const bedKey = `bed-${state.selectedBed}`;
    const journal = getJournalData();
    if (!journal[bedKey]) journal[bedKey] = [];
    journal[bedKey].unshift({
        id: Date.now(),
        text: text,
        date: new Date().toISOString()
    });
    saveJournalData(journal);
    input.value = '';
    renderJournalEntries();
    showToast('Note added to Bed ' + (state.selectedBed + 1));
    // Scroll entries into view
    const container = document.getElementById('journal-entries');
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderJournalEntries() {
    const bedKey = `bed-${state.selectedBed}`;
    const journal = getJournalData();
    const entries = journal[bedKey] || [];
    const container = document.getElementById('journal-entries');

    if (entries.length === 0) {
        container.innerHTML = '<p class="muted-text">No notes yet</p>';
        return;
    }

    container.innerHTML = entries.map(e => {
        const dateStr = new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `
            <div class="journal-entry">
                <span class="journal-entry-date">${dateStr}</span>
                <span class="journal-entry-text">${e.text}</span>
                <button class="journal-entry-delete" data-entry-id="${e.id}">\u00D7</button>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.journal-entry-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const journal = getJournalData();
            if (journal[bedKey]) {
                journal[bedKey] = journal[bedKey].filter(e => e.id !== parseInt(btn.dataset.entryId));
                saveJournalData(journal);
                renderJournalEntries();
            }
        });
    });
}

// ---- TOOLBAR BUTTONS ----
function initToolbarButtons() {
    document.getElementById('btn-clear-all').addEventListener('click', () => {
        if (!confirm('Clear all plants from all beds?')) return;
        pushUndo();
        state.beds = [[], [], [], []];
        for (let i = 0; i < 4; i++) renderPlacedPlants(i);
        updateBedDetails();
        saveState();
    });

    document.getElementById('btn-save').addEventListener('click', () => {
        saveState();
        showToast('Garden plan saved!');
    });

    document.getElementById('btn-load').addEventListener('click', () => {
        showPresetModal();
    });

    document.getElementById('btn-export').addEventListener('click', exportPDF);

    // Grid toggle
    let gridOn = false;
    document.getElementById('btn-grid-toggle').addEventListener('click', () => {
        gridOn = !gridOn;
        document.querySelectorAll('.garden-bed').forEach(bed => {
            bed.classList.toggle('show-grid', gridOn);
        });
        document.getElementById('btn-grid-toggle').textContent = gridOn ? 'GRID: ON' : 'GRID: OFF';
        document.getElementById('btn-grid-toggle').classList.toggle('accent', gridOn);
    });

    // Auto-organize
    document.getElementById('btn-auto-organize').addEventListener('click', () => {
        pushUndo();
        autoOrganizeBed(state.selectedBed);
    });

    // Undo / Redo
    document.getElementById('btn-undo').addEventListener('click', undo);
    document.getElementById('btn-redo').addEventListener('click', redo);

    // Clear this bed
    document.getElementById('btn-clear-bed').addEventListener('click', () => {
        const bedIdx = state.selectedBed;
        if (state.beds[bedIdx].length === 0) { showToast('Bed is already empty!'); return; }
        pushUndo();
        state.beds[bedIdx] = [];
        renderPlacedPlants(bedIdx);
        updateBedDetails();
        saveState();
        showToast(`Bed ${bedIdx + 1} cleared`);
    });

    // Copy bed to another bed
    document.getElementById('btn-copy-bed').addEventListener('click', () => {
        showCopyBedModal();
    });

    updateUndoRedoButtons();
}

// ---- COPY BED MODAL ----
function showCopyBedModal() {
    const srcBed = state.selectedBed;
    if (state.beds[srcBed].length === 0) {
        showToast('Nothing to copy - bed is empty!');
        return;
    }
    const others = [0,1,2,3].filter(i => i !== srcBed);
    const modal = document.createElement('div');
    modal.id = 'copy-bed-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-box">
            <h3 style="font-family:var(--font-heading);color:var(--emerald);margin:0 0 1rem;">COPY BED ${srcBed + 1} TO:</h3>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                ${others.map(i => `<button class="tool-btn accent copy-target-btn" data-target="${i}">BED ${i + 1}${state.beds[i].length > 0 ? ' (overwrite)' : ''}</button>`).join('')}
            </div>
            <button class="tool-btn" id="copy-bed-cancel" style="margin-top:1rem;">CANCEL</button>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelectorAll('.copy-target-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = parseInt(btn.dataset.target);
            pushUndo();
            state.beds[target] = state.beds[srcBed].map(p => ({
                ...p,
                id: `${p.plantId}-${Date.now()}-${Math.random().toString(36).substr(2,5)}`
            }));
            renderPlacedPlants(target);
            updateBedDetails();
            saveState();
            modal.remove();
            showToast(`Copied Bed ${srcBed + 1} to Bed ${target + 1}`);
        });
    });

    document.getElementById('copy-bed-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

// ---- AUTO-ORGANIZE (Square Foot Garden Style) ----
function autoOrganizeBed(bedIndex) {
    const plants = state.beds[bedIndex];
    if (plants.length === 0) {
        showToast('No plants to organize in this bed!');
        return;
    }

    const bedEl = document.querySelectorAll('.garden-bed')[bedIndex];
    const bedW = bedEl.offsetWidth;
    const bedH = bedEl.offsetHeight;

    // SFG grid: 5' x 10' = 50 squares (each 1'x1' = 12"x12")
    // Map to pixel grid: 10 cols x 5 rows
    const cols = 10;
    const rows = 5;
    const cellW = bedW / cols;
    const cellH = bedH / rows;

    // Group plants by type, sort by spacing (largest first for best packing)
    const plantGroups = {};
    plants.forEach(p => {
        if (!plantGroups[p.plantId]) plantGroups[p.plantId] = [];
        plantGroups[p.plantId].push(p);
    });

    const sortedGroups = Object.entries(plantGroups).sort((a, b) => {
        const plantA = PLANT_LIBRARY.find(p => p.id === a[0]);
        const plantB = PLANT_LIBRARY.find(p => p.id === b[0]);
        return (plantB?.spacing || 0) - (plantA?.spacing || 0);
    });

    // Calculate how many cells each plant takes based on spacing
    // spacing <= 6" = 4 per cell, 6-12" = 1 per cell, 12-18" = 2 cells, 18-24" = 4 cells, 24"+ = 6 cells
    function cellsNeeded(spacing) {
        if (spacing <= 6) return 0.25;   // 4 plants per cell
        if (spacing <= 12) return 1;     // 1 per cell
        if (spacing <= 18) return 2;     // spans 2 cells
        if (spacing <= 24) return 4;     // spans 4 cells (2x2)
        return 6;                         // spans 6 cells (2x3)
    }

    // Build a grid occupancy map
    const grid = Array.from({ length: rows }, () => Array(cols).fill(false));

    function findSpace(cellCount) {
        // Determine shape
        let spanCols, spanRows;
        if (cellCount <= 0.25) { spanCols = 1; spanRows = 1; }
        else if (cellCount <= 1) { spanCols = 1; spanRows = 1; }
        else if (cellCount <= 2) { spanCols = 2; spanRows = 1; }
        else if (cellCount <= 4) { spanCols = 2; spanRows = 2; }
        else { spanCols = 3; spanRows = 2; }

        for (let r = 0; r <= rows - spanRows; r++) {
            for (let c = 0; c <= cols - spanCols; c++) {
                let fits = true;
                for (let dr = 0; dr < spanRows && fits; dr++) {
                    for (let dc = 0; dc < spanCols && fits; dc++) {
                        if (grid[r + dr][c + dc]) fits = false;
                    }
                }
                if (fits) {
                    // Mark occupied
                    for (let dr = 0; dr < spanRows; dr++) {
                        for (let dc = 0; dc < spanCols; dc++) {
                            grid[r + dr][c + dc] = true;
                        }
                    }
                    return {
                        x: c * cellW + (spanCols * cellW) / 2 - 18,
                        y: r * cellH + (spanRows * cellH) / 2 - 18
                    };
                }
            }
        }
        return null;
    }

    // Place small plants (multiple per cell)
    let placementIndex = 0;
    sortedGroups.forEach(([plantId, placements]) => {
        const plant = PLANT_LIBRARY.find(p => p.id === plantId);
        const cells = cellsNeeded(plant.spacing);

        if (cells < 1) {
            // Multiple per cell - group them
            const perCell = Math.round(1 / cells);
            let cellPlacements = [];
            placements.forEach((p, idx) => {
                if (idx % perCell === 0) {
                    // Find a new cell
                    const space = findSpace(1);
                    if (space) cellPlacements.push(space);
                }
                const basePos = cellPlacements[cellPlacements.length - 1];
                if (basePos) {
                    const subIdx = idx % perCell;
                    const subCols = Math.ceil(Math.sqrt(perCell));
                    const subRow = Math.floor(subIdx / subCols);
                    const subCol = subIdx % subCols;
                    const subSpacing = cellW / (subCols + 1);
                    p.x = Math.max(0, Math.min(basePos.x - cellW/2 + 18 + subSpacing * (subCol + 0.5), bedW - 36));
                    p.y = Math.max(0, Math.min(basePos.y - cellH/2 + 18 + subSpacing * (subRow + 0.5), bedH - 36));
                }
            });
        } else {
            placements.forEach(p => {
                const space = findSpace(cells);
                if (space) {
                    p.x = Math.max(0, Math.min(space.x, bedW - 36));
                    p.y = Math.max(0, Math.min(space.y, bedH - 36));
                } else {
                    // Overflow: place in remaining space
                    p.x = Math.random() * (bedW - 36);
                    p.y = Math.random() * (bedH - 36);
                }
            });
        }
    });

    renderPlacedPlants(bedIndex);
    updateBedDetails();
    saveState();
    showToast(`Bed ${bedIndex + 1} auto-organized!`);
}

// ---- PRESET GARDENS ----
const GARDEN_PRESETS = [
    {
        name: '\u{1F33F} HERB GARDEN',
        desc: 'A fragrant herb garden perfect for cooking and tea. Low maintenance, drought tolerant, and perennial favorites.',
        beds: [
            [
                { plantId: 'basil', count: 4 },
                { plantId: 'thyme', count: 3 },
                { plantId: 'chive', count: 4 },
                { plantId: 'dill', count: 3 },
                { plantId: 'mint', count: 2 },
            ],
            [
                { plantId: 'basil', count: 3 },
                { plantId: 'nasturtium', count: 4 },
                { plantId: 'marigold', count: 4 },
                { plantId: 'chive', count: 3 },
            ],
            [],
            []
        ]
    },
    {
        name: '\u{1F338} BLOOMING POLLINATOR GARDEN',
        desc: 'Attract bees, butterflies, and beneficial insects. Bright colors for community engagement. All low-water selections.',
        beds: [
            [
                { plantId: 'sunflower', count: 3 },
                { plantId: 'marigold', count: 6 },
                { plantId: 'nasturtium', count: 4 },
            ],
            [
                { plantId: 'sweet-peas', count: 5 },
                { plantId: 'marigold', count: 4 },
                { plantId: 'sunflower', count: 2 },
                { plantId: 'nasturtium', count: 3 },
            ],
            [
                { plantId: 'dill', count: 3 },
                { plantId: 'basil', count: 3 },
                { plantId: 'thyme', count: 4 },
                { plantId: 'chive', count: 4 },
            ],
            []
        ]
    },
    {
        name: '\u{1F345} FOOD NOT BOMBS HARVEST',
        desc: 'Maximum food production for community distribution. Stewart\'s original plan with high-yield, low-maintenance crops for Canton Zone 6a.',
        beds: [
            [
                { plantId: 'tomato', count: 3 },
                { plantId: 'basil', count: 3 },
                { plantId: 'marigold', count: 4 },
            ],
            [
                { plantId: 'green-beans', count: 6 },
                { plantId: 'cucumber', count: 2 },
                { plantId: 'lettuce', count: 4 },
            ],
            [
                { plantId: 'strawberry', count: 4 },
                { plantId: 'spinach', count: 5 },
                { plantId: 'radish', count: 6 },
            ],
            [
                { plantId: 'cantaloupe', count: 2 },
                { plantId: 'sweet-peas', count: 4 },
                { plantId: 'marigold', count: 3 },
                { plantId: 'zucchini', count: 2 },
            ]
        ]
    }
];

function showPresetModal() {
    const modal = document.getElementById('preset-modal');
    const list = document.getElementById('preset-list');

    list.innerHTML = GARDEN_PRESETS.map((preset, i) => {
        const plantNames = preset.beds.flat().map(p => {
            const plant = PLANT_LIBRARY.find(pl => pl.id === p.plantId);
            return plant ? plant.emoji : '';
        }).join(' ');
        return `
            <div class="preset-card" data-preset="${i}">
                <h3>${preset.name}</h3>
                <div class="preset-desc">${preset.desc}</div>
                <div class="preset-plants">${plantNames}</div>
            </div>
        `;
    }).join('');

    list.querySelectorAll('.preset-card').forEach(card => {
        card.addEventListener('click', () => {
            loadPreset(parseInt(card.dataset.preset));
            modal.classList.add('hidden');
        });
    });

    document.getElementById('btn-load-saved').onclick = () => {
        loadSavedState();
        modal.classList.add('hidden');
        showToast('Saved plan loaded!');
    };

    document.getElementById('close-preset-modal').onclick = () => {
        modal.classList.add('hidden');
    };

    modal.classList.remove('hidden');
}

function loadPreset(presetIndex) {
    const preset = GARDEN_PRESETS[presetIndex];
    state.beds = [[], [], [], []];

    preset.beds.forEach((bedPlants, bedIdx) => {
        bedPlants.forEach(({ plantId, count }) => {
            for (let i = 0; i < count; i++) {
                const bedEl = document.querySelectorAll('.garden-bed')[bedIdx];
                const bedW = bedEl ? bedEl.offsetWidth : 400;
                const bedH = bedEl ? bedEl.offsetHeight : 220;
                state.beds[bedIdx].push({
                    id: `${plantId}-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
                    plantId,
                    x: Math.random() * (bedW - 40) + 2,
                    y: Math.random() * (bedH - 40) + 2,
                });
            }
        });
    });

    // Render and auto-organize each bed
    for (let i = 0; i < 4; i++) {
        renderPlacedPlants(i);
        if (state.beds[i].length > 0) {
            autoOrganizeBed(i);
        }
    }

    updateBedDetails();
    saveState();
    showToast(`Loaded: ${preset.name}`);
}

// ---- SAVE / LOAD ----
function saveState() {
    const data = {
        beds: state.beds,
        volunteers: state.volunteers,
        bedAssignments: state.bedAssignments
    };
    localStorage.setItem('gardensync_state', JSON.stringify(data));
}

function loadSavedState() {
    const saved = localStorage.getItem('gardensync_state');
    if (!saved) return;
    try {
        const data = JSON.parse(saved);
        if (data.beds) {
            state.beds = data.beds;
            for (let i = 0; i < 4; i++) renderPlacedPlants(i);
        }
        if (data.volunteers) state.volunteers = data.volunteers;
        if (data.bedAssignments) state.bedAssignments = data.bedAssignments;
        updateBedDetails();
    } catch(e) { console.error('Failed to load state', e); }
}

// ---- TOAST ----
function showToast(msg) {
    // Remove any existing toast
    document.querySelectorAll('.toast-notification').forEach(t => t.remove());
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('toast-leaving');
        setTimeout(() => toast.remove(), 300);
    }, 2200);
}

// ---- EXPORT PDF (prints page) ----
function exportPDF() {
    window.print();
}

// ---- GROW SCHEDULE ----
function updateSchedule() {
    const allPlants = [];
    state.beds.forEach((bed, bedIdx) => {
        const unique = [...new Set(bed.map(p => p.plantId))];
        unique.forEach(pid => {
            if (!allPlants.find(ap => ap.plantId === pid)) {
                allPlants.push({ plantId: pid, beds: [bedIdx] });
            } else {
                const existing = allPlants.find(ap => ap.plantId === pid);
                if (!existing.beds.includes(bedIdx)) existing.beds.push(bedIdx);
            }
        });
    });

    const emptyEl = document.getElementById('schedule-empty');
    const contentEl = document.getElementById('schedule-content');

    if (allPlants.length === 0) {
        emptyEl.classList.remove('hidden');
        contentEl.classList.add('hidden');
        return;
    }
    emptyEl.classList.add('hidden');
    contentEl.classList.remove('hidden');

    buildTimeline(allPlants);
    buildTaskTracker(allPlants);
    buildInstructions(allPlants);
}

function getPlantDates(plant) {
    // Last frost: April 18 (month index 3, day 18)
    const lastFrostDate = new Date(new Date().getFullYear(), 3, 18);
    const dates = {};

    if (plant.sowIndoors !== null && plant.sowIndoors !== undefined) {
        const startD = new Date(lastFrostDate);
        startD.setDate(startD.getDate() + plant.sowIndoors * 7);
        const endD = new Date(startD);
        endD.setDate(endD.getDate() + 14); // 2-week window
        dates.seedIndoor = { start: startD, end: endD };
    }
    if (plant.transplantAfterFrost !== null && plant.transplantAfterFrost !== undefined) {
        const startD = new Date(lastFrostDate);
        startD.setDate(startD.getDate() + plant.transplantAfterFrost * 7);
        const endD = new Date(startD);
        endD.setDate(endD.getDate() + 14);
        dates.transplant = { start: startD, end: endD };
    }
    if (plant.directSow !== null && plant.directSow !== undefined) {
        const startD = new Date(lastFrostDate);
        startD.setDate(startD.getDate() + plant.directSow * 7);
        const endD = new Date(startD);
        endD.setDate(endD.getDate() + 21); // 3-week window for direct sow
        dates.directSow = { start: startD, end: endD };
    }
    // Harvest dates
    const growStart = dates.transplant?.start || dates.directSow?.start || dates.seedIndoor?.start;
    if (growStart) {
        const harvestStart = new Date(growStart);
        harvestStart.setDate(harvestStart.getDate() + plant.daysToHarvest);
        const harvestEnd = new Date(harvestStart);
        harvestEnd.setDate(harvestEnd.getDate() + (plant.harvestWeeks || 4) * 7);
        dates.harvestStart = { start: harvestStart, end: harvestEnd };
    }

    return dates;
}

function formatDateRange(range) {
    if (!range) return '';
    const opts = { month: 'short', day: 'numeric' };
    return `${range.start.toLocaleDateString('en-US', opts)} \u2013 ${range.end.toLocaleDateString('en-US', opts)}`;
}

function formatDate(d) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildTimeline(allPlants) {
    const container = document.getElementById('schedule-timeline');
    let html = `<div class="timeline-legend">
        <div class="legend-item"><div class="legend-swatch" style="background:#7c3aed"></div>START INDOORS</div>
        <div class="legend-item"><div class="legend-swatch" style="background:#059669"></div>TRANSPLANT</div>
        <div class="legend-item"><div class="legend-swatch" style="background:#0d9488"></div>DIRECT SOW</div>
        <div class="legend-item"><div class="legend-swatch" style="background:#92400e"></div>HARVEST</div>
    </div>`;

    const months = [0,1,2,3,4,5,6,7,8,9,10,11];
    months.forEach(m => {
        let bars = '';
        allPlants.forEach(ap => {
            const plant = PLANT_LIBRARY.find(p => p.id === ap.plantId);
            const dates = getPlantDates(plant);

            if (dates.seedIndoor && dates.seedIndoor.start.getMonth() === m) {
                bars += `<div class="timeline-plant-bar seed-indoor">${plant.emoji} ${plant.name} \u2014 start indoors (${formatDateRange(dates.seedIndoor)})</div>`;
            }
            if (dates.transplant && dates.transplant.start.getMonth() === m) {
                bars += `<div class="timeline-plant-bar transplant">${plant.emoji} ${plant.name} \u2014 transplant (${formatDateRange(dates.transplant)})</div>`;
            }
            if (dates.directSow && dates.directSow.start.getMonth() === m) {
                bars += `<div class="timeline-plant-bar direct-sow">${plant.emoji} ${plant.name} \u2014 direct sow (${formatDateRange(dates.directSow)})</div>`;
            }
            if (dates.harvestStart) {
                const harvestStartMonth = dates.harvestStart.start.getMonth();
                const harvestEndMonth = dates.harvestStart.end.getMonth();
                if (m >= harvestStartMonth && m <= harvestEndMonth && m === harvestStartMonth) {
                    bars += `<div class="timeline-plant-bar harvest">${plant.emoji} ${plant.name} \u2014 harvest (${formatDateRange(dates.harvestStart)})</div>`;
                }
            }
        });

        if (bars) {
            html += `<div class="timeline-month-row">
                <div class="timeline-month-label">${MONTH_NAMES[m]}</div>
                <div class="timeline-bar-area">${bars}</div>
            </div>`;
        }
    });

    container.innerHTML = html;
}

function buildInstructions(allPlants) {
    const container = document.getElementById('schedule-instructions');
    container.innerHTML = '<h3 class="subsection-title" style="font-size:1rem;margin-top:0;">DETAILED GROWING REFERENCE</h3>';

    const monthActions = {};
    allPlants.forEach(ap => {
        const plant = PLANT_LIBRARY.find(p => p.id === ap.plantId);
        const dates = getPlantDates(plant);

        function addAction(dateRange, action, detail) {
            if (!dateRange) return;
            const key = dateRange.start.getMonth();
            if (!monthActions[key]) monthActions[key] = [];
            monthActions[key].push({ plant, dateRange, action, detail });
        }

        addAction(dates.seedIndoor, 'START INDOORS', plant.seedStartInstructions);
        addAction(dates.transplant, 'TRANSPLANT', `Transplant ${plant.name} outdoors. ${plant.careNotes}`);
        addAction(dates.directSow, 'DIRECT SOW', plant.seedStartInstructions);
        addAction(dates.harvestStart, 'BEGIN HARVEST', `${plant.name} should be ready to harvest! ${plant.careNotes}`);
    });

    const sortedMonths = Object.keys(monthActions).sort((a,b) => a - b);
    sortedMonths.forEach(m => {
        const actions = monthActions[m];
        let stepsHtml = actions.map(a =>
            `<li><strong>${a.plant.emoji} ${a.plant.name} \u2014 ${a.action} (${formatDateRange(a.dateRange)}):</strong> ${a.detail}</li>`
        ).join('');

        container.innerHTML += `
            <div class="instruction-card">
                <h4><span class="month-tag">${MONTH_FULL[m].toUpperCase()}</span> ${MONTH_FULL[m]} Tasks</h4>
                <ul class="instruction-steps">${stepsHtml}</ul>
            </div>
        `;
    });
}

// ---- TASK TRACKER SYSTEM ----
function buildTaskTracker(allPlants) {
    const container = document.getElementById('schedule-tasks');
    if (!container) return;

    // Load completed tasks from localStorage
    const completedTasks = JSON.parse(localStorage.getItem('gardensync_completed_tasks') || '{}');

    // Generate all tasks with specific dates
    const allTasks = [];
    allPlants.forEach(ap => {
        const plant = PLANT_LIBRARY.find(p => p.id === ap.plantId);
        const dates = getPlantDates(plant);
        const beds = ap.beds.map(b => `Bed ${b + 1}`).join(', ');

        if (dates.seedIndoor) {
            allTasks.push({
                id: `${plant.id}-seed-indoor`,
                month: dates.seedIndoor.start.getMonth(),
                sortDate: dates.seedIndoor.start,
                type: 'seed-indoor',
                typeLabel: 'START INDOORS',
                title: `${plant.emoji} Start ${plant.name} seeds indoors`,
                dateStr: `${formatDate(dates.seedIndoor.start)} \u2013 ${formatDate(dates.seedIndoor.end)}`,
                detail: plant.seedStartInstructions,
                beds
            });
        }
        if (dates.transplant) {
            allTasks.push({
                id: `${plant.id}-transplant`,
                month: dates.transplant.start.getMonth(),
                sortDate: dates.transplant.start,
                type: 'transplant',
                typeLabel: 'TRANSPLANT',
                title: `${plant.emoji} Transplant ${plant.name} outdoors (${beds})`,
                dateStr: `${formatDate(dates.transplant.start)} \u2013 ${formatDate(dates.transplant.end)}`,
                detail: `Move hardened-off ${plant.name} transplants to ${beds}. ${plant.careNotes}`,
                beds
            });
        }
        if (dates.directSow) {
            allTasks.push({
                id: `${plant.id}-direct-sow`,
                month: dates.directSow.start.getMonth(),
                sortDate: dates.directSow.start,
                type: 'direct-sow',
                typeLabel: 'DIRECT SOW',
                title: `${plant.emoji} Direct sow ${plant.name} in ${beds}`,
                dateStr: `${formatDate(dates.directSow.start)} \u2013 ${formatDate(dates.directSow.end)}`,
                detail: plant.seedStartInstructions,
                beds
            });
        }
        if (dates.harvestStart) {
            allTasks.push({
                id: `${plant.id}-harvest`,
                month: dates.harvestStart.start.getMonth(),
                sortDate: dates.harvestStart.start,
                type: 'harvest',
                typeLabel: 'HARVEST',
                title: `${plant.emoji} Begin harvesting ${plant.name} from ${beds}`,
                dateStr: `${formatDate(dates.harvestStart.start)} \u2013 ${formatDate(dates.harvestStart.end)}`,
                detail: plant.careNotes,
                beds
            });
        }
    });

    // Sort by date
    allTasks.sort((a, b) => a.sortDate - b.sortDate);

    // Group by month
    const byMonth = {};
    allTasks.forEach(t => {
        if (!byMonth[t.month]) byMonth[t.month] = [];
        byMonth[t.month].push(t);
    });

    container.innerHTML = '';
    const sortedMonths = Object.keys(byMonth).sort((a, b) => a - b);

    sortedMonths.forEach(m => {
        const tasks = byMonth[m];
        const completedCount = tasks.filter(t => completedTasks[t.id]).length;
        const totalCount = tasks.length;
        const allDone = completedCount === totalCount;
        const now = new Date();
        const isCurrentMonth = now.getMonth() === parseInt(m);
        const isPast = now.getMonth() > parseInt(m);

        const group = document.createElement('div');
        group.className = 'task-month-group';
        if (allDone) group.style.borderLeftColor = '#525252';

        group.innerHTML = `
            <div class="task-month-header">
                <span class="task-month-name">${allDone ? '\u2705 ' : isCurrentMonth ? '\u{1F449} ' : ''}${MONTH_FULL[m].toUpperCase()}</span>
                <span class="task-month-progress"><span class="done-count">${completedCount}</span>/${totalCount} complete</span>
            </div>
            <div class="task-month-body ${isPast && allDone ? 'collapsed' : ''}">
                ${tasks.map(t => {
                    const done = completedTasks[t.id] || false;
                    return `
                        <div class="sched-task-item" data-task-id="${t.id}">
                            <div class="sched-task-check ${done ? 'done' : ''}" data-task-id="${t.id}">${done ? '\u2714' : ''}</div>
                            <div class="sched-task-content">
                                <div class="sched-task-title ${done ? 'done' : ''}">${t.title}</div>
                                <div class="sched-task-date">${t.dateStr}</div>
                                <div class="sched-task-detail ${done ? 'done' : ''}">${t.detail}</div>
                            </div>
                            <span class="sched-task-type ${t.type}">${t.typeLabel}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        // Toggle month collapse
        group.querySelector('.task-month-header').addEventListener('click', () => {
            group.querySelector('.task-month-body').classList.toggle('collapsed');
        });

        // Task checkoff
        group.querySelectorAll('.sched-task-check').forEach(chk => {
            chk.addEventListener('click', (e) => {
                e.stopPropagation();
                const taskId = chk.dataset.taskId;
                completedTasks[taskId] = !completedTasks[taskId];
                localStorage.setItem('gardensync_completed_tasks', JSON.stringify(completedTasks));
                // Re-render
                buildTaskTracker(allPlants);
            });
        });

        container.appendChild(group);
    });
}

// ---- VOLUNTEERS ----
function initVolunteers() {
    document.getElementById('btn-add-volunteer').addEventListener('click', addVolunteer);
    document.getElementById('btn-auto-assign').addEventListener('click', autoAssign);

    // Load defaults if empty
    if (state.volunteers.length === 0) {
        state.volunteers = [
            { id: 1, name: 'Volunteer 1', phone: '', availability: 'medium' },
            { id: 2, name: 'Volunteer 2', phone: '', availability: 'medium' },
            { id: 3, name: 'Volunteer 3', phone: '', availability: 'low' },
            { id: 4, name: 'Volunteer 4', phone: '', availability: 'high' },
            { id: 5, name: 'Volunteer 5', phone: '', availability: 'low' },
        ];
    }
    renderVolunteers();
}

function addVolunteer() {
    const name = document.getElementById('vol-name').value.trim();
    if (!name) return;
    const phone = document.getElementById('vol-phone').value.trim();
    const availability = document.getElementById('vol-availability').value;
    state.volunteers.push({
        id: Date.now(),
        name, phone, availability
    });
    document.getElementById('vol-name').value = '';
    document.getElementById('vol-phone').value = '';
    renderVolunteers();
    saveState();
}

function renderVolunteers() {
    // Volunteer list
    const listEl = document.getElementById('volunteer-list');
    const avatars = ['\u270A','\u{1F331}','\u{1F33F}','\u{1F33B}','\u{1F345}','\u{1F955}','\u{1F952}','\u{1F96C}'];
    listEl.innerHTML = state.volunteers.map((v, i) => `
        <div class="vol-card">
            <div class="vol-avatar">${avatars[i % avatars.length]}</div>
            <div class="vol-info">
                <div class="vol-name">${v.name}</div>
                <div class="vol-contact">${v.phone || 'no contact info'}</div>
            </div>
            <span class="vol-avail ${v.availability}">${v.availability.toUpperCase()}</span>
            <button class="vol-remove" data-vol-id="${v.id}">\u00D7</button>
        </div>
    `).join('');

    listEl.querySelectorAll('.vol-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            state.volunteers = state.volunteers.filter(v => v.id !== parseInt(btn.dataset.volId));
            renderVolunteers();
            saveState();
        });
    });

    // Bed assignments
    const assignEl = document.getElementById('bed-assignments');
    assignEl.innerHTML = [0,1,2,3].map(i => `
        <div class="assignment-row">
            <div class="assignment-bed-label">BED ${i+1} ${state.beds[i].length > 0 ? `(${[...new Set(state.beds[i].map(p=>p.plantId))].map(pid => PLANT_LIBRARY.find(pl=>pl.id===pid)?.emoji || '').join(' ')})` : '(empty)'}</div>
            <select class="assignment-select" data-bed="${i}">
                <option value="">Unassigned</option>
                ${state.volunteers.map(v => `<option value="${v.id}" ${state.bedAssignments[i] === v.id ? 'selected' : ''}>${v.name} (${v.availability})</option>`).join('')}
            </select>
        </div>
    `).join('');

    assignEl.querySelectorAll('.assignment-select').forEach(sel => {
        sel.addEventListener('change', () => {
            state.bedAssignments[parseInt(sel.dataset.bed)] = sel.value ? parseInt(sel.value) : null;
            saveState();
            renderWeeklyTasks();
        });
    });

    renderWeeklyTasks();
}

function autoAssign() {
    const sorted = [...state.volunteers].sort((a,b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.availability] - order[b.availability];
    });
    for (let i = 0; i < 4; i++) {
        state.bedAssignments[i] = sorted[i % sorted.length]?.id || null;
    }
    renderVolunteers();
    saveState();
    showToast('Auto-assigned by availability!');
}

function renderWeeklyTasks() {
    const container = document.getElementById('current-week-tasks');
    const now = new Date();
    const monthName = MONTH_FULL[now.getMonth()];

    const tasks = [];
    // Generate tasks based on current month and planted items
    state.beds.forEach((bed, bedIdx) => {
        if (bed.length === 0) return;
        const vol = state.volunteers.find(v => v.id === state.bedAssignments[bedIdx]);
        const volName = vol ? vol.name : 'Unassigned';
        tasks.push({ text: `[BED ${bedIdx+1}] Water check \u2014 ${volName}`, done: false });
        tasks.push({ text: `[BED ${bedIdx+1}] Weed patrol \u2014 ${volName}`, done: false });
    });

    if (now.getMonth() >= 3 && now.getMonth() <= 5) {
        tasks.push({ text: `Check rain barrels \u2014 refill schedule`, done: false });
    }
    tasks.push({ text: `Harvest any ripe produce for FNB distribution`, done: false });
    tasks.push({ text: `Update garden log / take photos`, done: false });

    container.innerHTML = `<h4 style="font-family:var(--font-mono);font-size:0.7rem;color:var(--text-muted);letter-spacing:1px;margin-bottom:0.75rem;">WEEK OF ${monthName.toUpperCase()} ${now.getDate()}</h4>` +
        tasks.map((t, i) => `
        <div class="task-item">
            <div class="task-check ${t.done ? 'done' : ''}" data-task="${i}">${t.done ? '\u2714' : ''}</div>
            <span class="task-text ${t.done ? 'done' : ''}">${t.text}</span>
        </div>
    `).join('');

    container.querySelectorAll('.task-check').forEach(chk => {
        chk.addEventListener('click', () => {
            chk.classList.toggle('done');
            const span = chk.nextElementSibling;
            span.classList.toggle('done');
            chk.textContent = chk.classList.contains('done') ? '\u2714' : '';
        });
    });
}

// ---- CLIMATE CHARTS (Canvas based, no dependencies) ----
function initClimateCharts() {
    drawRainfallChart();
    drawTempChart();
}

function drawRainfallChart() {
    const canvas = document.getElementById('rainfall-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;
    const data = Object.values(CANTON_CLIMATE.monthlyRainfall);
    const maxVal = 6;
    const barW = chartW / 12 - 4;

    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);

    // Bars
    data.forEach((val, i) => {
        const x = padding.left + (chartW / 12) * i + 2;
        const barH = (val / maxVal) * chartH;
        const y = padding.top + chartH - barH;

        const grad = ctx.createLinearGradient(x, y + barH, x, y);
        grad.addColorStop(0, '#0d9488');
        grad.addColorStop(1, '#14b8a6');
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barW, barH);

        // Value
        ctx.fillStyle = '#a3a3a3';
        ctx.font = '9px "Space Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(val + '"', x + barW/2, y - 4);

        // Month label
        ctx.fillStyle = '#525252';
        ctx.font = '9px "Space Mono", monospace';
        ctx.fillText(MONTH_NAMES[i], x + barW/2, h - 8);
    });

    // Y-axis
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 6; i++) {
        const y = padding.top + chartH - (i / 6) * chartH;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();

        ctx.fillStyle = '#525252';
        ctx.font = '9px "Space Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(i + '"', padding.left - 4, y + 3);
    }
}

function drawTempChart() {
    const canvas = document.getElementById('temp-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;
    const highs = Object.values(CANTON_CLIMATE.monthlyAvgHigh);
    const lows = Object.values(CANTON_CLIMATE.monthlyAvgLow);
    const maxT = 90;
    const minT = 10;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);

    function tempY(t) {
        return padding.top + chartH - ((t - minT) / (maxT - minT)) * chartH;
    }

    // Growing season band
    ctx.fillStyle = 'rgba(16,185,129,0.08)';
    const aprilX = padding.left + (chartW / 12) * 3;
    const octX = padding.left + (chartW / 12) * 10;
    ctx.fillRect(aprilX, padding.top, octX - aprilX, chartH);

    // Grid lines
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    for (let t = 20; t <= 80; t += 20) {
        const y = tempY(t);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();
        ctx.fillStyle = '#525252';
        ctx.font = '9px "Space Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(t + '\u00B0F', padding.left - 4, y + 3);
    }

    // Frost line at 32F
    ctx.strokeStyle = '#3b82f688';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left, tempY(32));
    ctx.lineTo(w - padding.right, tempY(32));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#3b82f6';
    ctx.font = '9px "Space Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('32\u00B0F FROST', padding.left + 4, tempY(32) - 4);

    // Lines
    function drawLine(data, color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        data.forEach((val, i) => {
            const x = padding.left + (chartW / 12) * i + (chartW / 24);
            const y = tempY(val);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Dots
        data.forEach((val, i) => {
            const x = padding.left + (chartW / 12) * i + (chartW / 24);
            const y = tempY(val);
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    drawLine(highs, '#dc2626');
    drawLine(lows, '#3b82f6');

    // Month labels
    MONTH_NAMES.forEach((name, i) => {
        const x = padding.left + (chartW / 12) * i + (chartW / 24);
        ctx.fillStyle = '#525252';
        ctx.font = '9px "Space Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(name, x, h - 8);
    });

    // Legend
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(w - 130, 8, 10, 10);
    ctx.fillStyle = '#a3a3a3';
    ctx.font = '9px "Space Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('AVG HIGH', w - 115, 17);

    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(w - 130, 22, 10, 10);
    ctx.fillStyle = '#a3a3a3';
    ctx.fillText('AVG LOW', w - 115, 31);
}

// ---- RAIN BARREL CALCULATOR ----
function initRainBarrelCalc() {
    const roofInput = document.getElementById('roof-area');
    const barrelInput = document.getElementById('barrel-count');
    if (!roofInput || !barrelInput) return;

    function calc() {
        const roofArea = parseFloat(roofInput.value) || 200;
        const barrels = parseInt(barrelInput.value) || 2;
        const capacity = barrels * 55;
        document.getElementById('barrel-capacity').textContent = capacity + ' gallons';

        // Monthly collection: 1 inch rain on 1 sq ft = 0.623 gallons
        const avgMonthlyRain = CANTON_CLIMATE.annualRainfall / 12;
        const monthlyGal = Math.round(roofArea * avgMonthlyRain * 0.623);
        document.getElementById('barrel-monthly').textContent = `~${monthlyGal} gal/month`;

        // 4 beds, 50 sq ft each = 200 sq ft garden
        // ~1 inch/week during peak = 200 * 0.623 = ~125 gal/week
        const weeklyNeed = Math.round(200 * 0.623);
        document.getElementById('garden-need').textContent = `~${weeklyNeed} gal/week (peak)`;

        const weeksOfStorage = (capacity / weeklyNeed).toFixed(1);
        const deficitOrSurplus = monthlyGal - (weeklyNeed * 4.3);

        const verdict = document.getElementById('barrel-verdict');
        if (deficitOrSurplus >= 0) {
            verdict.innerHTML = `\u2705 <strong>Good news!</strong> Your rain collection (~${monthlyGal} gal/mo) covers garden needs (~${Math.round(weeklyNeed*4.3)} gal/mo). ${capacity} gal storage gives you ~${weeksOfStorage} weeks of drought buffer. With low-maintenance plant selections, natural rainfall should handle most watering.`;
            verdict.style.borderColor = '#059669';
        } else {
            verdict.innerHTML = `\u26A0\uFE0F <strong>Heads up:</strong> Peak demand (~${Math.round(weeklyNeed*4.3)} gal/mo) exceeds collection (~${monthlyGal} gal/mo) by ~${Math.abs(Math.round(deficitOrSurplus))} gal. Your ${capacity} gal storage provides ~${weeksOfStorage} weeks drought buffer. Stick to low-water plants and mulch heavily!`;
            verdict.style.borderColor = '#f59e0b';
        }
    }

    roofInput.addEventListener('input', calc);
    barrelInput.addEventListener('input', calc);
    calc();
}

// ---- VISUALIZER (Gemini Integration) ----
function initVisualizer() {
    const keyInput = document.getElementById('gemini-key');
    if (state.geminiKey) keyInput.value = state.geminiKey;

    document.getElementById('btn-save-key').addEventListener('click', () => {
        state.geminiKey = keyInput.value.trim();
        localStorage.setItem('gardensync_gemini_key', state.geminiKey);
        showToast('API key saved!');
    });

    document.getElementById('btn-generate-viz').addEventListener('click', generateVisualization);
}

function generateVisualization() {
    const key = document.getElementById('gemini-key').value.trim() || state.geminiKey;
    if (!key) {
        showVizStatus('Please enter your Gemini API key first.', 'error');
        return;
    }
    state.geminiKey = key;
    localStorage.setItem('gardensync_gemini_key', key);

    const bedSelect = document.getElementById('viz-bed-select').value;

    // Gather plant data for prompt
    let plantDescription = '';
    if (bedSelect === 'all') {
        state.beds.forEach((bed, i) => {
            if (bed.length === 0) return;
            const counts = {};
            bed.forEach(p => { counts[p.plantId] = (counts[p.plantId] || 0) + 1; });
            const plantList = Object.entries(counts).map(([pid, count]) => {
                const plant = PLANT_LIBRARY.find(pl => pl.id === pid);
                return `${count}x ${plant.name}`;
            }).join(', ');
            plantDescription += `Bed ${i+1} (5'x10'): ${plantList}\n`;
        });
    } else {
        const bedIdx = parseInt(bedSelect);
        const bed = state.beds[bedIdx];
        if (bed.length === 0) {
            showVizStatus('Selected bed is empty. Add plants first!', 'error');
            return;
        }
        const counts = {};
        bed.forEach(p => { counts[p.plantId] = (counts[p.plantId] || 0) + 1; });
        const plantList = Object.entries(counts).map(([pid, count]) => {
            const plant = PLANT_LIBRARY.find(pl => pl.id === pid);
            return `${count}x ${plant.name}`;
        }).join(', ');
        plantDescription = `Bed ${bedIdx+1} (5'x10'): ${plantList}`;
    }

    if (!plantDescription.trim()) {
        showVizStatus('No plants placed! Use the Bed Planner first.', 'error');
        return;
    }

    // Generate prompts for multiple angles
    const baseContext = `A community garden in Canton, Ohio. Raised garden beds made of weathered wood, approximately 5 feet by 10 feet each. The garden is in a public community space. The plants are healthy and at peak growing season (mid-summer). Natural sunlight, realistic gardening scene. Organic, lived-in feel with mulch paths between beds. Rain barrels visible nearby.`;

    const prompts = [
        {
            label: 'BIRD\'S EYE VIEW (Top-Down)',
            prompt: `Top-down aerial view looking straight down at a community garden. ${baseContext} The beds contain: ${plantDescription}. Show each plant species in its correct position and spacing. Detailed botanical accuracy. Photorealistic style. Rich earth tones and vibrant greens.`
        },
        {
            label: 'PERSPECTIVE VIEW (Garden Overview)',
            prompt: `Wide-angle perspective view of a community garden at eye level, standing at the path entrance looking across all four raised beds. ${baseContext} The beds contain: ${plantDescription}. Show the full layout with pathways between beds, a small shed or tool rack in background. Warm golden hour lighting. Photorealistic community garden photography style.`
        },
        {
            label: 'CLOSE-UP DETAIL',
            prompt: `Close-up detail shot of raised garden bed plants at a slight angle, showing the textures and details of the plants. ${baseContext} Focus on: ${plantDescription}. Show companion planting arrangements, mulched soil surface, wooden bed edges. Macro photography style with shallow depth of field. Morning dew on leaves.`
        },
        {
            label: 'GARDEN AT HARVEST TIME',
            prompt: `A community garden during peak harvest with ripe vegetables and flowers. ${baseContext} The beds contain: ${plantDescription}. Show ripe tomatoes, full bean plants, blooming flowers, ready-to-pick produce. A woven basket sits at the edge of a bed partially filled with fresh vegetables. Warm afternoon light. Inviting and abundant. Food Not Bombs mutual aid spirit.`
        }
    ];

    // Show prompts
    const promptList = document.getElementById('viz-prompt-list');
    promptList.innerHTML = prompts.map(p => `
        <div class="viz-prompt-item">
            <span class="viz-prompt-label">${p.label}</span>
            ${p.prompt}
        </div>
    `).join('');
    document.getElementById('viz-prompts').classList.remove('hidden');

    showVizStatus('Generating images with Gemini... This may take a moment per image.', 'loading');

    // Generate all images
    generateAllImages(prompts, key);
}

async function generateAllImages(prompts, apiKey) {
    const gallery = document.getElementById('viz-images');
    gallery.innerHTML = '';
    document.getElementById('viz-gallery').classList.remove('hidden');

    let successCount = 0;

    for (const promptData of prompts) {
        const card = document.createElement('div');
        card.className = 'viz-image-card';
        card.innerHTML = `
            <div style="height:250px;display:flex;align-items:center;justify-content:center;background:var(--bg-tertiary);color:var(--text-muted);font-family:var(--font-mono);font-size:0.75rem;">
                Generating ${promptData.label}...
            </div>
            <div class="viz-image-label">${promptData.label}</div>
        `;
        gallery.appendChild(card);

        try {
            const model = document.getElementById('viz-model-select').value;
            // Try proxy first (if running proxy.py), fall back to direct API
            const proxyUrl = `/api/gemini/v1beta/models/${model}:generateContent`;
            const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

            let response;
            const requestBody = JSON.stringify({
                contents: [{
                    parts: [{
                        text: promptData.prompt
                    }]
                }],
                generationConfig: {
                    responseModalities: ["TEXT", "IMAGE"]
                }
            });

            try {
                // Try proxy first
                response = await fetch(proxyUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-goog-api-key': apiKey
                    },
                    body: requestBody
                });
            } catch (proxyErr) {
                // Proxy not available, try direct (may fail due to CORS)
                response = await fetch(directUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-goog-api-key': apiKey
                    },
                    body: requestBody
                });
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `API error: ${response.status}`);
            }

            const data = await response.json();

            // Extract image from response
            let imageFound = false;
            if (data.candidates && data.candidates[0]?.content?.parts) {
                for (const part of data.candidates[0].content.parts) {
                    if (part.inlineData) {
                        const imgSrc = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                        card.innerHTML = `
                            <img src="${imgSrc}" alt="${promptData.label}" loading="lazy">
                            <div class="viz-image-label">${promptData.label}</div>
                        `;
                        imageFound = true;
                        successCount++;
                        break;
                    }
                }
            }

            if (!imageFound) {
                // Show text response if no image
                const textParts = data.candidates?.[0]?.content?.parts?.filter(p => p.text) || [];
                const textContent = textParts.map(p => p.text).join('\n');
                card.innerHTML = `
                    <div style="padding:1rem;color:var(--text-secondary);font-size:0.8rem;max-height:250px;overflow-y:auto;">
                        <p style="color:var(--amber);font-family:var(--font-mono);font-size:0.7rem;margin-bottom:0.5rem;">IMAGE NOT RETURNED - TEXT RESPONSE:</p>
                        <p>${textContent || 'No content returned'}</p>
                    </div>
                    <div class="viz-image-label">${promptData.label}</div>
                `;
            }

        } catch (err) {
            card.innerHTML = `
                <div style="padding:1rem;color:var(--red-accent);font-family:var(--font-mono);font-size:0.75rem;">
                    ERROR: ${err.message}
                </div>
                <div class="viz-image-label">${promptData.label} (FAILED)</div>
            `;
        }
    }

    if (successCount === prompts.length) {
        showVizStatus(`All ${successCount} images generated successfully!`, 'success');
    } else if (successCount > 0) {
        showVizStatus(`${successCount}/${prompts.length} images generated. Some may have failed.`, 'loading');
    } else {
        showVizStatus('Image generation failed. Check your API key and model selection. Ensure your API key has access to the selected model. Try gemini-2.5-flash-image if unsure.', 'error');
    }
}

function showVizStatus(msg, type) {
    const el = document.getElementById('viz-status');
    el.textContent = msg;
    el.className = 'viz-status ' + type;
    el.classList.remove('hidden');
}

// ---- CALENDAR EXPORT (.ics) ----
function initCalendarExport() {
    document.getElementById('btn-export-calendar').addEventListener('click', exportCalendar);
}

function exportCalendar() {
    const tasks = generateAllPlantingTasks();
    const logData = getPlantingLogData();

    // Only export undone tasks
    const undoneTasks = tasks.filter(t => !logData[t.id]?.done);

    if (undoneTasks.length === 0) {
        showToast('All tasks are done! Nothing to export.');
        return;
    }

    function formatICSDate(date) {
        const d = new Date(date);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}${m}${day}`;
    }

    function escapeICS(str) {
        return str.replace(/[,;\\]/g, c => '\\' + c).replace(/\n/g, '\\n');
    }

    let ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//GardenSync//Food Not Bombs Canton//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:GardenSync Planting Schedule',
        'X-WR-TIMEZONE:America/New_York'
    ];

    const now = new Date();
    const dtstamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');

    undoneTasks.forEach(task => {
        const startDate = formatICSDate(task.date);
        const endDate = formatICSDate(new Date(task.date.getTime() + 86400000));
        const uid = `${task.id}-${startDate}@gardensync`;

        ics.push(
            'BEGIN:VEVENT',
            `DTSTAMP:${dtstamp}`,
            `DTSTART;VALUE=DATE:${startDate}`,
            `DTEND;VALUE=DATE:${endDate}`,
            `SUMMARY:${escapeICS(task.emoji + ' ' + task.title)}`,
            `DESCRIPTION:${escapeICS(task.detail)}`,
            `UID:${uid}`,
            `CATEGORIES:${task.typeLabel}`,
            'BEGIN:VALARM',
            'TRIGGER:-P1D',
            'ACTION:DISPLAY',
            `DESCRIPTION:Tomorrow: ${escapeICS(task.title)}`,
            'END:VALARM',
            'END:VEVENT'
        );
    });

    ics.push('END:VCALENDAR');

    const blob = new Blob([ics.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gardensync-planting-schedule.ics';
    a.click();
    URL.revokeObjectURL(url);

    showToast(`Exported ${undoneTasks.length} tasks to calendar!`);
}

// ---- HARVEST LOG ----
function initHarvestLog() {
    // Populate plant dropdown
    const plantSelect = document.getElementById('harvest-plant');
    plantSelect.innerHTML = PLANT_LIBRARY
        .filter(p => p.type === 'vegetable' || p.type === 'fruit' || p.type === 'herb')
        .map(p => `<option value="${p.id}">${p.emoji} ${p.name}</option>`)
        .join('');

    // Set default date to today
    document.getElementById('harvest-date').valueAsDate = new Date();

    document.getElementById('btn-log-harvest').addEventListener('click', logHarvest);
}

function getHarvestData() {
    return JSON.parse(localStorage.getItem('gardensync_harvests') || '[]');
}

function saveHarvestData(data) {
    localStorage.setItem('gardensync_harvests', JSON.stringify(data));
}

function logHarvest() {
    const plantId = document.getElementById('harvest-plant').value;
    const bed = document.getElementById('harvest-bed').value;
    const weight = parseFloat(document.getElementById('harvest-weight').value) || 0;
    const date = document.getElementById('harvest-date').value;
    const notes = document.getElementById('harvest-notes').value.trim();
    const donated = document.getElementById('harvest-donated').value;

    if (!plantId || !date) {
        showToast('Please select a plant and date!');
        return;
    }

    const harvests = getHarvestData();
    harvests.unshift({
        id: Date.now(),
        plantId,
        bed: parseInt(bed),
        weight,
        date,
        notes,
        donated,
        timestamp: new Date().toISOString()
    });

    saveHarvestData(harvests);

    // Reset form
    document.getElementById('harvest-weight').value = '';
    document.getElementById('harvest-notes').value = '';
    document.getElementById('harvest-date').valueAsDate = new Date();

    renderHarvestLog();
    showToast('Harvest logged!');
}

function renderHarvestLog() {
    const harvests = getHarvestData();

    // Stats
    const totalCount = harvests.length;
    const totalWeight = harvests.reduce((sum, h) => sum + (h.weight || 0), 0);
    const donatedWeight = harvests
        .filter(h => h.donated === 'yes')
        .reduce((sum, h) => sum + (h.weight || 0), 0)
        + harvests
        .filter(h => h.donated === 'partial')
        .reduce((sum, h) => sum + (h.weight || 0) * 0.5, 0);
    const varieties = new Set(harvests.map(h => h.plantId)).size;

    document.getElementById('harvest-total-count').textContent = totalCount;
    document.getElementById('harvest-total-weight').textContent = totalWeight.toFixed(1) + ' lbs';
    document.getElementById('harvest-total-donated').textContent = donatedWeight.toFixed(1) + ' lbs';
    document.getElementById('harvest-total-varieties').textContent = varieties;

    // Entries
    const container = document.getElementById('harvest-entries');
    if (harvests.length === 0) {
        container.innerHTML = '<div class="harvest-empty">No harvests logged yet. Start picking and logging!</div>';
        return;
    }

    container.innerHTML = harvests.map(h => {
        const plant = PLANT_LIBRARY.find(p => p.id === h.plantId);
        const dateStr = new Date(h.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const donatedLabels = { yes: 'DONATED', partial: 'PARTIAL', no: 'PERSONAL' };
        return `
            <div class="harvest-entry">
                <span class="harvest-emoji">${plant?.emoji || '\u{1F33F}'}</span>
                <div class="harvest-entry-info">
                    <div class="harvest-entry-title">${plant?.name || h.plantId}</div>
                    <div class="harvest-entry-meta">${dateStr} &bull; Bed ${h.bed}</div>
                    ${h.notes ? `<div class="harvest-entry-notes">${h.notes}</div>` : ''}
                </div>
                <div class="harvest-entry-weight">${h.weight > 0 ? h.weight.toFixed(1) + ' lbs' : '--'}</div>
                <span class="harvest-entry-donated ${h.donated}">${donatedLabels[h.donated] || 'N/A'}</span>
                <button class="harvest-entry-delete" data-harvest-id="${h.id}" title="Delete entry">\u00D7</button>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.harvest-entry-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const harvests = getHarvestData().filter(h => h.id !== parseInt(btn.dataset.harvestId));
            saveHarvestData(harvests);
            renderHarvestLog();
        });
    });
}

// ---- PLANTING LOG ----
function initPlantingLog() {
    document.querySelectorAll('[data-plantlog-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-plantlog-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderPlantingLog(btn.dataset.plantlogFilter);
        });
    });

    document.getElementById('btn-plantlog-reset').addEventListener('click', () => {
        if (!confirm('Reset all planting log progress? This cannot be undone.')) return;
        localStorage.removeItem('gardensync_plantlog');
        renderPlantingLog('all');
        showToast('Planting log reset!');
    });
}

function getPlantingLogData() {
    return JSON.parse(localStorage.getItem('gardensync_plantlog') || '{}');
}

function savePlantingLogData(data) {
    localStorage.setItem('gardensync_plantlog', JSON.stringify(data));
}

function generateAllPlantingTasks() {
    const lastFrostDate = new Date(new Date().getFullYear(), 3, 18); // April 18
    const tasks = [];

    PLANT_LIBRARY.forEach(plant => {
        // Indoor seed starting
        if (plant.sowIndoors !== null) {
            const startDate = new Date(lastFrostDate);
            startDate.setDate(startDate.getDate() + plant.sowIndoors * 7);
            tasks.push({
                id: `${plant.id}-seed-indoor`,
                plantId: plant.id,
                plantName: plant.name,
                emoji: plant.emoji,
                type: 'seed-indoor',
                typeLabel: 'START INDOORS',
                title: `Start ${plant.name} seeds indoors`,
                detail: plant.seedStartInstructions,
                date: startDate,
                weekKey: getWeekKey(startDate)
            });
        }

        // Transplant
        if (plant.transplantAfterFrost !== null) {
            const startDate = new Date(lastFrostDate);
            startDate.setDate(startDate.getDate() + plant.transplantAfterFrost * 7);
            tasks.push({
                id: `${plant.id}-transplant`,
                plantId: plant.id,
                plantName: plant.name,
                emoji: plant.emoji,
                type: 'transplant',
                typeLabel: 'TRANSPLANT',
                title: `Transplant ${plant.name} outdoors`,
                detail: plant.careNotes,
                date: startDate,
                weekKey: getWeekKey(startDate)
            });
        }

        // Direct sow
        if (plant.directSow !== null) {
            const startDate = new Date(lastFrostDate);
            startDate.setDate(startDate.getDate() + plant.directSow * 7);
            tasks.push({
                id: `${plant.id}-direct-sow`,
                plantId: plant.id,
                plantName: plant.name,
                emoji: plant.emoji,
                type: 'direct-sow',
                typeLabel: 'DIRECT SOW',
                title: `Direct sow ${plant.name}`,
                detail: plant.seedStartInstructions,
                date: startDate,
                weekKey: getWeekKey(startDate)
            });
        }

        // Harvest
        const growStart = plant.transplantAfterFrost !== null
            ? new Date(lastFrostDate.getTime() + plant.transplantAfterFrost * 7 * 86400000)
            : plant.directSow !== null
                ? new Date(lastFrostDate.getTime() + plant.directSow * 7 * 86400000)
                : plant.sowIndoors !== null
                    ? new Date(lastFrostDate.getTime() + plant.sowIndoors * 7 * 86400000)
                    : null;

        if (growStart) {
            const harvestDate = new Date(growStart);
            harvestDate.setDate(harvestDate.getDate() + plant.daysToHarvest);
            tasks.push({
                id: `${plant.id}-harvest`,
                plantId: plant.id,
                plantName: plant.name,
                emoji: plant.emoji,
                type: 'harvest',
                typeLabel: 'HARVEST',
                title: `Begin harvesting ${plant.name}`,
                detail: plant.careNotes,
                date: harvestDate,
                weekKey: getWeekKey(harvestDate)
            });
        }
    });

    // Sort by date
    tasks.sort((a, b) => a.date - b.date);
    return tasks;
}

function getWeekKey(date) {
    // Get Monday of the week
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
}

function getWeekRange(weekKey) {
    const monday = new Date(weekKey + 'T12:00:00');
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    const opts = { month: 'short', day: 'numeric' };
    return {
        monday,
        sunday,
        label: `${monday.toLocaleDateString('en-US', opts)} \u2013 ${sunday.toLocaleDateString('en-US', opts)}`,
        monthYear: monday.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    };
}

function getCurrentWeekKey() {
    return getWeekKey(new Date());
}

function renderPlantingLog(filter = 'all') {
    const tasks = generateAllPlantingTasks();
    const logData = getPlantingLogData();
    const currentWeekKey = getCurrentWeekKey();
    const now = new Date();

    // Group tasks by week
    const weekMap = {};
    tasks.forEach(task => {
        if (!weekMap[task.weekKey]) weekMap[task.weekKey] = [];
        weekMap[task.weekKey].push(task);
    });

    const sortedWeeks = Object.keys(weekMap).sort();

    // Calculate totals
    const totalTasks = tasks.length;
    const doneTasks = tasks.filter(t => logData[t.id]?.done).length;

    // Update progress bar
    const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
    document.getElementById('plantlog-progress-fill').style.width = pct + '%';
    document.getElementById('plantlog-progress-text').textContent = `${doneTasks} / ${totalTasks} tasks done (${pct}%)`;

    // Current week highlight
    const currentWeekEl = document.getElementById('plantlog-current-week');
    const currentWeekTasks = weekMap[currentWeekKey] || [];
    if (currentWeekTasks.length > 0) {
        const range = getWeekRange(currentWeekKey);
        const cwDone = currentWeekTasks.filter(t => logData[t.id]?.done).length;
        currentWeekEl.innerHTML = `
            <div class="plantlog-current-week-card">
                <h3>\u{1F449} THIS WEEK'S TASKS</h3>
                <div class="plantlog-week-hint">${range.label} &bull; ${cwDone}/${currentWeekTasks.length} complete</div>
                ${currentWeekTasks.map(task => renderPlantlogTask(task, logData)).join('')}
            </div>
        `;
        attachPlantlogCheckHandlers(currentWeekEl, logData, filter);
    } else {
        const range = getWeekRange(currentWeekKey);
        currentWeekEl.innerHTML = `
            <div class="plantlog-current-week-card">
                <h3>\u{1F449} THIS WEEK (${range.label})</h3>
                <div class="plantlog-empty-week">No planting tasks scheduled this week. Check the timeline below for upcoming tasks.</div>
            </div>
        `;
    }

    // Full timeline
    const timelineEl = document.getElementById('plantlog-timeline');
    let timelineHtml = '';

    sortedWeeks.forEach(weekKey => {
        const weekTasks = weekMap[weekKey];
        const range = getWeekRange(weekKey);
        const isCurrent = weekKey === currentWeekKey;
        const isPast = range.sunday < now;
        const weekDone = weekTasks.filter(t => logData[t.id]?.done).length;
        const allDone = weekDone === weekTasks.length;

        // Apply filter
        if (filter === 'done' && weekDone === 0) return;
        if (filter === 'upcoming' && (isPast || isCurrent)) return;
        if (filter === 'overdue') {
            const hasOverdue = weekTasks.some(t => isPast && !logData[t.id]?.done);
            if (!hasOverdue) return;
        }

        let badge = '';
        if (isCurrent) badge = '<span class="plantlog-week-badge current">THIS WEEK</span>';
        else if (isPast && !allDone) badge = '<span class="plantlog-week-badge overdue">OVERDUE</span>';
        else if (!isPast) badge = '<span class="plantlog-week-badge future">UPCOMING</span>';

        const classes = [
            'plantlog-week',
            weekTasks.length > 0 ? 'has-tasks' : '',
            allDone ? 'all-done' : '',
            isCurrent ? 'is-current' : ''
        ].filter(Boolean).join(' ');

        // Collapse past completed weeks and far future weeks by default
        const collapsed = (isPast && allDone) || (!isCurrent && !isPast && range.monday > new Date(now.getTime() + 30 * 86400000));

        timelineHtml += `
            <div class="${classes}" data-week="${weekKey}">
                <div class="plantlog-week-header">
                    <div style="display:flex;align-items:center;gap:0.5rem;">
                        <span class="plantlog-week-title">${allDone ? '\u2705 ' : ''}${range.monthYear.toUpperCase()} \u2014 WEEK OF ${range.label}</span>
                        ${badge}
                    </div>
                    <span class="plantlog-week-progress"><span class="done-count">${weekDone}</span>/${weekTasks.length}</span>
                </div>
                <div class="plantlog-week-body ${collapsed ? 'collapsed' : ''}">
                    ${weekTasks.map(task => {
                        if (filter === 'done' && !logData[task.id]?.done) return '';
                        if (filter === 'overdue' && (logData[task.id]?.done || !isPast)) return '';
                        return renderPlantlogTask(task, logData);
                    }).join('')}
                </div>
            </div>
        `;
    });

    timelineEl.innerHTML = timelineHtml;

    // Attach event handlers
    timelineEl.querySelectorAll('.plantlog-week-header').forEach(header => {
        header.addEventListener('click', () => {
            header.nextElementSibling.classList.toggle('collapsed');
        });
    });

    attachPlantlogCheckHandlers(timelineEl, logData, filter);

    // Scroll current week into view if it exists in timeline
    const currentEl = timelineEl.querySelector('.is-current');
    if (currentEl) {
        setTimeout(() => currentEl.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }
}

function renderPlantlogTask(task, logData) {
    const entry = logData[task.id] || {};
    const done = entry.done || false;
    const completedDate = entry.completedAt ? new Date(entry.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

    return `
        <div class="plantlog-task" data-task-id="${task.id}">
            <div class="plantlog-task-check ${done ? 'done' : ''}" data-task-id="${task.id}">${done ? '\u2714' : ''}</div>
            <div class="plantlog-task-content">
                <div class="plantlog-task-title ${done ? 'done' : ''}">${task.emoji} ${task.title}</div>
                <div class="plantlog-task-subtitle ${done ? 'done' : ''}">${task.detail}</div>
                ${done && completedDate ? `<div class="plantlog-task-date-completed">\u2714 Completed ${completedDate}</div>` : ''}
            </div>
            <span class="plantlog-task-type ${task.type}">${task.typeLabel}</span>
        </div>
    `;
}

function attachPlantlogCheckHandlers(container, logData, filter) {
    container.querySelectorAll('.plantlog-task-check').forEach(chk => {
        chk.addEventListener('click', (e) => {
            e.stopPropagation();
            const taskId = chk.dataset.taskId;
            if (logData[taskId]?.done) {
                delete logData[taskId];
            } else {
                logData[taskId] = {
                    done: true,
                    completedAt: new Date().toISOString()
                };
            }
            savePlantingLogData(logData);
            renderPlantingLog(filter);
        });
    });
}

// ---- LIVE WEATHER (Open-Meteo API) ----
const CANTON_COORDS = { lat: 40.7989, lon: -81.3784 };
const WMO_WEATHER_CODES = {
    0: { desc: 'Clear sky', icon: '\u2600\uFE0F' },
    1: { desc: 'Mainly clear', icon: '\u{1F324}\uFE0F' },
    2: { desc: 'Partly cloudy', icon: '\u26C5' },
    3: { desc: 'Overcast', icon: '\u2601\uFE0F' },
    45: { desc: 'Foggy', icon: '\u{1F32B}\uFE0F' },
    48: { desc: 'Depositing rime fog', icon: '\u{1F32B}\uFE0F' },
    51: { desc: 'Light drizzle', icon: '\u{1F326}\uFE0F' },
    53: { desc: 'Moderate drizzle', icon: '\u{1F326}\uFE0F' },
    55: { desc: 'Dense drizzle', icon: '\u{1F327}\uFE0F' },
    61: { desc: 'Slight rain', icon: '\u{1F327}\uFE0F' },
    63: { desc: 'Moderate rain', icon: '\u{1F327}\uFE0F' },
    65: { desc: 'Heavy rain', icon: '\u{1F327}\uFE0F' },
    66: { desc: 'Light freezing rain', icon: '\u{1F9CA}' },
    67: { desc: 'Heavy freezing rain', icon: '\u{1F9CA}' },
    71: { desc: 'Slight snow', icon: '\u{1F328}\uFE0F' },
    73: { desc: 'Moderate snow', icon: '\u{1F328}\uFE0F' },
    75: { desc: 'Heavy snow', icon: '\u2744\uFE0F' },
    77: { desc: 'Snow grains', icon: '\u{1F328}\uFE0F' },
    80: { desc: 'Slight rain showers', icon: '\u{1F326}\uFE0F' },
    81: { desc: 'Moderate rain showers', icon: '\u{1F327}\uFE0F' },
    82: { desc: 'Violent rain showers', icon: '\u{1F327}\uFE0F' },
    85: { desc: 'Slight snow showers', icon: '\u{1F328}\uFE0F' },
    86: { desc: 'Heavy snow showers', icon: '\u2744\uFE0F' },
    95: { desc: 'Thunderstorm', icon: '\u26C8\uFE0F' },
    96: { desc: 'Thunderstorm w/ slight hail', icon: '\u26C8\uFE0F' },
    99: { desc: 'Thunderstorm w/ heavy hail', icon: '\u26C8\uFE0F' },
};

function getWeatherInfo(code) {
    return WMO_WEATHER_CODES[code] || { desc: 'Unknown', icon: '\u2753' };
}

function getWindDirection(degrees) {
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    return dirs[Math.round(degrees / 22.5) % 16];
}

async function fetchWeather() {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${CANTON_COORDS.lat}&longitude=${CANTON_COORDS.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code,sunrise,sunset&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=America%2FNew_York&forecast_days=7`;

    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Weather API error: ${resp.status}`);
        const data = await resp.json();
        renderWeatherDashboard(data);
        checkFrostAlerts(data);
        // Cache the data
        localStorage.setItem('gardensync_weather_cache', JSON.stringify({
            data,
            timestamp: Date.now()
        }));
    } catch (err) {
        console.error('Weather fetch failed:', err);
        // Try to load cached data
        const cached = localStorage.getItem('gardensync_weather_cache');
        if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            renderWeatherDashboard(data, timestamp);
            checkFrostAlerts(data);
        } else {
            document.getElementById('weather-dashboard').innerHTML = `
                <div class="weather-current-card" style="text-align:center;padding:2rem;">
                    <p style="color:var(--red-accent);font-family:var(--font-mono);font-size:0.8rem;">
                        WEATHER DATA UNAVAILABLE — ${err.message}
                    </p>
                    <button onclick="fetchWeather()" class="tool-btn" style="margin-top:0.75rem;">RETRY</button>
                </div>
            `;
        }
    }
}

function renderWeatherDashboard(data, cachedTimestamp) {
    const current = data.current;
    const daily = data.daily;
    const weather = getWeatherInfo(current.weather_code);
    const DAY_NAMES = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

    let html = `
        <div class="weather-current-row">
            <div class="weather-current-card main-temp">
                <div class="weather-label">CURRENT CONDITIONS</div>
                <div style="display:flex;align-items:center;gap:0.75rem;">
                    <span class="weather-icon-large">${weather.icon}</span>
                    <div>
                        <div class="weather-big-value">${Math.round(current.temperature_2m)}<span class="weather-unit">\u00B0F</span></div>
                        <div class="weather-desc">${weather.desc.toUpperCase()}</div>
                    </div>
                </div>
                <div class="weather-detail-row">
                    <div class="weather-detail"><span>FEELS LIKE</span> ${Math.round(current.apparent_temperature)}\u00B0F</div>
                </div>
            </div>
            <div class="weather-current-card">
                <div class="weather-label">HUMIDITY & WIND</div>
                <div class="weather-detail-row" style="flex-direction:column;gap:0.75rem;margin-top:0.75rem;">
                    <div class="weather-detail" style="font-size:0.85rem;">\u{1F4A7} <span>HUMIDITY</span> ${current.relative_humidity_2m}%</div>
                    <div class="weather-detail" style="font-size:0.85rem;">\u{1F4A8} <span>WIND</span> ${Math.round(current.wind_speed_10m)} mph ${getWindDirection(current.wind_direction_10m)}</div>
                    <div class="weather-detail" style="font-size:0.85rem;">\u{1F327}\uFE0F <span>PRECIP</span> ${current.precipitation}" today</div>
                </div>
            </div>
            <div class="weather-current-card">
                <div class="weather-label">GARDEN STATUS</div>
                <div style="margin-top:0.75rem;">
                    ${getGardenStatus(current, daily)}
                </div>
            </div>
        </div>
        <div class="weather-forecast-card">
            <h3>7-DAY FORECAST</h3>
            <div class="forecast-grid">
                ${daily.time.map((date, i) => {
                    const d = new Date(date + 'T12:00:00');
                    const dayName = i === 0 ? 'TODAY' : DAY_NAMES[d.getDay()];
                    const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
                    const wx = getWeatherInfo(daily.weather_code[i]);
                    const low = Math.round(daily.temperature_2m_min[i]);
                    const high = Math.round(daily.temperature_2m_max[i]);
                    const precipProb = daily.precipitation_probability_max[i];
                    const frost = low <= 32;
                    return `
                        <div class="forecast-day ${frost ? 'frost-day' : ''}">
                            <div class="forecast-day-name">${dayName}</div>
                            <div class="forecast-day-date">${dateStr}</div>
                            <div class="forecast-icon">${wx.icon}</div>
                            <div class="forecast-temps">
                                <span class="forecast-high">${high}\u00B0</span>
                                <span class="forecast-low">${low}\u00B0</span>
                            </div>
                            ${precipProb > 0 ? `<div class="forecast-precip">\u{1F4A7} ${precipProb}%</div>` : ''}
                            ${frost ? `<div class="forecast-frost-warn">\u26A0 FROST</div>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        <div class="weather-updated">
            ${cachedTimestamp ? `CACHED DATA FROM ${new Date(cachedTimestamp).toLocaleTimeString()}` : `UPDATED ${new Date(current.time).toLocaleTimeString()}`}
            <button onclick="fetchWeather()">REFRESH</button>
        </div>
    `;

    document.getElementById('weather-dashboard').innerHTML = html;
}

function getGardenStatus(current, daily) {
    const temp = current.temperature_2m;
    const lines = [];

    // Temperature assessment
    if (temp <= 32) {
        lines.push(`<div style="color:var(--red-accent);font-weight:700;font-size:0.85rem;">\u2744\uFE0F FREEZING \u2014 Protect any exposed plants!</div>`);
    } else if (temp <= 40) {
        lines.push(`<div style="color:var(--amber);font-size:0.85rem;">\u{1F9CA} COLD \u2014 Not safe for tender crops</div>`);
    } else if (temp >= 60 && temp <= 85) {
        lines.push(`<div style="color:var(--emerald);font-size:0.85rem;">\u2705 IDEAL growing temperature</div>`);
    } else if (temp > 85) {
        lines.push(`<div style="color:var(--amber);font-size:0.85rem;">\u{1F525} HOT \u2014 Water deeply, mulch well</div>`);
    } else {
        lines.push(`<div style="color:var(--text-secondary);font-size:0.85rem;">\u{1F321}\uFE0F Cool conditions</div>`);
    }

    // Upcoming frost check
    const frostDays = daily.temperature_2m_min.filter(t => t <= 32).length;
    if (frostDays > 0) {
        lines.push(`<div style="color:var(--red-accent);font-size:0.8rem;margin-top:0.35rem;">\u26A0 ${frostDays} frost night${frostDays > 1 ? 's' : ''} in forecast</div>`);
    } else {
        lines.push(`<div style="color:var(--text-muted);font-size:0.8rem;margin-top:0.35rem;">\u2714 No frost in 7-day forecast</div>`);
    }

    // Growing season check
    const now = new Date();
    const lastFrost = new Date(now.getFullYear(), 3, 18);
    const firstFrost = new Date(now.getFullYear(), 9, 28);
    if (now >= lastFrost && now <= firstFrost) {
        const daysLeft = Math.ceil((firstFrost - now) / (1000 * 60 * 60 * 24));
        lines.push(`<div style="color:var(--emerald);font-size:0.8rem;margin-top:0.35rem;">\u{1F331} Growing season \u2014 ${daysLeft} days until first frost</div>`);
    } else if (now < lastFrost) {
        const daysUntil = Math.ceil((lastFrost - now) / (1000 * 60 * 60 * 24));
        lines.push(`<div style="color:var(--teal);font-size:0.8rem;margin-top:0.35rem;">\u23F3 ${daysUntil} days until growing season starts</div>`);
    } else {
        lines.push(`<div style="color:var(--text-muted);font-size:0.8rem;margin-top:0.35rem;">\u{1F342} Growing season has ended</div>`);
    }

    return lines.join('');
}

function checkFrostAlerts(data) {
    const banner = document.getElementById('frost-alert-banner');
    const daily = data.daily;
    const frostDays = [];

    daily.time.forEach((date, i) => {
        if (daily.temperature_2m_min[i] <= 32) {
            const d = new Date(date + 'T12:00:00');
            frostDays.push({
                date: d,
                low: Math.round(daily.temperature_2m_min[i]),
                dateStr: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
            });
        }
    });

    if (frostDays.length === 0) {
        banner.classList.add('hidden');
        return;
    }

    const now = new Date();
    const lastFrost = new Date(now.getFullYear(), 3, 18);
    const firstFrost = new Date(now.getFullYear(), 9, 28);
    const inGrowingSeason = now >= lastFrost && now <= firstFrost;

    banner.classList.remove('hidden');
    banner.innerHTML = `
        <div class="frost-alert-title">\u26A0\uFE0F FROST ALERT \u2014 ${frostDays.length} NIGHT${frostDays.length > 1 ? 'S' : ''} BELOW FREEZING</div>
        <div class="frost-alert-detail">
            ${frostDays.map(d => `<strong>${d.dateStr}</strong>: Low of ${d.low}\u00B0F`).join(' &bull; ')}
            ${inGrowingSeason ? '<br><strong>ACTION NEEDED:</strong> Cover tender plants (tomatoes, peppers, basil, beans) or harvest before freeze. Hardy crops (kale, spinach, garlic) should be fine.' : ''}
        </div>
    `;
}

function initWeather() {
    // Check cache age - refresh if older than 30 minutes
    const cached = localStorage.getItem('gardensync_weather_cache');
    if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        if (age < 30 * 60 * 1000) {
            renderWeatherDashboard(data, timestamp);
            checkFrostAlerts(data);
            return;
        }
    }
    fetchWeather();
}

// ---- DATA EXPORT / IMPORT ----
function initDataExportImport() {
    document.getElementById('btn-export-data').addEventListener('click', exportAllData);
    document.getElementById('btn-import-data').addEventListener('click', () => {
        document.getElementById('import-file-input').click();
    });
    document.getElementById('import-file-input').addEventListener('change', importAllData);
}

function exportAllData() {
    const exportData = {
        version: 1,
        exportDate: new Date().toISOString(),
        app: 'GardenSync // Food Not Bombs Canton',
        state: {
            beds: state.beds,
            volunteers: state.volunteers,
            bedAssignments: state.bedAssignments,
        },
        plantingLog: getPlantingLogData(),
        harvests: getHarvestData(),
        journal: getJournalData(),
        completedTasks: JSON.parse(localStorage.getItem('gardensync_completed_tasks') || '{}'),
        geminiKey: localStorage.getItem('gardensync_gemini_key') || '',
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gardensync-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('All data exported!');
}

function importAllData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);

            if (!data.version || !data.state) {
                showToast('Invalid backup file!');
                return;
            }

            if (!confirm('Import this backup? This will replace all current data.')) return;

            // Restore state
            if (data.state.beds) {
                state.beds = data.state.beds;
                for (let i = 0; i < 4; i++) renderPlacedPlants(i);
            }
            if (data.state.volunteers) state.volunteers = data.state.volunteers;
            if (data.state.bedAssignments) state.bedAssignments = data.state.bedAssignments;

            // Restore localStorage items
            if (data.plantingLog) savePlantingLogData(data.plantingLog);
            if (data.harvests) saveHarvestData(data.harvests);
            if (data.journal) saveJournalData(data.journal);
            if (data.completedTasks) localStorage.setItem('gardensync_completed_tasks', JSON.stringify(data.completedTasks));
            if (data.geminiKey) {
                localStorage.setItem('gardensync_gemini_key', data.geminiKey);
                state.geminiKey = data.geminiKey;
            }

            saveState();
            updateBedDetails();
            showToast('Data imported successfully!');
        } catch (err) {
            showToast('Error reading backup: ' + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// ---- WINDOW RESIZE FOR CHARTS ----
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        drawRainfallChart();
        drawTempChart();
    }, 250);
});
