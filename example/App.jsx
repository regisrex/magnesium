import React, { useState } from 'react';
import { ChalkBoard, useChalkBoard, BOARD_TOOL, boardSystemPrompt } from '@regisrex/magnesium';

/* Minimal teaching loop: the student asks, the agent answers on the board.
   `callModel` is whatever you use to reach your model — shown here against a backend route
   that proxies the Anthropic Messages API so the key stays server-side. */
async function callModel(messages, tools, system) {
  const r = await fetch('/api/claude', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2000, system, tools, messages })
  });
  return r.json();
}

export default function App() {
  const board = useChalkBoard();
  const [question, setQuestion] = useState('Explain Pythagoras with a labelled triangle');

  async function teach() {
    await board.clear();
    const system = boardSystemPrompt({ width: 1920, height: 1080 });
    const messages = [{ role: 'user', content: `${question}\n\nBoard state: ${JSON.stringify(board.state())}` }];
    for (let turn = 0; turn < 8; turn++) {
      const res = await callModel(messages, [BOARD_TOOL], system);
      messages.push({ role: 'assistant', content: res.content });
      const uses = res.content.filter(c => c.type === 'tool_use');
      if (!uses.length) break;                        // the agent is done talking to the board
      const results = [];
      for (const u of uses) {
        await board.exec(u.input.commands);           // animates; resolves when the chalk stops
        results.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify({ ok: true, board: board.state() }) });
      }
      messages.push({ role: 'user', content: results });
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 16 }}>
      <ChalkBoard ref={board.ref} board="green" size={36} />
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input value={question} onChange={e => setQuestion(e.target.value)} style={{ flex: 1 }} />
        <button onClick={teach} disabled={board.busy}>{board.busy ? 'Writing…' : 'Ask'}</button>
      </div>
    </div>
  );
}
