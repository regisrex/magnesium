/* Tool schema and system-prompt text for an LLM agent driving the board. */

export const BOARD_COMMANDS = [
  'at', 'move', 'mark', 'back', 'wrap', 'write', 'math', 'label',
  'line', 'arrow', 'box', 'triangle', 'polygon', 'circle', 'arc', 'angle', 'dot',
  'underline', 'pause', 'clear', 'color', 'size'
];

/* JSON Schema for one tool call: an ordered list of drawing commands. Works as an
   Anthropic `input_schema` or an OpenAI `parameters` object. */
export const BOARD_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    commands: {
      type: 'array',
      description: 'Ordered drawing commands, executed one after another with the chalk visibly moving.',
      items: {
        type: 'object',
        properties: {
          op: { type: 'string', enum: BOARD_COMMANDS },
          x: { type: 'number' }, y: { type: 'number' },
          x1: { type: 'number' }, y1: { type: 'number' }, x2: { type: 'number' }, y2: { type: 'number' },
          w: { type: 'number' }, h: { type: 'number' },
          cx: { type: 'number' }, cy: { type: 'number' }, r: { type: 'number' },
          a1: { type: 'number' }, a2: { type: 'number' },
          points: { type: 'array', items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 } },
          text: { type: 'string' }, tex: { type: 'string' }, name: { type: 'string' },
          color: { type: 'string' }, size: { type: 'number' }, ms: { type: 'number' }
        },
        required: ['op']
      }
    }
  },
  required: ['commands']
};

export const BOARD_TOOL = {
  name: 'write_on_board',
  description: 'Write text, LaTeX equations and draw shapes on a chalkboard visible to the student. The chalk moves visibly, so order the commands the way a teacher would write.',
  input_schema: BOARD_TOOL_SCHEMA
};

export function boardSystemPrompt({ width = 1920, height = 1080 } = {}) {
  return `You can write on a chalkboard of ${width} by ${height} pixels (x right, y down, origin top-left) using the write_on_board tool.

Commands (each is an object with "op" plus fields):
- at {x,y}: jump the pen to a position. Text written after this starts here and wraps to this x on new lines.
- move {x,y}: glide the chalk there (visible travel), then write there.
- mark {name} / back {name}: remember the current writing position and later return to it. Use this to leave a paragraph, draw a figure elsewhere, then continue the paragraph.
- wrap {x2}: right edge for line wrapping of text.
- write {text, color?, size?}: handwritten text at the pen; inline math with $...$. Moves to the next line afterwards.
- math {tex, color?, size?}: a display LaTeX equation on its own line. Chemistry with \\ce{...}.
- label {x,y,text}: write a short label at a point (e.g. vertex names, side names) without moving the writing cursor. $...$ allowed.
- line {x1,y1,x2,y2}, arrow {x1,y1,x2,y2}, box {x,y,w,h}, triangle {points:[[x,y],[x,y],[x,y]]}, polygon {points}, circle {cx,cy,r}, arc {cx,cy,r,a1,a2}, dot {x,y}.
- angle {x,y,r,a1,a2,text?}: angle mark at a vertex between directions a1 and a2 in degrees (0 = right, 90 = up, 180 = left, 270 = down). A 90-degree span draws the right-angle square. text (LaTeX) is placed on the bisector.
- underline: underline the last written line. pause {ms}: wait. clear: wipe the board. color {color}: white|yellow|blue|pink|green|#hex. size {size}: pen size in px (default 36).

Text and equations never overwrite existing chalk: they step down to free space. Shapes and labels go exactly where you put them, so check the board state for free regions before drawing a figure. Keep text under about 60 characters per line at size 36. Write like a teacher: heading, then steps, drawing figures beside the text and labelling them, then returning to the text with back.`;
}
