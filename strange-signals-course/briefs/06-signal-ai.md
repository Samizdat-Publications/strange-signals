# Module 6 Brief: SIGNAL AI — The Agent Loop

## Teaching Arc
- **Metaphor:** An air-traffic controller with binoculars and a radio. The controller can't fly the planes — all they can do is *see* (look through the binoculars / read the radar) and *talk* (issue instructions over the radio). Strange Signals' AI is the same: Claude can't touch the map directly. It can only ask to *see* something (a tool that reads state) or *do* something (a tool that changes state), and the browser runs each request and reports back. (NOT a restaurant. NOT a factory. NOT a writer's room. NOT a stage magician. NOT a courtroom.)
- **Opening hook:** "You type 'show me UFO hotspots near military bases in the 90s' into SIGNAL's chat box. Three seconds later the map has zoomed, the year filter is 1990-1999, the military overlay is on, the heatmap is rendering. *You didn't click anything.* What just happened is the most-asked question in modern AI coding — 'how do I let an LLM actually *do things* and not just talk?' — and this module walks you through how Strange Signals answers it in 80 lines of JavaScript."
- **Key insight:** An LLM on its own is a *text machine*. It can only produce text. An "AI agent" is a text machine attached to two things: a **catalog of tools** (JSON schemas describing what the app can do) and a **loop** (the code that receives the LLM's tool requests, runs them, and feeds the results back in). That's it. That's the whole trick. Every "AI agent" is some version of this loop.
- **"Why should I care?":** When AI-coding agents build you an "AI assistant feature," they almost always get the loop wrong — they build one-shot prompts, forget to feed tool results back, or invent fake tools the app doesn't expose. Knowing the five phases of the loop makes you bulletproof when reviewing this kind of code: you know what to check.

## Output file
Write to `strange-signals-course/modules/06-signal-ai.html`.

## Content to cover (5 screens)

**Screen 1 — What SIGNAL can actually do.** Hook paragraph. Then a pattern-cards strip of four representative tool categories (pick one exemplar from each, compressed): 
- **See the map** — "read what's currently visible: bounds, zoom, category counts" (e.g. `get_map_state`)
- **Drive the map** — "change what's visible: pan, zoom, switch view, apply filters" (e.g. `set_view`, `apply_filters`)
- **Analyze** — "run math on the data: correlations, clusters, nearest-neighbor distances" (e.g. `compute_correlation`)
- **Annotate** — "stick pins on the map with notes and colors; draw highlight zones" (e.g. `add_annotation`)

All of these are just functions with JSON-schema descriptions. Claude reads the descriptions and picks which one(s) to call.

**Screen 2 — The five phases of the agent loop.** This is the backbone. Use a **Flow / data flow animation** (see Interactive Elements below) and reinforce it with a compact enumerated list:

1. **Ask** — the user types a message. The browser puts it on the messages array and calls `fetch('https://api.anthropic.com/v1/messages', ...)`.
2. **Think** — Claude reads the full history + the tool catalog. Claude streams back either plain text (if the answer is conversational) or one or more `tool_use` blocks (if it wants to act).
3. **Act** — the browser iterates Claude's tool requests, runs each one (`executeTool(name, input)`), and collects a `tool_result` for each.
4. **Report** — the browser pushes those results back onto the messages array as a new user turn (yes, *user* — that's how tool results are encoded in the API).
5. **Loop** — back to step 2. Claude sees its own request *and* the results, and decides whether to call more tools or finish with a text reply. The loop caps at 10 turns.

Callout: **"Aha! Tool results go back as a 'user' message."** A common bug in hand-rolled loops: developers assume tool results are their own message role. They're not — the API wraps them as the *user* turn that answers the assistant's `tool_use`. Miss this and Claude gets confused about who said what.

**Screen 3 — The fetch call, demystified.** Show Snippet A (`runConversationLoop` core). Translation block focuses on the fetch and the headers.

Key teaching points:
- `fetch('https://api.anthropic.com/v1/messages', ...)` — "No backend. The browser talks to Anthropic directly. That's the `anthropic-dangerous-direct-browser-access` header — it's 'dangerous' because your API key is exposed to anyone who opens DevTools. Fine for a personal tool, never for a shipped product."
- `'x-api-key': apiKey` — "Your key. Stored in `localStorage`. Whoever has the key can spend your credits."
- `body: JSON.stringify(body)` — "The whole conversation, every turn, gets sent every time. Claude has no memory between calls; the messages array *is* the memory."
- `stream: true` — "Stream tokens as they arrive so the UI can show text typing in. We'll ignore the streaming parser; the important thing is what comes out: a list of `content` blocks, either `text` or `tool_use`."

**Screen 4 — The loop body: executing tools.** Show Snippet B (the tool-exec half of the loop). Translation block:
- `var hasToolUse = result.content.some(b => b.type==='tool_use')` — "Did Claude ask for any tools? If not, we're done — break the loop."
- `messages.push({role:'assistant', content: result.content})` — "Save Claude's turn (including the tool requests) back onto the conversation history."
- The inner `for` loop — "For each tool request, call `executeTool(name, input)`. This is the one function that knows how to actually drive the map."
- `toolResults.push({type:'tool_result', tool_use_id: block.id, content: JSON.stringify(toolResult)})` — "Wrap the return value in a `tool_result` block, keyed by the original request's id. Claude uses the id to match 'I asked for X, and here's the answer to X.'"
- `messages.push({role:'user', content: toolResults})` — "The pairing I called out in the Aha callout — tool results go back as a *user* turn, not assistant."
- `saveConversation()` — "Every turn, persist the whole messages array to localStorage. If the user refreshes, the conversation comes back."

Callout: **"Aha! Prompt caching is a 2-line optimization."** Point at `cache_control: {type: 'ephemeral'}` in Snippet A — "This tells Anthropic 'the system prompt and tool list don't change across turns — hold them in cache for ~5 minutes.' After the first call, subsequent calls get charged a fraction of the input tokens for the cached prefix. Tiny code change, large bill savings on multi-turn chats."

**Screen 5 — Quiz.** 3 scenarios on reviewing AI-agent code.

## Code Snippets (pre-extracted — do not re-read the codebase)

**Snippet A — The fetch call with caching + retry (from ai-assistant.js lines 900-949, trimmed).** Use in Screen 3's translation block.

```javascript
async function runConversationLoop(){
  var apiKey=getApiKey();
  var model=getModel();

  // Mark system prompt + last tool as cacheable (ephemeral, ~5 min TTL)
  var cachedSystem=[{type:'text',text:SYSTEM_PROMPT,cache_control:{type:'ephemeral'}}];
  var cachedTools=TOOLS.map(function(t,i){
    return i===TOOLS.length-1 ? Object.assign({},t,{cache_control:{type:'ephemeral'}}) : t;
  });

  for(var turn=0;turn<10;turn++){
    var body={
      model:model, max_tokens:4096,
      system:cachedSystem, tools:cachedTools,
      messages:messages, stream:true
    };

    var resp=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'x-api-key':apiKey,
        'anthropic-version':'2023-06-01',
        'anthropic-dangerous-direct-browser-access':'true'
      },
      body:JSON.stringify(body)
    });
    // (retry on 429/529 with retry-after header omitted for clarity)

    var result=await parseStream(resp);
    // ... continued in Snippet B
  }
}
```

Translation ideas:
- Cache blocks: "The system prompt plus the whole tool catalog rarely change. Marking them ephemeral tells Anthropic: 'Hold onto these between my turns so I only pay for them once per ~5-minute window.'"
- `turn<10` — "Hard cap. An agent can loop up to 10 times per user message — enough for multi-step plans but bounded so a confused model can't run away with your API bill."
- `anthropic-dangerous-direct-browser-access:'true'` — "The opt-in flag that says: yes, we really are calling the API straight from the browser, we know what we're doing. Without it, CORS blocks the request."

**Snippet B — The tool execution half of the loop (from ai-assistant.js lines 956-982).** Use in Screen 4's translation block.

```javascript
var result=await parseStream(resp);
var hasToolUse=result.content.some(function(b){return b.type==='tool_use'});

messages.push({role:'assistant',content:result.content});
saveConversation();

if(!hasToolUse)break;

// Execute tool calls
var toolResults=[];
for(var i=0;i<result.content.length;i++){
  var block=result.content[i];
  if(block.type!=='tool_use')continue;
  try{
    var toolResult=await executeTool(block.name,block.input);
    toolResults.push({type:'tool_result',tool_use_id:block.id,content:JSON.stringify(toolResult)});
  }catch(e){
    toolResults.push({type:'tool_result',tool_use_id:block.id,content:JSON.stringify({error:e.message}),is_error:true});
  }
}

messages.push({role:'user',content:toolResults});
saveConversation();
```

Translation ideas:
- `content: result.content` — "Claude's reply isn't a single string — it's a list of blocks. Text blocks, tool-use blocks, sometimes thinking blocks. The whole list goes back on the messages array unchanged."
- `if(!hasToolUse)break;` — "If Claude's reply was pure text, there's nothing to do — the loop exits and the user sees the answer."
- The try/catch — "If a tool throws, send an error result back to Claude tagged `is_error: true`. Claude can read the error and try a different approach. That's robust-agent behavior — don't let one bad tool call crash the conversation."
- `tool_use_id:block.id` — "Every tool request has an id. Every tool result carries that id back. Claude uses the id to pair them — without it, a chat with three simultaneous tool calls would be scrambled."

## Interactive Elements (all required)

- [x] **Code↔English translation** — Snippets A and B, on Screens 3 and 4 respectively.
- [x] **Group chat animation** — id: `chat-module6-loop`. Five actors: **User**, **Claude**, **The Loop** (the JS runtime), **executeTool**, **The Map**. Suggested messages (8-10 total):
  - User: "Show me UFO sightings near military bases in the 1990s."
  - The Loop: "Forwarding to Claude with the full tool catalog and conversation so far."
  - Claude: "I'll need to set the year filter and turn on the military overlay. Calling `apply_filters({yearFrom:1990,yearTo:1999})` and `toggle_overlay({layer:'military',on:true})`."
  - The Loop: "Two tool requests — executing both."
  - executeTool: "`apply_filters` → success. `toggle_overlay` → success. Here are the JSON results."
  - The Map: "Year filter updated. Military bases now visible. Repainting."
  - The Loop: "Results packaged back as a user turn. Looping to Claude."
  - Claude: "Great — filters applied. Now `set_view({view:'heatmap'})` to show density."
  - The Map: "Heatmap rendering."
  - Claude: "Done. Top-right shows Nevada as the brightest cluster — Area 51 region, 847 reports in range. Anything you want me to drill into?"
  - The Loop: "No more tool requests. Exiting the loop. User sees the final text."
- [x] **Flow / data flow animation** — id: `flow-module6-agent`. 5 actors: **User Message**, **Anthropic API**, **tool_use Block**, **executeTool + Map**, **tool_result Block**. Steps:
  1. Highlight User Message. Label: "User types: 'zoom to the Pacific Northwest.'"
  2. Packet User Message → Anthropic API. Label: "Full history + tool catalog sent via fetch."
  3. Highlight Anthropic API. Label: "Claude picks a tool: `pan_zoom({lat:47, lon:-122, zoom:6})`."
  4. Packet Anthropic API → tool_use Block. Label: "Streamed back as a `tool_use` content block with a unique id."
  5. Packet tool_use Block → executeTool + Map. Label: "Browser runs `executeTool('pan_zoom', {...})`. Leaflet receives the command."
  6. Highlight executeTool + Map. Label: "Map animates to the new position."
  7. Packet executeTool + Map → tool_result Block. Label: "Return value wrapped as `tool_result`, same id."
  8. Packet tool_result Block → Anthropic API. Label: "Sent back as a new user turn. Claude can now see its action succeeded."
  9. Highlight Anthropic API. Label: "Claude replies with text: 'Zoomed in. Five Bigfoot reports visible.' Loop ends."
- [x] **Multiple-choice quiz** — id: `quiz-module6`. 3 questions:
  1. *"AI built you a 'chat with your app' feature. When you test it, the assistant's first reply says 'I called the weather API' — but no API call actually happened, and the app doesn't expose a weather tool. What's the most likely bug?"*
     - A: "Claude hallucinated a tool that doesn't exist — either the tool catalog wasn't passed, or the loop isn't checking for `tool_use` blocks and actually executing them." **(correct)**
     - B: "The weather API is down." (wrong — no real call was made)
     - C: "The message needs a better prompt." (wrong — prompt changes won't help if the loop is broken)
  2. *"Your AI agent runs 1 step, finishes, and the user's follow-up question has no memory of what was just said. What's the most likely cause?"*
     - A: "The messages array isn't being persisted or re-sent — every call starts from a blank history." **(correct)**
     - B: "Claude has amnesia by design." (sort of, but misses the point — the fix is sending the history)
     - C: "Prompt caching is broken." (wrong — caching is an optimization, not the memory mechanism)
  3. *"You open your AI-driven app's network tab and see the same 4KB of system-prompt text sent on every turn, costing you input tokens. What's the fix?"*
     - A: "Rewrite the system prompt." (wrong — it's already as short as it needs to be)
     - B: "Add `cache_control: {type: 'ephemeral'}` to the system prompt and the last tool definition so Anthropic serves them from cache on subsequent turns." **(correct)**
     - C: "Switch to Haiku." (partial — cheaper, but doesn't address the waste)
- [x] **Callout boxes** — two of them:
  - "Aha! Tool results go back as a 'user' message." (Screen 2)
  - "Aha! Prompt caching is a 2-line optimization." (Screen 4)

## Glossary Tooltips (first use)

- **LLM** — "Large Language Model. A neural network that takes text in and produces text out. On its own, can't *do* anything — only write. Agent loops give it hands."
- **agent** — "An LLM wrapped in a loop that can call tools and read their results, so it can take multi-step actions rather than just reply once."
- **tool** — "A function the app exposes to the LLM. Described in JSON with a name, a purpose, and an input schema. The LLM picks tools and supplies arguments; the app runs them."
- **tool_use block** — "A structured part of Claude's reply saying 'I want to call this tool with these inputs.' Has a unique id so the matching result can be paired."
- **tool_result block** — "The paired response — 'here's what happened when you called that tool.' Travels back on the next turn as a *user* role message."
- **tool-use loop** — "The cycle: ask → Claude picks tools → run them → send results back → Claude either calls more or replies. Repeats up to a turn limit."
- **prompt caching** — "Anthropic feature that stores a stable prefix (system prompt, tool list) server-side for ~5 minutes so follow-up turns don't re-charge for the same tokens."
- **streaming** — "The server sends the reply token by token as it's generated, instead of waiting for the whole thing. Makes the UI feel alive."
- **localStorage** — "A small per-site key-value store in the browser. Survives page reloads. Used here to remember the API key and conversation."
- **CORS** — "Cross-Origin Resource Sharing. Browsers block direct API calls to other domains unless the target explicitly allows it. Anthropic requires the `dangerous-direct-browser-access` header to opt in."
- **429 / 529** — "HTTP status codes that mean 'slow down' (rate limited) and 'overloaded.' The app sleeps and retries — honoring the `retry-after` header if one is given."

## Reference Files to Read

- `references/content-philosophy.md` — especially "Show Don't Tell", "Code↔English", "Metaphors First", "Callout Boxes", "Quizzes That Test Application"
- `references/interactive-elements.md` → "Code ↔ English Translation Blocks", "Group Chat Animation", "Message Flow / Data Flow Animation", "Pattern/Feature Cards", "Multiple-Choice Quizzes", "Callout Boxes", "Glossary Tooltips"
- `references/gotchas.md` — full file

## Connections

- **Previous module:** "The Correlation Math" — established that the app can run real science on the data (Pearson r + permutation p-values). Now: put an LLM in front of that science so the user can ask for it in English.
- **Next module:** None — this is the finale. End with a short "outro" paragraph that (a) reminds the learner of the six mental models they now own — pipeline, cast, pipeline flow, rendering tricks, correlation math, agent loop — and (b) connects back to the "why should I care": these aren't Strange-Signals-specific. Every data app AI will ever build for you is some combination of these six patterns. The learner has graduated into being a much sharper steerer.
- **Tone/style notes:**
  - Accent color is vermillion (`#D94F30`).
  - This module has the highest density of new terms (agent, tool, tool_use, caching). Tooltip aggressively; don't assume.
  - Close the whole course with one last callout (optional but recommended): "**Aha! 'AI agents' are just a loop + a tool catalog.** Anytime someone says 'AI agent' and it feels mystical, picture these five steps. That's the entire trick."

## Section wrapper

Your output file must be exactly one `<section class="module" id="module-6">...</section>` block.
